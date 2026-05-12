/**
 * Notification 생성 헬퍼.
 * 호출 측에서 createNotification(...) 한 줄로 INSERT + 캐시 무효화까지 처리.
 *
 * recipient_user_id 우선. NULL 이면 recipient_role 로 broadcast (academy 내 매칭되는 사용자 전체).
 * read 상태는 글로벌 — 한 명이 처리하면 모두 read.
 */
import { generatePrefixedId } from '@/utils/id';

type RecipientRole = 'all_teachers' | 'admin' | 'instructor' | 'student';

export interface CreateNotificationParams {
  academy_id: string;
  recipient_user_id?: string | null;
  recipient_role?: RecipientRole | null;
  type: string;
  title: string;
  body?: string | null;
  link?: string | null;
  payload?: Record<string, unknown> | null;
  expires_in_days?: number;
}

export async function createNotification(
  db: D1Database,
  kv: KVNamespace | null,
  params: CreateNotificationParams,
): Promise<string> {
  const id = generatePrefixedId('notif');
  const recipient_user_id = params.recipient_user_id ?? null;
  const recipient_role = params.recipient_role ?? (recipient_user_id ? null : 'all_teachers');
  const expires_at = params.expires_in_days
    ? new Date(Date.now() + params.expires_in_days * 86400_000).toISOString()
    : null;

  await db
    .prepare(
      `INSERT INTO notifications
        (id, academy_id, recipient_user_id, recipient_role, type, title, body, link, payload, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    )
    .bind(
      id,
      params.academy_id,
      recipient_user_id,
      recipient_role,
      params.type,
      params.title,
      params.body ?? null,
      params.link ?? null,
      params.payload ? JSON.stringify(params.payload) : null,
      expires_at,
    )
    .run();

  // unread-count 캐시 invalidate — 학원 전체 단위 (per-user 캐시는 별도)
  if (kv) {
    try {
      await kv.delete(`notif:unread:${params.academy_id}`);
    } catch { /* ignore */ }
  }

  return id;
}

/**
 * payload 의 특정 키 값으로 매칭되는 알림을 read 처리.
 * 예: 가입 요청 처리 시 그 request_id 와 연결된 broadcast 알림을 read.
 */
export async function markNotificationsReadByPayloadKey(
  db: D1Database,
  kv: KVNamespace | null,
  params: {
    academy_id: string;
    type: string;
    payload_key: string;
    payload_value: string;
  },
): Promise<number> {
  const result = await db
    .prepare(
      `UPDATE notifications
       SET is_read = 1, read_at = datetime('now')
       WHERE academy_id = ? AND type = ? AND is_read = 0
         AND json_extract(payload, '$.' || ?) = ?`,
    )
    .bind(params.academy_id, params.type, params.payload_key, params.payload_value)
    .run();

  if (kv) {
    try {
      await kv.delete(`notif:unread:${params.academy_id}`);
    } catch { /* ignore */ }
  }
  return result.meta.changes ?? 0;
}
