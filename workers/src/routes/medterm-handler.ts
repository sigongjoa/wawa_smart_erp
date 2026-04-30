/**
 * MedTerm 교사용 핸들러 (JWT)
 * 교재·챕터·단어요소·용어·시드·학생할당.
 *
 * 보안 (CLAUDE.md 준수):
 *  - academy_id 격리: 학생 진척 테이블 모든 SELECT/UPDATE 에 academy_id 필터
 *  - 콘텐츠(books/chapters/parts/terms/exam_items)는 academy 무관 공유
 *  - sanitize: 모든 텍스트 입력 sanitize + 길이 캡
 *  - isValidId: URL/body 의 ID 화이트리스트
 *  - 멱등: INSERT OR IGNORE + status 가드
 */
import { z } from 'zod';
import { RequestContext } from '@/types';
import { requireAuth, requireRole } from '@/middleware/auth';
import { getAcademyId, getUserId } from '@/utils/context';
import { generatePrefixedId } from '@/utils/id';
import { executeQuery, executeFirst, executeInsert } from '@/utils/db';
import { successResponse, errorResponse, unauthorizedResponse } from '@/utils/response';
import { handleRouteError } from '@/utils/error-handler';
import { logger } from '@/utils/logger';
import { sanitizeText, sanitizeNullable, sanitizeRequired, isValidId } from '@/utils/sanitize';

// ── 행 타입 ──
interface IdRow { id: string }
interface BookRow {
  id: string; title: string; publisher: string | null; field: string | null;
}
interface ChapterRow {
  id: string; book_id: string; chapter_no: number; title: string;
  page_start: number | null; page_end: number | null; objectives: string | null;
}
interface TermRow {
  id: string; chapter_id: string; term: string; meaning_ko: string;
}

// ── Zod 스키마 ──
const RoleSchema = z.enum(['p', 'r', 'cv', 's']);
const StudyModeSchema = z.enum(['meaning', 'decompose', 'compose', 'plural', 'figure']);

const CreateBookSchema = z.object({
  id: z.string().min(1).max(64),
  title: z.string().min(1).max(200),
  publisher: z.string().max(100).nullish(),
  edition: z.string().max(50).nullish(),
  field: z.string().max(50).nullish(),
});

const CreateChapterSchema = z.object({
  id: z.string().min(1).max(64),
  book_id: z.string().min(1).max(64),
  chapter_no: z.number().int().min(1).max(999),
  title: z.string().min(1).max(200),
  page_start: z.number().int().min(1).max(9999).nullish(),
  page_end: z.number().int().min(1).max(9999).nullish(),
  objectives: z.string().max(2000).nullish(),
});

const SeedPartSchema = z.object({
  id: z.string().min(1).max(64),
  role: RoleSchema,
  value: z.string().min(1).max(100),
  meaning_ko: z.string().min(1).max(200),
  meaning_en: z.string().max(200).nullish(),
  origin: z.string().max(50).nullish(),
  origin_word: z.string().max(100).nullish(),
});
const SeedTermSchema = z.object({
  id: z.string().min(1).max(64),
  term: z.string().min(1).max(150),
  meaning_ko: z.string().min(1).max(500),
  meaning_long: z.string().max(2000).nullish(),
  category: z.string().max(50).nullish(),
  is_constructed: z.number().int().min(0).max(1).default(1),
  plural_form: z.string().max(150).nullish(),
  plural_rule: z.string().max(100).nullish(),
  parts: z.array(z.object({
    part_id: z.string().min(1).max(64),
    position: z.number().int().min(0).max(20),
  })).max(20).default([]),
});
const SeedExamItemSchema = z.object({
  id: z.string().min(1).max(64),
  no: z.number().int().min(1).max(999),
  type: z.enum(['객관식', '단답형', '매칭', '빈칸', '용어분해', 'OX']),
  topic: z.string().max(100).nullish(),
  difficulty: z.enum(['하', '중', '상']),
  question: z.string().min(1).max(2000),
  body_json: z.unknown(),     // 유형별 페이로드
  answer_json: z.unknown(),
  explanation: z.string().max(2000).nullish(),
  figure_id: z.string().max(64).nullish(),
});
const SeedSchema = z.object({
  parts: z.array(SeedPartSchema).max(500).default([]),
  terms: z.array(SeedTermSchema).max(500).default([]),
  exam_items: z.array(SeedExamItemSchema).max(500).default([]),
});

const AssignSchema = z.object({
  student_ids: z.array(z.string().min(1).max(64)).min(1).max(100),
  modes: z.array(StudyModeSchema).min(1).max(5).default(['meaning']),
});

function zodError(err: unknown): Response | null {
  if (err instanceof z.ZodError) {
    return errorResponse(`입력 검증 오류: ${err.errors[0]?.message || 'invalid'}`, 400);
  }
  return null;
}

// ── 교재 ──────────────────────────────────────────────────────────

async function handleCreateBook(request: Request, context: RequestContext): Promise<Response> {
  if (!requireAuth(context) || !requireRole(context, 'instructor', 'admin')) {
    return unauthorizedResponse();
  }
  let data;
  try {
    data = CreateBookSchema.parse(await request.json());
  } catch (err) {
    const z = zodError(err);
    if (z) return z;
    throw err;
  }
  if (!isValidId(data.id)) return errorResponse('id 형식 오류', 400);

  await executeInsert(
    context.env.DB,
    `INSERT OR IGNORE INTO med_books(id,title,publisher,edition,field)
     VALUES(?,?,?,?,?)`,
    [
      data.id,
      sanitizeRequired(data.title, 'title', 200),
      sanitizeNullable(data.publisher, 100),
      sanitizeNullable(data.edition, 50),
      sanitizeNullable(data.field, 50),
    ]
  );
  return successResponse({ id: data.id }, 201);
}

async function handleListBooks(_req: Request, context: RequestContext): Promise<Response> {
  if (!requireAuth(context) || !requireRole(context, 'instructor', 'admin')) {
    return unauthorizedResponse();
  }
  const rows = await executeQuery<BookRow>(
    context.env.DB,
    `SELECT id,title,publisher,field FROM med_books ORDER BY created_at DESC`,
    []
  );
  return successResponse({ items: rows });
}

// ── 챕터 ──────────────────────────────────────────────────────────

async function handleCreateChapter(request: Request, context: RequestContext): Promise<Response> {
  if (!requireAuth(context) || !requireRole(context, 'instructor', 'admin')) {
    return unauthorizedResponse();
  }
  let data;
  try {
    data = CreateChapterSchema.parse(await request.json());
  } catch (err) {
    const z = zodError(err);
    if (z) return z;
    throw err;
  }
  if (!isValidId(data.id) || !isValidId(data.book_id)) {
    return errorResponse('id 형식 오류', 400);
  }

  const book = await executeFirst<IdRow>(
    context.env.DB,
    'SELECT id FROM med_books WHERE id = ?',
    [data.book_id]
  );
  if (!book) return errorResponse('교재를 찾을 수 없습니다', 404);

  await executeInsert(
    context.env.DB,
    `INSERT OR IGNORE INTO med_chapters(id,book_id,chapter_no,title,page_start,page_end,objectives)
     VALUES(?,?,?,?,?,?,?)`,
    [
      data.id,
      data.book_id,
      data.chapter_no,
      sanitizeRequired(data.title, 'title', 200),
      data.page_start ?? null,
      data.page_end ?? null,
      sanitizeNullable(data.objectives, 2000),
    ]
  );
  return successResponse({ id: data.id }, 201);
}

async function handleListChapters(request: Request, context: RequestContext): Promise<Response> {
  if (!requireAuth(context) || !requireRole(context, 'instructor', 'admin')) {
    return unauthorizedResponse();
  }
  const url = new URL(request.url);
  const bookId = url.searchParams.get('book_id');
  if (bookId && !isValidId(bookId)) return errorResponse('book_id 형식 오류', 400);

  const sql = bookId
    ? `SELECT id,book_id,chapter_no,title,page_start,page_end,objectives
       FROM med_chapters WHERE book_id = ? ORDER BY chapter_no`
    : `SELECT id,book_id,chapter_no,title,page_start,page_end,objectives
       FROM med_chapters ORDER BY book_id, chapter_no`;
  const rows = await executeQuery<ChapterRow>(
    context.env.DB,
    sql,
    bookId ? [bookId] : []
  );
  return successResponse({ items: rows });
}

// ── 시드 import (UC-MT-02) ─────────────────────────────────────────

/**
 * POST /api/medterm/chapters/:id/seed
 * body: { parts: [...], terms: [...], exam_items: [...] }
 *
 * db.batch() 로 원자적 적용 — 부분 실패 시 전체 롤백.
 * 멱등: INSERT OR IGNORE 사용 → 동일 요청 두 번 보내도 안전.
 */
async function handleSeedChapter(request: Request, context: RequestContext, chapterId: string): Promise<Response> {
  if (!requireAuth(context) || !requireRole(context, 'instructor', 'admin')) {
    return unauthorizedResponse();
  }
  if (!isValidId(chapterId)) return errorResponse('chapter id 형식 오류', 400);

  const chapter = await executeFirst<IdRow>(
    context.env.DB,
    'SELECT id FROM med_chapters WHERE id = ?',
    [chapterId]
  );
  if (!chapter) return errorResponse('챕터를 찾을 수 없습니다', 404);

  let data;
  try {
    data = SeedSchema.parse(await request.json());
  } catch (err) {
    const z = zodError(err);
    if (z) return z;
    throw err;
  }

  const stmts = [];

  // 단어 요소
  for (const p of data.parts) {
    if (!isValidId(p.id)) return errorResponse(`part id 형식 오류: ${p.id}`, 400);
    stmts.push(context.env.DB.prepare(
      `INSERT OR IGNORE INTO med_word_parts(id,chapter_id,role,value,meaning_ko,meaning_en,origin,origin_word)
       VALUES(?,?,?,?,?,?,?,?)`
    ).bind(
      p.id, chapterId, p.role,
      sanitizeRequired(p.value, 'value', 100),
      sanitizeRequired(p.meaning_ko, 'meaning_ko', 200),
      sanitizeNullable(p.meaning_en, 200),
      sanitizeNullable(p.origin, 50),
      sanitizeNullable(p.origin_word, 100),
    ));
  }

  // 의학용어 + 합성 링크
  for (const t of data.terms) {
    if (!isValidId(t.id)) return errorResponse(`term id 형식 오류: ${t.id}`, 400);
    stmts.push(context.env.DB.prepare(
      `INSERT OR IGNORE INTO med_terms(id,chapter_id,term,meaning_ko,meaning_long,category,is_constructed,plural_form,plural_rule)
       VALUES(?,?,?,?,?,?,?,?,?)`
    ).bind(
      t.id, chapterId,
      sanitizeRequired(t.term, 'term', 150),
      sanitizeRequired(t.meaning_ko, 'meaning_ko', 500),
      sanitizeNullable(t.meaning_long, 2000),
      sanitizeNullable(t.category, 50),
      t.is_constructed,
      sanitizeNullable(t.plural_form, 150),
      sanitizeNullable(t.plural_rule, 100),
    ));
    for (const link of t.parts) {
      if (!isValidId(link.part_id)) {
        return errorResponse(`term_parts.part_id 형식 오류: ${link.part_id}`, 400);
      }
      const linkId = `tp-${t.id.replace(/^mt-/, '')}-${link.position}`;
      stmts.push(context.env.DB.prepare(
        `INSERT OR IGNORE INTO med_term_parts(id,term_id,part_id,position)
         VALUES(?,?,?,?)`
      ).bind(linkId, t.id, link.part_id, link.position));
    }
  }

  // 출제 문항
  for (const e of data.exam_items) {
    if (!isValidId(e.id)) return errorResponse(`exam_item id 형식 오류: ${e.id}`, 400);
    if (e.figure_id && !isValidId(e.figure_id)) {
      return errorResponse(`figure_id 형식 오류: ${e.figure_id}`, 400);
    }
    // body_json/answer_json 길이 캡 (8KB 각각)
    const bodyStr = JSON.stringify(e.body_json ?? {}).slice(0, 8192);
    const ansStr = JSON.stringify(e.answer_json ?? null).slice(0, 8192);
    stmts.push(context.env.DB.prepare(
      `INSERT OR IGNORE INTO med_exam_items
       (id,chapter_id,no,type,topic,difficulty,question,body_json,answer_json,explanation,figure_id)
       VALUES(?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(
      e.id, chapterId, e.no, e.type,
      sanitizeNullable(e.topic, 100),
      e.difficulty,
      sanitizeRequired(e.question, 'question', 2000),
      bodyStr, ansStr,
      sanitizeNullable(e.explanation, 2000),
      e.figure_id ?? null,
    ));
  }

  if (stmts.length === 0) return errorResponse('시드 데이터가 비어 있습니다', 400);

  await context.env.DB.batch(stmts);
  return successResponse({
    inserted: {
      parts: data.parts.length,
      terms: data.terms.length,
      term_parts: data.terms.reduce((acc, t) => acc + t.parts.length, 0),
      exam_items: data.exam_items.length,
    },
  });
}

// ── 학생 할당 (UC-MT-05) ────────────────────────────────────────────

/**
 * POST /api/medterm/chapters/:id/assign
 * body: { student_ids: [...], modes: ['meaning','decompose'] }
 *
 * 각 학생 × 챕터의 모든 용어 × 모드 조합으로 med_student_terms 생성 (box=1).
 */
async function handleAssignChapter(request: Request, context: RequestContext, chapterId: string): Promise<Response> {
  if (!requireAuth(context) || !requireRole(context, 'instructor', 'admin')) {
    return unauthorizedResponse();
  }
  if (!isValidId(chapterId)) return errorResponse('chapter id 형식 오류', 400);

  const academyId = getAcademyId(context);
  const userId = getUserId(context);

  const chapter = await executeFirst<IdRow>(
    context.env.DB,
    'SELECT id FROM med_chapters WHERE id = ?',
    [chapterId]
  );
  if (!chapter) return errorResponse('챕터를 찾을 수 없습니다', 404);

  let data;
  try {
    data = AssignSchema.parse(await request.json());
  } catch (err) {
    const z = zodError(err);
    if (z) return z;
    throw err;
  }
  for (const sid of data.student_ids) {
    if (!isValidId(sid)) return errorResponse(`student_id 형식 오류: ${sid}`, 400);
  }

  // 학생들이 본 학원 소속인지 사전 검증 (CLAUDE.md 1번)
  const placeholders = data.student_ids.map(() => '?').join(',');
  const validStudents = await executeQuery<IdRow>(
    context.env.DB,
    `SELECT id FROM gacha_students WHERE academy_id = ? AND id IN (${placeholders})`,
    [academyId, ...data.student_ids]
  );
  const validIdSet = new Set(validStudents.map(s => s.id));
  const invalid = data.student_ids.filter(s => !validIdSet.has(s));
  if (invalid.length > 0) {
    return errorResponse(`해당 학원 소속이 아닌 학생: ${invalid.join(', ')}`, 403);
  }

  // 챕터의 모든 의학용어 가져오기
  const terms = await executeQuery<IdRow>(
    context.env.DB,
    'SELECT id FROM med_terms WHERE chapter_id = ?',
    [chapterId]
  );
  if (terms.length === 0) {
    return errorResponse('챕터에 의학용어가 없습니다 — 먼저 시드하세요', 400);
  }

  const stmts = [];
  const modesJson = JSON.stringify(data.modes);
  for (const sid of data.student_ids) {
    const scId = generatePrefixedId('msc');
    stmts.push(context.env.DB.prepare(
      `INSERT OR IGNORE INTO med_student_chapters
       (id,academy_id,student_id,chapter_id,modes_json,assigned_by)
       VALUES(?,?,?,?,?,?)`
    ).bind(scId, academyId, sid, chapterId, modesJson, userId));

    for (const t of terms) {
      for (const mode of data.modes) {
        const stId = generatePrefixedId('mst');
        stmts.push(context.env.DB.prepare(
          `INSERT OR IGNORE INTO med_student_terms
           (id,academy_id,student_id,term_id,study_mode,box,next_review)
           VALUES(?,?,?,?,?,1,datetime('now'))`
        ).bind(stId, academyId, sid, t.id, mode));
      }
    }
  }
  await context.env.DB.batch(stmts);

  return successResponse({
    assigned_students: data.student_ids.length,
    terms: terms.length,
    modes: data.modes,
    cards_created: data.student_ids.length * terms.length * data.modes.length,
  });
}

// ── 학생 진척 조회 (UC-MT-06) ───────────────────────────────────────

async function handleStudentProgress(request: Request, context: RequestContext): Promise<Response> {
  if (!requireAuth(context) || !requireRole(context, 'instructor', 'admin')) {
    return unauthorizedResponse();
  }
  const academyId = getAcademyId(context);
  const url = new URL(request.url);
  const studentId = url.searchParams.get('student_id');
  const chapterId = url.searchParams.get('chapter_id');
  if (!studentId || !isValidId(studentId)) return errorResponse('student_id 필요', 400);
  if (chapterId && !isValidId(chapterId)) return errorResponse('chapter_id 형식 오류', 400);

  // 학생 학원 격리 검증
  const student = await executeFirst<IdRow>(
    context.env.DB,
    'SELECT id FROM gacha_students WHERE id = ? AND academy_id = ?',
    [studentId, academyId]
  );
  if (!student) return errorResponse('학생을 찾을 수 없습니다', 404);

  // box 분포 + 모드별
  const boxRows = await executeQuery<{ study_mode: string; box: number; cnt: number }>(
    context.env.DB,
    `SELECT study_mode, box, COUNT(*) as cnt
     FROM med_student_terms
     WHERE academy_id = ? AND student_id = ?
       ${chapterId ? 'AND term_id IN (SELECT id FROM med_terms WHERE chapter_id = ?)' : ''}
     GROUP BY study_mode, box
     ORDER BY study_mode, box`,
    chapterId ? [academyId, studentId, chapterId] : [academyId, studentId]
  );

  // 약점 — wrong_count 상위 10
  const weakRows = await executeQuery<{ term: string; meaning_ko: string; wrong_count: number; box: number }>(
    context.env.DB,
    `SELECT t.term, t.meaning_ko, st.wrong_count, st.box
     FROM med_student_terms st
     JOIN med_terms t ON t.id = st.term_id
     WHERE st.academy_id = ? AND st.student_id = ?
       ${chapterId ? 'AND t.chapter_id = ?' : ''}
       AND st.wrong_count > 0
     ORDER BY st.wrong_count DESC, st.box ASC
     LIMIT 10`,
    chapterId ? [academyId, studentId, chapterId] : [academyId, studentId]
  );

  return successResponse({
    box_distribution: boxRows,
    weak_terms: weakRows,
  });
}

// ── 라우터 ─────────────────────────────────────────────────────────

export async function handleMedTerm(
  method: string,
  pathname: string,
  request: Request,
  context: RequestContext
): Promise<Response> {
  try {
    // 교재
    if (pathname === '/api/medterm/books') {
      if (method === 'GET') return handleListBooks(request, context);
      if (method === 'POST') return handleCreateBook(request, context);
    }
    // 챕터
    if (pathname === '/api/medterm/chapters') {
      if (method === 'GET') return handleListChapters(request, context);
      if (method === 'POST') return handleCreateChapter(request, context);
    }
    // 시드: POST /api/medterm/chapters/:id/seed
    const seedM = pathname.match(/^\/api\/medterm\/chapters\/([^/]+)\/seed$/);
    if (seedM && method === 'POST') {
      return handleSeedChapter(request, context, seedM[1]);
    }
    // 할당: POST /api/medterm/chapters/:id/assign
    const assignM = pathname.match(/^\/api\/medterm\/chapters\/([^/]+)\/assign$/);
    if (assignM && method === 'POST') {
      return handleAssignChapter(request, context, assignM[1]);
    }
    // 진척: GET /api/medterm/progress?student_id=...&chapter_id=...
    if (pathname === '/api/medterm/progress' && method === 'GET') {
      return handleStudentProgress(request, context);
    }
    return errorResponse('Not Found', 404);
  } catch (err) {
    return handleRouteError(err, 'medterm-handler');
  }
}
