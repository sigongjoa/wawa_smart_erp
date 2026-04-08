import { RequestContext } from '@/types';
import { errorResponse } from '@/utils/response';

const RATE_LIMIT_WINDOW = 60; // 1분
const RATE_LIMIT_REQUESTS = 1000; // 1분에 1000개 요청 (테스트 환경용)

export async function rateLimitMiddleware(
  context: RequestContext
): Promise<RequestContext | Response> {
  const ip = context.request.headers.get('CF-Connecting-IP') || 'unknown';
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
