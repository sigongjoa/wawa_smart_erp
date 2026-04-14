/**
 * 테넌트 스코프 미들웨어
 * 인증된 요청에서 학원 정보를 로드하고 활성 상태를 확인
 */

import { RequestContext, Academy } from '@/types';
import { executeFirst } from '@/utils/db';
import { errorResponse } from '@/utils/response';

/**
 * 인증된 요청에 테넌트(학원) 정보를 주입
 * - JWT의 academyId로 학원 조회
 * - 비활성 학원이면 403 반환
 * - context.tenantId, context.academy 설정
 */
export async function tenantMiddleware(
  context: RequestContext
): Promise<RequestContext | Response> {
  const academyId = context.auth?.academyId;

  if (!academyId) {
    return errorResponse('학원 정보가 없습니다', 403);
  }

  // KV 캐시 확인 (5분 TTL)
  const cacheKey = `academy:${academyId}:info`;
  let academy: Academy | null = null;

  try {
    const cached = await context.env.KV.get(cacheKey, 'json');
    if (cached) {
      academy = cached as Academy;
    }
  } catch {
    // 캐시 실패는 무시
  }

  if (!academy) {
    academy = await executeFirst<Academy>(
      context.env.DB,
      'SELECT * FROM academies WHERE id = ? AND is_active = 1',
      [academyId]
    );

    if (academy) {
      try {
        await context.env.KV.put(cacheKey, JSON.stringify(academy), { expirationTtl: 300 });
      } catch {
        // 캐시 저장 실패는 무시
      }
    }
  }

  if (!academy) {
    return errorResponse('비활성화된 학원이거나 존재하지 않습니다', 403);
  }

  // 만료일 체크
  if (academy.expires_at && new Date(academy.expires_at) < new Date()) {
    return errorResponse('학원 이용 기간이 만료되었습니다. 요금제를 갱신해주세요.', 403);
  }

  context.tenantId = academyId;
  context.academy = academy;
  return context;
}

/**
 * slug로 학원 정보 조회 (로그인 등 공개 라우트용)
 */
export async function resolveAcademyBySlug(
  db: D1Database,
  slug: string
): Promise<Academy | null> {
  return executeFirst<Academy>(
    db,
    'SELECT * FROM academies WHERE slug = ? AND is_active = 1',
    [slug]
  );
}
