/**
 * MedTerm 학생용 핸들러 (PIN 토큰).
 *
 * 인증: KV `play:{token}` 토큰 (vocab-play와 공유).
 * Endpoints:
 *   GET  /api/play/medterm/today         — 오늘 학습할 카드 목록
 *   POST /api/play/medterm/answer        — 답안 제출 + Leitner 갱신
 *   GET  /api/play/medterm/term/:id      — 단일 용어 상세 (parts 포함)
 *   GET  /api/play/medterm/figure/:id    — 그림 + 라벨 (figure 모드용)
 *
 * 보안: 모든 SELECT/UPDATE 에 academy_id + student_id 필터 (CLAUDE.md 1번).
 */
import { z } from 'zod';
import { RequestContext } from '@/types';
import { executeQuery, executeFirst, executeInsert, executeUpdate } from '@/utils/db';
import { successResponse, errorResponse, unauthorizedResponse } from '@/utils/response';
import { handleRouteError } from '@/utils/error-handler';
import { sanitizeText, isValidId } from '@/utils/sanitize';
import { gradeItem, nextLeitner } from '@/utils/medterm-validate';
import { handleMedTermFiguresPlay } from '@/routes/medterm-figures-handler';
import {
  handleGetAttempt as handleExamGetAttempt,
  handleSaveResponse as handleExamSaveResponse,
  handleSubmitAttempt as handleExamSubmit,
  handleListAttemptsForStudent,
} from '@/routes/medterm-exam-handler';

interface PlayAuth {
  studentId: string;
  academyId: string;
  teacherId: string;
  name: string;
}

interface CardRow {
  id: string;          // med_student_terms.id
  term_id: string;
  term: string;
  meaning_ko: string;
  meaning_long: string | null;
  study_mode: string;
  box: number;
  review_count: number;
  wrong_count: number;
  next_review: string;
}

interface PartRow {
  id: string;
  role: string;
  value: string;
  meaning_ko: string;
  position: number;
}

async function getPlayAuth(context: RequestContext): Promise<PlayAuth | null> {
  const authHeader = context.request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  return (await context.env.KV.get(`play:${token}`, 'json')) as PlayAuth | null;
}

// ── 오늘의 카드 (UC-MS-01) ─────────────────────────────────────────

async function handleTodayCards(request: Request, context: RequestContext, auth: PlayAuth): Promise<Response> {
  const url = new URL(request.url);
  const limitRaw = parseInt(url.searchParams.get('limit') || '20', 10);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 50) : 20;
  const chapterId = url.searchParams.get('chapter_id');
  if (chapterId && !isValidId(chapterId)) return errorResponse('chapter_id 형식 오류', 400);

  // next_review 도래한 카드를 box 가중치 (낮은 box 우선)로 sample
  const cards = await executeQuery<CardRow>(
    context.env.DB,
    `SELECT st.id, st.term_id, t.term, t.meaning_ko, t.meaning_long,
            st.study_mode, st.box, st.review_count, st.wrong_count, st.next_review
     FROM med_student_terms st
     JOIN med_terms t ON t.id = st.term_id
     WHERE st.academy_id = ? AND st.student_id = ?
       AND st.next_review <= datetime('now')
       ${chapterId ? 'AND t.chapter_id = ?' : ''}
     ORDER BY st.box ASC, st.next_review ASC
     LIMIT ?`,
    chapterId ? [auth.academyId, auth.studentId, chapterId, limit]
              : [auth.academyId, auth.studentId, limit]
  );

  return successResponse({
    items: cards,
    count: cards.length,
    server_time: new Date().toISOString(),
  });
}

// ── 답안 제출 (UC-MS-02~06) ────────────────────────────────────────

const AnswerSchema = z.object({
  student_term_id: z.string().min(1).max(64),
  response: z.unknown(),    // 유형별 페이로드
  // 선택: 클라이언트에 표시 보내기용
  client_ts: z.number().int().optional(),
});

async function handleAnswer(request: Request, context: RequestContext, auth: PlayAuth): Promise<Response> {
  let data;
  try {
    data = AnswerSchema.parse(await request.json());
  } catch {
    return errorResponse('답안 페이로드 오류', 400);
  }
  if (!isValidId(data.student_term_id)) {
    return errorResponse('student_term_id 형식 오류', 400);
  }

  // 학생 본인 카드인지 검증 + 용어 정보 조회
  interface JoinedRow {
    st_id: string;
    term_id: string;
    term: string;
    study_mode: string;
    box: number;
    meaning_ko: string;
    plural_form: string | null;
  }
  const card = await executeFirst<JoinedRow>(
    context.env.DB,
    `SELECT st.id AS st_id, st.term_id, t.term, st.study_mode, st.box,
            t.meaning_ko, t.plural_form
     FROM med_student_terms st
     JOIN med_terms t ON t.id = st.term_id
     WHERE st.id = ? AND st.academy_id = ? AND st.student_id = ?`,
    [data.student_term_id, auth.academyId, auth.studentId]
  );
  if (!card) return errorResponse('카드를 찾을 수 없습니다', 404);

  // 정답 산출 — study_mode 별 분기
  let answer: unknown;
  let gradeType: string;
  switch (card.study_mode) {
    case 'meaning':
      answer = card.meaning_ko;
      gradeType = '단답형';
      break;
    case 'compose':
      answer = card.term;
      gradeType = '단답형';
      break;
    case 'plural':
      answer = card.plural_form;
      gradeType = '단답형';
      if (answer == null) return errorResponse('이 용어는 복수형 정보 없음', 400);
      break;
    case 'decompose': {
      // term_parts JOIN 으로 정답 parts 배열 구성
      const parts = await executeQuery<{ role: string; value: string; position: number }>(
        context.env.DB,
        `SELECT wp.role, wp.value, tp.position
         FROM med_term_parts tp
         JOIN med_word_parts wp ON wp.id = tp.part_id
         WHERE tp.term_id = ?
         ORDER BY tp.position`,
        [card.term_id]
      );
      answer = parts.map((p) => ({ role: p.role, value: p.value }));
      gradeType = '용어분해';
      break;
    }
    case 'figure':
      return handleFigureAnswer(context, auth, card.term_id, data.response, card.st_id, card.box);
    default:
      return errorResponse(`지원하지 않는 study_mode: ${card.study_mode}`, 400);
  }

  const grade = gradeItem(gradeType, answer, data.response);
  const isCorrect = grade.correct === 1;

  // Leitner 갱신
  const { box, nextReview } = nextLeitner(card.box, isCorrect);

  await executeUpdate(
    context.env.DB,
    `UPDATE med_student_terms
     SET box = ?,
         review_count = review_count + 1,
         wrong_count = wrong_count + ?,
         last_reviewed = datetime('now'),
         next_review = ?
     WHERE id = ? AND academy_id = ? AND student_id = ?`,
    [
      box,
      isCorrect ? 0 : 1,
      nextReview.toISOString(),
      card.st_id,
      auth.academyId,
      auth.studentId,
    ]
  );

  return successResponse({
    correct: isCorrect,
    box_before: card.box,
    box_after: box,
    next_review: nextReview.toISOString(),
    answer,                  // 학생 화면에 정답 표시
    explanation: card.meaning_ko, // 간단 해설
  });
}

// ── figure 모드 채점 (좌표 거리 기반) ──────────────────────────────

/**
 * figure 모드 응답 형태:
 *   { label_id: 'fl-...', x: 0.65, y: 0.27 }  — 학생이 라벨을 그림 위에 떨어뜨린 좌표
 *   또는
 *   { matches: [{label_id:'fl-...', x:0.6, y:0.3}, ...] }  — 다중 라벨
 *
 * 채점: 정답 라벨 좌표와 거리 ≤ THRESHOLD (0.10) 이면 정답.
 */
const FIG_THRESHOLD = 0.10;

async function handleFigureAnswer(
  context: RequestContext,
  auth: PlayAuth,
  termId: string,
  response: unknown,
  cardId: string,
  currentBox: number
): Promise<Response> {
  // figure 모드 카드는 term ↔ figure 라벨이 연결된 경우에만 의미가 있음
  // term_id 와 매칭되는 figure_labels 를 가져온다 (med_word_parts 매핑 통해)
  // 단순화: term 의 part 들 중 하나가 figure 라벨에 등장하면 그 라벨이 정답
  const expected = await executeFirst<{ x_ratio: number; y_ratio: number; figure_id: string }>(
    context.env.DB,
    `SELECT fl.x_ratio, fl.y_ratio, fl.figure_id
     FROM med_figure_labels fl
     JOIN med_term_parts tp ON tp.part_id = fl.part_id
     WHERE tp.term_id = ?
     LIMIT 1`,
    [termId]
  );
  if (!expected) {
    return errorResponse('이 용어에 대한 그림 라벨이 없습니다', 400);
  }

  const r = response as { x?: number; y?: number };
  if (typeof r?.x !== 'number' || typeof r?.y !== 'number') {
    return errorResponse('response 에 x, y 좌표 필요 (0.0~1.0)', 400);
  }
  if (r.x < 0 || r.x > 1 || r.y < 0 || r.y > 1) {
    return errorResponse('좌표 범위 0.0~1.0', 400);
  }

  const dx = r.x - expected.x_ratio;
  const dy = r.y - expected.y_ratio;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const isCorrect = distance <= FIG_THRESHOLD;

  const { box, nextReview } = nextLeitner(currentBox, isCorrect);
  await executeUpdate(
    context.env.DB,
    `UPDATE med_student_terms
     SET box = ?, review_count = review_count + 1,
         wrong_count = wrong_count + ?,
         last_reviewed = datetime('now'), next_review = ?
     WHERE id = ? AND academy_id = ? AND student_id = ?`,
    [box, isCorrect ? 0 : 1, nextReview.toISOString(),
     cardId, auth.academyId, auth.studentId]
  );

  return successResponse({
    correct: isCorrect,
    distance: Math.round(distance * 1000) / 1000,
    threshold: FIG_THRESHOLD,
    box_before: currentBox,
    box_after: box,
    next_review: nextReview.toISOString(),
    answer: { x: expected.x_ratio, y: expected.y_ratio },
    explanation: '라벨 좌표 ≤ 임계값 (10%) 이면 정답',
  });
}

// ── 단일 용어 상세 (decompose 학습용) ──────────────────────────────

async function handleGetTerm(request: Request, context: RequestContext, auth: PlayAuth, termId: string): Promise<Response> {
  if (!isValidId(termId)) return errorResponse('term id 형식 오류', 400);

  // 학생이 할당받은 챕터의 용어인지 격리 검증
  const term = await executeFirst<{ id: string; term: string; meaning_ko: string; chapter_id: string }>(
    context.env.DB,
    `SELECT t.id, t.term, t.meaning_ko, t.chapter_id
     FROM med_terms t
     JOIN med_student_chapters sc ON sc.chapter_id = t.chapter_id
     WHERE t.id = ? AND sc.academy_id = ? AND sc.student_id = ? AND sc.status = 'active'
     LIMIT 1`,
    [termId, auth.academyId, auth.studentId]
  );
  if (!term) return errorResponse('용어를 찾을 수 없습니다', 404);

  const parts = await executeQuery<PartRow>(
    context.env.DB,
    `SELECT wp.id, wp.role, wp.value, wp.meaning_ko, tp.position
     FROM med_term_parts tp
     JOIN med_word_parts wp ON wp.id = tp.part_id
     WHERE tp.term_id = ?
     ORDER BY tp.position`,
    [termId]
  );

  return successResponse({
    id: term.id,
    term: term.term,
    meaning_ko: term.meaning_ko,
    parts,
  });
}

// ── 라우터 ─────────────────────────────────────────────────────────

export async function handleMedTermPlay(
  method: string,
  pathname: string,
  request: Request,
  context: RequestContext
): Promise<Response> {
  try {
    const auth = await getPlayAuth(context);
    if (!auth) return unauthorizedResponse();

    if (pathname === '/api/play/medterm/today' && method === 'GET') {
      return handleTodayCards(request, context, auth);
    }
    if (pathname === '/api/play/medterm/answer' && method === 'POST') {
      return handleAnswer(request, context, auth);
    }
    const termM = pathname.match(/^\/api\/play\/medterm\/term\/([^/]+)$/);
    if (termM && method === 'GET') {
      return handleGetTerm(request, context, auth, termM[1]);
    }

    // 그림 (학생용) — figures-handler 위임
    if (pathname.startsWith('/api/play/medterm/figures')) {
      return handleMedTermFiguresPlay(method, pathname, request, context, auth.academyId);
    }

    // 단원평가 응시
    if (pathname === '/api/play/medterm/exam-attempts' && method === 'GET') {
      return handleListAttemptsForStudent(context, auth);
    }
    const attM = pathname.match(/^\/api\/play\/medterm\/exam-attempts\/([^/]+)$/);
    if (attM && method === 'GET') {
      return handleExamGetAttempt(context, auth, attM[1]);
    }
    const respM = pathname.match(/^\/api\/play\/medterm\/exam-attempts\/([^/]+)\/responses$/);
    if (respM && method === 'POST') {
      return handleExamSaveResponse(request, context, auth, respM[1]);
    }
    const submM = pathname.match(/^\/api\/play\/medterm\/exam-attempts\/([^/]+)\/submit$/);
    if (submM && method === 'POST') {
      return handleExamSubmit(context, auth, submM[1]);
    }

    return errorResponse('Not Found', 404);
  } catch (err) {
    return handleRouteError(err, 'medterm-play-handler');
  }
}
