/**
 * ID 생성 유틸리티 — 중앙화
 */

/** prefix 없이 UUID 반환 */
export function generateId(): string {
  return crypto.randomUUID();
}

/** prefix 붙인 짧은 ID (prefix-xxxxxxxx) */
export function generatePrefixedId(prefix: string): string {
  const uuid = crypto.randomUUID();
  return `${prefix}-${uuid.split('-')[0]}`;
}
