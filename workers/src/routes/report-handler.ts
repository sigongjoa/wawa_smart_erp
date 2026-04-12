/**
 * 보고서 라우트 핸들러
 */

import { RequestContext } from '@/types';
import { errorResponse, successResponse, unauthorizedResponse } from '@/utils/response';
import { executeFirst, executeInsert, executeUpdate } from '@/utils/db';
import { requireAuth, requireRole } from '@/middleware/auth';
import { logger } from '@/utils/logger';
import { getAcademyId } from '@/utils/context';
import { handleRouteError } from '@/utils/error-handler';
import { z } from 'zod';

// ==================== 스키마 ====================
const SendConfigSchema = z.object({
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '시작일은 YYYY-MM-DD 형식이어야 합니다'),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '종료일은 YYYY-MM-DD 형식이어야 합니다'),
});

type SendConfigInput = z.infer<typeof SendConfigSchema>;

// ==================== 헬퍼 함수 ====================

function generateId(prefix: string): string {
  const uuid = crypto.randomUUID();
  return `${prefix}-${uuid.split('-')[0]}`;
}

async function parseSendConfigInput(request: Request): Promise<SendConfigInput> {
  try {
    const body = await request.json() as any;
    return SendConfigSchema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const message = error.errors.map(e => e.message).join(', ');
      throw new Error(`입력 검증 오류: ${message}`);
    }
    throw new Error('요청 처리 오류: 유효한 JSON이 필요합니다');
  }
}

// ==================== ReportConfig 핸들러 ====================

/**
 * POST /api/report/send-config - 전송주간 설정 저장
 */
async function handleSetSendConfig(
  request: Request,
  context: RequestContext
): Promise<Response> {
  const ipAddress = context.request.headers.get('CF-Connecting-IP') || 'unknown';

  try {
    // 관리자 권한 확인
    if (!requireAuth(context) || !requireRole(context, 'admin')) {
      return unauthorizedResponse();
    }

    const input = await parseSendConfigInput(request);

    logger.logRequest('POST', '/api/report/send-config', undefined, ipAddress);

    // 기존 설정 확인
    const existing = await executeFirst<any>(
      context.env.DB,
      'SELECT id FROM report_send_configs WHERE academy_id = ?',
      [getAcademyId(context)]
    );

    const now = new Date().toISOString();

    if (existing) {
      // 기존 설정 업데이트
      const result = await executeUpdate(
        context.env.DB,
        `UPDATE report_send_configs
         SET start_date = ?, end_date = ?, updated_at = ?
         WHERE id = ?`,
        [input.start_date, input.end_date, now, existing.id]
      );

      if (!result) {
        throw new Error('설정 업데이트 실패');
      }

      return successResponse({
        id: existing.id,
        start_date: input.start_date,
        end_date: input.end_date,
        updated_at: now,
      });
    } else {
      // 신규 설정 생성
      const configId = generateId('config');

      const result = await executeInsert(
        context.env.DB,
        `INSERT INTO report_send_configs (id, academy_id, start_date, end_date, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          configId,
          getAcademyId(context),
          input.start_date,
          input.end_date,
          now,
          now,
        ]
      );

      if (!result.success) {
        throw new Error('데이터베이스 삽입 실패');
      }

      return successResponse(
        {
          id: configId,
          start_date: input.start_date,
          end_date: input.end_date,
        },
        201
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (errorMessage.includes('입력 검증')) {
      logger.warn('전송주간 설정 검증 오류', { error: errorMessage, ipAddress });
      return errorResponse(errorMessage, 400);
    }

    logger.error('전송주간 설정 중 오류', error instanceof Error ? error : new Error(String(error)), { ipAddress });
    return errorResponse('전송주간 설정에 실패했습니다', 500);
  }
}

/**
 * GET /api/report - 리포트 목록 조회
 *
 * 지원 모드:
 *   - reportType=monthly (기본): ?yearMonth=YYYY-MM 로 월말평가 리포트
 *   - reportType=midterm|final:  ?term=YYYY-N 로 정기고사 리포트
 */
async function handleGetReports(request: Request, context: RequestContext): Promise<Response> {
  try {
    if (!requireAuth(context)) {
      return unauthorizedResponse();
    }

    const url = new URL(request.url);
    const reportType = (url.searchParams.get('reportType') || 'monthly') as 'monthly' | 'midterm' | 'final';
    const yearMonth = url.searchParams.get('yearMonth');
    const term = url.searchParams.get('term');

    if (!['monthly', 'midterm', 'final'].includes(reportType)) {
      return errorResponse('reportType은 monthly|midterm|final 중 하나여야 합니다', 400);
    }

    if (reportType === 'monthly' && !yearMonth) {
      return errorResponse('yearMonth 파라미터가 필수입니다', 400);
    }

    if (reportType !== 'monthly' && !term) {
      return errorResponse('term 파라미터가 필수입니다 (예: 2026-1)', 400);
    }

    const { executeQuery } = await import('@/utils/db');
    const academyId = getAcademyId(context);
    const userId = context.auth?.userId;
    const role = context.auth?.role;

    // 1) 학생 조회 — instructor는 본인 담당 학생만, admin은 전체
    let allStudents: any[];
    if (role === 'instructor' && userId) {
      allStudents = await executeQuery<any>(
        context.env.DB,
        `SELECT s.id, s.name, s.subjects
         FROM students s
         INNER JOIN student_teachers st ON s.id = st.student_id
         WHERE s.academy_id = ? AND s.status = 'active' AND st.teacher_id = ?
         ORDER BY s.name`,
        [academyId, userId]
      );
    } else {
      allStudents = await executeQuery<any>(
        context.env.DB,
        `SELECT id, name, subjects FROM students WHERE academy_id = ? AND status = 'active' ORDER BY name`,
        [academyId]
      );
    }

    // 2) 시험 목록 — 모드에 따라 필터 기준 상이
    let exams: any[];
    if (reportType === 'monthly') {
      exams = await executeQuery<any>(
        context.env.DB,
        `SELECT id, name, exam_month FROM exams
         WHERE academy_id = ? AND exam_month = ?
           AND (exam_type IS NULL OR exam_type = 'monthly')`,
        [academyId, yearMonth!]
      );
    } else {
      exams = await executeQuery<any>(
        context.env.DB,
        `SELECT id, name, exam_month FROM exams
         WHERE academy_id = ? AND exam_type = ? AND term = ?`,
        [academyId, reportType, term!]
      );
    }

    // 3) 해당 시험들의 성적 목록
    const examIds = exams.map((e: any) => e.id);
    let grades: any[] = [];
    if (examIds.length > 0) {
      const placeholders = examIds.map(() => '?').join(',');
      grades = await executeQuery<any>(
        context.env.DB,
        `SELECT g.id, g.student_id, g.exam_id, g.score, g.comments, g.year_month,
                e.name as exam_name
         FROM grades g
         LEFT JOIN exams e ON g.exam_id = e.id
         WHERE g.exam_id IN (${placeholders})`,
        examIds
      );
    }

    // 성적을 student_id별로 인덱싱
    const gradeMap = new Map<string, any[]>();
    for (const g of grades) {
      if (!gradeMap.has(g.student_id)) gradeMap.set(g.student_id, []);
      gradeMap.get(g.student_id)!.push(g);
    }

    // exam_name에서 과목명 추출 헬퍼
    function extractSubject(examName: string | null): string {
      if (!examName) return '기타';
      const parts = examName.split(' - ');
      return parts.length > 1 ? parts[parts.length - 1] : examName;
    }

    // 4) 학생별 리포트 생성 — 성적 유무 관계없이 모든 학생 포함
    const reports = allStudents.map((student: any) => {
      const studentGrades = gradeMap.get(student.id) || [];
      const scores = [];

      // 기존 성적이 있는 경우
      for (const g of studentGrades) {
        scores.push({
          examId: g.exam_id,
          subject: extractSubject(g.exam_name),
          score: g.score,
          comment: g.comments || '',
        });
      }

      // 학생의 수강 과목 파싱
      let studentSubjects: string[] = [];
      try {
        studentSubjects = student.subjects ? JSON.parse(student.subjects) : [];
      } catch {
        studentSubjects = [];
      }

      // 이미 성적이 있는 과목 추적 (중복 시험 방어)
      const gradedExamIds = new Set(studentGrades.map((g: any) => g.exam_id));
      const gradedSubjects = new Set(studentGrades.map((g: any) => extractSubject(g.exam_name)));

      // 성적이 없는 시험에 대해 빈 슬롯 추가 (수강 과목만, 중복 과목 제외)
      for (const exam of exams) {
        if (!gradedExamIds.has(exam.id)) {
          const examSubject = extractSubject(exam.name);
          // 이미 해당 과목 성적이 있으면 중복 슬롯 추가하지 않음
          if (gradedSubjects.has(examSubject)) continue;
          // 수강 과목이 설정되어 있으면 해당 과목만, 없으면 전체 표시
          if (studentSubjects.length === 0 || studentSubjects.includes(examSubject)) {
            scores.push({
              examId: exam.id,
              subject: examSubject,
              score: 0,
              comment: '',
            });
            gradedSubjects.add(examSubject); // 이 과목도 추가됐으므로 중복 방지
          }
        }
      }

      const reportKey = reportType === 'monthly' ? yearMonth! : `${term}-${reportType}`;
      return {
        id: `report-${student.id}-${reportKey}`.replace(/-/g, ''),
        studentId: student.id,
        studentName: student.name,
        reportType,
        yearMonth: reportType === 'monthly' ? yearMonth : null,
        term: reportType !== 'monthly' ? term : null,
        scores,
        totalComment: '',
        createdAt: new Date().toISOString(),
      };
    });

    return successResponse(reports);
  } catch (error) {
    logger.error('리포트 목록 조회 오류', error instanceof Error ? error : new Error(String(error)));
    return errorResponse('리포트 목록 조회에 실패했습니다', 500);
  }
}

/**
 * GET /api/report/send-config - 전송주간 설정 조회
 */
async function handleGetSendConfig(context: RequestContext): Promise<Response> {
  try {
    if (!requireAuth(context)) {
      return unauthorizedResponse();
    }

    const config = await executeFirst<any>(
      context.env.DB,
      'SELECT * FROM report_send_configs WHERE academy_id = ?',
      [getAcademyId(context)]
    );

    if (!config) {
      return errorResponse('설정된 전송주간이 없습니다', 404);
    }

    return successResponse(config);
  } catch (error) {
    logger.error('전송주간 조회 오류', error instanceof Error ? error : new Error(String(error)));
    return errorResponse('전송주간 조회에 실패했습니다', 500);
  }
}

/**
 * GET /api/report/history?studentId=xxx&months=6 - 학생 점수 추이 (최근 N개월)
 */
async function handleGetScoreHistory(request: Request, context: RequestContext): Promise<Response> {
  try {
    if (!requireAuth(context)) {
      return unauthorizedResponse();
    }

    const url = new URL(request.url);
    const studentId = url.searchParams.get('studentId');
    const months = parseInt(url.searchParams.get('months') || '6', 10);

    if (!studentId) {
      return errorResponse('studentId 파라미터가 필수입니다', 400);
    }

    const { executeQuery } = await import('@/utils/db');

    // 최근 N개월의 성적을 과목별로 조회
    const grades = await executeQuery<any>(
      context.env.DB,
      `SELECT g.score, g.year_month, e.name as exam_name
       FROM grades g
       LEFT JOIN exams e ON g.exam_id = e.id
       WHERE g.student_id = ?
       ORDER BY g.year_month ASC`,
      [studentId]
    );

    // exam_name에서 과목명 추출
    function extractSubject(examName: string | null): string {
      if (!examName) return '기타';
      const parts = examName.split(' - ');
      return parts.length > 1 ? parts[parts.length - 1] : examName;
    }

    // 과목별, 월별로 정리
    const subjectMap = new Map<string, { month: string; score: number }[]>();
    const allMonths = new Set<string>();

    for (const g of grades) {
      const subject = extractSubject(g.exam_name);
      if (!subjectMap.has(subject)) subjectMap.set(subject, []);
      subjectMap.get(subject)!.push({ month: g.year_month, score: g.score });
      allMonths.add(g.year_month);
    }

    // 최근 N개월만 필터
    const sortedMonths = Array.from(allMonths).sort().slice(-months);

    const history = {
      months: sortedMonths,
      subjects: Object.fromEntries(
        Array.from(subjectMap.entries()).map(([subject, data]) => [
          subject,
          sortedMonths.map((m) => {
            const found = data.find((d) => d.month === m);
            return found ? found.score : null;
          }),
        ])
      ),
    };

    return successResponse(history);
  } catch (error) {
    logger.error('점수 추이 조회 오류', error instanceof Error ? error : new Error(String(error)));
    return errorResponse('점수 추이 조회에 실패했습니다', 500);
  }
}

// ==================== 전송 상태 핸들러 ====================

/**
 * GET /api/report/send-status
 *   월말: ?yearMonth=YYYY-MM         → report_sends
 *   정기고사: ?reportType=midterm|final&term=YYYY-N → exam_review_sends
 *
 * 학생별 전송 기록 조회
 */
async function handleGetSendStatus(request: Request, context: RequestContext): Promise<Response> {
  try {
    if (!requireAuth(context)) {
      return unauthorizedResponse();
    }

    const url = new URL(request.url);
    const reportType = (url.searchParams.get('reportType') || 'monthly') as 'monthly' | 'midterm' | 'final';
    const yearMonth = url.searchParams.get('yearMonth');
    const term = url.searchParams.get('term');

    if (reportType === 'monthly' && !yearMonth) {
      return errorResponse('yearMonth 파라미터가 필수입니다', 400);
    }
    if (reportType !== 'monthly' && !term) {
      return errorResponse('term 파라미터가 필수입니다', 400);
    }

    const { executeQuery } = await import('@/utils/db');
    const academyId = getAcademyId(context);

    const sends = reportType === 'monthly'
      ? await executeQuery<any>(
          context.env.DB,
          `SELECT student_id, share_url, sent_by, sent_at
           FROM report_sends
           WHERE academy_id = ? AND year_month = ?`,
          [academyId, yearMonth!]
        )
      : await executeQuery<any>(
          context.env.DB,
          `SELECT student_id, share_url, sent_by, sent_at
           FROM exam_review_sends
           WHERE academy_id = ? AND term = ? AND exam_type = ?`,
          [academyId, term!, reportType]
        );

    // student_id → 전송 정보 맵으로 변환
    const sendMap: Record<string, { shareUrl: string; sentBy: string; sentAt: string }> = {};
    for (const s of sends) {
      sendMap[s.student_id] = {
        shareUrl: s.share_url,
        sentBy: s.sent_by,
        sentAt: s.sent_at,
      };
    }

    return successResponse(sendMap);
  } catch (error) {
    logger.error('전송 상태 조회 오류', error instanceof Error ? error : new Error(String(error)));
    return errorResponse('전송 상태 조회에 실패했습니다', 500);
  }
}

// ==================== 메인 핸들러 ====================

export async function handleReport(
  method: string,
  pathname: string,
  request: Request,
  context: RequestContext
): Promise<Response> {
  try {
    // 학원 소속 검증 — 인증된 사용자가 해당 academy에 실제로 속하는지 확인
    if (context.auth?.userId && context.auth?.academyId) {
      const userCheck = await executeFirst<{ id: string }>(
        context.env.DB,
        'SELECT id FROM users WHERE id = ? AND academy_id = ?',
        [context.auth.userId, context.auth.academyId]
      );
      if (!userCheck) return unauthorizedResponse();
    }

    // /api/report/history (점수 추이)
    if (pathname === '/api/report/history') {
      if (method === 'GET') return await handleGetScoreHistory(request, context);
      return errorResponse('Method not allowed', 405);
    }

    // /api/report/send-status (전송 상태)
    if (pathname === '/api/report/send-status') {
      if (method === 'GET') return await handleGetSendStatus(request, context);
      return errorResponse('Method not allowed', 405);
    }

    // /api/report (쿼리 파라미터로 yearMonth)
    if (pathname === '/api/report') {
      if (method === 'GET') return await handleGetReports(request, context);
      return errorResponse('Method not allowed', 405);
    }

    // /api/report/send-config
    if (pathname === '/api/report/send-config') {
      if (method === 'POST') return await handleSetSendConfig(request, context);
      if (method === 'GET') return await handleGetSendConfig(context);
      return errorResponse('Method not allowed', 405);
    }

    return errorResponse('Not found', 404);
  } catch (error) {
    logger.error('Report handler error', error instanceof Error ? error : new Error(String(error)));
    return errorResponse('Internal server error', 500);
  }
}
