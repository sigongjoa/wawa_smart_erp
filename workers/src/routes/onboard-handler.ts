/**
 * 학원 온보딩 라우트 핸들러
 * 새 학원 등록, slug 중복 확인
 */

import { RequestContext } from '@/types';
import { executeFirst, executeInsert, executeUpdate } from '@/utils/db';
import { successResponse, errorResponse } from '@/utils/response';
import { logger } from '@/utils/logger';
import { z } from 'zod';

// slug 규칙: 영문 소문자, 숫자, 하이픈 (3~30자)
const SLUG_REGEX = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;

const RegisterSchema = z.object({
  academyName: z.string().min(1, '학원 이름은 필수입니다').max(100),
  slug: z.string().regex(SLUG_REGEX, '학원코드는 영문 소문자, 숫자, 하이픈만 가능 (3~30자)'),
  ownerName: z.string().min(1, '대표 이름은 필수입니다').max(50),
  pin: z.string().min(4, 'PIN은 최소 4자 이상이어야 합니다').max(20),
  phone: z.string().optional(),
  address: z.string().optional(),
});

const VerifySlugSchema = z.object({
  slug: z.string().regex(SLUG_REGEX, '학원코드는 영문 소문자, 숫자, 하이픈만 가능 (3~30자)'),
});

// 예약어 slug (사용 불가)
const RESERVED_SLUGS = new Set([
  'api', 'app', 'www', 'admin', 'super', 'login', 'register',
  'dashboard', 'help', 'support', 'docs', 'status', 'cdn',
]);

// ---------- PIN hashing (PBKDF2) ----------
const PBKDF2_ITERATIONS = 100_000;
const SALT_BYTES = 16;
const HASH_BYTES = 32;

function bufToB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

async function hashPinPbkdf2(pin: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(pin), { name: 'PBKDF2' }, false, ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    key, HASH_BYTES * 8,
  );
  return `pbkdf2$${PBKDF2_ITERATIONS}$${bufToB64(salt.buffer)}$${bufToB64(bits)}`;
}

export async function handleOnboard(
  method: string,
  pathname: string,
  request: Request,
  context: RequestContext
): Promise<Response> {
  try {
    // POST /api/onboard/register — 새 학원 + 대표 계정 생성
    if (method === 'POST' && pathname === '/api/onboard/register') {
      const body = await request.json() as any;
      const input = RegisterSchema.parse(body);

      // 예약어 체크
      if (RESERVED_SLUGS.has(input.slug)) {
        return errorResponse('사용할 수 없는 학원코드입니다', 400);
      }

      // slug 중복 확인
      const existing = await executeFirst<{ id: string }>(
        context.env.DB,
        'SELECT id FROM academies WHERE slug = ?',
        [input.slug]
      );
      if (existing) {
        return errorResponse('이미 사용 중인 학원코드입니다', 409);
      }

      // 학원 생성
      const academyId = `acad-${crypto.randomUUID().slice(0, 8)}`;
      const userId = `user-${crypto.randomUUID().slice(0, 8)}`;
      const classId = `class-default-${academyId}`;
      const now = new Date().toISOString();

      await executeInsert(
        context.env.DB,
        `INSERT INTO academies (id, name, slug, phone, address, owner_id, plan, max_students, max_teachers, is_active, default_class_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'free', 30, 3, 1, ?, ?, ?)`,
        [academyId, input.academyName, input.slug, input.phone || null, input.address || null, userId, classId, now, now]
      );

      // 기본 "전체" 클래스 생성
      await executeInsert(
        context.env.DB,
        `INSERT INTO classes (id, academy_id, name, created_at, updated_at) VALUES (?, ?, '전체', ?, ?)`,
        [classId, academyId, now, now]
      );

      // 대표 계정 (admin) 생성
      const hashedPin = await hashPinPbkdf2(input.pin);
      const uniqueEmail = `${input.slug}_admin@wawa.app`;

      await executeInsert(
        context.env.DB,
        `INSERT INTO users (id, email, name, password_hash, role, academy_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'admin', ?, ?, ?)`,
        [userId, uniqueEmail, input.ownerName, hashedPin, academyId, now, now]
      );

      logger.info(`새 학원 등록: ${input.academyName} (${input.slug})`);

      return successResponse({
        academyId,
        slug: input.slug,
        academyName: input.academyName,
        userId,
        message: '학원이 생성되었습니다. 로그인 페이지에서 학원코드와 이름, PIN으로 로그인하세요.',
      }, 201);
    }

    // POST /api/onboard/verify-slug — slug 사용 가능 확인
    if (method === 'POST' && pathname === '/api/onboard/verify-slug') {
      const body = await request.json() as any;
      const { slug } = VerifySlugSchema.parse(body);

      if (RESERVED_SLUGS.has(slug)) {
        return successResponse({ available: false, reason: '예약된 학원코드입니다' });
      }

      const existing = await executeFirst<{ id: string }>(
        context.env.DB,
        'SELECT id FROM academies WHERE slug = ?',
        [slug]
      );

      return successResponse({
        available: !existing,
        reason: existing ? '이미 사용 중인 학원코드입니다' : null,
      });
    }

    // GET /api/onboard/academies — 학원 목록 (공개, 로그인 페이지 드롭다운용)
    if (method === 'GET' && pathname === '/api/onboard/academies') {
      const rows = await context.env.DB.prepare(
        'SELECT slug, name, logo_url FROM academies WHERE is_active = 1 ORDER BY name'
      ).all<{ slug: string; name: string; logo_url: string | null }>();

      return successResponse(
        (rows.results || []).map(r => ({ slug: r.slug, name: r.name, logo: r.logo_url }))
      );
    }

    // GET /api/onboard/academy-info?slug=xxx — 학원 기본 정보 (공개)
    if (method === 'GET' && pathname === '/api/onboard/academy-info') {
      const url = new URL(request.url);
      const slug = url.searchParams.get('slug');

      if (!slug) {
        return errorResponse('slug 파라미터가 필요합니다', 400);
      }

      const academy = await executeFirst<{ name: string; logo_url: string | null }>(
        context.env.DB,
        'SELECT name, logo_url FROM academies WHERE slug = ? AND is_active = 1',
        [slug]
      );

      if (!academy) {
        return errorResponse('학원을 찾을 수 없습니다', 404);
      }

      return successResponse({
        name: academy.name,
        logo: academy.logo_url,
      });
    }

    return errorResponse('Not found', 404);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const message = error.errors.map(e => e.message).join(', ');
      return errorResponse(`입력 검증 오류: ${message}`, 400);
    }

    logger.error('온보딩 처리 중 오류', error instanceof Error ? error : new Error(String(error)));
    return errorResponse('요청 처리 실패', 500);
  }
}
