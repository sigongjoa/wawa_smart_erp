/**
 * UC-15 — 오프라인 자가평가 큐
 *
 * 학생이 통학길에서 drill 평가 → IndexedDB 큐에 저장 → 온라인 시 동기.
 * IndexedDB는 in-memory mock으로 테스트 (fake-indexeddb 없이 단순 추상화).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { OfflineQueue, type RatingPayload } from './offline-queue';

class MemoryStorage {
  store: Record<string, string> = {};
  setItem(k: string, v: string) { this.store[k] = v; }
  getItem(k: string): string | null { return this.store[k] ?? null; }
  removeItem(k: string) { delete this.store[k]; }
}

describe('OfflineQueue — UC-15', () => {
  let storage: MemoryStorage;
  let queue: OfflineQueue;

  beforeEach(() => {
    storage = new MemoryStorage();
    queue = new OfflineQueue(storage);
  });

  it('enqueue → 저장됨', () => {
    const payload: RatingPayload = {
      card_id: 'c-1', rating: 'easy', rated_at: '2026-05-15T08:00:00Z',
    };
    queue.enqueue(payload);
    expect(queue.size()).toBe(1);
  });

  it('순서 보존 (FIFO)', () => {
    queue.enqueue({ card_id: 'c-1', rating: 'easy', rated_at: '2026-05-15T08:00:00Z' });
    queue.enqueue({ card_id: 'c-2', rating: 'ok', rated_at: '2026-05-15T08:01:00Z' });
    queue.enqueue({ card_id: 'c-3', rating: 'hard', rated_at: '2026-05-15T08:02:00Z' });
    expect(queue.peekAll().map(p => p.card_id)).toEqual(['c-1', 'c-2', 'c-3']);
  });

  it('storage에 직렬화 — 새 인스턴스에서 복원 가능', () => {
    queue.enqueue({ card_id: 'c-1', rating: 'easy', rated_at: '2026-05-15T08:00:00Z' });
    queue.enqueue({ card_id: 'c-2', rating: 'dunno', rated_at: '2026-05-15T08:01:00Z' });

    const restored = new OfflineQueue(storage);
    expect(restored.size()).toBe(2);
    expect(restored.peekAll()[0].card_id).toBe('c-1');
  });

  it('flush 성공 시 큐에서 제거', async () => {
    queue.enqueue({ card_id: 'c-1', rating: 'easy', rated_at: '2026-05-15T08:00:00Z' });
    queue.enqueue({ card_id: 'c-2', rating: 'ok', rated_at: '2026-05-15T08:01:00Z' });

    const sent: RatingPayload[] = [];
    await queue.flush(async (batch) => {
      sent.push(...batch);
      return { success: true };
    });

    expect(sent).toHaveLength(2);
    expect(queue.size()).toBe(0);
  });

  it('flush 실패 시 큐 유지 (재시도 대상)', async () => {
    queue.enqueue({ card_id: 'c-1', rating: 'easy', rated_at: '2026-05-15T08:00:00Z' });

    await expect(queue.flush(async () => {
      throw new Error('network down');
    })).rejects.toThrow();

    expect(queue.size()).toBe(1);  // 보존
  });

  it('flush 부분 실패 — 성공한 항목만 제거', async () => {
    queue.enqueue({ card_id: 'c-1', rating: 'easy', rated_at: '2026-05-15T08:00:00Z' });
    queue.enqueue({ card_id: 'c-2', rating: 'ok', rated_at: '2026-05-15T08:01:00Z' });
    queue.enqueue({ card_id: 'c-3', rating: 'hard', rated_at: '2026-05-15T08:02:00Z' });

    await queue.flush(async () => {
      // 처음 2개만 성공
      return { success: true, processed_ids: ['c-1', 'c-2'] };
    });

    expect(queue.size()).toBe(1);
    expect(queue.peekAll()[0].card_id).toBe('c-3');
  });

  it('빈 큐 flush는 no-op', async () => {
    let called = false;
    await queue.flush(async () => { called = true; return { success: true }; });
    expect(called).toBe(false);
  });

  it('clear는 즉시 비움', () => {
    queue.enqueue({ card_id: 'c-1', rating: 'easy', rated_at: '2026-05-15T08:00:00Z' });
    queue.enqueue({ card_id: 'c-2', rating: 'ok', rated_at: '2026-05-15T08:01:00Z' });
    queue.clear();
    expect(queue.size()).toBe(0);
  });
});
