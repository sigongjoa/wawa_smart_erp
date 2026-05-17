/**
 * UC-11 — 강사 코멘트 / AI 틀림 → 학생 알림 message 빌더
 *
 * 실제 push send는 외부 서비스 (Web Push / FCM / APNs).
 * 여기서는 페이로드 빌더 + rate limit 판단만.
 */

const MAX_BODY_LEN = 80;
const RATE_WINDOW_MS = 10 * 60 * 1000;       // 10분
const RATE_THRESHOLD = 3;                    // 같은 학생에게 10분 내 3개 이상이면 차단

export interface NotificationPayload {
  title: string;
  body: string;
  deeplink?: string;
  tag: 'ask-ai-comment' | 'ask-ai-wrong';
}

export function buildCommentNotification(opts: {
  teacher_name: string;
  student_name: string;
  unit: string;
  comment: string;
  conversation_id?: string;
}): NotificationPayload {
  const preview = truncate(opts.comment, MAX_BODY_LEN);
  return {
    title: `${opts.teacher_name} 쌤이 코멘트를 남겼어요`,
    body: `${opts.unit} · "${preview}"`,
    deeplink: opts.conversation_id ? `/ask-ai/conversations/${opts.conversation_id}` : undefined,
    tag: 'ask-ai-comment',
  };
}

export function buildAiWrongWarning(opts: {
  student_name: string;
  teacher_name: string;
  unit: string;
}): NotificationPayload {
  return {
    title: '⚠ AI 답이 틀렸을 수 있어요',
    body: `${opts.teacher_name} 쌤이 ${opts.unit} 답변을 다시 확인하라고 표시했어요.`,
    tag: 'ask-ai-wrong',
  };
}

export function shouldRateLimit(
  recent: Array<{ sent_at: string }>,
  now_iso: string
): boolean {
  const now = new Date(now_iso).getTime();
  const recentInWindow = recent.filter((n) => {
    const t = new Date(n.sent_at).getTime();
    return now - t < RATE_WINDOW_MS;
  });
  return recentInWindow.length >= RATE_THRESHOLD;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + '…';
}
