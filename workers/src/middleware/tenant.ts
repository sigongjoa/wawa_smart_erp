/**
 * 테넌트 스코프 미들웨어
 * 인증된 요청에서 학원 정보를 로드하고 활성 상태를 확인
 */

import { RequestContext, Academy } from '@/types';
import { executeFirst } from '@/utils/db';
import { errorResponse } from '@/utils/response';
import { logger } from '@/utils/logger';

// In-memory tenant 캐시 (isolate별, KV write 폭주 방지)
// 5분 TTL — KV는 1h fallback. 학원 정보 변경 시 academy-handler에서 invalidate 필요.
interface TenantCacheEntry { academy: Academy; expiresAt: number; }
const tenantMemCache: Map<string, TenantCacheEntry> =
  (globalThis as any).__tenantCache ??= new Map();

const MEM_TTL_MS = 5 * 60 * 1000;   // 5분 (in-memory)
const KV_TTL_SEC = 60 * 60;          // 1시간 (KV)

export function invalidateTenantCache(academyId: string) {
  tenantMemCache.delete(academyId);
}

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

  let academy: Academy | null = null;

  // 1차: in-memory 캐시 (KV write 폭주 방지)
  const now = Date.now();
  const memHit = tenantMemCache.get(academyId);
  if (memHit && memHit.expiresAt > now) {
    academy = memHit.academy;
  }

  // 2차: KV 캐시 (1h TTL)
  const cacheKey = `academy:${academyId}:info`;
  if (!academy) {
    try {
      const cached = await context.env.KV.get(cacheKey, 'json');
      if (cached) {
        academy = cached as Academy;
        tenantMemCache.set(academyId, { academy, expiresAt: now + MEM_TTL_MS });
      }
    } catch (err) {
      logger.warn('tenant KV 캐시 읽기 실패', { academyId, error: err instanceof Error ? err.message : String(err) });
    }
  }

  // 3차: D1
  if (!academy) {
    academy = await executeFirst<Academy>(
      context.env.DB,
      'SELECT * FROM academies WHERE id = ? AND is_active = 1',
      [academyId]
    );

    if (academy) {
      tenantMemCache.set(academyId, { academy, expiresAt: now + MEM_TTL_MS });
      try {
        await context.env.KV.put(cacheKey, JSON.stringify(academy), { expirationTtl: KV_TTL_SEC });
      } catch (err) {
        logger.warn('tenant KV 캐시 저장 실패', { academyId, error: err instanceof Error ? err.message : String(err) });
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
