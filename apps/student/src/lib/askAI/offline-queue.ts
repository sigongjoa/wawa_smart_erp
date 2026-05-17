/**
 * UC-15 — drill 자가평가 오프라인 큐
 *
 * 학생이 통학길에서 평가 → localStorage 큐 → 온라인 시 동기.
 * IndexedDB가 더 안전하지만 단순함 우선 — localStorage로 v0.
 *
 * Storage 의존성은 inject — 테스트 시 in-memory mock.
 */

const STORAGE_KEY = 'askai:offline-queue:v1';

export type Rating = 'easy' | 'ok' | 'hard' | 'dunno';

export interface RatingPayload {
  card_id: string;
  rating: Rating;
  rated_at: string;     // ISO datetime
}

export interface FlushResult {
  success: boolean;
  /** 부분 성공 시 처리된 card_id 목록 */
  processed_ids?: string[];
}

export type FlushFn = (batch: RatingPayload[]) => Promise<FlushResult>;

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export class OfflineQueue {
  private items: RatingPayload[];

  constructor(private storage: StorageLike) {
    this.items = this.load();
  }

  enqueue(payload: RatingPayload): void {
    this.items.push(payload);
    this.persist();
  }

  size(): number {
    return this.items.length;
  }

  peekAll(): readonly RatingPayload[] {
    return [...this.items];
  }

  async flush(fn: FlushFn): Promise<void> {
    if (this.items.length === 0) return;

    const batch = [...this.items];
    const result = await fn(batch);

    if (!result.success) {
      // 명시적 실패는 throw로 알림 (재시도 책임은 호출자)
      throw new Error('flush returned success=false');
    }

    if (result.processed_ids && result.processed_ids.length < batch.length) {
      // 부분 성공 — 처리된 것만 제거
      const processedSet = new Set(result.processed_ids);
      this.items = this.items.filter((p) => !processedSet.has(p.card_id));
    } else {
      this.items = [];
    }
    this.persist();
  }

  clear(): void {
    this.items = [];
    this.persist();
  }

  private load(): RatingPayload[] {
    const raw = this.storage.getItem(STORAGE_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private persist(): void {
    if (this.items.length === 0) {
      this.storage.removeItem(STORAGE_KEY);
    } else {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(this.items));
    }
  }
}
