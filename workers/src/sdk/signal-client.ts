/**
 * signal-client — 외부 생성 워커(edu-arch·수행평가)가 POST /api/signal로 신호를 보내는 유일한 경로.
 * 워커키 인증(server-trust) · 계약 버전 헤더 · 멱등키 · 5xx/네트워크 재시도(지수백오프).
 * 내부 서비스는 이 SDK를 쓰지 않는다 — emitSignal을 직접 호출(HTTP 없음).
 * 설계: cloudflare-integration.md §3.2 (외부 발신).
 */
export const SIGNAL_CONTRACT_VERSION = 'signal.schema@v1';

export interface SignalClientOptions {
  endpoint: string;            // 예: https://api.example.com/api/signal
  workerKey: string;           // SIGNAL_WORKER_KEY (server-trust)
  fetchImpl?: typeof fetch;    // 테스트 주입용
  maxRetries?: number;         // 기본 3
  backoffMs?: number;          // 기본 200
}

export interface SignalInput {
  academyId: string;
  source: string;
  kind: string;
  payload: Record<string, unknown>;
  ingestId: string;            // 멱등키 — 호출자가 안정적으로 부여 (재시도 안전)
  erpStudentId?: string;
  externalId?: string;
  ts?: string;
}

export interface SignalResult {
  ok: boolean;
  status: number;
  inserted?: boolean;
  reason?: string;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export class SignalClient {
  private fetchImpl: typeof fetch;
  private maxRetries: number;
  private backoffMs: number;
  constructor(private opts: SignalClientOptions) {
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.maxRetries = opts.maxRetries ?? 3;
    this.backoffMs = opts.backoffMs ?? 200;
  }

  async send(input: SignalInput): Promise<SignalResult> {
    if (!input.ingestId) return { ok: false, status: 0, reason: 'ingestId(멱등키) 필수' };
    const body = JSON.stringify({
      academy_id: input.academyId,
      source: input.source,
      kind: input.kind,
      payload: input.payload,
      ingest_id: input.ingestId,
      erp_student_id: input.erpStudentId,
      external_id: input.externalId,
      ts: input.ts,
    });

    let lastErr = '';
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const res = await this.fetchImpl(this.opts.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Signal-Worker-Key': this.opts.workerKey,
            'X-Contract-Version': SIGNAL_CONTRACT_VERSION,
          },
          body,
        });
        // 5xx → 재시도, 4xx → 즉시 실패(검증 오류는 재시도 무의미)
        if (res.status >= 500) {
          lastErr = `서버 ${res.status}`;
          if (attempt < this.maxRetries) { await sleep(this.backoffMs * 2 ** attempt); continue; }
          return { ok: false, status: res.status, reason: lastErr };
        }
        const json = (await res.json().catch(() => ({}))) as { data?: { inserted?: boolean }; error?: string };
        if (!res.ok) return { ok: false, status: res.status, reason: json.error ?? `HTTP ${res.status}` };
        return { ok: true, status: res.status, inserted: json.data?.inserted };
      } catch (e) {
        lastErr = String(e);
        if (attempt < this.maxRetries) { await sleep(this.backoffMs * 2 ** attempt); continue; }
        return { ok: false, status: 0, reason: lastErr };
      }
    }
    return { ok: false, status: 0, reason: lastErr };
  }
}
