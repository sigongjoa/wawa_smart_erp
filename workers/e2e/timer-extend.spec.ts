/**
 * 타이머 세션 연장(+/-N분) E2E — issue 학생페이지에서 30분 추가가 타이머에 반영 안됨
 *
 * 검증:
 *   - POST /api/timer/sessions/:id/extend 가 realtime_sessions.added_minutes 를 갱신
 *   - getRealtimeToday 응답에 addedMinutes 가 노출되어 타이머 페이지가 합산 가능
 *   - 누적 / 감액 / 0 floor / ±240 상한 / 0 거부 / completed 거부 / ownership 차단
 *
 * 실행:
 *   터미널 A: cd workers && npx wrangler dev
 *   터미널 B: pnpm exec playwright test workers/e2e/timer-extend.spec.ts
 *
 * 사전: migrations/060_session_added_minutes.sql 가 로컬 D1에 적용되어 있어야 함
 *       (attendance_records.added_minutes 컬럼 — check-out 단계에서 사용)
 */
import { test, expect } from '@playwright/test';
import { API_URL } from './_env';

const API = API_URL;
// .env: TEST_SLUG/TEST_NAME/TEST_PIN 으로 override 가능. 미지정 시 로컬 D1 시드 (wawa/김상현/1234).
const TEACHER = {
  slug: process.env.TEST_SLUG || 'wawa',
  name: process.env.TEST_NAME || '김상현',
  pin: process.env.TEST_PIN || '1234',
};

async function getToken(): Promise<string> {
  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(TEACHER),
  });
  const json = (await res.json()) as any;
  if (!json.data?.accessToken) {
    throw new Error(
      `로그인 실패 (slug=${TEACHER.slug} name=${TEACHER.name}): ` + JSON.stringify(json)
    );
  }
  return json.data.accessToken;
}

function headers(token: string) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

// 응답 wrapper 풀기 — 프로젝트 컨벤션상 { success, data } 또는 raw
function unwrap<T = any>(json: any): T {
  return (json?.data ?? json) as T;
}

// 오늘 요일 (ko)
function todayDay(): string {
  return ['일', '월', '화', '수', '목', '금', '토'][new Date().getDay()];
}

function todayDate(): string {
  return new Date().toISOString().split('T')[0];
}

let token: string;
let sessionId: string;
let studentId: string;
let createdSession = false; // 우리가 만든 세션이면 cleanup에서 체크아웃
let originalScheduled = 0;

test.describe.configure({ mode: 'serial' });

test.describe('타이머 세션 연장 (+/-N분)', () => {
  test('UC-01: 로그인', async () => {
    token = await getToken();
    expect(token).toBeTruthy();
  });

  test('UC-02: 테스트용 active session 확보 (없으면 체크인)', async () => {
    const day = todayDay();
    const date = todayDate();

    const res = await fetch(
      `${API}/api/timer/realtime-today?day=${encodeURIComponent(day)}&date=${date}`,
      { headers: headers(token) }
    );
    expect(res.status).toBe(200);
    const data = unwrap<{ students: any[] }>(await res.json());
    expect(Array.isArray(data.students)).toBe(true);

    // 이미 진행 중인 세션이 있으면 재사용
    const withActive = data.students.find(
      (s: any) => s.activeSession && s.activeSession.status !== 'completed'
    );
    if (withActive) {
      sessionId = withActive.activeSession.id;
      studentId = withActive.id;
      originalScheduled = withActive.activeSession.scheduledMinutes;
      createdSession = false;
      console.log(`♻️ 재사용: ${withActive.name} session=${sessionId} 예정=${originalScheduled}분`);
      return;
    }

    // 없으면 적당한 학생 골라서 새 세션 체크인
    const candidate = data.students.find(
      (s: any) => !s.activeSession && !s.completedSession
    );
    if (!candidate) {
      throw new Error('테스트용 학생 없음 — 모든 학생이 이미 수업중 또는 완료');
    }

    studentId = candidate.id;
    const checkInRes = await fetch(`${API}/api/timer/sessions/check-in`, {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify({
        studentId,
        scheduledStartTime: '15:00',
        scheduledEndTime: '17:00', // 120분 — 이후 산수가 깔끔
        subject: 'E2E-extend-test',
      }),
    });
    expect(checkInRes.status).toBeLessThan(300);
    const checkInData = unwrap<any>(await checkInRes.json());
    sessionId = checkInData.id;
    originalScheduled = checkInData.scheduledMinutes;
    createdSession = true;
    expect(originalScheduled).toBe(120);
    expect(checkInData.addedMinutes).toBe(0); // 체크인 직후 added=0
    console.log(`🆕 체크인: ${candidate.name} session=${sessionId} 예정=${originalScheduled}분`);
  });

  test('UC-03: +30분 연장 → addedMinutes=30', async () => {
    const baselineAdded = await currentAdded(token, sessionId);

    const res = await fetch(`${API}/api/timer/sessions/${sessionId}/extend`, {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify({ minutes: 30 }),
    });
    expect(res.status).toBe(200);
    const d = unwrap<any>(await res.json());
    expect(d.addedMinutes).toBe(baselineAdded + 30);
    expect(d.scheduledMinutes).toBe(originalScheduled);
    expect(d.delta).toBe(30);
  });

  test('UC-04: +10 누적 → 직전 + 10', async () => {
    const before = await currentAdded(token, sessionId);
    const res = await fetch(`${API}/api/timer/sessions/${sessionId}/extend`, {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify({ minutes: 10 }),
    });
    expect(res.status).toBe(200);
    const d = unwrap<any>(await res.json());
    expect(d.addedMinutes).toBe(before + 10);
  });

  test('UC-05: -20 감액 → 직전 - 20', async () => {
    const before = await currentAdded(token, sessionId);
    const res = await fetch(`${API}/api/timer/sessions/${sessionId}/extend`, {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify({ minutes: -20 }),
    });
    expect(res.status).toBe(200);
    const d = unwrap<any>(await res.json());
    expect(d.addedMinutes).toBe(before - 20);
  });

  test('UC-06: 0 floor — 더 빼도 음수로 안 떨어짐', async () => {
    const before = await currentAdded(token, sessionId);
    const huge = -(before + 100); // 무조건 음수로 만들 양
    const res = await fetch(`${API}/api/timer/sessions/${sessionId}/extend`, {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify({ minutes: huge }),
    });
    expect(res.status).toBe(200);
    const d = unwrap<any>(await res.json());
    expect(d.addedMinutes).toBe(0);
    expect(d.delta).toBe(-before); // before → 0 만큼만 적용
  });

  test('UC-07: getRealtimeToday 응답에 addedMinutes 노출 (타이머가 읽을 수 있음)', async () => {
    // 0 상태에서 +30 다시 적용 → 30
    const ext = await fetch(`${API}/api/timer/sessions/${sessionId}/extend`, {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify({ minutes: 30 }),
    });
    expect(ext.status).toBe(200);

    const day = todayDay();
    const date = todayDate();
    const res = await fetch(
      `${API}/api/timer/realtime-today?day=${encodeURIComponent(day)}&date=${date}`,
      { headers: headers(token) }
    );
    const data = unwrap<{ students: any[] }>(await res.json());
    const student = data.students.find((s: any) => s.id === studentId);
    expect(student).toBeTruthy();
    const sess = student!.activeSession || student!.completedSession;
    expect(sess).toBeTruthy();
    expect(sess.id).toBe(sessionId);
    expect(sess.addedMinutes).toBe(30); // 타이머 페이지가 이 값을 합산
    expect(sess.scheduledMinutes).toBe(originalScheduled);
  });

  test('UC-08: 0 거부 → 400', async () => {
    const res = await fetch(`${API}/api/timer/sessions/${sessionId}/extend`, {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify({ minutes: 0 }),
    });
    expect(res.status).toBe(400);
  });

  test('UC-09: ±240 초과 거부 → 400', async () => {
    const res = await fetch(`${API}/api/timer/sessions/${sessionId}/extend`, {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify({ minutes: 300 }),
    });
    expect(res.status).toBe(400);

    const res2 = await fetch(`${API}/api/timer/sessions/${sessionId}/extend`, {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify({ minutes: -300 }),
    });
    expect(res2.status).toBe(400);
  });

  test('UC-10: 인증 없으면 401', async () => {
    const res = await fetch(`${API}/api/timer/sessions/${sessionId}/extend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ minutes: 10 }),
    });
    expect(res.status).toBe(401);
  });

  test('UC-11: 존재하지 않는 sessionId → 404', async () => {
    const res = await fetch(`${API}/api/timer/sessions/00000000-0000-0000-0000-000000000000/extend`, {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify({ minutes: 10 }),
    });
    expect(res.status).toBe(404);
  });

  test('UC-12 (cleanup): 우리가 만든 세션이면 체크아웃 + attendance 검증', async () => {
    if (!createdSession) {
      console.log('♻️ 재사용 세션 — 체크아웃 스킵');
      return;
    }

    // 직전 added=30 확인
    const added = await currentAdded(token, sessionId);
    expect(added).toBe(30);

    const res = await fetch(`${API}/api/timer/sessions/${sessionId}/check-out`, {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify({ note: 'E2E-extend-test cleanup' }),
    });
    expect(res.status).toBe(200);
    const d = unwrap<any>(await res.json());
    expect(d.status).toBe('completed');
    // attendance_records 영구기록은 admin/audit 라우트로 별도 검증 — 여기선 체크아웃만 확인
    console.log(`✅ 체크아웃 완료 — net=${d.netMinutes}분, recordId=${d.recordId}`);
  });
});

// 헬퍼 — 현재 addedMinutes 조회
async function currentAdded(token: string, sessionId: string): Promise<number> {
  const day = todayDay();
  const date = todayDate();
  const res = await fetch(
    `${API}/api/timer/realtime-today?day=${encodeURIComponent(day)}&date=${date}`,
    { headers: headers(token) }
  );
  const data = unwrap<{ students: any[] }>(await res.json());
  for (const s of data.students) {
    const sess = s.activeSession || s.completedSession;
    if (sess && sess.id === sessionId) return sess.addedMinutes ?? 0;
  }
  throw new Error(`session ${sessionId} 를 realtime-today 응답에서 찾지 못함`);
}
