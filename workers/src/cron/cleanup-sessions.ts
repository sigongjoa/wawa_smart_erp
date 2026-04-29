/**
 * Cron: 만료된 refresh sessions 정리 (SEC-AUTH-M4)
 *
 * - sessions.expires_at < 현재 시각인 row 삭제
 * - DB 비대화 방지 + DB dump 시 만료 토큰까지 노출되는 표면 축소
 * - 회전된 토큰 (이전 row가 DELETE된 경우)은 이미 정리됨, 이건 자연 만료된 토큰만 처리
 *
 * 1분마다 실행되지만 SELECT-then-DELETE 비용을 줄이기 위해 단일 DELETE만 수행.
 */

import { Env } from '@/types';

export async function cleanupExpiredSessions(env: Env): Promise<{ deleted: number }> {
  const result = await env.DB.prepare(
    `DELETE FROM sessions WHERE expires_at < datetime('now')`
  ).run();

  const deleted = result.meta?.changes ?? 0;
  return { deleted };
}
