import { RequestContext } from '@/types';
import { errorResponse } from '@/utils/response';

const RATE_LIMIT_WINDOW = 60; // 1분
const RATE_LIMIT_REQUESTS = 300; // 일반 API: 1분에 300개
const LOGIN_RATE_LIMIT_WINDOW = 60; // 1분
const LOGIN_RATE_LIMIT_REQUESTS = 5; // 로그인: 1분에 5회

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
];

export async function rateLimitMiddleware(
  context: RequestContext
): Promise<RequestContext | Response> {
  const ip = context.request.headers.get('CF-Connecting-IP') || 'unknown';
  const url = new URL(context.request.url);
  const pathname = url.pathname;
  const method = context.request.method;

  // 엔드포인트별 rate limit 체크
  for (const limit of ENDPOINT_LIMITS) {
    if (!pathname.startsWith(limit.prefix)) continue;
    if (limit.methods && !limit.methods.includes(method)) continue;

    const epKey = `ep-limit:${ip}:${limit.prefix}`;
    const epCount = await context.env.KV.get(epKey);
    const currentEpCount = epCount ? parseInt(epCount) : 0;

    if (currentEpCount >= limit.maxRequests) {
      return new Response(
        JSON.stringify({ error: limit.message, code: 'rate_limited' }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': limit.windowSeconds.toString(),
          },
        },
      );
    }

    await context.env.KV.put(epKey, (currentEpCount + 1).toString(), {
      expirationTtl: limit.windowSeconds,
    });

    break; // 첫 매칭 엔드포인트만 적용
  }

  // 일반 rate limit 체크
  const key = `rate-limit:${ip}`;

  const count = await context.env.KV.get(key);
  const currentCount = count ? parseInt(count) : 0;

  if (currentCount >= RATE_LIMIT_REQUESTS) {
    return errorResponse('Too many requests', 429);
  }

  await context.env.KV.put(key, (currentCount + 1).toString(), {
    expirationTtl: RATE_LIMIT_WINDOW,
  });

  return context;
}

/**
 * 로그인 전용 rate limiter — 5회/분 per IP.
 * Returns null if allowed, or a 429 Response if blocked.
 */
export async function loginRateLimit(
  kv: { get(key: string): Promise<string | null>; put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void> },
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

export async function setRateLimitHeaders(
  response: Response,
  ip: string,
  kv: any
): Promise<Response> {
  const key = `rate-limit:${ip}`;
  const count = await kv.get(key);
  const currentCount = count ? parseInt(count) : 0;

  const newResponse = new Response(response.body, response);
  newResponse.headers.set('X-RateLimit-Limit', RATE_LIMIT_REQUESTS.toString());
  newResponse.headers.set('X-RateLimit-Remaining', (RATE_LIMIT_REQUESTS - currentCount).toString());
  newResponse.headers.set('X-RateLimit-Reset', Math.ceil(Date.now() / 1000 + RATE_LIMIT_WINDOW).toString());

  return newResponse;
}
