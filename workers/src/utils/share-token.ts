/**
 * HMAC 기반 공유 토큰 (학부모 리포트/아카이브/숙제 공통)
 *
 * 페이로드 형식: `${resourceId}|${type}|${expiresAtMs}`
 * 토큰 구조: `${b64url(payload)}.${b64url(hmac)}`
 */

function b64urlEncode(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlEncodeStr(str: string): string {
  return b64urlEncode(new TextEncoder().encode(str));
}

function b64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad);
  const out = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
  return out;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export async function signShareToken(
  resourceId: string,
  type: string,
  expiresAtMs: number,
  secret: string
): Promise<string> {
  const payload = `${resourceId}|${type}|${expiresAtMs}`;
  const key = await hmacKey(secret);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload)));
  return `${b64urlEncodeStr(payload)}.${b64urlEncode(sig)}`;
}

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: 'malformed' | 'mismatch' | 'expired' | 'bad_signature' };

export async function verifyShareToken(
  token: string,
  expectedResourceId: string,
  expectedType: string,
  secret: string
): Promise<VerifyResult> {
  const parts = token.split('.');
  if (parts.length !== 2) return { ok: false, reason: 'malformed' };
  let payload: string;
  try {
    payload = new TextDecoder().decode(b64urlDecode(parts[0]));
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  const [rid, type, expStr] = payload.split('|');
  if (!rid || !type || !expStr) return { ok: false, reason: 'malformed' };
  if (rid !== expectedResourceId || type !== expectedType) return { ok: false, reason: 'mismatch' };
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || Date.now() > exp) return { ok: false, reason: 'expired' };

  const key = await hmacKey(secret);
  const sig = b64urlDecode(parts[1]);
  const ok = await crypto.subtle.verify('HMAC', key, sig, new TextEncoder().encode(payload));
  return ok ? { ok: true } : { ok: false, reason: 'bad_signature' };
}

export function resolveShareSecret(env: { PARENT_REPORT_SECRET?: string; JWT_SECRET?: string }): string | null {
  return env.PARENT_REPORT_SECRET || env.JWT_SECRET || null;
}

const RATE_LIMIT_WINDOW_SEC = 3600;

export async function checkShareRateLimit(
  kv: KVNamespace,
  userId: string,
  scope: string,
  limitPerHour = 20
): Promise<boolean> {
  const key = `rate:share:${scope}:${userId}`;
  const raw = await kv.get(key);
  const count = raw ? Number(raw) || 0 : 0;
  if (count >= limitPerHour) return false;
  await kv.put(key, String(count + 1), { expirationTtl: RATE_LIMIT_WINDOW_SEC });
  return true;
}
