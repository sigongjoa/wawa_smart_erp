import { RequestContext } from '@/types';
import { errorResponse } from '@/utils/response';

const RATE_LIMIT_WINDOW = 60; // 1분
const RATE_LIMIT_REQUESTS = 120; // 일반 API: 1분에 120개
const LOGIN_RATE_LIMIT_WINDOW = 60; // 1분
const LOGIN_RATE_LIMIT_REQUESTS = 5; // 로그인: 1분에 5회

// In-memory rate limit store (per isolate). 무료티어 KV put 한도(1000/day) 보호용.
// isolate가 recycle되면 초기화되지만, 봇/스크래퍼 요청에 대한 소프트 실드로 충분함.
// 민감한 엔드포인트(로그인, AI)는 별도로 KV 기반 rate limit 유지.
interface MemoryBucket { count: number; resetAt: number; }
const memStore: Map<string, MemoryBucket> = (globalThis as any).__rateLimitStore ??= new Map();

function memCheck(key: string, max: number, windowSec: number): boolean {
  const now = Date.now();
  const bucket = memStore.get(key);
  if (!bucket || bucket.resetAt < now) {
    memStore.set(key, { count: 1, resetAt: now + windowSec * 1000 });
    return true;
  }
  if (bucket.count >= max) return false;
  bucket.count++;
  return true;
}

// 엔드포인트별 rate limit 설정
interface EndpointRateLimitConfig {
  prefix: string;
  methods?: string[];  // 비어 있으면 모든 메서드
  maxRequests: number;
  windowSeconds: number;
  message: string;
}

const ENDPOINT_LIMITS: EndpointRateLimitConfig[] = [
  {
    prefix: '/api/grader',
    maxRequests: 20,
    windowSeconds: 60,
    message: 'AI 채점 요청이 너무 많습니다. 1분 후 다시 시도하세요.',
  },
  {
    prefix: '/api/timer/finish-day',
    maxRequests: 5,
    windowSeconds: 60,
    message: '하루 마감 요청이 너무 많습니다. 1분 후 다시 시도하세요.',
  },
  {
    prefix: '/api/report',
    methods: ['POST', 'PATCH'],
    maxRequests: 60,
    windowSeconds: 60,
    message: '리포트 수정 요청이 너무 많습니다. 1분 후 다시 시도하세요.',
  },
  {
    prefix: '/api/ai/',
    maxRequests: 10,
    windowSeconds: 60,
    message: 'AI 요청이 너무 많습니다. 1분 후 다시 시도하세요.',
  },
  {
    prefix: '/api/meeting',
    methods: ['POST'],
    maxRequests: 10,
    windowSeconds: 60,
    message: '회의 요청이 너무 많습니다. 1분 후 다시 시도하세요.',
  },
  {
    prefix: '/api/file/upload',
    maxRequests: 20,
    windowSeconds: 60,
    message: '파일 업로드 요청이 너무 많습니다. 1분 후 다시 시도하세요.',
  },
];

export async function rateLimitMiddleware(
  context: RequestContext
): Promise<RequestContext | Response> {
  const ip = context.request.headers.get('CF-Connecting-IP') || 'unknown';
  const url = new URL(context.request.url);
  const pathname = url.pathname;
  const method = context.request.method;

  // 엔드포인트별 rate limit 체크 (in-memory)
  for (const limit of ENDPOINT_LIMITS) {
    if (!pathname.startsWith(limit.prefix)) continue;
    if (limit.methods && !limit.methods.includes(method)) continue;

    const epKey = `ep:${ip}:${limit.prefix}`;
    if (!memCheck(epKey, limit.maxRequests, limit.windowSeconds)) {
      return errorResponse(limit.message, 429);
    }
    break; // 첫 매칭 엔드포인트만 적용
  }

  // 일반 rate limit 체크 (in-memory)
  const key = `rl:${ip}`;
  if (!memCheck(key, RATE_LIMIT_REQUESTS, RATE_LIMIT_WINDOW)) {
    return errorResponse('Too many requests', 429);
  }

  return context;
}

type KVLike = {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
};

/** SHA-256 hex (key 길이/PII 보호용) */
async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * 로그인 전용 rate limiter — 5회/분 per IP.
 * Returns null if allowed, or a 429 Response if blocked.
 */
export async function loginRateLimit(
  kv: KVLike,
  request: Request,
): Promise<Response | null> {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const key = `login-limit:${ip}`;

  const count = await kv.get(key);
  const currentCount = count ? parseInt(count) : 0;

  if (currentCount >= LOGIN_RATE_LIMIT_REQUESTS) {
    const retryAfter = LOGIN_RATE_LIMIT_WINDOW.toString();
    return new Response(
      JSON.stringify({ error: '로그인 시도가 너무 많습니다. 1분 후 다시 시도하세요.', code: 'rate_limited' }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': retryAfter,
        },
      },
    );
  }

  await kv.put(key, (currentCount + 1).toString(), {
    expirationTtl: LOGIN_RATE_LIMIT_WINDOW,
  });

  return null; // allowed
}

// ──────────────────────────────────────────────────────────────────
// 계정 단위 lockout — 분산 무차별 대입 방어 (SEC-AUTH-H1)
// 5회 실패 시 15분 잠금. 성공 시 reset.
// 키는 (slug, name) 해시 — PII 회피.
// ──────────────────────────────────────────────────────────────────
const ACCOUNT_LOCKOUT_FAILS = 5;
const ACCOUNT_LOCKOUT_TTL = 15 * 60; // 15분

async function accountKey(slug: string, name: string): Promise<string> {
  const h = await sha256Hex(`${slug.toLowerCase()}::${name.trim().toLowerCase()}`);
  return `login-acct:${h.slice(0, 32)}`;
}

/** 계정 잠금 여부 확인 — 잠겨 있으면 429, 아니면 null. */
export async function accountLoginCheck(kv: KVLike, slug: string, name: string): Promise<Response | null> {
  const key = await accountKey(slug, name);
  const raw = await kv.get(key);
  const fails = raw ? parseInt(raw) : 0;
  if (fails >= ACCOUNT_LOCKOUT_FAILS) {
    return new Response(
      JSON.stringify({ error: '연속 로그인 실패로 계정이 일시 잠겼습니다. 15분 후 다시 시도하세요.', code: 'account_locked' }),
      { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': String(ACCOUNT_LOCKOUT_TTL) } },
    );
  }
  return null;
}

/** 로그인 실패 카운트 증가 (TTL 슬라이딩 — 마지막 실패 기준 15분 유지). */
export async function accountLoginRecordFail(kv: KVLike, slug: string, name: string): Promise<void> {
  const key = await accountKey(slug, name);
  const raw = await kv.get(key);
  const fails = raw ? parseInt(raw) : 0;
  await kv.put(key, String(fails + 1), { expirationTtl: ACCOUNT_LOCKOUT_TTL });
}

/** 로그인 성공 — 카운터 리셋. */
export async function accountLoginRecordSuccess(kv: KVLike, slug: string, name: string): Promise<void> {
  const key = await accountKey(slug, name);
  try { await kv.delete(key); } catch { /* ignore */ }
}

// ──────────────────────────────────────────────────────────────────
// 초대 수락 rate limit — 코드 무차별 대입 방어 (SEC-H1)
// IP: 10회/분, 1시간 누계 30회 초과 시 차단.
// ──────────────────────────────────────────────────────────────────
const INVITE_ACCEPT_PER_MIN = 10;
const INVITE_ACCEPT_PER_HOUR = 30;

export async function inviteAcceptRateLimit(kv: KVLike, request: Request): Promise<Response | null> {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const minKey = `inv-accept:m:${ip}`;
  const hourKey = `inv-accept:h:${ip}`;

  const [mRaw, hRaw] = await Promise.all([kv.get(minKey), kv.get(hourKey)]);
  const m = mRaw ? parseInt(mRaw) : 0;
  const h = hRaw ? parseInt(hRaw) : 0;

  if (m >= INVITE_ACCEPT_PER_MIN || h >= INVITE_ACCEPT_PER_HOUR) {
    return new Response(
      JSON.stringify({ error: '초대 코드 시도가 너무 많습니다. 잠시 후 다시 시도하세요.', code: 'rate_limited' }),
      { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '60' } },
    );
  }

  await Promise.all([
    kv.put(minKey, String(m + 1), { expirationTtl: 60 }),
    kv.put(hourKey, String(h + 1), { expirationTtl: 3600 }),
  ]);
  return null;
}

// ──────────────────────────────────────────────────────────────────
// 공개 학원 목록 — 무인증 dump 방어 (SEC-LOGIN-H1)
// IP당 20회/분, 100회/시간
// ──────────────────────────────────────────────────────────────────
const PUBLIC_ACADEMIES_PER_MIN = 20;
const PUBLIC_ACADEMIES_PER_HOUR = 100;

export async function publicAcademiesRateLimit(kv: KVLike, request: Request): Promise<Response | null> {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const minKey = `pa:m:${ip}`;
  const hourKey = `pa:h:${ip}`;

  const [mRaw, hRaw] = await Promise.all([kv.get(minKey), kv.get(hourKey)]);
  const m = mRaw ? parseInt(mRaw) : 0;
  const h = hRaw ? parseInt(hRaw) : 0;

  if (m >= PUBLIC_ACADEMIES_PER_MIN || h >= PUBLIC_ACADEMIES_PER_HOUR) {
    return new Response(
      JSON.stringify({ error: '요청이 너무 많습니다. 잠시 후 다시 시도하세요.', code: 'rate_limited' }),
      { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '60' } },
    );
  }

  await Promise.all([
    kv.put(minKey, String(m + 1), { expirationTtl: 60 }),
    kv.put(hourKey, String(h + 1), { expirationTtl: 3600 }),
  ]);
  return null;
}

// ──────────────────────────────────────────────────────────────────
// 학원 등록 — 봇/스팸 방어 (SEC-ONB-H1)
// IP당 시간 1회, 일 3회 — 합법적 학원 가입 흐름은 매우 드물기 때문
// ──────────────────────────────────────────────────────────────────
const ONBOARD_REGISTER_PER_HOUR = 1;
const ONBOARD_REGISTER_PER_DAY = 3;

export async function onboardRegisterRateLimit(kv: KVLike, request: Request): Promise<Response | null> {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const hKey = `onb-reg:h:${ip}`;
  const dKey = `onb-reg:d:${ip}`;

  const [hRaw, dRaw] = await Promise.all([kv.get(hKey), kv.get(dKey)]);
  const h = hRaw ? parseInt(hRaw) : 0;
  const d = dRaw ? parseInt(dRaw) : 0;

  if (h >= ONBOARD_REGISTER_PER_HOUR || d >= ONBOARD_REGISTER_PER_DAY) {
    return new Response(
      JSON.stringify({ error: '학원 등록 요청이 너무 많습니다. 잠시 후 다시 시도하세요.', code: 'rate_limited' }),
      { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '3600' } },
    );
  }

  await Promise.all([
    kv.put(hKey, String(h + 1), { expirationTtl: 3600 }),
    kv.put(dKey, String(d + 1), { expirationTtl: 86400 }),
  ]);
  return null;
}

// ──────────────────────────────────────────────────────────────────
// slug 가용성 확인 — 열거 방어 (SEC-ONB-M2)
// IP당 분 30회, 시간 200회
// ──────────────────────────────────────────────────────────────────
const VERIFY_SLUG_PER_MIN = 30;
const VERIFY_SLUG_PER_HOUR = 200;

export async function verifySlugRateLimit(kv: KVLike, request: Request): Promise<Response | null> {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const mKey = `vslug:m:${ip}`;
  const hKey = `vslug:h:${ip}`;

  const [mRaw, hRaw] = await Promise.all([kv.get(mKey), kv.get(hKey)]);
  const m = mRaw ? parseInt(mRaw) : 0;
  const h = hRaw ? parseInt(hRaw) : 0;

  if (m >= VERIFY_SLUG_PER_MIN || h >= VERIFY_SLUG_PER_HOUR) {
    return new Response(
      JSON.stringify({ error: '요청이 너무 많습니다. 잠시 후 다시 시도하세요.', code: 'rate_limited' }),
      { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '60' } },
    );
  }

  await Promise.all([
    kv.put(mKey, String(m + 1), { expirationTtl: 60 }),
    kv.put(hKey, String(h + 1), { expirationTtl: 3600 }),
  ]);
  return null;
}

// ──────────────────────────────────────────────────────────────────
// 학원 단건 정보 조회 — 무인증 스크래핑 방어 (SEC-ONB-M3)
// IP+slug 페어 분 20회, 시간 100회
// ──────────────────────────────────────────────────────────────────
const ACADEMY_INFO_PER_MIN = 20;
const ACADEMY_INFO_PER_HOUR = 100;

export async function academyInfoRateLimit(kv: KVLike, request: Request, slug: string): Promise<Response | null> {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const safeSlug = slug.slice(0, 64).replace(/[^a-zA-Z0-9_-]/g, '');
  const mKey = `ai:m:${ip}:${safeSlug}`;
  const hKey = `ai:h:${ip}:${safeSlug}`;

  const [mRaw, hRaw] = await Promise.all([kv.get(mKey), kv.get(hKey)]);
  const m = mRaw ? parseInt(mRaw) : 0;
  const h = hRaw ? parseInt(hRaw) : 0;

  if (m >= ACADEMY_INFO_PER_MIN || h >= ACADEMY_INFO_PER_HOUR) {
    return new Response(
      JSON.stringify({ error: '요청이 너무 많습니다. 잠시 후 다시 시도하세요.', code: 'rate_limited' }),
      { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '60' } },
    );
  }

  await Promise.all([
    kv.put(mKey, String(m + 1), { expirationTtl: 60 }),
    kv.put(hKey, String(h + 1), { expirationTtl: 3600 }),
  ]);
  return null;
}

// ──────────────────────────────────────────────────────────────────
// 공개 강사 이름 목록 — 무인증 스크래핑 방어 (TEACH-SEC-H1)
// IP·slug 페어 기준 30회/분, 200회/시간
// ──────────────────────────────────────────────────────────────────
const TEACHER_NAMES_PER_MIN = 30;
const TEACHER_NAMES_PER_HOUR = 200;

export async function teacherNamesRateLimit(kv: KVLike, request: Request, slug: string): Promise<Response | null> {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const safeSlug = slug.slice(0, 64).replace(/[^a-zA-Z0-9_-]/g, '');
  const minKey = `tn:m:${ip}:${safeSlug}`;
  const hourKey = `tn:h:${ip}:${safeSlug}`;

  const [mRaw, hRaw] = await Promise.all([kv.get(minKey), kv.get(hourKey)]);
  const m = mRaw ? parseInt(mRaw) : 0;
  const h = hRaw ? parseInt(hRaw) : 0;

  if (m >= TEACHER_NAMES_PER_MIN || h >= TEACHER_NAMES_PER_HOUR) {
    return new Response(
      JSON.stringify({ error: '요청이 너무 많습니다. 잠시 후 다시 시도하세요.', code: 'rate_limited' }),
      { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '60' } },
    );
  }

  await Promise.all([
    kv.put(minKey, String(m + 1), { expirationTtl: 60 }),
    kv.put(hourKey, String(h + 1), { expirationTtl: 3600 }),
  ]);
  return null;
}

// ──────────────────────────────────────────────────────────────────
// 가챠 카드 피드백 — 자가 box 부풀리기 방어 (SEC-GACHA-H2)
// (studentId, cardId) 페어 기준 분 5회, 일 30회.
// 정상 학습 흐름은 카드당 일 1~3회. 30회/일 캡은 자가 부풀리기를 사실상 차단.
// ──────────────────────────────────────────────────────────────────
const GACHA_FEEDBACK_PER_MIN = 5;
const GACHA_FEEDBACK_PER_DAY = 30;

export async function gachaCardFeedbackRateLimit(
  kv: KVLike,
  studentId: string,
  cardId: string
): Promise<Response | null> {
  const safeStudent = studentId.slice(0, 64).replace(/[^a-zA-Z0-9_-]/g, '');
  const safeCard = cardId.slice(0, 64).replace(/[^a-zA-Z0-9_-]/g, '');
  const minKey = `gcf:m:${safeStudent}:${safeCard}`;
  const dayKey = `gcf:d:${safeStudent}:${safeCard}`;

  const [mRaw, dRaw] = await Promise.all([kv.get(minKey), kv.get(dayKey)]);
  const m = mRaw ? parseInt(mRaw) : 0;
  const d = dRaw ? parseInt(dRaw) : 0;

  if (m >= GACHA_FEEDBACK_PER_MIN || d >= GACHA_FEEDBACK_PER_DAY) {
    return new Response(
      JSON.stringify({ error: '카드 피드백 요청이 너무 많습니다. 잠시 후 다시 시도하세요.', code: 'rate_limited' }),
      { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '60' } },
    );
  }

  await Promise.all([
    kv.put(minKey, String(m + 1), { expirationTtl: 60 }),
    kv.put(dayKey, String(d + 1), { expirationTtl: 86400 }),
  ]);
  return null;
}

export async function setRateLimitHeaders(
  response: Response,
  ip: string,
  _kv: any
): Promise<Response> {
  const bucket = memStore.get(`rl:${ip}`);
  const currentCount = bucket && bucket.resetAt > Date.now() ? bucket.count : 0;

  const newResponse = new Response(response.body, response);
  newResponse.headers.set('X-RateLimit-Limit', RATE_LIMIT_REQUESTS.toString());
  newResponse.headers.set('X-RateLimit-Remaining', Math.max(0, RATE_LIMIT_REQUESTS - currentCount).toString());
  newResponse.headers.set('X-RateLimit-Reset', Math.ceil(Date.now() / 1000 + RATE_LIMIT_WINDOW).toString());

  return newResponse;
}
