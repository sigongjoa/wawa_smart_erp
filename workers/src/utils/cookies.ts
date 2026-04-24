/**
 * HTTP 쿠키 유틸리티
 * - 토큰은 httpOnly/Secure/SameSite=None 으로만 발급 (cross-origin)
 * - API와 프런트가 다른 도메인이므로 SameSite=None 필수, 이에 따라 Secure 필수
 */

export const ACCESS_COOKIE = 'access_token';
export const REFRESH_COOKIE = 'refresh_token';

interface CookieOptions {
  maxAge?: number;     // seconds
  path?: string;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
}

export function serializeCookie(name: string, value: string, opts: CookieOptions = {}): string {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  parts.push(`Path=${opts.path ?? '/'}`);
  if (opts.maxAge !== undefined) parts.push(`Max-Age=${opts.maxAge}`);
  if (opts.httpOnly !== false) parts.push('HttpOnly');
  if (opts.secure !== false) parts.push('Secure');
  parts.push(`SameSite=${opts.sameSite ?? 'None'}`);
  return parts.join('; ');
}

export function clearCookie(name: string): string {
  return `${name}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=None`;
}

export function parseCookies(header: string | null): Record<string, string> {
  if (!header) return {};
  const out: Record<string, string> = {};
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const k = part.slice(0, eq).trim();
    const v = part.slice(eq + 1).trim();
    if (!k) continue;
    try {
      out[k] = decodeURIComponent(v);
    } catch {
      out[k] = v;
    }
  }
  return out;
}

/** 응답에 여러 Set-Cookie 헤더를 추가 (append 사용 필수) */
export function appendSetCookie(response: Response, cookies: string[]): Response {
  const newRes = new Response(response.body, response);
  for (const c of cookies) newRes.headers.append('Set-Cookie', c);
  return newRes;
}
