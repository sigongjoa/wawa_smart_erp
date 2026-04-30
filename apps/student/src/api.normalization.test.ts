/**
 * API 응답 정규화 단위 테스트.
 *
 * 회귀 가드: 서버가 paginatedList 결과 ({items, total, ...}) 또는
 * 일반 배열을 반환할 때 클라이언트가 항상 배열로 정규화하는지 검증.
 *
 * 실행: cd apps/student && npx vitest run src/api.normalization.test.ts
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// fetch mock 후 api 모듈 import
beforeEach(() => {
  // localStorage stub (Node 환경)
  if (typeof globalThis.localStorage === 'undefined') {
    const store = new Map<string, string>();
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => store.set(k, v),
        removeItem: (k: string) => store.delete(k),
      },
      configurable: true,
    });
  }
  globalThis.localStorage.setItem('play_token', 'test-token');
});

function mockFetch(payload: unknown) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ data: payload }),
    statusText: 'OK',
  });
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

describe('api.getAssignments 정규화', () => {
  it('서버가 일반 배열을 반환하면 그대로 반환', async () => {
    mockFetch([{ target_id: 't1', title: 'A' }]);
    const { api } = await import('./api');
    const r = await api.getAssignments();
    expect(Array.isArray(r)).toBe(true);
    expect(r).toHaveLength(1);
  });

  it('서버가 paginated 객체 ({items, total})를 반환해도 배열로 정규화', async () => {
    mockFetch({ items: [{ target_id: 't1', title: 'A' }, { target_id: 't2', title: 'B' }], total: 2 });
    vi.resetModules();
    const { api } = await import('./api');
    const r = await api.getAssignments();
    expect(Array.isArray(r)).toBe(true);
    expect(r).toHaveLength(2);
    // 회귀 핵심: r.filter 가 호출 가능해야 함 (이전 버그)
    const filtered = r.filter((a: any) => a.title);
    expect(filtered).toHaveLength(2);
  });

  it('서버가 null/undefined 같은 비정상 응답을 반환해도 빈 배열', async () => {
    mockFetch(null);
    vi.resetModules();
    const { api } = await import('./api');
    const r = await api.getAssignments();
    expect(Array.isArray(r)).toBe(true);
    expect(r).toEqual([]);
  });

  it('서버가 items 없는 객체를 반환해도 빈 배열 (graceful)', async () => {
    mockFetch({ unrelated: 'shape' });
    vi.resetModules();
    const { api } = await import('./api');
    const r = await api.getAssignments();
    expect(Array.isArray(r)).toBe(true);
    expect(r).toEqual([]);
  });
});

describe('api.listExams 정규화', () => {
  it('paginated 응답도 배열로 변환', async () => {
    mockFetch({ items: [{ id: 'e1', title: 'Exam' }], total: 1 });
    vi.resetModules();
    const { api } = await import('./api');
    const r = await api.listExams();
    expect(Array.isArray(r)).toBe(true);
    expect(r).toHaveLength(1);
  });

  it('일반 배열 응답도 그대로', async () => {
    mockFetch([{ id: 'e1', title: 'Exam' }]);
    vi.resetModules();
    const { api } = await import('./api');
    const r = await api.listExams();
    expect(Array.isArray(r)).toBe(true);
    expect(r).toHaveLength(1);
  });
});
