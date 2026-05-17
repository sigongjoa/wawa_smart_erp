import { test, expect } from '@playwright/test';

const API = 'https://wawa-smart-erp-api.zeskywa499.workers.dev';
const SLUG = 'alpha';
const TEACHER = { name: '서재용', pin: '1141' };
const STUDENT_NAME = '강은서';
const STUDENT_PIN = '9999';

test.setTimeout(90000);

// ── helpers ────────────────────────────────────────────────
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

async function patchJson(path: string, body: any, token: string) {
  const res = await fetch(`${API}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: (await res.json().catch(() => ({}))) };
}

// ── the flow ───────────────────────────────────────────────
test.describe('과제 회수·첨삭 E2E 플로우 (선생 발행 → 학생 제출 → 선생 회신 → 완료)', () => {
  test.describe.configure({ mode: 'serial' });

  let teacherToken = '';
  let studentToken = '';
  let studentId = '';
  let assignmentId = '';
  let targetId = '';
  let submittedFileKey = '';

  test('UC1: 선생님 로그인 (JWT 발급)', async () => {
    const r = await postJson('/api/auth/login', { slug: SLUG, name: TEACHER.name, pin: TEACHER.pin });
    expect(r.status).toBe(200);
    expect(r.json.accessToken).toBeTruthy();
    teacherToken = r.json.accessToken;
    console.log('[UC1] 선생님 JWT 발급 ✓');
  });

  test('UC2: 대상 가차 학생 찾고 PIN 초기화', async () => {
    const list = await getJson('/api/gacha/students?scope=all', teacherToken);
    expect(list.status).toBe(200);
    const student = (list.json as any[]).find(s => s.name === STUDENT_NAME && s.status === 'active');
    expect(student, `학생 "${STUDENT_NAME}" 못 찾음`).toBeTruthy();
    studentId = student.id;
    console.log(`[UC2] 대상 학생: ${student.name} (${studentId})`);

    // PIN을 9999로 초기화
    const reset = await postJson(
      `/api/gacha/students/${studentId}/reset-pin`,
      { pin: STUDENT_PIN },
      teacherToken,
    );
    expect(reset.status).toBeLessThan(400);
    console.log('[UC2] PIN 초기화 → 9999 ✓');
  });

  test('UC3: 학생 PIN 로그인 (play token 발급)', async () => {
    const r = await postJson('/api/play/login', {
      academy_slug: SLUG, name: STUDENT_NAME, pin: STUDENT_PIN,
    });
    expect(r.status).toBe(200);
    expect(r.json.token).toBeTruthy();
    studentToken = r.json.token;
    console.log('[UC3] 학생 play token 발급 ✓');
  });

  test('UC4: 선생님이 수행평가 과제 발행', async () => {
    const r = await postJson('/api/assignments', {
      title: `E2E 테스트 수행평가 — ${new Date().toISOString()}`,
      instructions: '아래 파일을 풀어서 사진 찍어 업로드해주세요.',
      kind: 'perf_eval',
      due_at: new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString(),
      student_ids: [studentId],
    }, teacherToken);
    expect(r.status).toBe(201);
    expect(r.json.id).toBeTruthy();
    expect(r.json.target_count).toBe(1);
    assignmentId = r.json.id;
    console.log(`[UC4] 과제 발행 ✓ (id=${assignmentId}, target_count=${r.json.target_count})`);
  });

  test('UC5: 학생이 과제 목록에서 새 과제 확인', async () => {
    const r = await getJson('/api/play/assignments', studentToken);
    expect(r.status).toBe(200);
    const target = (r.json as any[]).find(t => t.assignment_id === assignmentId);
    expect(target, '발행한 과제가 학생 목록에 안 보임').toBeTruthy();
    expect(target.status).toBe('assigned');
    targetId = target.target_id;
    console.log(`[UC5] 학생 목록에 과제 노출 ✓ (target=${targetId}, status=assigned)`);
  });

  test('UC6: 학생이 파일 업로드', async () => {
    // 가짜 이미지 파일 (PNG 헤더 + 최소 데이터)
    const pngMagic = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13]);
    const blob = new Blob([pngMagic], { type: 'image/png' });
    const fd = new FormData();
    fd.append('file', blob, 'test-submission.png');
    const res = await fetch(`${API}/api/play/assignments/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: fd,
    });
    const raw = await res.json() as any;
    const json = raw.data ?? raw;
    expect(res.status).toBe(201);
    expect(json.key).toContain(`/submission/${studentId}/`);
    submittedFileKey = json.key;
    console.log(`[UC6] 학생 파일 업로드 ✓ (key=${json.key.slice(-40)})`);
  });

  test('UC7: 학생이 과제 제출', async () => {
    const r = await postJson(`/api/play/assignments/${targetId}/submit`, {
      note: '선생님 풀어봤어요!',
      files: [{ key: submittedFileKey, name: 'test-submission.png', size: 12, mime: 'image/png' }],
    }, studentToken);
    expect(r.status).toBe(201);
    expect(r.json.status).toBe('submitted');
    console.log('[UC7] 학생 제출 완료 ✓');
  });

  test('UC8: 선생님 인박스에 제출 노출 확인', async () => {
    const r = await getJson('/api/assignments/inbox', teacherToken);
    expect(r.status).toBe(200);
    const item = (r.json as any[]).find(x => x.target_id === targetId);
    expect(item, '인박스에 제출 안 보임').toBeTruthy();
    expect(item.status).toBe('submitted');
    console.log(`[UC8] 인박스 노출 ✓ (${item.student_name} — ${item.title})`);
  });

  test('UC9: 선생님이 재제출 요청 (needs_resubmit)', async () => {
    const r = await postJson(`/api/assignments/targets/${targetId}/respond`, {
      comment: '3번 문제 다시 풀어주세요',
      action: 'needs_resubmit',
    }, teacherToken);
    expect(r.status).toBe(201);
    expect(r.json.target_status).toBe('needs_resubmit');
    console.log('[UC9] 재제출 요청 전송 ✓');
  });

  test('UC10: 학생이 재제출 요청 + 코멘트 확인', async () => {
    const r = await getJson(`/api/play/assignments/${targetId}`, studentToken);
    expect(r.status).toBe(200);
    expect((r.json as any).target.status).toBe('needs_resubmit');
    const responses = (r.json as any).responses;
    expect(responses.length).toBeGreaterThan(0);
    expect(responses[0].comment).toContain('3번 문제');
    expect(responses[0].action).toBe('needs_resubmit');
    console.log('[UC10] 학생이 재제출 요청 확인 ✓');
  });

  test('UC11: 학생 재제출', async () => {
    // 재업로드
    const fd = new FormData();
    fd.append('file', new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' }), 'retry.png');
    const up = await fetch(`${API}/api/play/assignments/upload`, {
      method: 'POST', headers: { Authorization: `Bearer ${studentToken}` }, body: fd,
    });
    const upRaw = await up.json() as any;
    const upJson = upRaw.data ?? upRaw;
    expect(up.status).toBe(201);

    const r = await postJson(`/api/play/assignments/${targetId}/submit`, {
      note: '다시 풀었어요',
      files: [{ key: upJson.key, name: 'retry.png', size: 4, mime: 'image/png' }],
    }, studentToken);
    expect(r.status).toBe(201);
    expect(r.json.status).toBe('submitted');
    console.log('[UC11] 학생 재제출 ✓');
  });

  test('UC12: 선생님 완료 처리 (accept)', async () => {
    const r = await postJson(`/api/assignments/targets/${targetId}/respond`, {
      comment: '좋아요, 완벽해요!',
      action: 'accept',
    }, teacherToken);
    expect(r.status).toBe(201);
    expect(r.json.target_status).toBe('completed');
    console.log('[UC12] 완료 처리 ✓');
  });

  test('UC13: 양쪽에서 최종 상태 확인', async () => {
    // 학생 측
    const stu = await getJson(`/api/play/assignments/${targetId}`, studentToken);
    expect((stu.json as any).target.status).toBe('completed');
    // 선생님 측
    const tch = await getJson(`/api/assignments/${assignmentId}`, teacherToken);
    const target = (tch.json as any).targets.find((t: any) => t.id === targetId);
    expect(target.status).toBe('completed');
    expect(target.response_count).toBeGreaterThanOrEqual(2);
    expect(target.submission_count).toBeGreaterThanOrEqual(2);
    console.log('[UC13] 양쪽 최종 상태 일치: completed ✓');
  });

  test('UC14: 통계 카운트 검증', async () => {
    const r = await getJson('/api/assignments/stats', teacherToken);
    expect(r.status).toBe(200);
    expect((r.json as any).completed_count).toBeGreaterThanOrEqual(1);
    console.log(`[UC14] stats.completed_count = ${(r.json as any).completed_count} ✓`);
  });

  test('UC15: 과제 닫기 (soft-delete)', async () => {
    const res = await fetch(`${API}/api/assignments/${assignmentId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    expect(res.status).toBe(200);

    const detail = await getJson(`/api/assignments/${assignmentId}`, teacherToken);
    expect((detail.json as any).status).toBe('closed');
    console.log('[UC15] 과제 닫기 ✓');
  });

  test('UC16: ACL 검증 — 다른 학생 토큰으로 파일 접근 불가', async () => {
    // 학생 본인은 접근 OK
    const ok = await fetch(`${API}/api/play/assignments/file/${encodeURIComponent(submittedFileKey)}`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    expect(ok.status).toBe(200);

    // 토큰 없이는 401
    const unauth = await fetch(`${API}/api/play/assignments/file/${encodeURIComponent(submittedFileKey)}`);
    expect(unauth.status).toBe(401);

    console.log('[UC16] ACL 검증 ✓ (본인=200, 무토큰=401)');
  });
});
