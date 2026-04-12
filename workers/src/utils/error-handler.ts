/**
 * 공통 라우트 에러 핸들러
 * 모든 라우트 핸들러에서 반복되는 catch 로직을 통합
 */
import { errorResponse } from '@/utils/response';
import { logger } from '@/utils/logger';

/**
 * 라우트 핸들러의 catch 블록에서 사용하는 공통 에러 처리
 * - 입력 검증 / 요청 처리 에러 → 400
 * - 그 외 → 500
 */
export function handleRouteError(
  error: unknown,
  context: string,
  options?: { ipAddress?: string }
): Response {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';

  if (errorMessage.includes('입력 검증') || errorMessage.includes('요청 처리')) {
    logger.warn(`${context} 검증 오류`, { error: errorMessage, ...options });
    return errorResponse(errorMessage, 400);
  }

  logger.error(
    `${context} 중 오류`,
    error instanceof Error ? error : new Error(String(error)),
    options
  );
  return errorResponse(`${context}에 실패했습니다`, 500);
}
