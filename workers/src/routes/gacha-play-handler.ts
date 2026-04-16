/**
 * 학생용 가차 플레이 핸들러
 * PIN 인증 (JWT와 별개) → KV 토큰 기반 세션
 * 가차 카드 + 증명 연습 (순서배치, 빈칸채우기)
 */
import { RequestContext } from '@/types';
import { generatePrefixedId } from '@/utils/id';
import { executeQuery, executeFirst, executeInsert, executeUpdate } from '@/utils/db';
import { successResponse, errorResponse, unauthorizedResponse } from '@/utils/response';
import { handleRouteError } from '@/utils/error-handler';
import { logger } from '@/utils/logger';

// ── 유틸리티 ──

function safeParseBlanks(json: string): any[] {
  try { return JSON.parse(json); } catch { return []; }
}

// ── In-memory PIN rate limit (KV 무료한도 보호) ──
// IP당 1분 5회 제한. isolate recycle 시 초기화되지만 봇/스크래퍼 방어로 충분.
interface PinRateBucket { count: number; resetAt: number; }
const pinRateStore: Map<string, PinRateBucket> = (globalThis as any).__pinRateStore ??= new Map();

function checkPinRate(ip: string, max: number = 5, windowSec: number = 60): boolean {
  const now = Date.now();
  const key = `play-login:${ip}`;
  const bucket = pinRateStore.get(key);
  if (!bucket || bucket.resetAt < now) {
    pinRateStore.set(key, { count: 1, resetAt: now + windowSec * 1000 });
    return true;
  }
  if (bucket.count >= max) return false;
  bucket.count++;
  return true;
}

function clearPinRate(ip: string) {
  pinRateStore.delete(`play-login:${ip}`);
}

// ── PIN 해싱 (gacha-student-handler와 동일) ──

async function hashPin(pin: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', encoder.encode(pin), 'PBKDF2', false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: encoder.encode(salt), iterations: 10000, hash: 'SHA-256' },
    keyMaterial, 256
  );
  return Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ── 학생 토큰 인증 ──

interface PlayAuth {
  studentId: string;
  academyId: string;
  teacherId: string;
  name: string;
}

async function getPlayAuth(context: RequestContext): Promise<PlayAuth | null> {
  const authHeader = context.request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);
  const data = await context.env.KV.get(`play:${token}`, 'json') as PlayAuth | null;
  return data;
}

function requirePlayAuth(auth: PlayAuth | null): auth is PlayAuth {
  return auth !== null;
}

// ── 로그인 (레이트 리밋 포함) ──

async function handleLogin(request: Request, context: RequestContext): Promise<Response> {
  const body = await request.json() as any;
  const { academy_slug, name, pin } = body;

  if (!academy_slug || !name || !pin) {
    return errorResponse('입력 검증 오류: academy_slug, name, pin은 필수입니다', 400);
  }

  // 학원 조회
  const academy = await executeFirst<any>(
    context.env.DB,
    'SELECT id FROM academies WHERE slug = ? AND is_active = 1',
    [academy_slug]
  );
  if (!academy) {
    return errorResponse('학원을 찾을 수 없습니다', 404);
  }

  // 레이트 리밋: IP 기반 5회/60초 (in-memory — KV 무료한도 보호)
  const ip = context.request.headers.get('CF-Connecting-IP') || 'unknown';
  if (!checkPinRate(ip)) {
    return errorResponse('로그인 시도 횟수 초과. 잠시 후 다시 시도해주세요.', 429);
  }

  // 학생 조회
  const student = await executeFirst<any>(
    context.env.DB,
    'SELECT * FROM gacha_students WHERE academy_id = ? AND name = ? AND status = ?',
    [academy.id, name.trim(), 'active']
  );
  if (!student) {
    return errorResponse('학생을 찾을 수 없습니다', 404);
  }

  // PIN 검증
  const pinHash = await hashPin(pin, student.pin_salt);
  if (pinHash !== student.pin_hash) {
    logger.logSecurity('PLAY_LOGIN_FAILED', 'medium', { name, academySlug: academy_slug, ip });
    return errorResponse('PIN이 올바르지 않습니다', 401);
  }

  // 토큰 생성 + KV 저장 (24시간 TTL)
  const token = crypto.randomUUID();
  const playAuth: PlayAuth = {
    studentId: student.id,
    academyId: academy.id,
    teacherId: student.teacher_id,
    name: student.name,
  };
  await context.env.KV.put(`play:${token}`, JSON.stringify(playAuth), { expirationTtl: 86400 });

  // 레이트 리밋 초기화 (in-memory)
  clearPinRate(ip);

  logger.logSecurity('PLAY_LOGIN_SUCCESS', 'low', { studentId: student.id, name });

  return successResponse({
    token,
    student: { id: student.id, name: student.name, grade: student.grade },
  });
}

// ── 오늘의 세션 ──

async function handleGetSession(context: RequestContext, auth: PlayAuth): Promise<Response> {
  const today = new Date().toISOString().split('T')[0];

  let session = await executeFirst<any>(
    context.env.DB,
    'SELECT * FROM gacha_sessions WHERE student_id = ? AND session_date = ?',
    [auth.studentId, today]
  );

  if (!session) {
    const sessionId = generatePrefixedId('gsess');
    await executeInsert(
      context.env.DB,
      `INSERT INTO gacha_sessions (id, student_id, session_date) VALUES (?, ?, ?)`,
      [sessionId, auth.studentId, today]
    );
    session = { id: sessionId, student_id: auth.studentId, session_date: today, cards_drawn: 0, cards_target: 10, proofs_done: 0, proofs_target: 5 };
  }

  return successResponse(session);
}

// ── 가차: 랜덤 카드 ──

async function handleRandomCard(context: RequestContext, auth: PlayAuth): Promise<Response> {
  // 학생에게 배정된 카드 + 선생님 공용 카드
  const cards = await executeQuery<any>(
    context.env.DB,
    `SELECT * FROM gacha_cards
     WHERE academy_id = ? AND teacher_id = ?
       AND (student_id = ? OR student_id IS NULL)
     ORDER BY box ASC`,
    [auth.academyId, auth.teacherId, auth.studentId]
  );

  if (cards.length === 0) {
    return errorResponse('배정된 카드가 없습니다', 404);
  }

  // 가중치 랜덤: weight = 6 - box (Box 1 → 5배, Box 5 → 1배)
  const weighted: any[] = [];
  for (const card of cards) {
    const weight = Math.max(1, 6 - (card.box || 1));
    for (let i = 0; i < weight; i++) {
      weighted.push(card);
    }
  }

  const selected = weighted[Math.floor(Math.random() * weighted.length)];
  return successResponse(selected);
}

// ── 가차: 카드 피드백 (Leitner) ──

async function handleCardFeedback(request: Request, context: RequestContext, auth: PlayAuth, cardId: string): Promise<Response> {
  const body = await request.json() as any;
  const result = body.result; // 'success' | 'fail'

  if (!['success', 'fail'].includes(result)) {
    return errorResponse('입력 검증 오류: result는 success 또는 fail이어야 합니다', 400);
  }

  const card = await executeFirst<any>(
    context.env.DB,
    'SELECT * FROM gacha_cards WHERE id = ? AND academy_id = ?',
    [cardId, auth.academyId]
  );
  if (!card) return errorResponse('카드를 찾을 수 없습니다', 404);

  const boxBefore = card.box || 1;
  const boxAfter = result === 'success' ? Math.min(5, boxBefore + 1) : 1;
  const now = new Date().toISOString();

  // 카드 업데이트
  await executeUpdate(
    context.env.DB,
    `UPDATE gacha_cards SET
      box = ?, last_review = ?,
      success_count = success_count + ?,
      fail_count = fail_count + ?
     WHERE id = ?`,
    [boxAfter, now, result === 'success' ? 1 : 0, result === 'fail' ? 1 : 0, cardId]
  );

  // 결과 기록
  const resultId = generatePrefixedId('gcres');
  const today = now.split('T')[0];
  const session = await executeFirst<any>(
    context.env.DB,
    'SELECT id FROM gacha_sessions WHERE student_id = ? AND session_date = ?',
    [auth.studentId, today]
  );

  await executeInsert(
    context.env.DB,
    `INSERT INTO gacha_card_results (id, student_id, card_id, session_id, result, box_before, box_after, reviewed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [resultId, auth.studentId, cardId, session?.id || null, result, boxBefore, boxAfter, now]
  );

  // 세션 카운트 업데이트
  if (session) {
    await executeUpdate(
      context.env.DB,
      'UPDATE gacha_sessions SET cards_drawn = cards_drawn + 1 WHERE id = ?',
      [session.id]
    );
  }

  return successResponse({ card_id: cardId, result, box_before: boxBefore, box_after: boxAfter });
}

// ── 증명: 배정된 증명 목록 ──

async function handleGetProofs(context: RequestContext, auth: PlayAuth): Promise<Response> {
  const proofs = await executeQuery<any>(
    context.env.DB,
    `SELECT p.*, pa.assigned_at,
      (SELECT COUNT(*) FROM proof_steps ps WHERE ps.proof_id = p.id) as step_count,
      (SELECT MAX(pr.score) FROM proof_results pr WHERE pr.proof_id = p.id AND pr.student_id = ?) as best_score,
      (SELECT pr.box FROM proof_results pr WHERE pr.proof_id = p.id AND pr.student_id = ? ORDER BY pr.attempted_at DESC LIMIT 1) as current_box
    FROM proofs p
    JOIN proof_assignments pa ON pa.proof_id = p.id
    WHERE pa.student_id = ?
    ORDER BY pa.assigned_at DESC`,
    [auth.studentId, auth.studentId, auth.studentId]
  );

  return successResponse(proofs);
}

// ── 증명: 순서배치 문제 생성 ──

async function handleProofOrdering(context: RequestContext, auth: PlayAuth, proofId: string): Promise<Response> {
  // 배정 확인
  const assignment = await executeFirst<any>(
    context.env.DB,
    'SELECT id FROM proof_assignments WHERE student_id = ? AND proof_id = ?',
    [auth.studentId, proofId]
  );
  if (!assignment) return errorResponse('배정되지 않은 증명입니다', 403);

  const proof = await executeFirst<any>(
    context.env.DB,
    'SELECT id, title, grade, difficulty, description, description_image FROM proofs WHERE id = ?',
    [proofId]
  );
  if (!proof) return errorResponse('증명을 찾을 수 없습니다', 404);

  const steps = await executeQuery<any>(
    context.env.DB,
    'SELECT id, step_order, content, content_image, hint FROM proof_steps WHERE proof_id = ? ORDER BY step_order',
    [proofId]
  );

  // Fisher-Yates 셔플 (정답 순서와 겹치지 않을 때까지, 단계 2개 이상일 때만)
  const shuffled = [...steps];
  if (steps.length >= 2) {
    let isIdentical = true;
    let attempts = 0;
    while (isIdentical && attempts < 20) {
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      isIdentical = shuffled.every((s, i) => s.step_order === steps[i].step_order);
      attempts++;
    }
    // 20회 시도 후에도 같으면 첫 두 원소를 강제 swap
    if (isIdentical) {
      [shuffled[0], shuffled[1]] = [shuffled[1], shuffled[0]];
    }
  }

  // step_order 제거 (학생에게 정답 노출 방지)
  const problemSteps = shuffled.map(s => ({
    id: s.id,
    content: s.content,
    content_image: s.content_image,
  }));

  return successResponse({
    proof,
    steps: problemSteps,
    total_steps: steps.length,
  });
}

// ── 증명: 빈칸채우기 문제 생성 ──

async function handleProofFillBlank(context: RequestContext, auth: PlayAuth, proofId: string): Promise<Response> {
  // 배정 확인
  const assignment = await executeFirst<any>(
    context.env.DB,
    'SELECT id FROM proof_assignments WHERE student_id = ? AND proof_id = ?',
    [auth.studentId, proofId]
  );
  if (!assignment) return errorResponse('배정되지 않은 증명입니다', 403);

  const proof = await executeFirst<any>(
    context.env.DB,
    'SELECT id, title, grade, difficulty, description, description_image FROM proofs WHERE id = ?',
    [proofId]
  );
  if (!proof) return errorResponse('증명을 찾을 수 없습니다', 404);

  const steps = await executeQuery<any>(
    context.env.DB,
    'SELECT id, step_order, content, content_image, blanks_json, hint FROM proof_steps WHERE proof_id = ? ORDER BY step_order',
    [proofId]
  );

  // 현재 Leitner box 기반 난이도 조절
  const lastResult = await executeFirst<any>(
    context.env.DB,
    'SELECT box FROM proof_results WHERE student_id = ? AND proof_id = ? AND mode = ? ORDER BY attempted_at DESC LIMIT 1',
    [auth.studentId, proofId, 'fill_blank']
  );
  const currentBox = lastResult?.box || 1;

  // Box에 따라 빈칸 비율 결정
  // Box 1: 20% → Box 2: 40% → Box 3: 60% → Box 4: 80% → Box 5: 100%
  const blankRatio = Math.min(1.0, currentBox * 0.2);

  // 빈칸이 있는 단계만 필터
  const stepsWithBlanks = steps.filter((s: any) => s.blanks_json);
  const blankCount = Math.max(1, Math.ceil(stepsWithBlanks.length * blankRatio));

  // 랜덤으로 빈칸 활성화할 단계 선택
  const shuffledBlanks = [...stepsWithBlanks].sort(() => Math.random() - 0.5);
  const activeBlanks = new Set(shuffledBlanks.slice(0, blankCount).map((s: any) => s.id));

  const problemSteps = steps.map((s: any) => {
    const showBlanks = activeBlanks.has(s.id);
    return {
      id: s.id,
      step_order: s.step_order,
      content: s.content,
      content_image: s.content_image,
      has_blank: showBlanks,
      // blanks_json에서 정답 제거 — 위치/길이만 전달
      blanks: showBlanks && s.blanks_json
        ? safeParseBlanks(s.blanks_json).map((b: any) => ({ position: b.position, length: b.length }))
        : [],
    };
  });

  return successResponse({
    proof,
    steps: problemSteps,
    total_blanks: problemSteps.reduce((acc: number, s: any) => acc + s.blanks.length, 0),
    current_box: currentBox,
  });
}

// ── 증명: 결과 제출 ──

async function handleProofSubmit(request: Request, context: RequestContext, auth: PlayAuth, proofId: string): Promise<Response> {
  const body = await request.json() as any;
  const { mode, answers } = body;

  if (!['ordering', 'fill_blank'].includes(mode)) {
    return errorResponse('입력 검증 오류: mode는 ordering 또는 fill_blank이어야 합니다', 400);
  }

  // 배정 확인
  const assignment = await executeFirst<any>(
    context.env.DB,
    'SELECT id FROM proof_assignments WHERE student_id = ? AND proof_id = ?',
    [auth.studentId, proofId]
  );
  if (!assignment) return errorResponse('배정되지 않은 증명입니다', 403);

  const steps = await executeQuery<any>(
    context.env.DB,
    'SELECT * FROM proof_steps WHERE proof_id = ? ORDER BY step_order',
    [proofId]
  );
  if (steps.length === 0) return errorResponse('증명 단계가 없습니다', 404);

  let score = 0;
  let detail: any = {};
  const startTime = body.start_time ? new Date(body.start_time).getTime() : 0;
  const timeSpent = startTime > 0 ? Math.floor((Date.now() - startTime) / 1000) : 0;

  if (mode === 'ordering') {
    // answers: [stepId1, stepId2, ...] 순서대로
    if (!Array.isArray(answers) || answers.length !== steps.length) {
      return errorResponse('입력 검증 오류: 모든 단계를 배치해야 합니다', 400);
    }
    let correct = 0;
    const stepResults: any[] = [];
    for (let i = 0; i < steps.length; i++) {
      const isCorrect = answers[i] === steps[i].id;
      if (isCorrect) correct++;
      stepResults.push({
        position: i + 1,
        submitted: answers[i],
        expected: steps[i].id,
        correct: isCorrect,
      });
    }
    score = Math.round((correct / steps.length) * 100);
    detail = { correct, total: steps.length, results: stepResults };
  } else {
    // fill_blank: answers: { [stepId]: { [blankIndex]: value } }
    if (!answers || typeof answers !== 'object') {
      return errorResponse('입력 검증 오류: 빈칸 답안이 필요합니다', 400);
    }
    let correct = 0;
    let total = 0;
    const blankResults: any[] = [];

    for (const step of steps) {
      if (!step.blanks_json) continue;
      const blanks = safeParseBlanks(step.blanks_json);
      const stepAnswers = answers[step.id] || {};

      for (let bi = 0; bi < blanks.length; bi++) {
        const expected = blanks[bi].answer;
        const submitted = stepAnswers[bi]?.toString().trim() || '';
        if (!submitted) continue;

        total++;
        // 정규화된 비교 (공백, 대소문자)
        const isCorrect = normalizeAnswer(submitted) === normalizeAnswer(expected);
        if (isCorrect) correct++;
        blankResults.push({
          step_id: step.id,
          blank_index: bi,
          submitted,
          expected,
          correct: isCorrect,
        });
      }
    }

    score = total > 0 ? Math.round((correct / total) * 100) : 0;
    detail = { correct, total, results: blankResults };
  }

  // Leitner box 업데이트
  const lastResult = await executeFirst<any>(
    context.env.DB,
    'SELECT box FROM proof_results WHERE student_id = ? AND proof_id = ? AND mode = ? ORDER BY attempted_at DESC LIMIT 1',
    [auth.studentId, proofId, mode]
  );
  const boxBefore = lastResult?.box || 1;
  const boxAfter = score >= 70 ? Math.min(5, boxBefore + 1) : 1;

  // 결과 저장
  const resultId = generatePrefixedId('pres');
  const now = new Date().toISOString();
  const today = now.split('T')[0];

  const session = await executeFirst<any>(
    context.env.DB,
    'SELECT id FROM gacha_sessions WHERE student_id = ? AND session_date = ?',
    [auth.studentId, today]
  );

  await executeInsert(
    context.env.DB,
    `INSERT INTO proof_results (id, student_id, proof_id, session_id, mode, score, time_spent, detail_json, box, attempted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [resultId, auth.studentId, proofId, session?.id || null, mode, score, timeSpent, JSON.stringify(detail), boxAfter, now]
  );

  // 세션 카운트 업데이트
  if (session) {
    await executeUpdate(
      context.env.DB,
      'UPDATE gacha_sessions SET proofs_done = proofs_done + 1 WHERE id = ?',
      [session.id]
    );
  }

  return successResponse({
    score,
    box_before: boxBefore,
    box_after: boxAfter,
    detail,
    time_spent: timeSpent,
  });
}

// ── 답안 정규화 ──

function normalizeAnswer(s: string): string {
  return s.replace(/\s+/g, '').toLowerCase()
    .replace(/\\/g, '')          // LaTeX backslash 제거
    .replace(/\{|\}/g, '')       // LaTeX 중괄호 제거
    .replace(/\^/g, '')          // 지수 기호
    .replace(/_/g, '');          // 하첨자 기호
}

// ── 학생 프로필 + 통계 ──

async function handleGetProfile(context: RequestContext, auth: PlayAuth): Promise<Response> {
  const student = await executeFirst<any>(
    context.env.DB,
    'SELECT id, name, grade FROM gacha_students WHERE id = ?',
    [auth.studentId]
  );

  // 최근 7일 세션
  const sessions = await executeQuery<any>(
    context.env.DB,
    `SELECT * FROM gacha_sessions WHERE student_id = ? ORDER BY session_date DESC LIMIT 7`,
    [auth.studentId]
  );

  // 카드 Box 분포 (학생 본인 카드만)
  const boxDistribution = await executeQuery<any>(
    context.env.DB,
    `SELECT box, COUNT(*) as count FROM gacha_cards
     WHERE student_id = ?
     GROUP BY box ORDER BY box`,
    [auth.studentId]
  );

  // 증명 성적
  const proofScores = await executeQuery<any>(
    context.env.DB,
    `SELECT pr.proof_id, p.title, pr.mode, pr.score, pr.box, pr.attempted_at
     FROM proof_results pr
     JOIN proofs p ON p.id = pr.proof_id
     WHERE pr.student_id = ?
     ORDER BY pr.attempted_at DESC LIMIT 20`,
    [auth.studentId]
  );

  return successResponse({
    student,
    sessions,
    boxDistribution,
    recentProofScores: proofScores,
  });
}

// ── 메인 라우터 ──

export async function handleGachaPlay(
  method: string,
  pathname: string,
  request: Request,
  context: RequestContext
): Promise<Response> {
  try {
    // 로그인 (인증 불필요)
    if (pathname === '/api/play/login') {
      if (method === 'POST') return await handleLogin(request, context);
      return errorResponse('Method not allowed', 405);
    }

    // 이하 모든 요청은 PIN 토큰 필요
    const auth = await getPlayAuth(context);
    if (!requirePlayAuth(auth)) {
      return unauthorizedResponse();
    }

    // /api/play/session
    if (pathname === '/api/play/session') {
      if (method === 'GET') return await handleGetSession(context, auth);
      return errorResponse('Method not allowed', 405);
    }

    // /api/play/profile
    if (pathname === '/api/play/profile') {
      if (method === 'GET') return await handleGetProfile(context, auth);
      return errorResponse('Method not allowed', 405);
    }

    // /api/play/random-card
    if (pathname === '/api/play/random-card') {
      if (method === 'GET') return await handleRandomCard(context, auth);
      return errorResponse('Method not allowed', 405);
    }

    // /api/play/card/:id/feedback
    const feedbackMatch = pathname.match(/^\/api\/play\/card\/([^/]+)\/feedback$/);
    if (feedbackMatch) {
      if (method === 'POST') return await handleCardFeedback(request, context, auth, feedbackMatch[1]);
      return errorResponse('Method not allowed', 405);
    }

    // /api/play/proofs
    if (pathname === '/api/play/proofs') {
      if (method === 'GET') return await handleGetProofs(context, auth);
      return errorResponse('Method not allowed', 405);
    }

    // /api/play/proof/:id/ordering
    const orderingMatch = pathname.match(/^\/api\/play\/proof\/([^/]+)\/ordering$/);
    if (orderingMatch) {
      if (method === 'GET') return await handleProofOrdering(context, auth, orderingMatch[1]);
      return errorResponse('Method not allowed', 405);
    }

    // /api/play/proof/:id/fillblank
    const fillBlankMatch = pathname.match(/^\/api\/play\/proof\/([^/]+)\/fillblank$/);
    if (fillBlankMatch) {
      if (method === 'GET') return await handleProofFillBlank(context, auth, fillBlankMatch[1]);
      return errorResponse('Method not allowed', 405);
    }

    // /api/play/proof/:id/submit
    const submitMatch = pathname.match(/^\/api\/play\/proof\/([^/]+)\/submit$/);
    if (submitMatch) {
      if (method === 'POST') return await handleProofSubmit(request, context, auth, submitMatch[1]);
      return errorResponse('Method not allowed', 405);
    }

    return errorResponse('Not found', 404);
  } catch (error) {
    return handleRouteError(error, '가차 플레이');
  }
}
