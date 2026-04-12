/**
 * 인증 컨텍스트 헬퍼
 * requireAuth 이후 안전하게 auth 필드를 꺼내는 유틸
 */
import { RequestContext } from '@/types';

/**
 * 인증된 요청에서 academyId를 안전하게 추출
 * requireAuth() 통과 후 사용해야 함 — auth 없으면 에러
 */
export function getAcademyId(context: RequestContext): string {
  if (!context.auth?.academyId) {
    throw new Error('요청 처리 실패: 인증 정보가 없습니다');
  }
  return context.auth.academyId;
}

/**
 * 인증된 요청에서 userId를 안전하게 추출
 */
export function getUserId(context: RequestContext): string {
  if (!context.auth?.userId) {
    throw new Error('요청 처리 실패: 인증 정보가 없습니다');
  }
  return context.auth.userId;
}
