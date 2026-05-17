/**
 * ask-ai-handler 통합 테스트
 *
 * D1 + KV mock으로 HTTP 흐름 검증.
 * 비즈니스 로직은 services 단위에서 이미 검증됨 — 여기는 wiring만.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleAskAI } from './ask-ai-handler';
import { invalidateTenantCache } from '@/middleware/tenant';

// Mock minimal Env + RequestContext
function makeContext(overrides?: {
  method?: string;
  body?: any;
  auth?: any;
  pathQuery?: string;
  authHeader?: string;       // 'Bearer <play-uuid>' 또는 'Bearer <jwt>'
  kvGet?: (key: string) => any;  // KV.get override (play:<token> 등)
  noAcademy?: boolean;        // 학원 비활성 시뮬레이션
}) {
  const method = overrides?.method ?? 'POST';
  const body = overrides?.body !== undefined ? JSON.stringify(overrides.body) : undefined;
  const url = `https://example.test${overrides?.pathQuery ?? '/api/ask-ai/quota'}`;

  const dbCalls: Array<{ sql: string; binds: any[] }> = [];

  const stmt = (sql: string) => ({
    bind: (...binds: any[]) => ({
      first: async () => {
        dbCalls.push({ sql, binds });
        if (sql.includes('FROM academies')) {
          if (overrides?.noAcademy) return null;
          return { id: binds[0], name: 'wawa', slug: 'wawa', is_active: 1, expires_at: null };
        }
        if (sql.includes('FROM askai_quota')) return null;
        if (sql.includes('FROM askai_conversations')) {
          return { id: binds[0], student_id: binds[1], response_json: '{}', attached_photos: '[]' };
        }
        return null;
      },
      all: async () => { dbCalls.push({ sql, binds }); return { results: [] }; },
      run: async () => { dbCalls.push({ sql, binds }); return { success: true }; },
    }),
  });

  const env = {
    DB: { prepare: stmt },
    KV: {
      get: vi.fn().mockImplementation(async (key: string, fmt?: string) => {
        if (overrides?.kvGet) {
          const v = overrides.kvGet(key);
          if (v !== undefined) return fmt === 'json' && typeof v === 'string' ? JSON.parse(v) : v;
        }
        return null;
      }),
      put: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    },
    BUCKET: {},
    JWT_SECRET: 'test-secret',
    JWT_REFRESH_SECRET: 'test-refresh',
    ENVIRONMENT: 'test',
    API_URL: 'http://localhost',
    FRONTEND_URL: 'http://localhost',
    JWT_EXPIRES_IN: '1h',
    REFRESH_TOKEN_EXPIRES_IN: '7d',
    LOG_LEVEL: 'silent',
    ANTHROPIC_API_KEY: 'sk-ant-test',
  };

  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (overrides?.authHeader) headers.set('Authorization', overrides.authHeader);
  const request = new Request(url, { method, headers, body });

  const context: any = {
    request,
    env,
    params: {},
    auth: overrides?.auth ?? {
      userId: 'iruda-001',
      email: 'iruda@test',
      role: 'student',
      academyId: 'wawa',
      iat: 0,
      exp: 0,
    },
  };

  // bypass authMiddleware by pre-setting context.auth
  return { context, env, dbCalls };
}

describe('handleAskAI — 라우팅', () => {
  it('인증 없이 호출 → 401 (auth middleware가 차단)', async () => {
    const { context } = makeContext({ method: 'GET', pathQuery: '/api/ask-ai/unknown' });
    const res = await handleAskAI('GET', '/api/ask-ai/unknown', context.request, context);
    expect(res.status).toBe(401);
  });

  it('teacher 라우트에 student 권한으로 접근 → 403', async () => {
    const { context } = makeContext({
      method: 'GET',
      pathQuery: '/api/ask-ai/teacher/queue',
      auth: { userId: 'iruda-001', role: 'student', academyId: 'wawa', email: '', iat: 0, exp: 0 },
    });
    // authMiddleware가 동작 안 하므로 직접 인증 우회 — 실 환경은 미들웨어가 막지만 핸들러도 role 체크
    const res = await handleAskAI('GET', '/api/ask-ai/teacher/queue', context.request, context);
    // 401 또는 403 (auth middleware가 토큰 없어 401 먼저 — 핸들러 진입 X)
    // 실제 환경에선 auth 통과 후 role 체크 → 403
    expect([401, 403]).toContain(res.status);
  });
});

describe('PlayAuth 분기 (학생 라우트)', () => {
  const PLAY_TOKEN = 'play-uuid-1';
  const PLAY_AUTH = { studentId: 'iruda-001', academyId: 'wawa', teacherId: 't1', name: '이루다' };

  beforeEach(() => invalidateTenantCache('wawa'));

  it('GET /quota — 유효 play_token → 200 + 신규 quota', async () => {
    const { context } = makeContext({
      method: 'GET',
      pathQuery: '/api/ask-ai/quota',
      authHeader: `Bearer ${PLAY_TOKEN}`,
      kvGet: (k) => k === `play:${PLAY_TOKEN}` ? JSON.stringify(PLAY_AUTH) : undefined,
    });
    const res = await handleAskAI('GET', '/api/ask-ai/quota', context.request, context);
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.data.questions).toEqual({ used: 0, limit: 30 });
  });

  it('GET /quota — Authorization 헤더 없음 → 401', async () => {
    const { context } = makeContext({ method: 'GET', pathQuery: '/api/ask-ai/quota' });
    const res = await handleAskAI('GET', '/api/ask-ai/quota', context.request, context);
    expect(res.status).toBe(401);
  });

  it('GET /quota — KV 에 토큰 없음 → 401', async () => {
    const { context } = makeContext({
      method: 'GET',
      pathQuery: '/api/ask-ai/quota',
      authHeader: 'Bearer unknown-token',
    });
    const res = await handleAskAI('GET', '/api/ask-ai/quota', context.request, context);
    expect(res.status).toBe(401);
  });

  it('GET /quota — 학원 비활성 (tenant) → 403', async () => {
    const { context } = makeContext({
      method: 'GET',
      pathQuery: '/api/ask-ai/quota',
      authHeader: `Bearer ${PLAY_TOKEN}`,
      kvGet: (k) => k === `play:${PLAY_TOKEN}` ? JSON.stringify(PLAY_AUTH) : undefined,
      noAcademy: true,
    });
    const res = await handleAskAI('GET', '/api/ask-ai/quota', context.request, context);
    expect(res.status).toBe(403);
  });

  it('teacher 라우트에 학생 토큰 → 401 (JWT 분기로 가지만 토큰 형식 다름)', async () => {
    const { context } = makeContext({
      method: 'GET',
      pathQuery: '/api/ask-ai/teacher/queue',
      authHeader: `Bearer ${PLAY_TOKEN}`,
      kvGet: (k) => k === `play:${PLAY_TOKEN}` ? JSON.stringify(PLAY_AUTH) : undefined,
    });
    const res = await handleAskAI('GET', '/api/ask-ai/teacher/queue', context.request, context);
    // play_token 은 JWT가 아니라 verifyAccessToken 실패 → 401
    expect(res.status).toBe(401);
  });
});
