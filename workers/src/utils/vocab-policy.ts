/**
 * Vocab Exam 정책 resolve 헬퍼
 *
 * 우선순위: student > teacher > academy > 시스템 기본값
 */
import { executeFirst } from '@/utils/db';

export interface VocabPolicy {
  id: string;
  academy_id: string;
  scope: 'academy' | 'teacher' | 'student';
  scope_id: string | null;

  vocab_count: number;
  context_count: number;
  grammar_count: number;
  writing_enabled: number;
  writing_type: string | null;

  box_filter: string;          // CSV
  source: string;
  textbook_id: string | null;

  time_limit_sec: number;
  cooldown_min: number;
  daily_limit: number;
  active_from: string | null;  // 'HH:MM'
  active_to: string | null;
  word_cooldown_min: number;

  ai_grading: number;
  enabled: number;
}

export const SYSTEM_DEFAULT_POLICY: VocabPolicy = {
  id: 'system-default',
  academy_id: '',
  scope: 'academy',
  scope_id: null,
  vocab_count: 10,
  context_count: 0,
  grammar_count: 0,
  writing_enabled: 0,
  writing_type: null,
  box_filter: '1,2,3,4',
  source: 'student_pool',
  textbook_id: null,
  time_limit_sec: 600,
  cooldown_min: 60,
  daily_limit: 3,
  active_from: null,
  active_to: null,
  word_cooldown_min: 30,
  ai_grading: 1,
  enabled: 1,
};

/**
 * 정책 resolve: student → teacher → academy → 시스템 기본값
 */
export async function resolveVocabPolicy(
  db: D1Database,
  academyId: string,
  teacherId: string | null,
  studentId: string | null
): Promise<VocabPolicy> {
  // 1) student 스코프
  if (studentId) {
    const p = await executeFirst<VocabPolicy>(
      db,
      `SELECT * FROM vocab_exam_policy
        WHERE academy_id = ? AND scope = 'student' AND scope_id = ? AND enabled = 1`,
      [academyId, studentId]
    );
    if (p) return p;
  }
  // 2) teacher 스코프
  if (teacherId) {
    const p = await executeFirst<VocabPolicy>(
      db,
      `SELECT * FROM vocab_exam_policy
        WHERE academy_id = ? AND scope = 'teacher' AND scope_id = ? AND enabled = 1`,
      [academyId, teacherId]
    );
    if (p) return p;
  }
  // 3) academy 스코프
  const p = await executeFirst<VocabPolicy>(
    db,
    `SELECT * FROM vocab_exam_policy
      WHERE academy_id = ? AND scope = 'academy' AND scope_id IS NULL AND enabled = 1`,
    [academyId]
  );
  if (p) return p;

  // 4) 시스템 기본값
  return { ...SYSTEM_DEFAULT_POLICY, academy_id: academyId };
}

export interface AvailabilityCheck {
  ok: boolean;
  reason?: 'disabled' | 'cooldown' | 'daily_limit' | 'inactive_hours';
  retryAt?: string;            // ISO
  message?: string;
  policy: VocabPolicy;
  todayCount: number;
}

/**
 * 응시 가능성 체크 — cooldown / daily_limit / active_hours
 */
export async function checkAvailability(
  db: D1Database,
  policy: VocabPolicy,
  academyId: string,
  studentId: string,
  now: Date = new Date()
): Promise<AvailabilityCheck> {
  // policy.enabled
  if (!policy.enabled) {
    return { ok: false, reason: 'disabled', message: '시험 기능이 비활성 상태입니다', policy, todayCount: 0 };
  }

  // active_from/to (HH:MM)
  if (policy.active_from && policy.active_to) {
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const cur = `${hh}:${mm}`;
    if (cur < policy.active_from || cur > policy.active_to) {
      return {
        ok: false, reason: 'inactive_hours',
        message: `응시 가능 시간: ${policy.active_from} ~ ${policy.active_to}`,
        policy, todayCount: 0,
      };
    }
  }

  // 오늘 응시 횟수 (submitted)
  const todayRow = await executeFirst<{ n: number; last: string | null }>(
    db,
    `SELECT COUNT(*) AS n, MAX(submitted_at) AS last FROM vocab_print_jobs
      WHERE academy_id = ? AND student_id = ?
        AND status = 'submitted' AND date(submitted_at) = date('now')`,
    [academyId, studentId]
  );
  const todayCount = todayRow?.n || 0;
  const lastSubmittedAt = todayRow?.last || null;

  // daily_limit
  if (policy.daily_limit > 0 && todayCount >= policy.daily_limit) {
    // 다음 가용 = 내일 00:00 (active_from 적용)
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return {
      ok: false, reason: 'daily_limit',
      retryAt: tomorrow.toISOString(),
      message: `오늘 응시 한도(${policy.daily_limit}회)를 모두 사용했습니다`,
      policy, todayCount,
    };
  }

  // cooldown
  if (lastSubmittedAt && policy.cooldown_min > 0) {
    const last = new Date(lastSubmittedAt + (lastSubmittedAt.includes('Z') ? '' : 'Z'));
    const next = new Date(last.getTime() + policy.cooldown_min * 60 * 1000);
    if (next > now) {
      return {
        ok: false, reason: 'cooldown',
        retryAt: next.toISOString(),
        message: `다음 시험은 ${formatRemain(next.getTime() - now.getTime())} 후 가능합니다`,
        policy, todayCount,
      };
    }
  }

  return { ok: true, policy, todayCount };
}

function formatRemain(ms: number): string {
  const sec = Math.ceil(ms / 1000);
  if (sec < 60) return `${sec}초`;
  const min = Math.ceil(sec / 60);
  if (min < 60) return `${min}분`;
  const hr = Math.floor(min / 60);
  const rem = min % 60;
  return rem === 0 ? `${hr}시간` : `${hr}시간 ${rem}분`;
}

/**
 * box_filter CSV → number[]
 */
export function parseBoxFilter(csv: string): number[] {
  return csv.split(',').map(s => parseInt(s.trim(), 10)).filter(n => Number.isInteger(n) && n >= 1 && n <= 5);
}
