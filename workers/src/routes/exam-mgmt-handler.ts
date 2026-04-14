/**
 * 정기고사 관리 핸들러
 * 시험 기간 CRUD + 시험지 CRUD + 학생 배정 + 자동배정 + 일괄체크
 */

import { RequestContext } from '@/types';
import { executeQuery, executeFirst, executeInsert, executeUpdate } from '@/utils/db';
import { successResponse, errorResponse, unauthorizedResponse } from '@/utils/response';
import { requireAuth } from '@/middleware/auth';
import { generatePrefixedId } from '@/utils/id';

interface ExamPeriodRow {
  id: string;
  academy_id: string;
  title: string;
  period_month: string;
  status: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface ExamPaperRow {
  id: string;
  exam_period_id: string;
  academy_id: string;
  title: string;
  grade_filter: string | null;
  is_custom: number;
  created_at: string;
}

interface ExamAssignmentRow {
  id: string;
  exam_period_id: string;
  exam_paper_id: string;
  student_id: string;
  academy_id: string;
  created_check: number;
  printed: number;
  reviewed: number;
  drive_link: string | null;
  score: number | null;
  memo: string | null;
  created_at: string;
  student_name?: string;
  student_grade?: string;
  paper_title?: string;
}

export async function handleExamMgmt(
  method: string,
  pathname: string,
  request: Request,
  context: RequestContext
): Promise<Response> {
  if (!requireAuth(context)) return unauthorizedResponse();

  const db = context.env.DB;
  const academyId = context.auth!.academyId;

  // ═══════════════════════════════════════════
  // 시험 기간 (Exam Periods)
  // ═══════════════════════════════════════════

  // GET /api/exam-mgmt — 시험 기간 목록
  if (method === 'GET' && pathname === '/api/exam-mgmt') {
    const rows = await executeQuery<ExamPeriodRow>(
      db,
      `SELECT * FROM exam_periods WHERE academy_id = ? ORDER BY period_month DESC`,
      [academyId]
    );
    return successResponse(rows);
  }

  // POST /api/exam-mgmt — 시험 기간 생성
  if (method === 'POST' && pathname === '/api/exam-mgmt') {
    const body = await request.json() as any;
    const { title, period_month } = body;

    if (!title?.trim() || !period_month?.trim()) {
      return errorResponse('title과 period_month는 필수입니다', 400);
    }

    const id = generatePrefixedId('ep');
    try {
      await executeInsert(db,
        `INSERT INTO exam_periods (id, academy_id, title, period_month, created_by)
         VALUES (?, ?, ?, ?, ?)`,
        [id, academyId, title.trim(), period_month.trim(), context.auth!.userId]
      );
    } catch (e: any) {
      if (e.message?.includes('UNIQUE')) {
        return errorResponse('이미 해당 월의 시험 기간이 존재합니다', 409);
      }
      throw e;
    }

    return successResponse({ id, title, period_month, status: 'preparing' }, 201);
  }

  // PATCH /api/exam-mgmt/:id — 상태 변경
  const periodPatchMatch = pathname.match(/^\/api\/exam-mgmt\/([^/]+)$/);
  if (method === 'PATCH' && periodPatchMatch) {
    const id = periodPatchMatch[1];
    const body = await request.json() as any;

    const existing = await executeFirst<ExamPeriodRow>(
      db, 'SELECT * FROM exam_periods WHERE id = ? AND academy_id = ?', [id, academyId]
    );
    if (!existing) return errorResponse('시험 기간을 찾을 수 없습니다', 404);

    const updates: string[] = [];
    const params: any[] = [];

    if (body.title !== undefined) { updates.push('title = ?'); params.push(body.title.trim()); }
    if (body.status !== undefined) { updates.push('status = ?'); params.push(body.status); }

    if (updates.length === 0) return errorResponse('변경할 필드가 없습니다', 400);

    updates.push("updated_at = datetime('now')");
    params.push(id, academyId);

    await executeUpdate(db,
      `UPDATE exam_periods SET ${updates.join(', ')} WHERE id = ? AND academy_id = ?`,
      params
    );
    return successResponse({ success: true });
  }

  // DELETE /api/exam-mgmt/:id — 시험 기간 삭제 (CASCADE)
  const periodDeleteMatch = pathname.match(/^\/api\/exam-mgmt\/([^/]+)$/);
  if (method === 'DELETE' && periodDeleteMatch) {
    const id = periodDeleteMatch[1];

    const existing = await executeFirst<ExamPeriodRow>(
      db, 'SELECT id FROM exam_periods WHERE id = ? AND academy_id = ?', [id, academyId]
    );
    if (!existing) return errorResponse('시험 기간을 찾을 수 없습니다', 404);

    // CASCADE로 papers, assignments도 삭제됨
    await executeUpdate(db, 'DELETE FROM exam_periods WHERE id = ?', [id]);
    return successResponse({ success: true });
  }

  // ═══════════════════════════════════════════
  // 시험지 (Exam Papers)
  // ═══════════════════════════════════════════

  // GET /api/exam-mgmt/:periodId/papers
  const papersGetMatch = pathname.match(/^\/api\/exam-mgmt\/([^/]+)\/papers$/);
  if (method === 'GET' && papersGetMatch) {
    const periodId = papersGetMatch[1];
    const rows = await executeQuery<ExamPaperRow>(
      db,
      `SELECT * FROM exam_papers WHERE exam_period_id = ? AND academy_id = ? ORDER BY grade_filter, title`,
      [periodId, academyId]
    );
    return successResponse(rows);
  }

  // POST /api/exam-mgmt/:periodId/papers — 시험지 등록
  const papersPostMatch = pathname.match(/^\/api\/exam-mgmt\/([^/]+)\/papers$/);
  if (method === 'POST' && papersPostMatch) {
    const periodId = papersPostMatch[1];
    const body = await request.json() as any;
    const { title, grade_filter, is_custom } = body;

    if (!title?.trim()) return errorResponse('title은 필수입니다', 400);

    // 시험 기간 존재 확인
    const period = await executeFirst<ExamPeriodRow>(
      db, 'SELECT id FROM exam_periods WHERE id = ? AND academy_id = ?', [periodId, academyId]
    );
    if (!period) return errorResponse('시험 기간을 찾을 수 없습니다', 404);

    const id = generatePrefixedId('epaper');
    await executeInsert(db,
      `INSERT INTO exam_papers (id, exam_period_id, academy_id, title, grade_filter, is_custom)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, periodId, academyId, title.trim(), grade_filter || null, is_custom ? 1 : 0]
    );

    return successResponse({ id, title, grade_filter, is_custom: is_custom ? 1 : 0 }, 201);
  }

  // DELETE /api/exam-mgmt/:periodId/papers/:id
  const paperDeleteMatch = pathname.match(/^\/api\/exam-mgmt\/([^/]+)\/papers\/([^/]+)$/);
  if (method === 'DELETE' && paperDeleteMatch) {
    const [, periodId, paperId] = paperDeleteMatch;

    const existing = await executeFirst<ExamPaperRow>(
      db, 'SELECT id FROM exam_papers WHERE id = ? AND exam_period_id = ? AND academy_id = ?',
      [paperId, periodId, academyId]
    );
    if (!existing) return errorResponse('시험지를 찾을 수 없습니다', 404);

    await executeUpdate(db, 'DELETE FROM exam_papers WHERE id = ?', [paperId]);
    return successResponse({ success: true });
  }

  // ═══════════════════════════════════════════
  // 배정 (Assignments)
  // ═══════════════════════════════════════════

  // GET /api/exam-mgmt/:periodId/assignments — 배정 현황 (학생+시험지 조인)
  const assignGetMatch = pathname.match(/^\/api\/exam-mgmt\/([^/]+)\/assignments$/);
  if (method === 'GET' && assignGetMatch) {
    const periodId = assignGetMatch[1];
    const rows = await executeQuery<ExamAssignmentRow>(
      db,
      `SELECT a.*, s.name as student_name, s.grade as student_grade, p.title as paper_title
       FROM exam_assignments a
       JOIN gacha_students s ON s.id = a.student_id
       JOIN exam_papers p ON p.id = a.exam_paper_id
       WHERE a.exam_period_id = ? AND a.academy_id = ?
       ORDER BY s.grade, s.name`,
      [periodId, academyId]
    );
    return successResponse(rows);
  }

  // POST /api/exam-mgmt/:periodId/auto-assign — 전체 학생 자동 배정
  // 시험지가 없으면 학년별로 자동 생성 후 전원 배정
  const autoAssignMatch = pathname.match(/^\/api\/exam-mgmt\/([^/]+)\/auto-assign$/);
  if (method === 'POST' && autoAssignMatch) {
    const periodId = autoAssignMatch[1];

    // 시험 기간 확인
    const period = await executeFirst<ExamPeriodRow>(
      db, 'SELECT id, title FROM exam_periods WHERE id = ? AND academy_id = ?', [periodId, academyId]
    );
    if (!period) return errorResponse('시험 기간을 찾을 수 없습니다', 404);

    // 학원 학생 목록
    const students = await executeQuery<{ id: string; name: string; grade: string }>(
      db,
      `SELECT id, name, grade FROM gacha_students WHERE academy_id = ? AND status = 'active'`,
      [academyId]
    );

    // 기존 시험지 로드
    let papers = await executeQuery<ExamPaperRow>(
      db,
      `SELECT * FROM exam_papers WHERE exam_period_id = ? AND academy_id = ? AND is_custom = 0`,
      [periodId, academyId]
    );

    // 학년별 시험지가 없으면 자동 생성
    const existingGrades = new Set(papers.map(p => p.grade_filter).filter(Boolean));
    const studentGrades = [...new Set(students.map(s => s.grade).filter(Boolean))];
    const newPapers: ExamPaperRow[] = [];

    for (const grade of studentGrades) {
      if (!existingGrades.has(grade)) {
        const paperId = generatePrefixedId('epaper');
        await executeInsert(db,
          `INSERT INTO exam_papers (id, exam_period_id, academy_id, title, grade_filter, is_custom)
           VALUES (?, ?, ?, ?, ?, 0)`,
          [paperId, periodId, academyId, `${grade} 정기고사`, grade]
        );
        newPapers.push({ id: paperId, exam_period_id: periodId, academy_id: academyId, title: `${grade} 정기고사`, grade_filter: grade, is_custom: 0, created_at: '' });
      }
    }

    // 전체 시험지 목록 갱신
    papers = [...papers, ...newPapers];
    const gradeToPageMap = new Map(papers.map(p => [p.grade_filter, p.id]));

    // 이미 배정된 학생 ID
    const existing = await executeQuery<{ student_id: string }>(
      db,
      `SELECT student_id FROM exam_assignments WHERE exam_period_id = ? AND academy_id = ?`,
      [periodId, academyId]
    );
    const assignedSet = new Set(existing.map(e => e.student_id));

    let created = 0;
    for (const student of students) {
      if (assignedSet.has(student.id)) continue;

      const paperId = gradeToPageMap.get(student.grade);
      if (!paperId) continue;

      const id = generatePrefixedId('eassign');
      await executeInsert(db,
        `INSERT INTO exam_assignments (id, exam_period_id, exam_paper_id, student_id, academy_id)
         VALUES (?, ?, ?, ?, ?)`,
        [id, periodId, paperId, student.id, academyId]
      );
      created++;
    }

    return successResponse({ created, total: students.length, papers_created: newPapers.length });
  }

  // POST /api/exam-mgmt/:periodId/assign — 수동 배정
  const manualAssignMatch = pathname.match(/^\/api\/exam-mgmt\/([^/]+)\/assign$/);
  if (method === 'POST' && manualAssignMatch) {
    const periodId = manualAssignMatch[1];
    const body = await request.json() as any;
    const { student_id, exam_paper_id } = body;

    if (!student_id || !exam_paper_id) {
      return errorResponse('student_id와 exam_paper_id는 필수입니다', 400);
    }

    const id = generatePrefixedId('eassign');
    try {
      await executeInsert(db,
        `INSERT INTO exam_assignments (id, exam_period_id, exam_paper_id, student_id, academy_id)
         VALUES (?, ?, ?, ?, ?)`,
        [id, periodId, exam_paper_id, student_id, academyId]
      );
    } catch (e: any) {
      if (e.message?.includes('UNIQUE')) {
        return errorResponse('이미 배정된 학생입니다', 409);
      }
      throw e;
    }

    return successResponse({ id }, 201);
  }

  // PATCH /api/exam-mgmt/:periodId/assignments/:id — 체크 업데이트
  const assignPatchMatch = pathname.match(/^\/api\/exam-mgmt\/([^/]+)\/assignments\/([^/]+)$/);
  if (method === 'PATCH' && assignPatchMatch) {
    const [, , assignId] = assignPatchMatch;
    const body = await request.json() as any;

    const existing = await executeFirst<ExamAssignmentRow>(
      db, 'SELECT id FROM exam_assignments WHERE id = ? AND academy_id = ?', [assignId, academyId]
    );
    if (!existing) return errorResponse('배정을 찾을 수 없습니다', 404);

    const updates: string[] = [];
    const params: any[] = [];

    if (body.created_check !== undefined) { updates.push('created_check = ?'); params.push(body.created_check ? 1 : 0); }
    if (body.printed !== undefined) { updates.push('printed = ?'); params.push(body.printed ? 1 : 0); }
    if (body.reviewed !== undefined) { updates.push('reviewed = ?'); params.push(body.reviewed ? 1 : 0); }
    if (body.drive_link !== undefined) { updates.push('drive_link = ?'); params.push(body.drive_link || null); }
    if (body.score !== undefined) { updates.push('score = ?'); params.push(body.score); }
    if (body.memo !== undefined) { updates.push('memo = ?'); params.push(body.memo || null); }

    if (updates.length === 0) return errorResponse('변경할 필드가 없습니다', 400);

    params.push(assignId);
    await executeUpdate(db,
      `UPDATE exam_assignments SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    return successResponse({ success: true });
  }

  // POST /api/exam-mgmt/:periodId/bulk-check — 일괄 체크
  const bulkCheckMatch = pathname.match(/^\/api\/exam-mgmt\/([^/]+)\/bulk-check$/);
  if (method === 'POST' && bulkCheckMatch) {
    const periodId = bulkCheckMatch[1];
    const body = await request.json() as any;
    const { field, value } = body;

    const allowedFields = ['created_check', 'printed', 'reviewed'];
    if (!allowedFields.includes(field)) {
      return errorResponse('field는 created_check, printed, reviewed 중 하나여야 합니다', 400);
    }

    await executeUpdate(db,
      `UPDATE exam_assignments SET ${field} = ? WHERE exam_period_id = ? AND academy_id = ?`,
      [value ? 1 : 0, periodId, academyId]
    );

    return successResponse({ success: true });
  }

  // DELETE /api/exam-mgmt/:periodId/assignments/:id — 배정 삭제
  const assignDeleteMatch = pathname.match(/^\/api\/exam-mgmt\/([^/]+)\/assignments\/([^/]+)$/);
  if (method === 'DELETE' && assignDeleteMatch) {
    const [, , assignId] = assignDeleteMatch;

    const existing = await executeFirst<ExamAssignmentRow>(
      db, 'SELECT id FROM exam_assignments WHERE id = ? AND academy_id = ?', [assignId, academyId]
    );
    if (!existing) return errorResponse('배정을 찾을 수 없습니다', 404);

    await executeUpdate(db, 'DELETE FROM exam_assignments WHERE id = ?', [assignId]);
    return successResponse({ success: true });
  }

  return errorResponse('Not found', 404);
}
