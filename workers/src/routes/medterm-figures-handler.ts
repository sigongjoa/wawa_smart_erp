/**
 * MedTerm 그림 핸들러 — R2 업로드 + 라벨 좌표 + 그림 fetch.
 *
 * 보안 (CLAUDE.md 9번 — 파일 업로드):
 *  - mime deny (XSS 호스팅 차단)
 *  - ext sanitize (path traversal 방어)
 *  - R2 키 prefix academy_id (학원 격리)
 *  - contentType 서버 결정 (file.type 신뢰 X)
 */
import { z } from 'zod';
import { RequestContext } from '@/types';
import { requireAuth, requireRole } from '@/middleware/auth';
import { getAcademyId } from '@/utils/context';
import { generatePrefixedId } from '@/utils/id';
import { executeQuery, executeFirst, executeInsert } from '@/utils/db';
import { successResponse, errorResponse, unauthorizedResponse } from '@/utils/response';
import { handleRouteError } from '@/utils/error-handler';
import { sanitizeText, sanitizeNullable, sanitizeRequired, isValidId } from '@/utils/sanitize';

interface FigureRow {
  id: string;
  chapter_id: string;
  label: string;
  caption: string | null;
  fig_type: string;
  r2_key: string;
  width: number | null;
  height: number | null;
}

interface LabelRow {
  id: string;
  figure_id: string;
  part_id: string | null;
  x_ratio: number;
  y_ratio: number;
  text: string;
}

const BLOCKED_MIMES = [
  'text/html', 'text/javascript', 'application/javascript',
  'application/x-javascript', 'image/svg+xml',
];

function safeExt(filename: string): string {
  const ext = (filename.split('.').pop() || 'jpg')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 8);
  return ext || 'jpg';
}

const CreateLabelSchema = z.object({
  part_id: z.string().min(1).max(64).nullish(),
  x_ratio: z.number().min(0).max(1),
  y_ratio: z.number().min(0).max(1),
  text: z.string().min(1).max(200),
});

// ── 그림 업로드 (UC-MT-03) ─────────────────────────────────────────

/**
 * POST /api/medterm/figures
 * multipart/form-data:
 *   - file: 이미지 파일
 *   - chapter_id: string
 *   - figure_id: string (sanitized)
 *   - label: string (예: '그림 1-3')
 *   - caption: string?
 *   - fig_type: anatomy|diagram|etymology|illustration
 */
async function handleUploadFigure(request: Request, context: RequestContext): Promise<Response> {
  if (!requireAuth(context) || !requireRole(context, 'instructor', 'admin')) {
    return unauthorizedResponse();
  }
  const academyId = getAcademyId(context);

  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File)) return errorResponse('file 누락', 400);

  const figureId = sanitizeText(form.get('figure_id'), 64);
  const chapterId = sanitizeText(form.get('chapter_id'), 64);
  const label = sanitizeText(form.get('label'), 100);
  const caption = sanitizeNullable(form.get('caption'), 500);
  const figType = sanitizeText(form.get('fig_type'), 30);

  if (!isValidId(figureId)) return errorResponse('figure_id 형식 오류', 400);
  if (!isValidId(chapterId)) return errorResponse('chapter_id 형식 오류', 400);
  if (!label) return errorResponse('label 누락', 400);
  if (!['anatomy', 'diagram', 'etymology', 'illustration'].includes(figType)) {
    return errorResponse('fig_type 오류', 400);
  }

  // 챕터 존재 검증
  const chapter = await executeFirst<{ id: string }>(
    context.env.DB,
    'SELECT id FROM med_chapters WHERE id = ?',
    [chapterId]
  );
  if (!chapter) return errorResponse('챕터를 찾을 수 없습니다', 404);

  // mime deny + 크기 캡 (10MB)
  const fileMime = (file.type || '').toLowerCase();
  if (BLOCKED_MIMES.some((m) => fileMime.startsWith(m))) {
    return errorResponse('허용되지 않는 형식', 415);
  }
  if (file.size > 10 * 1024 * 1024) {
    return errorResponse('파일 크기 10MB 초과', 413);
  }

  const ext = safeExt(file.name);
  // R2 키에 academy_id 포함 — 학원 격리 (CLAUDE.md 9번)
  const r2Key = `medterm/${academyId}/figs/${figureId}.${ext}`;

  const buffer = await file.arrayBuffer();
  await context.env.BUCKET.put(r2Key, buffer, {
    httpMetadata: {
      contentType: 'application/octet-stream',  // 서버 결정
    },
  });

  // DB upsert (멱등) — 동일 figure_id 재업로드 시 r2_key·label 갱신
  const existing = await executeFirst<{ id: string }>(
    context.env.DB,
    'SELECT id FROM med_figures WHERE id = ?',
    [figureId]
  );

  if (existing) {
    await context.env.DB.prepare(
      `UPDATE med_figures
       SET chapter_id=?, label=?, caption=?, fig_type=?, r2_key=?
       WHERE id=?`
    ).bind(chapterId, label, caption, figType, r2Key, figureId).run();
  } else {
    await executeInsert(
      context.env.DB,
      `INSERT INTO med_figures(id,chapter_id,label,caption,fig_type,r2_key)
       VALUES(?,?,?,?,?,?)`,
      [figureId, chapterId, label, caption, figType, r2Key]
    );
  }

  return successResponse({ id: figureId, r2_key: r2Key, size: file.size });
}

// ── 그림 fetch (강사·학생 공통) ────────────────────────────────────

/**
 * GET /api/medterm/figures/:id/image
 * R2 객체를 image/* 로 서빙. ACL: r2_key 가 본 학원 prefix 인지 검증.
 */
async function handleFetchFigureImage(
  request: Request,
  context: RequestContext,
  figureId: string,
  isPlay: boolean,
  playAcademyId?: string
): Promise<Response> {
  if (!isValidId(figureId)) return errorResponse('figure id 형식 오류', 400);

  const academyId = isPlay ? (playAcademyId as string) : getAcademyId(context);

  const fig = await executeFirst<{ r2_key: string }>(
    context.env.DB,
    'SELECT r2_key FROM med_figures WHERE id = ?',
    [figureId]
  );
  if (!fig) return errorResponse('그림을 찾을 수 없습니다', 404);

  // ACL: 본 학원 prefix
  if (!fig.r2_key.includes(`/${academyId}/`)) {
    return errorResponse('권한이 없습니다', 403);
  }

  const obj = await context.env.BUCKET.get(fig.r2_key);
  if (!obj) return errorResponse('파일이 없습니다', 404);

  // 안전한 contentType — 키 확장자 기반
  const ext = (fig.r2_key.split('.').pop() || 'jpg').toLowerCase();
  const ctMap: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif',
  };
  const contentType = ctMap[ext] || 'application/octet-stream';

  return new Response(obj.body, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'private, max-age=3600',
      'Content-Disposition': 'inline',
    },
  });
}

// ── 라벨 등록 / 조회 ──────────────────────────────────────────────

async function handleAddLabel(
  request: Request,
  context: RequestContext,
  figureId: string
): Promise<Response> {
  if (!requireAuth(context) || !requireRole(context, 'instructor', 'admin')) {
    return unauthorizedResponse();
  }
  if (!isValidId(figureId)) return errorResponse('figure id 형식 오류', 400);

  // 그림 존재 + 본 학원 격리
  const academyId = getAcademyId(context);
  const fig = await executeFirst<{ r2_key: string }>(
    context.env.DB,
    'SELECT r2_key FROM med_figures WHERE id = ?',
    [figureId]
  );
  if (!fig) return errorResponse('그림을 찾을 수 없습니다', 404);
  if (!fig.r2_key.includes(`/${academyId}/`)) {
    return errorResponse('권한이 없습니다', 403);
  }

  let data;
  try {
    data = CreateLabelSchema.parse(await request.json());
  } catch {
    return errorResponse('라벨 페이로드 오류', 400);
  }

  if (data.part_id && !isValidId(data.part_id)) {
    return errorResponse('part_id 형식 오류', 400);
  }

  const labelId = generatePrefixedId('fl');
  await executeInsert(
    context.env.DB,
    `INSERT INTO med_figure_labels(id,figure_id,part_id,x_ratio,y_ratio,text)
     VALUES(?,?,?,?,?,?)`,
    [labelId, figureId, data.part_id ?? null, data.x_ratio, data.y_ratio,
     sanitizeRequired(data.text, 'text', 200)]
  );

  return successResponse({ id: labelId }, 201);
}

async function handleListLabels(
  request: Request,
  context: RequestContext,
  figureId: string,
  isPlay: boolean,
  playAcademyId?: string
): Promise<Response> {
  if (!isValidId(figureId)) return errorResponse('figure id 형식 오류', 400);

  const academyId = isPlay ? (playAcademyId as string) : getAcademyId(context);

  const fig = await executeFirst<{ r2_key: string }>(
    context.env.DB,
    'SELECT r2_key FROM med_figures WHERE id = ?',
    [figureId]
  );
  if (!fig) return errorResponse('그림을 찾을 수 없습니다', 404);
  if (!fig.r2_key.includes(`/${academyId}/`)) {
    return errorResponse('권한이 없습니다', 403);
  }

  const labels = await executeQuery<LabelRow>(
    context.env.DB,
    `SELECT id, figure_id, part_id, x_ratio, y_ratio, text
     FROM med_figure_labels
     WHERE figure_id = ?
     ORDER BY id`,
    [figureId]
  );
  return successResponse({ items: labels });
}

// ── 챕터별 그림 목록 ──────────────────────────────────────────────

async function handleListByChapter(
  request: Request,
  context: RequestContext,
  isPlay: boolean,
  playAcademyId?: string
): Promise<Response> {
  const url = new URL(request.url);
  const chapterId = url.searchParams.get('chapter_id');
  if (!chapterId || !isValidId(chapterId)) {
    return errorResponse('chapter_id 필요', 400);
  }
  const academyId = isPlay ? (playAcademyId as string) : getAcademyId(context);

  const figs = await executeQuery<FigureRow & { has_image: number }>(
    context.env.DB,
    `SELECT id, chapter_id, label, caption, fig_type, r2_key, width, height,
            CASE WHEN r2_key LIKE 'medterm/' || ? || '/%' THEN 1 ELSE 0 END AS has_image
     FROM med_figures
     WHERE chapter_id = ?
     ORDER BY id`,
    [academyId, chapterId]
  );
  // r2_key 노출은 strip — has_image 만 알린다
  const items = figs.map((f) => ({
    id: f.id,
    chapter_id: f.chapter_id,
    label: f.label,
    caption: f.caption,
    fig_type: f.fig_type,
    width: f.width,
    height: f.height,
    has_image: !!f.has_image,
  }));
  return successResponse({ items });
}

// ── 라우터 (강사용) ────────────────────────────────────────────────

export async function handleMedTermFigures(
  method: string,
  pathname: string,
  request: Request,
  context: RequestContext
): Promise<Response> {
  try {
    // GET /api/medterm/figures?chapter_id=... — 챕터별 목록
    if (pathname === '/api/medterm/figures' && method === 'GET') {
      if (!requireAuth(context) || !requireRole(context, 'instructor', 'admin')) {
        return unauthorizedResponse();
      }
      return handleListByChapter(request, context, false);
    }
    // POST /api/medterm/figures — 업로드 (multipart)
    if (pathname === '/api/medterm/figures' && method === 'POST') {
      return handleUploadFigure(request, context);
    }
    // GET /api/medterm/figures/:id/image — 이미지 서빙 (강사)
    const imgM = pathname.match(/^\/api\/medterm\/figures\/([^/]+)\/image$/);
    if (imgM && method === 'GET') {
      if (!requireAuth(context) || !requireRole(context, 'instructor', 'admin')) {
        return unauthorizedResponse();
      }
      return handleFetchFigureImage(request, context, imgM[1], false);
    }
    // GET /api/medterm/figures/:id/labels
    const labelsM = pathname.match(/^\/api\/medterm\/figures\/([^/]+)\/labels$/);
    if (labelsM && method === 'GET') {
      if (!requireAuth(context) || !requireRole(context, 'instructor', 'admin')) {
        return unauthorizedResponse();
      }
      return handleListLabels(request, context, labelsM[1], false);
    }
    // POST /api/medterm/figures/:id/labels
    if (labelsM && method === 'POST') {
      return handleAddLabel(request, context, labelsM[1]);
    }

    return errorResponse('Not Found', 404);
  } catch (err) {
    return handleRouteError(err, 'medterm-figures');
  }
}

// ── 학생용 — play 라우터에서 호출 ────────────────────────────────

export async function handleMedTermFiguresPlay(
  method: string,
  pathname: string,
  request: Request,
  context: RequestContext,
  academyId: string
): Promise<Response> {
  try {
    if (pathname === '/api/play/medterm/figures' && method === 'GET') {
      return handleListByChapter(request, context, true, academyId);
    }
    const imgM = pathname.match(/^\/api\/play\/medterm\/figures\/([^/]+)\/image$/);
    if (imgM && method === 'GET') {
      return handleFetchFigureImage(request, context, imgM[1], true, academyId);
    }
    const labelsM = pathname.match(/^\/api\/play\/medterm\/figures\/([^/]+)\/labels$/);
    if (labelsM && method === 'GET') {
      return handleListLabels(request, context, labelsM[1], true, academyId);
    }
    return errorResponse('Not Found', 404);
  } catch (err) {
    return handleRouteError(err, 'medterm-figures-play');
  }
}
