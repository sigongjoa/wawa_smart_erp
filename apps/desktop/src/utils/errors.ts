/** unknown 에러에서 사용자에게 보여줄 메시지를 안전하게 추출. */
export function errorMessage(e: unknown, fallback: string = '오류가 발생했습니다'): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  return fallback;
}
