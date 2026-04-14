import { Env } from '@/types';

export function corsHeaders(env: Env, origin?: string): Record<string, string> {
  const isDev = env.ENVIRONMENT === 'development';

  // 동적 origin 결정
  let allowedOrigin = isDev ? env.FRONTEND_URL : 'https://wawa.app';

  // 허용된 프로덕션 도메인 목록
  const ALLOWED_ORIGINS = [
    'https://wawa-smart-erp.pages.dev',
    'https://wawa.app',
    'https://learn.wawa.app',
    'https://wawa-learn.pages.dev',
  ];

  // 요청 origin이 있으면 확인
  if (origin) {
    // 개발 환경 또는 localhost는 허용
    if (isDev || origin.includes('localhost')) {
      allowedOrigin = origin;
    }
    // 화이트리스트에 있는 도메인만 허용
    else if (ALLOWED_ORIGINS.includes(origin)) {
      allowedOrigin = origin;
    }
  }

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    'Access-Control-Allow-Credentials': 'true',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
  };
}

export function handleCors(request: Request, env: Env): Response | null {
  if (request.method === 'OPTIONS') {
    const origin = request.headers.get('origin') || undefined;
    return new Response(null, {
      status: 204,
      headers: corsHeaders(env, origin),
    });
  }
  return null;
}

export function addCorsHeaders(response: Response, env: Env, origin?: string): Response {
  const newResponse = new Response(response.body, response);
  Object.entries(corsHeaders(env, origin)).forEach(([key, value]) => {
    newResponse.headers.set(key, value);
  });
  return newResponse;
}
