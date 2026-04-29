/**
 * 공통 입력 위생화 헬퍼.
 *
 * 22 라운드의 보안 패치에서 거의 모든 핸들러가 동일한 sanitizeText/sanitizeNullable
 * 함수를 복사해 사용했음. 회귀 위험을 줄이기 위해 단일 모듈로 추출.
 *
 * 정책: C0/C1 제어문자 제거 + trim. 길이 캡은 호출 측에서 max 인자로 지정.
 *   - 보존: \t (0x09), \n (0x0A), \r (0x0D)
 *   - 제거: 그 외 0x00-0x1F + 0x7F
 *
 * 사용 패턴:
 *   sanitizeText(input, 200)              // 빈 문자열 반환 가능
 *   sanitizeNullable(input, 2000)         // 빈 → null 정규화
 *   sanitizeRequired(input, 'title', 100) // 빈 시 throw
 */

// eslint-disable-next-line no-control-regex
const CONTROL_CHAR_RE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

/**
 * 텍스트 위생화 — C0/C1 제어문자 제거 + trim. max가 지정되면 길이 캡.
 * 비-string 입력은 빈 문자열 반환.
 */
export function sanitizeText(v: unknown, max?: number): string {
  if (typeof v !== 'string') return '';
  const cleaned = v.replace(CONTROL_CHAR_RE, '').trim();
  return max !== undefined ? cleaned.slice(0, max) : cleaned;
}

/**
 * sanitizeText 결과가 빈 문자열이면 null 반환 (DB nullable 컬럼용).
 */
export function sanitizeNullable(v: unknown, max?: number): string | null {
  const cleaned = sanitizeText(v, max);
  return cleaned === '' ? null : cleaned;
}

/**
 * 필수 필드용 — sanitize 후 빈 값이면 Error 던짐.
 * 핸들러는 이 Error를 catch해서 400 응답으로 변환.
 */
export function sanitizeRequired(v: unknown, fieldName: string, max?: number): string {
  const cleaned = sanitizeText(v, max);
  if (!cleaned) {
    throw new Error(`${fieldName}는 필수입니다`);
  }
  return cleaned;
}

/**
 * ID 형식 검증 — 영숫자 + 하이픈/언더스코어, 64자 이내.
 * cross-tenant 변조 + path traversal 방어용 ID 화이트리스트.
 */
const ID_REGEX = /^[a-zA-Z0-9_-]+$/;
export function isValidId(v: unknown, maxLen: number = 64): v is string {
  return typeof v === 'string' && v.length > 0 && v.length <= maxLen && ID_REGEX.test(v);
}
