/**
 * vine-flywheel 신호 payload — kind별 화이트리스트.
 * 허용 필드만 통과(자유텍스트·실명·연락처 등 PII 자동 차단). PIPA 컴플라이언스.
 * 설계: vine-flywheel/docs/design/architecture.md §2.4 · cloudflare-integration.md §3.2
 */
type FieldType = 'string' | 'number' | 'boolean';

const SCHEMAS: Record<string, Record<string, FieldType>> = {
  review:       { card_id: 'string', result: 'string', box_from: 'number', box_to: 'number', concept: 'string' },
  wrong_answer: { kid: 'string', type: 'string', lv: 'string', unit: 'string', n: 'number' },
  result:       { kid: 'string', unit: 'string', difficulty: 'string', role: 'string', correct: 'boolean' },
  submission:   { ir_slug: 'string', subject: 'string', stage: 'string' },
  activity:     { kind: 'string', subject: 'string', topic: 'string', grade: 'number' },
  attendance:   { net_minutes: 'number', status: 'string' },
  grade:        { exam_id: 'string', score: 'number' },
  consult:      { category: 'string', sentiment: 'string' },
  mastery:      { concept: 'string', box: 'number' },
  // RS 피드백 루프 — 학생이 추천 카드에 한 행동(shown|clicked|completed|dismissed). 플라이휠 닫기.
  recommendation_action: { item_id: 'string', action: 'string' },
  // 관리쌤(휴먼 동기) 개입 씨앗 — 강사 override 시 적재(assign|reject|boost|nudge|praise|call|deadline|reward).
  intervention:          { lever: 'string', target_item: 'string' },
};

export const SIGNAL_KINDS = Object.keys(SCHEMAS);

/** payload가 kind 스키마에 맞으면 null, 아니면 거부 사유 문자열. */
export function validateSignalPayload(kind: string, payload: unknown): string | null {
  const spec = SCHEMAS[kind];
  if (!spec) return `미지원 kind '${kind}'`;
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) return 'payload는 객체여야 함';
  const p = payload as Record<string, unknown>;
  const MAX_STR = 200; // [P2] 문자열 값 길이 캡 (남용·과대 payload 방지)
  for (const k of Object.keys(p)) {
    if (!(k in spec)) return `허용 안 된 필드 '${k}' (PII 위험·차단)`;
    if (typeof p[k] !== spec[k]) return `'${k}' 타입 불일치(${spec[k]} 기대)`;
    if (spec[k] === 'string' && (p[k] as string).length > MAX_STR) return `'${k}' 길이 초과(<=${MAX_STR})`;
  }
  return null;
}
