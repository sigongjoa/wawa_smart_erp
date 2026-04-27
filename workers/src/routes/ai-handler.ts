/**
 * AI 코멘트 생성 핸들러 (Gemini API)
 */

import { RequestContext } from '@/types';
import { errorResponse, successResponse, unauthorizedResponse } from '@/utils/response';
import { requireAuth } from '@/middleware/auth';
import { getUserId } from '@/utils/context';
import { logger } from '@/utils/logger';
import { geminiGenerate } from '@/utils/gemini';
import { z } from 'zod';

// 정기고사 문맥 주입용 옵션
const ExamContextSchema = z.object({
  reportType: z.enum(['midterm', 'final']),
  term: z.string().regex(/^\d{4}-\d$/),
}).optional();

const GenerateCommentSchema = z.object({
  studentName: z.string().min(1),
  subject: z.string().min(1),
  score: z.number().min(0),
  yearMonth: z.string(),
  existingComment: z.string().optional(),
  examContext: ExamContextSchema,
});

const GenerateSummarySchema = z.object({
  studentName: z.string().min(1),
  yearMonth: z.string(),
  scores: z.array(z.object({
    subject: z.string(),
    score: z.number(),
    comment: z.string().optional(),
  })),
  examContext: ExamContextSchema,
});

function examContextLabel(ctx: { reportType: 'midterm' | 'final'; term: string } | undefined): string {
  if (!ctx) return '';
  const [year, half] = ctx.term.split('-');
  const typeLabel = ctx.reportType === 'midterm' ? '중간고사' : '기말고사';
  return `${year}년 ${half}학기 ${typeLabel}`;
}

/**
 * POST /api/ai/generate-comment
 * Gemini로 학생 성적 코멘트 생성
 */
async function handleGenerateComment(
  request: Request,
  context: RequestContext
): Promise<Response> {
  try {
    if (!requireAuth(context)) {
      return unauthorizedResponse();
    }

    const body = await request.json() as any;
    const input = GenerateCommentSchema.parse(body);

    const isExamReview = !!input.examContext;
    const examLabel = examContextLabel(input.examContext);
    const reportKindLabel = isExamReview ? examLabel : '월말평가';
    const periodLabel = isExamReview ? examLabel : input.yearMonth;
    const periodFeedbackLabel = isExamReview ? '이번 시험' : '이번 달';
    const nextPlanLabel = isExamReview ? '다음 학습 단계' : '다음 달 학습';

    const prompt = `당신은 한국 수학 학원의 경험 많은 선생님입니다. 학부모에게 보내는 ${reportKindLabel} 리포트의 과목별 코멘트를 작성해주세요.

학생: ${input.studentName}
과목: ${input.subject}
점수: ${input.score}점 (100점 만점)
평가 기간: ${periodLabel}
${input.existingComment ? `선생님 메모: "${input.existingComment}" — 이 메모를 핵심 내용으로 삼아 학부모에게 전달할 수 있는 상세한 코멘트로 확장해주세요.` : ''}

작성 규칙:
- 4~6문장으로 상세하게 작성 (선생님 메모가 짧더라도 반드시 풍부하게 확장)
- 존댓말 사용
- 점수에 맞는 구체적 평가:
  · 90점 이상: 우수한 성취, 심화 학습 방향 제시
  · 70~89점: 양호한 수준, 보완할 부분과 성장 가능성 언급
  · 50~69점: 노력이 필요한 부분을 구체적으로 짚고 개선 방법 제시
  · 50점 미만: 기초 보강 필요, 따뜻한 격려와 함께 단계적 학습 계획 제안
- ${periodFeedbackLabel} 학습 내용에 대한 구체적 피드백 포함
- ${nextPlanLabel}에 대한 간단한 방향 제시
- 긍정적이고 격려하는 톤 유지
- 코멘트만 출력 (제목, 라벨, 번호 없이 자연스러운 문장으로)`;

    const result = await geminiGenerate({
      env: context.env,
      userId: getUserId(context),
      kind: 'ai-comment',
      prompt,
      temperature: 0.7,
      maxOutputTokens: 1024,
    });
    if (result.blocked) return result.blocked;

    return successResponse({ comment: result.text });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('입력 검증 오류: ' + error.errors.map(e => e.message).join(', '), 400);
    }
    logger.error('AI 코멘트 생성 오류', error instanceof Error ? error : new Error(String(error)));
    return errorResponse('AI 코멘트 생성에 실패했습니다', 500);
  }
}

/**
 * POST /api/ai/generate-summary
 * 전 과목 종합 총평 생성
 */
async function handleGenerateSummary(
  request: Request,
  context: RequestContext
): Promise<Response> {
  try {
    if (!requireAuth(context)) {
      return unauthorizedResponse();
    }

    const body = await request.json() as any;
    const input = GenerateSummarySchema.parse(body);

    const avgScore = Math.round(input.scores.reduce((s, g) => s + g.score, 0) / input.scores.length);
    const scoreList = input.scores.map(g =>
      `- ${g.subject}: ${g.score}점${g.comment ? ` (선생님 메모: ${g.comment})` : ''}`
    ).join('\n');

    const isExamReview = !!input.examContext;
    const examLabel = examContextLabel(input.examContext);
    const reportKindLabel = isExamReview ? examLabel : '월말평가';
    const periodLabel = isExamReview ? examLabel : input.yearMonth;
    const summaryLine = isExamReview
      ? '이번 시험 학습 요약 (1~2문장) — 시험 준비 과정과 성과. 선생님 메모 반영.'
      : '이번 달 학습 요약 (1~2문장) — 전체적인 학습 태도와 성과. 선생님 메모 반영.';
    const planLine = isExamReview
      ? '다음 학습 단계 (1~2문장) — 이번 시험 결과를 바탕으로 학원에서 할 구체적 액션 1~2가지.'
      : '다음 달 계획 (1~2문장) — 학원에서 할 구체적 액션 1~2가지.';

    const prompt = `당신은 한국의 "와와학습코칭센터" 학원 담당 선생님입니다. 학부모님께 보내는 ${reportKindLabel} 총평을 작성해주세요.

학생: ${input.studentName}
평가 기간: ${periodLabel}
전체 평균: ${avgScore}점

과목별 성적 및 선생님 메모:
${scoreList}

[중요] 반드시 400~500자 이내로 작성하세요. 절대 500자를 초과하지 마세요.

총평 구성 (번호/제목 없이 자연스러운 문단으로):
1. ${summaryLine}
2. 과목별 핵심 피드백 (2~3문장) — 잘한 과목은 칭찬, 부족한 과목은 구체적 보완점.
3. ${planLine}
4. 마무리 격려 (1문장) — 짧고 진심 어린 격려.

작성 규칙:
- 존댓말, 따뜻하고 전문적인 톤
- 선생님 메모가 있으면 자연스럽게 반영 (원문 그대로 인용하지 말 것)
- 코멘트만 출력 (제목, 번호, 기호 없이)
- 400~500자 엄수`;

    const result = await geminiGenerate({
      env: context.env,
      userId: getUserId(context),
      kind: 'ai-summary',
      prompt,
      temperature: 0.7,
      maxOutputTokens: 1024,
    });
    if (result.blocked) return result.blocked;

    return successResponse({ summary: result.text });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('입력 검증 오류: ' + error.errors.map(e => e.message).join(', '), 400);
    }
    logger.error('AI 총평 생성 오류', error instanceof Error ? error : new Error(String(error)));
    return errorResponse('AI 총평 생성에 실패했습니다', 500);
  }
}

// ==================== 회의 요약 ====================

const MeetingSummarySchema = z.object({
  transcript: z.string().min(1, '녹취록은 필수입니다'),
  title: z.string().optional(),
  participants: z.array(z.string()).optional(),
  durationMinutes: z.number().optional(),
});

async function handleMeetingSummary(
  request: Request,
  context: RequestContext
): Promise<Response> {
  try {
    if (!requireAuth(context)) return unauthorizedResponse();

    const body = await request.json() as any;
    const input = MeetingSummarySchema.parse(body);

    const participantList = input.participants?.join(', ') || '미지정';
    const duration = input.durationMinutes ? `${input.durationMinutes}분` : '미지정';

    const prompt = `당신은 학원 강사 회의 내용을 정리하는 비서입니다.
아래 회의 녹취록을 분석하여 JSON 형식으로 결과를 반환하세요.

## 규칙
- summary: 3~5문장 핵심 요약
- keyDecisions: 회의에서 결정된 사항 목록 (없으면 빈 배열)
- extractedActions: 구체적인 할일 목록
  - title: 할일 내용
  - assigneeName: 담당자 이름 (녹취록에서 언급된 이름, 없으면 null)
  - dueDate: 기한 (언급된 경우 YYYY-MM-DD 형식, 없으면 null)

## 회의 정보
- 제목: ${input.title || '미팅'}
- 참석자: ${participantList}
- 소요 시간: ${duration}

## 녹취록
${input.transcript}

## 출력 (순수 JSON만, 마크다운 코드블록 없이)
{"summary":"...","keyDecisions":["..."],"extractedActions":[{"title":"...","assigneeName":"...","dueDate":"..."}]}`;

    const result = await geminiGenerate({
      env: context.env,
      userId: getUserId(context),
      kind: 'meeting-summary',
      prompt,
      temperature: 0.3,
      maxOutputTokens: 2048,
    });
    if (result.blocked) return result.blocked;
    const rawText = result.text!;

    // JSON 파싱 (코드블록 제거)
    const jsonStr = rawText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    try {
      const parsed = JSON.parse(jsonStr);
      return successResponse(parsed);
    } catch {
      // JSON 파싱 실패 시 원문 반환
      return successResponse({ summary: rawText, keyDecisions: [], extractedActions: [] });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('입력 검증 오류: ' + error.errors.map(e => e.message).join(', '), 400);
    }
    logger.error('회의 요약 생성 오류', error instanceof Error ? error : new Error(String(error)));
    return errorResponse('회의 요약 생성에 실패했습니다', 500);
  }
}

export async function handleAI(
  method: string,
  pathname: string,
  request: Request,
  context: RequestContext
): Promise<Response> {
  if (pathname === '/api/ai/generate-comment' && method === 'POST') {
    return await handleGenerateComment(request, context);
  }
  if (pathname === '/api/ai/generate-summary' && method === 'POST') {
    return await handleGenerateSummary(request, context);
  }
  if (pathname === '/api/ai/meeting-summary' && method === 'POST') {
    return await handleMeetingSummary(request, context);
  }
  return errorResponse('Not found', 404);
}
