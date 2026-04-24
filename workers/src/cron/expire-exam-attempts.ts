/**
 * Cron: 만료된 exam_attempts 자동 처리
 * 설계 문서: docs/EXAM_MAKEUP_TIMER_DESIGN.md §3.3
 *
 * 1분마다 실행 (wrangler.toml triggers.crons)
 * - running/paused 중에서 deadline 지난 것을 expired 로 변경
 * - 동시에 exam_assignments.exam_status='completed' 동기화
 */

import { Env } from '@/types';

export async function expireExpiredAttempts(env: Env): Promise<{ expired: number }> {
  const now = new Date().toISOString();

  // 1) deadline 지난 attempt id 수집 (post-update 로 assignment 동기화 위해)
  const expiredRows = await env.DB.prepare(
    `SELECT id, exam_assignment_id FROM exam_attempts
      WHERE status IN ('running','paused')
        AND datetime(started_at, '+' || (duration_minutes*60 + total_paused_seconds) || ' seconds') < ?`
  ).bind(now).all<{ id: string; exam_assignment_id: string }>();

  const targets = expiredRows.results || [];

  if (targets.length === 0) return { expired: 0 };

  // 2) 일괄 expired 처리
  await env.DB.prepare(
    `UPDATE exam_attempts
        SET status='expired', ended_at=?, updated_at=?
      WHERE status IN ('running','paused')
        AND datetime(started_at, '+' || (duration_minutes*60 + total_paused_seconds) || ' seconds') < ?`
  ).bind(now, now, now).run();

  // 3) exam_assignments.exam_status='completed' 동기화
  for (const row of targets) {
    await env.DB.prepare(
      `UPDATE exam_assignments SET exam_status='completed' WHERE id = ?`
    ).bind(row.exam_assignment_id).run();
  }

  return { expired: targets.length };
}
