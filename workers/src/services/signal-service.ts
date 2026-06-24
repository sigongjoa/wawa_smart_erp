/**
 * 신호 적재 코어 — 내부 서비스(가챠·징검다리·쌤키퍼)는 emitSignal을 직접 호출(HTTP 없음),
 * 외부 생성 워커(edu-arch·수행평가)는 /api/signal(워커키 server-trust) → emitSignal.
 * 불변식: 신원해석+소유권 · PII 화이트리스트 · per-student 암호화 · 멱등 · academy 격리 · 원자 적재 · 감사로그.
 * 설계: architecture.md §2 · cloudflare-integration.md §3.2 · /sc:analyze 반영(소유권가드·D1멱등·원자배치).
 */
import { Env } from '@/types';
import { executeFirst } from '@/utils/db';
import { generatePrefixedId } from '@/utils/id';
import { isValidId } from '@/utils/sanitize';
import { validateSignalPayload } from '@/schemas/signal-schema';
import { getOrCreateStudentKey, sealPayload } from '@/utils/signal-crypto';
import { logger } from '@/utils/logger';

const SOURCES = new Set(['gacha', 'jingdari', 'edu-arch', 'assessment', 'ssaemkeeper', 'erp']);

export interface EmitInput {
  academyId: string;
  source: string;
  kind: string;
  payload: Record<string, unknown>;
  ts: string;
  ingestId: string;
  erpStudentId?: string;
  externalId?: string;
  trust?: 'server' | 'client';
  actorId?: string;            // 신호를 일으킨 요청자(users.id) — 감사 추적용
}
export interface EmitResult { ok: boolean; inserted?: boolean; reason?: string; }

/** opts.extraStatements: 호출자(서비스 라우트)의 상태행을 같은 원자 배치에 합쳐 정합성 보장. */
export interface EmitOptions { extraStatements?: D1PreparedStatement[] }

/** ISO로 정규화 — 파싱 가능하면 ISO 문자열로 통일(문자열 정렬 안정), 아니면 서버 현재 시각(조작 방어). */
function normalizeTs(ts: unknown): string {
  if (typeof ts === 'string') {
    const t = Date.parse(ts);
    if (Number.isFinite(t)) return new Date(t).toISOString();
  }
  return new Date().toISOString();
}

export async function emitSignal(env: Env, input: EmitInput, opts: EmitOptions = {}): Promise<EmitResult> {
  const { academyId, source, kind, payload, ingestId } = input;
  const trust: 'server' | 'client' = input.trust === 'client' ? 'client' : 'server';

  if (!SOURCES.has(source)) return { ok: false, reason: `알 수 없는 source '${source}'` };
  if (!isValidId(academyId)) return { ok: false, reason: 'academyId 형식 오류' };
  if (!isValidId(ingestId, 128)) return { ok: false, reason: 'ingestId 형식 오류' };
  const ts = normalizeTs(input.ts);

  // 신원 해석 + academy 소유권 검증
  let sid = input.erpStudentId;
  if (sid) {
    if (!isValidId(sid)) return { ok: false, reason: 'erpStudentId 형식 오류' };
    // [P1] 직접 지정 경로도 "그 학생이 이 academy 소속"인지 확인 (cross-tenant 오귀속 차단)
    const own = await executeFirst<{ ok: number }>(
      env.DB, 'SELECT 1 AS ok FROM students WHERE id = ? AND academy_id = ?', [sid, academyId]
    );
    if (!own) return { ok: false, reason: '학생이 해당 academy 소속이 아님' };
  } else if (input.externalId) {
    const row = await executeFirst<{ erp_student_id: string }>(
      env.DB,
      'SELECT erp_student_id FROM student_links WHERE source = ? AND external_id = ? AND academy_id = ?',
      [source, input.externalId, academyId]
    );
    sid = row?.erp_student_id;
  }
  if (!sid) return { ok: false, reason: 'unresolved 신원 (student_links 없음)' };

  // [P1] 동의(consent) 게이트 — 수집·이용 동의 없거나 철회면 거부. PIPA.
  //   · 레코드 없음 또는 withdrawn_at 설정 → 처리 불가
  //   · under14는 보호자 동의(guardian_consent) 필수
  const consent = await executeFirst<{ age_band: string; guardian_consent: number; withdrawn_at: string | null }>(
    env.DB,
    'SELECT age_band, guardian_consent, withdrawn_at FROM consents WHERE academy_id = ? AND erp_student_id = ?',
    [academyId, sid]
  );
  if (!consent || consent.withdrawn_at) return { ok: false, reason: '수집·이용 동의 없음/철회됨' };
  if (consent.age_band === 'under14' && !consent.guardian_consent) {
    return { ok: false, reason: '만14세 미만 보호자 동의 필요' };
  }

  // PII 화이트리스트 (필드·타입·길이)
  const bad = validateSignalPayload(kind, payload);
  if (bad) return { ok: false, reason: `payload 거부(${bad})` };

  // [P1] 멱등 — D1 meta 비의존: ingest_id 사전 확인
  const dup = await executeFirst<{ ok: number }>(
    env.DB, 'SELECT 1 AS ok FROM signals WHERE academy_id = ? AND ingest_id = ?', [academyId, ingestId]
  );
  if (dup) return { ok: true, inserted: false };

  // per-student 키 (폐기 시 null → 적재 거부)
  const keyWrapped = await getOrCreateStudentKey(env, academyId, sid);
  if (!keyWrapped) return { ok: false, reason: '학생 키 폐기됨(삭제권)' };
  const enc = await sealPayload(env, keyWrapped, JSON.stringify(payload));

  // [P2] 원자 배치: signals + access_log (+ 학습신호면 recommend job). CLAUDE.md 다중쓰기 규칙.
  const stmts = [
    env.DB.prepare(
      `INSERT OR IGNORE INTO signals
         (id, academy_id, erp_student_id, source, kind, payload_enc, trust, ts, ingest_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(generatePrefixedId('sig'), academyId, sid, source, kind, enc, trust, ts, ingestId),
    env.DB.prepare(
      `INSERT INTO access_log (id, academy_id, actor_id, erp_student_id, action, detail)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(
      generatePrefixedId('acl'), academyId,
      input.actorId && isValidId(input.actorId) ? input.actorId : `signal:${source}`, // 요청자 추적(없으면 소스)
      sid, 'signal_ingest', `${kind}/${trust}`
    ),
  ];
  // recommend는 큐 뒤로(P1-1): server-trust 학습신호일 때만 enqueue. client-trust는 학습 제외.
  // 소스 확장(rs-two-layer-design §2): 약점/가드레일 연료가 되는 kind 전부 재추론 트리거.
  const LEARN_KINDS = new Set(['review', 'wrong_answer', 'result', 'mastery', 'attendance', 'grade']);
  if (trust === 'server' && LEARN_KINDS.has(kind)) {
    stmts.push(
      env.DB.prepare(
        `INSERT OR IGNORE INTO jobs (id, academy_id, type, status, erp_student_id, idempotency_key)
         VALUES (?, ?, 'recommend-infer', 'queued', ?, ?)`
      ).bind(generatePrefixedId('job'), academyId, sid, `infer-${ingestId}`)
    );
  }
  // [P1] 서비스 상태행(extraStatements)을 같은 트랜잭션에 합쳐 원자 적재 — 서비스행↔신호 정합성.
  await env.DB.batch([...(opts.extraStatements ?? []), ...stmts]);

  logger.debug('signal ingested', { academyId, source, kind, trust });
  return { ok: true, inserted: true };
}
