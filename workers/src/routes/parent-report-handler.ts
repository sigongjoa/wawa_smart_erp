/**
 * 학부모 월간 리포트
 *
 * 공개 조회: GET  /api/parent-report/:studentId?token=&month=YYYY-MM
 *   - HMAC 서명 토큰 검증 후 집계 데이터 반환. JWT 불필요(링크 공유).
 *
 * 링크 생성: POST /api/parent-report/:studentId/share   (JWT 필수)
 *   - body: { month: 'YYYY-MM', days?: number }
 *   - returns: { url, token, expires_at }
 *
 * 페이로드: `${studentId}|${month}|${expiresAtMs}` → base64url(payload).base64url(hmac)
 */

import { RequestContext } from '@/types';
import { executeFirst, executeQuery } from '@/utils/db';
import { errorResponse, successResponse, unauthorizedResponse, notFoundResponse } from '@/utils/response';
import { requireAuth } from '@/middleware/auth';
import { getAcademyId, getUserId } from '@/utils/context';

// ─────────────── HMAC 토큰 ───────────────

function b64urlEncode(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlEncodeStr(str: string): string {
  return b64urlEncode(new TextEncoder().encode(str));
}
function b64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad);
  const out = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
  return out;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

async function signToken(studentId: string, month: string, expiresAtMs: number, secret: string): Promise<string> {
  const payload = `${studentId}|${month}|${expiresAtMs}`;
  const key = await hmacKey(secret);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload)));
  return `${b64urlEncodeStr(payload)}.${b64urlEncode(sig)}`;
}

async function verifyToken(
  token: string,
  expectedStudentId: string,
  expectedMonth: string,
  secret: string
): Promise<{ ok: boolean; reason?: string }> {
  const parts = token.split('.');
  if (parts.length !== 2) return { ok: false, reason: 'malformed' };
  let payload: string;
  try {
    payload = new TextDecoder().decode(b64urlDecode(parts[0]));
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  const [sid, month, expStr] = payload.split('|');
  if (!sid || !month || !expStr) return { ok: false, reason: 'malformed' };
  if (sid !== expectedStudentId || month !== expectedMonth) return { ok: false, reason: 'mismatch' };
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || Date.now() > exp) return { ok: false, reason: 'expired' };

  const key = await hmacKey(secret);
  const sig = b64urlDecode(parts[1]);
  const ok = await crypto.subtle.verify('HMAC', key, sig, new TextEncoder().encode(payload));
  return ok ? { ok: true } : { ok: false, reason: 'bad_signature' };
}

// ─────────────── 월 범위 ───────────────

function monthRange(month: string): { start: string; endExclusive: string } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  if (mo < 1 || mo > 12) return null;
  const nextY = mo === 12 ? y + 1 : y;
  const nextM = mo === 12 ? 1 : mo + 1;
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    start: `${y}-${pad(mo)}-01`,
    endExclusive: `${nextY}-${pad(nextM)}-01`,
  };
}

const DAY_KO = ['일', '월', '화', '수', '목', '금', '토'];

function countWeekdaysInRange(start: string, endExclusive: string, dayKo: string): number {
  const s = new Date(start + 'T00:00:00Z');
  const e = new Date(endExclusive + 'T00:00:00Z');
  let count = 0;
  for (let d = new Date(s); d < e; d.setUTCDate(d.getUTCDate() + 1)) {
    if (DAY_KO[d.getUTCDay()] === dayKo) count++;
  }
  return count;
}

// ─────────────── 핸들러 ───────────────

export async function handleParentReport(
  method: string,
  pathname: string,
  request: Request,
  context: RequestContext
): Promise<Response> {
  const db = context.env.DB;
  const url = new URL(request.url);

  const shareMatch = pathname.match(/^\/api\/parent-report\/([^/]+)\/share$/);
  const getMatch = pathname.match(/^\/api\/parent-report\/([^/]+)$/);

  // ─── 링크 발급 (교사 JWT 필요) ───
  if (method === 'POST' && shareMatch) {
    if (!requireAuth(context)) return unauthorizedResponse();
    const studentId = shareMatch[1];
    const academyId = getAcademyId(context);
    const userId = getUserId(context);

    const student = await executeFirst<{ academy_id: string }>(
      db,
      'SELECT academy_id FROM students WHERE id = ?',
      [studentId]
    );
    if (!student || student.academy_id !== academyId) return notFoundResponse();

    const role = context.auth!.role;
    if (role !== 'admin') {
      const owns = await executeFirst<{ n: number }>(
        db,
        'SELECT 1 AS n FROM student_teachers WHERE teacher_id = ? AND student_id = ? LIMIT 1',
        [userId, studentId]
      );
      if (!owns) return errorResponse('담당 학생이 아닙니다', 403);
    }

    const body = (await request.json().catch(() => ({}))) as { month?: string; days?: number };
    const month = body.month || new Date().toISOString().slice(0, 7);
    if (!monthRange(month)) return errorResponse('month는 YYYY-MM 형식이어야 합니다', 400);
    const days = Math.max(1, Math.min(90, Math.round(body.days ?? 14)));
    const expiresAtMs = Date.now() + days * 24 * 3600 * 1000;

    const secret = context.env.JWT_SECRET!;
    const token = await signToken(studentId, month, expiresAtMs, secret);

    const origin = request.headers.get('origin') || '';
    const base = origin || (context.env as any).APP_BASE_URL || '';
    const path = `/#/parent-report/${studentId}?token=${encodeURIComponent(token)}&month=${month}`;
    const fullUrl = base ? `${base}${path}` : path;

    return successResponse({
      url: fullUrl,
      path,
      token,
      month,
      expires_at: new Date(expiresAtMs).toISOString(),
    });
  }

  // ─── 리포트 조회 (토큰 기반 공개) ───
  if (method === 'GET' && getMatch) {
    const studentId = getMatch[1];
    const token = url.searchParams.get('token');
    const month = url.searchParams.get('month');
    if (!token) return errorResponse('token이 필요합니다', 400);
    if (!month) return errorResponse('month가 필요합니다', 400);
    const range = monthRange(month);
    if (!range) return errorResponse('month는 YYYY-MM 형식이어야 합니다', 400);

    const secret = context.env.JWT_SECRET!;
    const verify = await verifyToken(token, studentId, month, secret);
    if (!verify.ok) {
      return errorResponse(
        verify.reason === 'expired' ? '링크가 만료되었습니다' : '유효하지 않은 링크입니다',
        401
      );
    }

    return buildReport(db, studentId, month, range);
  }

  return errorResponse('Not found', 404);
}

// ─────────────── 집계 ───────────────

async function buildReport(
  db: D1Database,
  studentId: string,
  month: string,
  range: { start: string; endExclusive: string }
): Promise<Response> {
  const student = await executeFirst<{
    id: string; name: string; grade: string | null; school: string | null; academy_id: string;
  }>(
    db,
    'SELECT id, name, grade, school, academy_id FROM students WHERE id = ?',
    [studentId]
  );
  if (!student) return notFoundResponse();
  const academyId = student.academy_id;

  // ─ 1) 출석 ─
  const attRows = await executeQuery<{
    subject: string | null; cnt: number; minutes: number; late: number;
  }>(
    db,
    `SELECT subject,
            COUNT(*) AS cnt,
            COALESCE(SUM(net_minutes), 0) AS minutes,
            COALESCE(SUM(was_late), 0) AS late
     FROM attendance_records
     WHERE academy_id = ? AND student_id = ?
       AND date >= ? AND date < ?
     GROUP BY subject`,
    [academyId, studentId, range.start, range.endExclusive]
  );
  const attended = attRows.reduce((s, r) => s + r.cnt, 0);
  const totalMinutes = attRows.reduce((s, r) => s + r.minutes, 0);
  const late = attRows.reduce((s, r) => s + r.late, 0);

  // 예정 수업 수: enrollments의 day 분포를 해당 월 요일 수와 곱함
  const enrolls = await executeQuery<{ day: string; subject: string | null }>(
    db,
    `SELECT day, subject FROM enrollments WHERE student_id = ?`,
    [studentId]
  );
  let scheduled = 0;
  for (const e of enrolls) scheduled += countWeekdaysInRange(range.start, range.endExclusive, e.day);

  // ─ 2) 시험 (학원 정기고사) ─
  const exams = await executeQuery<{
    period_id: string; period_title: string; period_month: string;
    paper_title: string; printed: number; reviewed: number; created_check: number;
    drive_link: string | null; score: number | null;
  }>(
    db,
    `SELECT ep.id AS period_id, ep.title AS period_title, ep.period_month,
            COALESCE(pap.title, '') AS paper_title,
            ea.printed, ea.reviewed, ea.created_check, ea.drive_link, ea.score
     FROM exam_assignments ea
     JOIN exam_periods ep ON ep.id = ea.exam_period_id
     LEFT JOIN exam_papers pap ON pap.id = ea.exam_paper_id
     WHERE ea.academy_id = ? AND ea.student_id = ?
       AND ep.period_month = ?
     ORDER BY ep.period_month, pap.title`,
    [academyId, studentId, month]
  );

  // ─ 3) 진도 (교재별) ─
  const progress = await executeQuery<{
    textbook: string; total_units: number; completed: number; in_progress: number;
    avg_understanding: number | null; recent_unit: string | null; recent_at: string | null;
  }>(
    db,
    `SELECT u.textbook,
            COUNT(u.id) AS total_units,
            SUM(CASE WHEN p.status = 'done' THEN 1 ELSE 0 END) AS completed,
            SUM(CASE WHEN p.status = 'in_progress' THEN 1 ELSE 0 END) AS in_progress,
            AVG(p.understanding) AS avg_understanding,
            (SELECT u2.name FROM student_study_progress p2
               JOIN study_units u2 ON u2.id = p2.unit_id
              WHERE p2.student_id = ? AND u2.textbook = u.textbook
              ORDER BY p2.updated_at DESC LIMIT 1) AS recent_unit,
            (SELECT p2.updated_at FROM student_study_progress p2
               JOIN study_units u2 ON u2.id = p2.unit_id
              WHERE p2.student_id = ? AND u2.textbook = u.textbook
              ORDER BY p2.updated_at DESC LIMIT 1) AS recent_at
     FROM study_units u
     LEFT JOIN student_study_progress p
       ON p.unit_id = u.id AND p.student_id = ?
     WHERE u.academy_id = ? AND u.kind = 'unit'
     GROUP BY u.textbook
     HAVING completed > 0 OR in_progress > 0
     ORDER BY u.textbook`,
    [studentId, studentId, studentId, academyId]
  );

  // ─ 4) 선생님이 준비한 자료 ─
  const assignments = await executeQuery<{
    title: string; kind: string; status: string; due_at: string | null;
    last_submitted_at: string | null; last_reviewed_at: string | null;
    assigned_at: string;
  }>(
    db,
    `SELECT a.title, a.kind, at.status, a.due_at,
            at.last_submitted_at, at.last_reviewed_at, at.assigned_at
     FROM assignment_targets at
     JOIN assignments a ON a.id = at.assignment_id
     WHERE at.academy_id = ? AND at.student_id = ?
       AND (
         (at.assigned_at >= ? AND at.assigned_at < ?) OR
         (at.last_submitted_at >= ? AND at.last_submitted_at < ?) OR
         (a.due_at >= ? AND a.due_at < ?)
       )
     ORDER BY at.assigned_at DESC`,
    [
      academyId, studentId,
      range.start, range.endExclusive,
      range.start, range.endExclusive,
      range.start, range.endExclusive,
    ]
  );

  const printMaterials = await executeQuery<{
    title: string; memo: string | null; status: string; file_url: string | null; created_at: string;
  }>(
    db,
    `SELECT title, memo, status, file_url, created_at
     FROM print_materials
     WHERE student_id = ?
       AND created_at >= ? AND created_at < ?
     ORDER BY created_at DESC`,
    [studentId, range.start, range.endExclusive]
  );

  // ─ 5) 학부모 공유 코멘트 ─
  const notes = await executeQuery<{
    subject: string; category: string; sentiment: string; content: string; created_at: string;
  }>(
    db,
    `SELECT subject, category, sentiment, content, created_at
     FROM student_teacher_notes
     WHERE academy_id = ? AND student_id = ?
       AND visibility = 'parent_share'
       AND created_at >= ? AND created_at < ?
     ORDER BY created_at DESC`,
    [academyId, studentId, range.start, range.endExclusive]
  );

  return successResponse({
    student: {
      id: student.id,
      name: student.name,
      grade: student.grade,
      school: student.school,
    },
    month,
    attendance: {
      scheduled,
      attended,
      late,
      absent: Math.max(0, scheduled - attended),
      total_net_minutes: totalMinutes,
      by_subject: attRows.map((r) => ({
        subject: r.subject,
        count: r.cnt,
        minutes: r.minutes,
      })),
    },
    exams: exams.map((e) => ({
      period_title: e.period_title,
      period_month: e.period_month,
      paper_title: e.paper_title,
      status: e.reviewed ? 'reviewed' : e.printed ? 'printed' : e.created_check ? 'prepared' : 'assigned',
      drive_link: e.drive_link,
      score: e.score,
    })),
    progress: progress.map((p) => ({
      textbook: p.textbook,
      total_units: p.total_units,
      completed: p.completed,
      in_progress: p.in_progress,
      avg_understanding: p.avg_understanding,
      recent_unit: p.recent_unit,
      recent_at: p.recent_at,
    })),
    materials: {
      assignments: assignments.map((a) => ({
        title: a.title,
        kind: a.kind,
        status: a.status,
        due_at: a.due_at,
        assigned_at: a.assigned_at,
        submitted_at: a.last_submitted_at,
        reviewed_at: a.last_reviewed_at,
      })),
      print_materials: printMaterials,
    },
    notes,
  });
}
