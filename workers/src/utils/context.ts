/**
 * 인증 컨텍스트 헬퍼
 * requireAuth 이후 안전하게 auth 필드를 꺼내는 유틸
 */
import { RequestContext } from '@/types';

/**
 * 인증된 요청에서 academyId를 안전하게 추출.
 * tenantMiddleware가 context.tenantId를 채운 뒤 호출되면 JWT의 academyId와
 * 일치 여부를 재검증하여 cross-tenant IDOR을 차단한다.
 */
export function getAcademyId(context: RequestContext): string {
  if (!context.auth?.academyId) {
    throw new Error('요청 처리 실패: 인증 정보가 없습니다');
  }
  // tenant middleware가 주입한 tenantId와 불일치하면 차단 (IDOR 방어)
  if (context.tenantId && context.tenantId !== context.auth.academyId) {
    throw new Error('요청 처리 실패: 테넌트 불일치');
  }
  return context.auth.academyId;
}

/**
 * JWT academyId와 tenantId가 일치하는지 명시적으로 검증.
 * 핸들러 진입부에서 방어적으로 호출해 tenant middleware 바이패스를 방지.
 */
export function assertTenantMatch(context: RequestContext): void {
  if (!context.auth?.academyId) {
    throw new Error('요청 처리 실패: 인증 정보가 없습니다');
  }
  if (context.tenantId && context.tenantId !== context.auth.academyId) {
    throw new Error('요청 처리 실패: 테넌트 불일치');
  }
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
