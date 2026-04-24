import { test, expect } from '@playwright/test';

/**
 * 이미지 숙제 피드백 · 학부모 공유 — E2E (라이브 워커)
 *
 * UC 매핑:
 *   UC1 교사 로그인
 *   UC2 학생 조회 + PIN 초기화
 *   UC3 학생 play 로그인
 *   UC4 교사 과제 발행
 *   UC5 학생 이미지 업로드
 *   UC6 학생 제출 (submitted)
 *   UC7 교사 피드백 작성 (completed)
 *   UC8 공유 링크 발급 성공
 *   UC9 공유 링크로 학부모 조회 성공 (토큰 검증 + 데이터)
 *   UC10 학부모 파일 프록시 접근 성공
 *   UC11 토큰 없음 → 400
 *   UC12 토큰 변조 → 401
 *   UC13 다른 target 의 파일 키 → 403
 *   UC14 피드백 0개 상태에서 공유 시도 → 400
 *   UC15 rate limit 는 검증 생략 (카운터 오염 방지)
 */

const API = 'https://wawa-smart-erp-api.zeskywa499.workers.dev';
const SLUG = 'alpha';
const TEACHER = { name: '서재용 개발자', pin: '1141' };
const STUDENT_PIN = '9999';
const STUDENT_NAME = `E2E숙제학생_${Date.now()}`;

test.setTimeout(120000);

async function postJson(path: string, body: any, token?: string) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json: (json as any).data ?? json, raw: json };
}

async function getJson(path: string, token?: string) {
  const res = await fetch(`${API}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json: (json as any).data ?? json, raw: json };
}

test.describe('이미지 숙제 · 학부모 공유 E2E', () => {
  test.describe.configure({ mode: 'serial' });

  let teacherToken = '';
  let studentToken = '';
  let studentId = '';
  let assignmentId = '';
  let targetId = '';
  let fileKey = '';
  let shareToken = '';
  let sharePath = '';

  test('UC1: 교사 로그인', async () => {
    const r = await postJson('/api/auth/login', { slug: SLUG, name: TEACHER.name, pin: TEACHER.pin });
    expect(r.status, `login raw=${JSON.stringify(r.raw)}`).toBe(200);
    teacherToken = r.json.accessToken;
    expect(teacherToken).toBeTruthy();
  });

  test('UC2: 테스트 학생 생성', async () => {
    const r = await postJson(
      '/api/gacha/students',
      { name: STUDENT_NAME, pin: STUDENT_PIN, grade: '중2' },
      teacherToken
    );
    expect(r.status, `create student raw=${JSON.stringify(r.raw)}`).toBeLessThan(400);
    studentId = r.json.id;
    expect(studentId).toBeTruthy();
  });

  test('UC3: 학생 play 로그인', async () => {
    const r = await postJson('/api/play/login', { academy_slug: SLUG, name: STUDENT_NAME, pin: STUDENT_PIN });
    expect(r.status).toBe(200);
    studentToken = r.json.token;
    expect(studentToken).toBeTruthy();
  });

  test('UC4: 교사 과제 발행', async () => {
    const r = await postJson(
      '/api/assignments',
      {
        title: `E2E 이미지 숙제 — ${new Date().toISOString()}`,
        instructions: '사진 찍어서 제출',
        kind: 'general',
        student_ids: [studentId],
      },
      teacherToken
    );
    expect(r.status, `create raw=${JSON.stringify(r.raw)}`).toBe(201);
    assignmentId = r.json.id;
  });

  test('UC5: 학생 이미지 업로드', async () => {
    const pngMagic = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13]);
    const fd = new FormData();
    fd.append('file', new Blob([pngMagic], { type: 'image/png' }), 'e2e-photo.png');
    const up = await fetch(`${API}/api/play/assignments/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: fd,
    });
    const raw = (await up.json()) as any;
    const json = raw.data ?? raw;
    expect(up.status).toBe(201);
    fileKey = json.key;
    expect(fileKey).toContain(`/submission/${studentId}/`);
  });

  test('UC6: 학생 제출', async () => {
    const list = await getJson('/api/play/assignments', studentToken);
    expect(list.status).toBe(200);
    const t = (list.json as any[]).find((x: any) => x.assignment_id === assignmentId);
    expect(t, '학생 목록에 과제 없음').toBeTruthy();
    targetId = t.target_id;

    const r = await postJson(
      `/api/play/assignments/${targetId}/submit`,
      {
        note: 'E2E 제출',
        files: [{ key: fileKey, name: 'e2e-photo.png', size: 12, mime: 'image/png' }],
      },
      studentToken
    );
    expect(r.status).toBe(201);
    expect(r.json.status).toBe('submitted');
  });

  test('UC14: 피드백 0개 상태에서 공유 시도 → 400', async () => {
    const r = await postJson(
      `/api/assignments/targets/${targetId}/parent-share`,
      { days: 7 },
      teacherToken
    );
    expect(r.status).toBe(400);
    expect(r.raw.error || r.raw.message || '').toMatch(/피드백/);
  });

  test('UC7: 교사 피드백 작성 (accept)', async () => {
    const r = await postJson(
      `/api/assignments/targets/${targetId}/respond`,
      { comment: 'E2E 피드백 — 잘했어요', action: 'accept' },
      teacherToken
    );
    expect(r.status).toBe(201);
    expect(r.json.target_status).toBe('completed');
  });

  test('UC8: 공유 링크 발급 성공', async () => {
    const r = await postJson(
      `/api/assignments/targets/${targetId}/parent-share`,
      { days: 7 },
      teacherToken
    );
    expect(r.status, `share raw=${JSON.stringify(r.raw)}`).toBe(200);
    expect(r.json.token).toBeTruthy();
    expect(r.json.url).toContain('/parent-homework/');
    expect(r.json.expires_at).toBeTruthy();
    shareToken = r.json.token;
    sharePath = r.json.path;
    expect(sharePath).toContain(targetId);
  });

  test('UC9: 학부모 조회 성공', async () => {
    const res = await fetch(
      `${API}/api/parent-homework/${targetId}?token=${encodeURIComponent(shareToken)}`
    );
    const raw = (await res.json()) as any;
    const data = raw.data ?? raw;
    expect(res.status, `view raw=${JSON.stringify(raw)}`).toBe(200);
    expect(data.student.name).toBe(STUDENT_NAME);
    expect(data.assignment.title).toContain('E2E 이미지 숙제');
    expect(Array.isArray(data.submissions)).toBe(true);
    expect(data.submissions.length).toBeGreaterThan(0);
    expect(data.submissions[0].files[0].key).toBe(fileKey);
    expect(Array.isArray(data.responses)).toBe(true);
    expect(data.responses.length).toBeGreaterThan(0);
    expect(data.responses[0].comment).toContain('E2E 피드백');
  });

  test('UC10: 학부모 파일 프록시 접근 성공', async () => {
    const url = `${API}/api/parent-homework/${targetId}/file/${encodeURIComponent(fileKey)}?token=${encodeURIComponent(shareToken)}`;
    const res = await fetch(url);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type') || '').toMatch(/image\/png|application\/octet-stream/);
    const buf = await res.arrayBuffer();
    expect(buf.byteLength).toBeGreaterThan(0);
  });

  test('UC11: 토큰 없음 → 400', async () => {
    const res = await fetch(`${API}/api/parent-homework/${targetId}`);
    expect(res.status).toBe(400);
  });

  test('UC12: 토큰 변조 → 401', async () => {
    // signature 마지막 문자 하나 바꿔서 위조
    const tampered = shareToken.slice(0, -2) + (shareToken.slice(-2) === 'aa' ? 'bb' : 'aa');
    const res = await fetch(
      `${API}/api/parent-homework/${targetId}?token=${encodeURIComponent(tampered)}`
    );
    expect(res.status).toBe(401);
  });

  test('UC13: 다른 target 의 파일 키 → 403', async () => {
    // 학원 범위는 맞되, 이 target 에 속하지 않는 임의 키
    const fakeKey = fileKey.replace('/submission/', '/submission/FAKE-');
    const res = await fetch(
      `${API}/api/parent-homework/${targetId}/file/${encodeURIComponent(fakeKey)}?token=${encodeURIComponent(shareToken)}`
    );
    expect([400, 403]).toContain(res.status);
  });

  test('UC-cleanup: 과제 닫기', async () => {
    const res = await fetch(`${API}/api/assignments/${assignmentId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    expect(res.status).toBe(200);
  });
});
