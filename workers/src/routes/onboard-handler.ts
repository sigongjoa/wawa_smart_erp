/**
 * 학원 온보딩 라우트 핸들러
 * 새 학원 등록, slug 중복 확인
 */

import { RequestContext } from '@/types';
import { executeFirst, executeInsert } from '@/utils/db';
import { successResponse, errorResponse } from '@/utils/response';
import { logger } from '@/utils/logger';
import { shouldBlockTestDataInProd } from '@/middleware/test-data-guard';
import { hashPin } from '@/utils/crypto';
import {
  publicAcademiesRateLimit,
  onboardRegisterRateLimit,
  verifySlugRateLimit,
  academyInfoRateLimit,
  signupRequestRateLimit,
} from '@/middleware/rateLimit';
import { sanitizeText, sanitizeNullable } from '@/utils/sanitize';
import { generatePrefixedId } from '@/utils/id';
import { z } from 'zod';

// 공개 학원 목록 캐시 키 (PERF-LOGIN-M1)
const ACADEMIES_CACHE_KEY = 'public:academies:v2';
const ACADEMIES_CACHE_TTL = 60; // 60초

// 학원 단건 정보 캐시 prefix (PERF-ONB-M2)
const ACADEMY_INFO_CACHE_PREFIX = 'public:academy-info:';
const ACADEMY_INFO_CACHE_TTL = 60;

// slug 규칙: 영문 소문자, 숫자, 하이픈 (3~30자)
const SLUG_REGEX = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;

// SEC-ONB-M4: 사람 이름 — 한글/영문 + 공백·점·하이픈·아포스트로피만 허용. 제어문자·태그 차단.
const PERSON_NAME_REGEX = /^[\p{L}\p{N}\s'.\-]{1,50}$/u;

const RegisterSchema = z.object({
  academyName: z.string().min(1, '학원 이름은 필수입니다').max(100),
  slug: z.string().regex(SLUG_REGEX, '학원코드는 영문 소문자, 숫자, 하이픈만 가능 (3~30자)'),
  ownerName: z
    .string()
    .min(1, '대표 이름은 필수입니다')
    .max(50)
    .regex(PERSON_NAME_REGEX, '대표 이름에 사용할 수 없는 문자가 포함되어 있습니다'),
  pin: z.string().min(4, 'PIN은 최소 4자 이상이어야 합니다').max(20),
  phone: z.string().max(20).optional(),
  address: z.string().max(200).optional(),
});

const VerifySlugSchema = z.object({
  slug: z.string().regex(SLUG_REGEX, '학원코드는 영문 소문자, 숫자, 하이픈만 가능 (3~30자)'),
});

// SEC-SSR-H2: 학생 자가 가입 요청 입력 스키마
const StudentSignupRequestSchema = z.object({
  academy_slug: z.string().regex(SLUG_REGEX),
  name: z.string().min(1).max(50).regex(PERSON_NAME_REGEX, '이름에 사용할 수 없는 문자가 포함되어 있습니다'),
  grade: z.string().max(20).optional(),
  pin: z.string().regex(/^\d{4}$/, 'PIN은 4자리 숫자여야 합니다'),
  memo: z.string().max(200).optional(),
});

// 예약어 slug (사용 불가)
const RESERVED_SLUGS = new Set([
  'api', 'app', 'www', 'admin', 'super', 'login', 'register',
  'dashboard', 'help', 'support', 'docs', 'status', 'cdn',
]);

export async function handleOnboard(
  method: string,
  pathname: string,
  request: Request,
  context: RequestContext
): Promise<Response> {
  try {
    // POST /api/onboard/register — 새 학원 + 대표 계정 생성
    if (method === 'POST' && pathname === '/api/onboard/register') {
      // SEC-ONB-H1: 봇/스팸 방어 — IP당 시간 1회, 일 3회
      const blocked = await onboardRegisterRateLimit(context.env.KV, request);
      if (blocked) return blocked;

      const body = await request.json() as any;
      const input = RegisterSchema.parse(body);

      // 예약어 체크
      if (RESERVED_SLUGS.has(input.slug)) {
        return errorResponse('사용할 수 없는 학원코드입니다', 400);
      }

      // prod 에서 테스트 패턴 이름으로 onboard 차단
      if (shouldBlockTestDataInProd(context.env.ENVIRONMENT, input.ownerName)) {
        logger.warn(`prod onboard 에서 테스트 패턴 차단: ownerName=${input.ownerName} slug=${input.slug}`);
        return errorResponse('테스트 패턴 이름으로는 학원을 생성할 수 없습니다', 403);
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

      // ID 사전 발급
      const academyId = `acad-${crypto.randomUUID().slice(0, 8)}`;
      const userId = `user-${crypto.randomUUID().slice(0, 8)}`;
      const classId = `class-default-${academyId}`;
      const now = new Date().toISOString();
      const hashedPin = await hashPin(input.pin);
      // SEC-ONB-M1: 이메일 예측 가능성 제거 — userId 기반 (UC-A1 SEC-H2와 동일 패턴)
      const uniqueEmail = `${userId}@wawa.app`;

      // SEC-ONB-H2 + PERF-ONB-M1: 3개 INSERT를 D1 batch로 원자 실행 —
      // 좀비 학원(class/admin 누락) 방지 + N+1 제거
      await context.env.DB.batch([
        context.env.DB
          .prepare(
            `INSERT INTO academies (id, name, slug, phone, address, owner_id, plan, max_students, max_teachers, is_active, default_class_id, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, 'free', 30, 3, 1, ?, ?, ?)`
          )
          .bind(academyId, input.academyName, input.slug, input.phone || null, input.address || null, userId, classId, now, now),
        context.env.DB
          .prepare(`INSERT INTO classes (id, academy_id, name, created_at, updated_at) VALUES (?, ?, '전체', ?, ?)`)
          .bind(classId, academyId, now, now),
        context.env.DB
          .prepare(
            `INSERT INTO users (id, email, name, password_hash, role, academy_id, created_at, updated_at)
             VALUES (?, ?, ?, ?, 'admin', ?, ?, ?)`
          )
          .bind(userId, uniqueEmail, input.ownerName, hashedPin, academyId, now, now),
      ]);

      logger.info(`새 학원 등록: ${input.academyName} (${input.slug})`);

      // 공개 목록 캐시 무효화 (PERF-LOGIN-M1)
      try { await context.env.KV.delete(ACADEMIES_CACHE_KEY); } catch { /* ignore */ }

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
      // SEC-ONB-M2: slug 열거 방어
      const blocked = await verifySlugRateLimit(context.env.KV, request);
      if (blocked) return blocked;

      const body = await request.json() as any;
      const { slug } = VerifySlugSchema.parse(body);

      // SEC-ONB-M2: 응답 단순화 — 예약어/중복 구분 없이 available 만 반환.
      // 등록 흐름 측은 register 응답으로 정확한 사유를 받는다.
      if (RESERVED_SLUGS.has(slug)) {
        return successResponse({ available: false });
      }
      const existing = await executeFirst<{ id: string }>(
        context.env.DB,
        'SELECT id FROM academies WHERE slug = ?',
        [slug]
      );
      return successResponse({ available: !existing });
    }

    // GET /api/onboard/academies — 학원 목록 (공개, 로그인 페이지 드롭다운용)
    // SEC-LOGIN-H1: rate limit + logo_url 응답에서 제거 (피싱 자산 차단)
    // PERF-LOGIN-M1: KV 60s 캐시
    if (method === 'GET' && pathname === '/api/onboard/academies') {
      const blocked = await publicAcademiesRateLimit(context.env.KV, request);
      if (blocked) return blocked;

      const cached = await context.env.KV.get(ACADEMIES_CACHE_KEY);
      if (cached) {
        try {
          return successResponse(JSON.parse(cached));
        } catch { /* fall-through to fresh fetch */ }
      }

      const rows = await context.env.DB.prepare(
        'SELECT slug, name FROM academies WHERE is_active = 1 ORDER BY name'
      ).all<{ slug: string; name: string }>();

      const payload = (rows.results || []).map((r: { slug: string; name: string }) => ({ slug: r.slug, name: r.name }));
      // 학원 등록/수정 핸들러에서 캐시 무효화 필요. (현 단계에서는 짧은 TTL로 한정.)
      try {
        await context.env.KV.put(ACADEMIES_CACHE_KEY, JSON.stringify(payload), {
          expirationTtl: ACADEMIES_CACHE_TTL,
        });
      } catch { /* KV 실패는 무시 — 응답은 성공 */ }

      return successResponse(payload);
    }

    // GET /api/onboard/academy-info?slug=xxx — 학원 기본 정보 (공개)
    // SEC-ONB-M3: rate limit, PERF-ONB-M2: KV 단건 캐시 60s
    if (method === 'GET' && pathname === '/api/onboard/academy-info') {
      const url = new URL(request.url);
      const slug = url.searchParams.get('slug');

      if (!slug || !SLUG_REGEX.test(slug)) {
        return errorResponse('slug 파라미터가 필요합니다', 400);
      }

      const blocked = await academyInfoRateLimit(context.env.KV, request, slug);
      if (blocked) return blocked;

      const cacheKey = `${ACADEMY_INFO_CACHE_PREFIX}${slug}`;
      const cached = await context.env.KV.get(cacheKey);
      if (cached) {
        try {
          return successResponse(JSON.parse(cached));
        } catch { /* fall-through */ }
      }

      const academy = await executeFirst<{ name: string; logo_url: string | null }>(
        context.env.DB,
        'SELECT name, logo_url FROM academies WHERE slug = ? AND is_active = 1',
        [slug]
      );

      if (!academy) {
        return errorResponse('학원을 찾을 수 없습니다', 404);
      }

      const payload = { name: academy.name, logo: academy.logo_url };
      try {
        await context.env.KV.put(cacheKey, JSON.stringify(payload), {
          expirationTtl: ACADEMY_INFO_CACHE_TTL,
        });
      } catch { /* ignore */ }

      return successResponse(payload);
    }

    // POST /api/onboard/student-signup-request — 학생 자가 가입 요청 (교사 승인 대기)
    if (method === 'POST' && pathname === '/api/onboard/student-signup-request') {
      const body = await request.json() as any;
      const input = StudentSignupRequestSchema.parse(body);

      // SEC-SSR-H1: 스팸/봇 방어 (IP+slug)
      const blocked = await signupRequestRateLimit(context.env.KV, request, input.academy_slug);
      if (blocked) return blocked;

      // 학원 조회
      const academy = await executeFirst<{ id: string }>(
        context.env.DB,
        'SELECT id FROM academies WHERE slug = ? AND is_active = 1',
        [input.academy_slug],
      );
      if (!academy) {
        return errorResponse('학원을 찾을 수 없습니다', 404);
      }

      const safeName = sanitizeText(input.name, 50);
      if (!safeName) {
        return errorResponse('입력 검증 오류: 이름', 400);
      }
      const safeGrade = sanitizeNullable(input.grade, 20);
      const safeMemo = sanitizeNullable(input.memo, 200);

      // 이미 등록된 학생(gacha_students)에 동명 존재 시 차단
      const existingStudent = await executeFirst<{ id: string }>(
        context.env.DB,
        'SELECT id FROM gacha_students WHERE academy_id = ? AND name = ?',
        [academy.id, safeName],
      );
      if (existingStudent) {
        return errorResponse('이미 등록된 학생입니다. 로그인을 시도해보세요.', 409);
      }

      // signup_requests에서 pending/rejected 동명 존재 확인 (UNIQUE 제약과 동일 결과를 미리 알림)
      const existingReq = await executeFirst<{ status: string }>(
        context.env.DB,
        'SELECT status FROM student_signup_requests WHERE academy_id = ? AND name = ?',
        [academy.id, safeName],
      );
      if (existingReq) {
        if (existingReq.status === 'pending') {
          return errorResponse('이미 가입 요청 중입니다. 선생님 승인을 기다려 주세요.', 409);
        }
        return errorResponse('이전 가입 요청이 거절되었습니다. 선생님께 문의해주세요.', 409);
      }

      const id = generatePrefixedId('ssr');
      const pinHash = await hashPin(input.pin);

      await executeInsert(
        context.env.DB,
        `INSERT INTO student_signup_requests
          (id, academy_id, name, grade, pin_hash, status, memo, submitted_at)
         VALUES (?, ?, ?, ?, ?, 'pending', ?, datetime('now'))`,
        [id, academy.id, safeName, safeGrade, pinHash, safeMemo],
      );

      logger.info(`학생 가입 요청 접수: ${safeName} (academy=${input.academy_slug})`);
      return successResponse(
        { id, message: '가입 요청이 접수되었습니다. 선생님 승인 후 로그인 가능합니다.' },
        201,
      );
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
