import { Env } from '@/types';

export function corsHeaders(env: Env): Record<string, string> {
  const isDev = env.ENVIRONMENT === 'development';
  const allowedOrigin = isDev ? env.FRONTEND_URL : 'https://wawa.app';

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    'Access-Control-Allow-Credentials': 'true',
  };
}

export function handleCors(request: Request, env: Env): Response | null {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(env),
    });
  }
  return null;
}

export function addCorsHeaders(response: Response, env: Env): Response {
  const newResponse = new Response(response.body, response);
  Object.entries(corsHeaders(env)).forEach(([key, value]) => {
    newResponse.headers.set(key, value);
  });
  return newResponse;
}
