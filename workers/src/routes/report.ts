import { Router } from 'itty-router';
import { RequestContext } from '@/types';
import { executeQuery, executeFirst, executeInsert, executeUpdate } from '@/utils/db';
import { successResponse, errorResponse, unauthorizedResponse, notFoundResponse } from '@/utils/response';
import { requireAuth, requireRole } from '@/middleware/auth';

export const reportRouter = Router<any>();

// AI 기반 보고서 생성
reportRouter.post('/generate', async (request: Request, env: any) => { const context = env as RequestContext;
  try {
    if (!requireAuth(context) || !requireRole(context, 'instructor', 'admin')) {
      return unauthorizedResponse();
    }

    const { studentId, month } = await context.request.json() as any;

    if (!studentId || !month) {
      return errorResponse('Required fields are missing', 400);
    }

    // 학생 데이터 조회
    const student = await executeFirst<any>(
      context.env.DB,
      'SELECT * FROM students WHERE id = ? AND academy_id = ?',
      [studentId, context.auth!.academyId]
    );

    if (!student) return notFoundResponse();

    // 출석 데이터 조회
    const attendance = await executeQuery<any>(
      context.env.DB,
      `SELECT status, COUNT(*) as count FROM attendance
       WHERE student_id = ? AND strftime('%Y-%m', date) = ?
       GROUP BY status`,
      [studentId, month]
    );

    // 성적 데이터 조회
    const grades = await executeQuery<any>(
      context.env.DB,
      `SELECT g.score, g.comments, e.name as exam_name
       FROM grades g
       JOIN exams e ON g.exam_id = e.id
       WHERE g.student_id = ? AND strftime('%Y-%m', e.date) = ?`,
      [studentId, month]
    );

    // Google Gemini API를 호출하여 보고서 생성
    // 실제 구현은 환경 변수의 GEMINI_API_KEY 필요
    const reportContent = await generateReportWithGemini(
      {
        studentName: (student as any).name,
        month,
        attendance,
        grades,
      },
      context.env
    );

    // 보고서 DB에 저장
    const reportId = crypto.randomUUID();
    await executeInsert(
      context.env.DB,
      `INSERT INTO reports (id, student_id, month, content, generated_at, created_at)
       VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [reportId, studentId, month, reportContent]
    );

    return successResponse(
      {
        id: reportId,
        studentId,
        month,
        content: reportContent,
      },
      201
    );
  } catch (error) {
    console.error('Generate report error:', error);
    return errorResponse('Failed to generate report', 500);
  }
});

// 보고서 조회
reportRouter.get('/:studentId/:month', async (request: Request, env: any) => { const context = env as RequestContext;
  try {
    if (!requireAuth(context)) return unauthorizedResponse();

    const { studentId, month } = context.params;

    const report = await executeFirst(
      context.env.DB,
      'SELECT * FROM reports WHERE student_id = ? AND month = ? LIMIT 1',
      [studentId, month]
    );

    if (!report) return notFoundResponse();

    return successResponse(report);
  } catch (error) {
    console.error('Get report error:', error);
    return errorResponse('Failed to get report', 500);
  }
});

// 보고서 목록 조회
reportRouter.get('/student/:studentId', async (request: Request, env: any) => { const context = env as RequestContext;
  try {
    if (!requireAuth(context)) return unauthorizedResponse();

    const { studentId } = context.params;

    const reports = await executeQuery(
      context.env.DB,
      'SELECT * FROM reports WHERE student_id = ? ORDER BY month DESC',
      [studentId]
    );

    return successResponse(reports);
  } catch (error) {
    console.error('Get reports error:', error);
    return errorResponse('Failed to get reports', 500);
  }
});

// 카카오톡 전송
reportRouter.post('/:reportId/send', async (request: Request, env: any) => { const context = env as RequestContext;
  try {
    if (!requireAuth(context) || !requireRole(context, 'instructor', 'admin')) {
      return unauthorizedResponse();
    }

    const { reportId } = context.params;
    const { recipientPhone } = await context.request.json() as any;

    if (!recipientPhone) {
      return errorResponse('Recipient phone is required', 400);
    }

    const report = await executeFirst(
      context.env.DB,
      'SELECT * FROM reports WHERE id = ?',
      [reportId]
    );

    if (!report) return notFoundResponse();

    // 카카오톡 API 호출 (실제 구현 필요)
    // await sendViaKakaoTalk(recipientPhone, report.content);

    // 전송 기록 업데이트
    await executeUpdate(
      context.env.DB,
      'UPDATE reports SET sent_at = datetime("now") WHERE id = ?',
      [reportId]
    );

    return successResponse({ message: 'Report sent successfully' });
  } catch (error) {
    console.error('Send report error:', error);
    return errorResponse('Failed to send report', 500);
  }
});

// Gemini API로 보고서 생성 (더미 구현)
async function generateReportWithGemini(
  data: any,
  env: any
): Promise<string> {
  try {
    // 실제 구현: Google Generative AI API 호출
    if (!env.GEMINI_API_KEY) {
      return `
학원 학습 보고서
학생명: ${data.studentName}
기간: ${data.month}

출석 현황:
${data.attendance.map((a: any) => `- ${a.status}: ${a.count}회`).join('\n')}

성적 정보:
${data.grades.map((g: any) => `- ${g.exam_name}: ${g.score}점`).join('\n')}

피드백: 열심히 공부하고 있습니다.
`.trim();
    }

    // 실제 API 호출 (미구현 상태에서는 위의 템플릿 사용)
    return 'AI 기반 보고서 생성 (Gemini API)';
  } catch (error) {
    console.error('Generate report with Gemini error:', error);
    throw error;
  }
}
