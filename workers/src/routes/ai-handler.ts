/**
 * AI 코멘트 생성 핸들러 (Gemini API)
 */

import { RequestContext } from '@/types';
import { errorResponse, successResponse, unauthorizedResponse } from '@/utils/response';
import { requireAuth } from '@/middleware/auth';
import { logger } from '@/utils/logger';
import { z } from 'zod';

const GenerateCommentSchema = z.object({
  studentName: z.string().min(1),
  subject: z.string().min(1),
  score: z.number().min(0),
  yearMonth: z.string(),
  existingComment: z.string().optional(),
});

const GenerateSummarySchema = z.object({
  studentName: z.string().min(1),
  yearMonth: z.string(),
  scores: z.array(z.object({
    subject: z.string(),
    score: z.number(),
    comment: z.string().optional(),
  })),
});

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

    const apiKey = context.env.GEMINI_API_KEY;
    if (!apiKey) {
      return errorResponse('Gemini API 키가 설정되지 않았습니다', 500);
    }

    const body = await request.json() as any;
    const input = GenerateCommentSchema.parse(body);

    const prompt = `당신은 한국 수학 학원의 경험 많은 선생님입니다. 학부모에게 보내는 월말평가 리포트의 과목별 코멘트를 작성해주세요.

학생: ${input.studentName}
과목: ${input.subject}
점수: ${input.score}점 (100점 만점)
평가 기간: ${input.yearMonth}
${input.existingComment ? `선생님 메모: "${input.existingComment}" — 이 메모를 핵심 내용으로 삼아 학부모에게 전달할 수 있는 상세한 코멘트로 확장해주세요.` : ''}

작성 규칙:
- 4~6문장으로 상세하게 작성 (선생님 메모가 짧더라도 반드시 풍부하게 확장)
- 존댓말 사용
- 점수에 맞는 구체적 평가:
  · 90점 이상: 우수한 성취, 심화 학습 방향 제시
  · 70~89점: 양호한 수준, 보완할 부분과 성장 가능성 언급
  · 50~69점: 노력이 필요한 부분을 구체적으로 짚고 개선 방법 제시
  · 50점 미만: 기초 보강 필요, 따뜻한 격려와 함께 단계적 학습 계획 제안
- 이번 달 학습 내용에 대한 구체적 피드백 포함
- 다음 달 학습에 대한 간단한 방향 제시
- 긍정적이고 격려하는 톤 유지
- 코멘트만 출력 (제목, 라벨, 번호 없이 자연스러운 문장으로)`;

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 500,
          },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      logger.error('Gemini API 오류', new Error(errText));
      return errorResponse('AI 코멘트 생성에 실패했습니다', 502);
    }

    const geminiData = await geminiRes.json() as any;
    const comment = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!comment) {
      return errorResponse('AI 응답이 비어있습니다', 502);
    }

    return successResponse({ comment });
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

    const apiKey = context.env.GEMINI_API_KEY;
    if (!apiKey) {
      return errorResponse('Gemini API 키가 설정되지 않았습니다', 500);
    }

    const body = await request.json() as any;
    const input = GenerateSummarySchema.parse(body);

    const avgScore = Math.round(input.scores.reduce((s, g) => s + g.score, 0) / input.scores.length);
    const scoreList = input.scores.map(g =>
      `- ${g.subject}: ${g.score}점${g.comment ? ` (선생님 메모: ${g.comment})` : ''}`
    ).join('\n');

    const prompt = `당신은 한국의 "와와학습코칭센터" 학원에서 학생을 직접 지도하는 담당 선생님입니다. 학부모님께 카카오톡으로 보내드리는 월말평가 리포트의 "총평"을 작성해주세요.

학생: ${input.studentName}
평가 기간: ${input.yearMonth}
전체 평균: ${avgScore}점

과목별 성적 및 선생님 메모:
${scoreList}

[중요] 반드시 800자 이상으로 길고 구체적으로 작성하세요. 짧게 쓰지 마세요.

총평 구성 (자연스러운 문단으로, 번호/제목 없이):

■ 이번 달 학습 요약 (2~3문장)
- 수업 태도, 과제 수행도, 집중력 등을 구체적으로 서술
- 선생님 메모 내용이 있으면 반드시 반영하여 서술

■ 과목별 분석 (3~4문장)
- 각 과목의 점수를 기반으로 강점과 약점을 구체적으로 언급
- 잘한 과목: "~에서 ~개념을 정확히 이해하고 있어 ~점을 받았습니다"
- 부족한 과목: "~과목에서는 ~부분에서 실수가 있었는데"
- 선생님 메모 내용을 자연스럽게 녹여서 서술

■ 학원의 구체적 액션 플랜 (3~4문장) ← 이 부분이 가장 중요합니다
- 선생님이 다음 달에 이 학생을 위해 구체적으로 무엇을 할 것인지 명시
- 반드시 아래와 같은 구체적인 행동을 포함:
  · "다음 달부터 매 수업 시작 10분간 ~를 반복 훈련하겠습니다"
  · "주 1회 ~영역 보충 프린트를 추가로 제공하겠습니다"
  · "오답노트를 활용하여 틀린 유형을 매주 복습하도록 지도하겠습니다"
  · "~단원 기초를 다시 잡기 위해 개별 보충 시간을 마련하겠습니다"
  · "다음 평가까지 ~점 이상을 목표로 단계별 학습 계획을 세웠습니다"
- 학원이 체계적으로 관리하고 있다는 신뢰감을 줄 것

■ 가정 연계 (1~2문장)
- 학부모님께서 가정에서 도와주시면 좋을 구체적인 사항 1~2가지
- 예: "가정에서 하루 10분 ~연습을 해주시면 효과가 배가 됩니다"

■ 마무리 격려 (1~2문장)
- 학생의 가능성에 대한 진심 어린 격려
- "저희 와와학습코칭센터에서 책임지고 꼼꼼히 지도하겠습니다"로 마무리

코멘트만 출력하세요 (제목, 번호, ■ 기호 없이 하나의 자연스러운 문단으로).`;

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2000,
          },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      logger.error('Gemini API 오류 (총평)', new Error(errText));
      return errorResponse('AI 총평 생성에 실패했습니다', 502);
    }

    const geminiData = await geminiRes.json() as any;
    const summary = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!summary) {
      return errorResponse('AI 응답이 비어있습니다', 502);
    }

    return successResponse({ summary });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('입력 검증 오류: ' + error.errors.map(e => e.message).join(', '), 400);
    }
    logger.error('AI 총평 생성 오류', error instanceof Error ? error : new Error(String(error)));
    return errorResponse('AI 총평 생성에 실패했습니다', 500);
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
  return errorResponse('Not found', 404);
}
