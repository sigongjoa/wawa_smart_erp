/**
 * 프로덕션 환경에서 테스트 패턴 이름의 유저 생성을 차단한다.
 *
 * 배경: E2E 테스트가 prod API 를 때려 `테스트_<timestamp>` 같은 계정을
 * `users` 테이블에 쏟아낸 사고(2026-04-08 ~ 04-09, 34 rows)가 있었다.
 * 환경 분리(wrangler.toml, playwright baseURL)로 1차 방어했지만
 * 사람 실수로 prod 자격증명·URL 로 테스트를 돌릴 가능성에 대비한 2차 방어.
 */
const TEST_NAME_PATTERN =
  /^(테스트_|강사_|관리자_|데이터_|중복테스트_|선생님[AB]_|다과목_|라이브테스트_|PIN테스트_|E2E_|첫 번째 선생님$|테스트 선생님$|강사 선생님$|데이터 테스트$|선생님 [AB]$|다과목 선생님$)/;

const TEST_EMAIL_PATTERN = /@academy\.local$|@wawa\.local$/;

export function isProductionEnv(environment: string | undefined): boolean {
  return (environment ?? '').toLowerCase() === 'production';
}

export function looksLikeTestIdentity(name?: string, email?: string): boolean {
  if (name && TEST_NAME_PATTERN.test(name)) return true;
  if (email && TEST_EMAIL_PATTERN.test(email)) return true;
  return false;
}

/**
 * prod 환경에서 테스트 패턴 유저 생성을 시도하면 true 를 반환한다.
 * 핸들러는 이 결과를 보고 `errorResponse('테스트 데이터는 프로덕션에 생성할 수 없습니다', 403)` 같은
 * 응답을 돌려줘야 한다.
 */
export function shouldBlockTestDataInProd(
  environment: string | undefined,
  name?: string,
  email?: string
): boolean {
  return isProductionEnv(environment) && looksLikeTestIdentity(name, email);
}
