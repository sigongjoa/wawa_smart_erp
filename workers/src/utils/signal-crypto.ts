/**
 * 신호 payload per-student 봉투암호화 (WebCrypto AES-GCM).
 * 마스터키(env.SIGNAL_MASTER_KEY, base64 32B)로 학생별 DEK를 래핑해 student_keys에 저장.
 * 삭제권(crypto-shred): student_keys.shredded_at 설정 → DEK 폐기 → 복호 불가.
 * 설계: architecture.md §8.5(b,d)
 */
import { Env } from '@/types';
import { executeFirst, executeInsert } from '@/utils/db';

function b64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}
function ub64(s: string): Uint8Array {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

async function masterKey(env: Env): Promise<CryptoKey> {
  if (!env.SIGNAL_MASTER_KEY) throw new Error('SIGNAL_MASTER_KEY 미설정');
  return crypto.subtle.importKey('raw', ub64(env.SIGNAL_MASTER_KEY), 'AES-GCM', false, ['encrypt', 'decrypt']);
}

async function aeadEncrypt(key: CryptoKey, data: ArrayBuffer): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
  return b64(iv.buffer) + '.' + b64(ct);
}
async function aeadDecrypt(key: CryptoKey, packed: string): Promise<ArrayBuffer> {
  const [iv, ct] = packed.split('.');
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv: ub64(iv) }, key, ub64(ct));
}

/** 학생 DEK(wrapped)를 가져오거나 생성. shred된 경우 null. */
export async function getOrCreateStudentKey(env: Env, academyId: string, erpStudentId: string): Promise<string | null> {
  const row = await executeFirst<{ key_wrapped: string; shredded_at: string | null }>(
    env.DB,
    'SELECT key_wrapped, shredded_at FROM student_keys WHERE erp_student_id = ? AND academy_id = ?',
    [erpStudentId, academyId]
  );
  if (row) return row.shredded_at ? null : row.key_wrapped;

  const dek = (await crypto.subtle.generateKey({ name: 'AES-GCM', length: 128 }, true, ['encrypt', 'decrypt'])) as CryptoKey;
  const rawDek = (await crypto.subtle.exportKey('raw', dek)) as ArrayBuffer;
  const wrapped = await aeadEncrypt(await masterKey(env), rawDek);
  // [P2] 첫 신호 동시 도착 레이스: INSERT OR IGNORE 후 실제 저장된(승자) 행을 재조회.
  await executeInsert(
    env.DB,
    'INSERT OR IGNORE INTO student_keys (erp_student_id, academy_id, key_wrapped) VALUES (?, ?, ?)',
    [erpStudentId, academyId, wrapped]
  );
  const winner = await executeFirst<{ key_wrapped: string; shredded_at: string | null }>(
    env.DB,
    'SELECT key_wrapped, shredded_at FROM student_keys WHERE erp_student_id = ? AND academy_id = ?',
    [erpStudentId, academyId]
  );
  return winner && !winner.shredded_at ? winner.key_wrapped : null;
}

/** 읽기 전용 키 조회 — 없거나 shred되면 null(생성 안 함). 추천 학습용. */
export async function getStudentKey(env: Env, academyId: string, erpStudentId: string): Promise<string | null> {
  const row = await executeFirst<{ key_wrapped: string; shredded_at: string | null }>(
    env.DB,
    'SELECT key_wrapped, shredded_at FROM student_keys WHERE erp_student_id = ? AND academy_id = ?',
    [erpStudentId, academyId]
  );
  if (!row) return null;
  return row.shredded_at ? null : row.key_wrapped;
}

async function dekFromWrapped(env: Env, wrapped: string): Promise<CryptoKey> {
  const rawDek = await aeadDecrypt(await masterKey(env), wrapped);
  return crypto.subtle.importKey('raw', rawDek, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function sealPayload(env: Env, keyWrapped: string, plaintext: string): Promise<string> {
  const dek = await dekFromWrapped(env, keyWrapped);
  return aeadEncrypt(dek, new TextEncoder().encode(plaintext).buffer as ArrayBuffer);
}

/** keyWrapped가 null(폐기)이면 null 반환 = 복호 불가(삭제권). */
export async function unsealPayload(env: Env, keyWrapped: string | null, sealed: string): Promise<string | null> {
  if (!keyWrapped) return null;
  try {
    const dek = await dekFromWrapped(env, keyWrapped);
    return new TextDecoder().decode(await aeadDecrypt(dek, sealed));
  } catch {
    return null;
  }
}
