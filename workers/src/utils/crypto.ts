/**
 * PIN/Password 해싱 유틸 (PBKDF2-SHA256, Web Crypto)
 * 모든 핸들러는 이 파일만 참조해야 함. 알고리즘 로테이션 시 단일 지점에서 변경.
 *
 * Format: `pbkdf2$<iterations>$<salt_b64>$<hash_b64>`
 * Legacy:  hex SHA256 (no salt) — verifyPin에서만 호환 처리
 */

const PBKDF2_ITERATIONS = 100_000;
const SALT_BYTES = 16;
const HASH_BYTES = 32;

function bufToB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function b64ToBuf(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** PBKDF2 해시 생성 — `pbkdf2$100000$<salt_b64>$<hash_b64>` 포맷 */
export async function hashPin(pin: string): Promise<string> {
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

async function verifyPinPbkdf2(pin: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
  const iterations = parseInt(parts[1], 10);
  const salt = b64ToBuf(parts[2]);
  const expectedHash = b64ToBuf(parts[3]);
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(pin), { name: 'PBKDF2' }, false, ['deriveBits'],
  );
  const bits = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, key, HASH_BYTES * 8,
  ));
  if (bits.length !== expectedHash.length) return false;
  let diff = 0;
  for (let i = 0; i < bits.length; i++) diff |= bits[i] ^ expectedHash[i];
  return diff === 0;
}

async function hashLegacySha256(pin: string): Promise<string> {
  const data = new TextEncoder().encode(pin);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/** PIN 검증 — pbkdf2$... 우선, legacy hex SHA256 하위호환 */
export async function verifyPin(pin: string, storedHash: string): Promise<boolean> {
  if (storedHash.startsWith('pbkdf2$')) {
    return verifyPinPbkdf2(pin, storedHash);
  }
  const pinHash = await hashLegacySha256(pin);
  return pinHash === storedHash;
}

/** 저장된 해시가 legacy 포맷이면 true — 로그인 성공 시 PBKDF2로 자동 업그레이드 용도 */
export function isLegacyHash(storedHash: string): boolean {
  return !storedHash.startsWith('pbkdf2$');
}
