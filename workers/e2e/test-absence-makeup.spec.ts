/**
 * 결석/보강 관리 시스템 E2E 테스트 (Issue #27)
 * 라이브 API 직접 호출
 */
import { test, expect } from '@playwright/test';
import { API_URL, SITE_URL } from './_env';

const API = API_URL;

async function getToken(): Promise<string> {
  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: '서재용 개발자', pin: '1141' }),
  });
  const json = await res.json() as any;
  if (!json.data?.accessToken) throw new Error('로그인 실패: ' + JSON.stringify(json));
  return json.data.accessToken;
}

function headers(token: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

// 테스트에서 사용할 상태
let token: string;
let testClassId: string;
let testStudentId: string;
let testAbsenceId: string;
let testMakeupId: string;

test.describe.configure({ mode: 'serial' });

test.describe('결석/보강 관리 시스템', () => {

  test('UC-01: 로그인 및 토큰 획득', async () => {
    token = await getToken();
    expect(token).toBeTruthy();
    console.log('✅ 토큰 획득 성공');
  });

  test('UC-02: 수업 목록 조회', async () => {
    const res = await fetch(`${API}/api/timer/classes`, { headers: headers(token) });
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    const classes = json.data || json;
    console.log(`✅ 수업 ${classes.length}개 조회`);

    if (classes.length > 0) {
      testClassId = classes[0].id;
      console.log(`  첫 수업: ${classes[0].name} (id: ${testClassId})`);
    }
  });

  test('UC-03: 학생 목록 조회', async () => {
    const res = await fetch(`${API}/api/student`, { headers: headers(token) });
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    const students = json.data || json;
    console.log(`✅ 학생 ${students.length}명 조회`);

    if (students.length > 0) {
      testStudentId = students[0].id;
      console.log(`  첫 학생: ${students[0].name} (id: ${testStudentId})`);
    }
  });

  test('UC-04: 수업에 학생 배정 (class_students)', async () => {
    if (!testClassId || !testStudentId) {
      console.log('⏭️ 수업 또는 학생 없음 — 테스트 수업/학생 생성');

      // 수업이 없으면 생성
      if (!testClassId) {
        const res = await fetch(`${API}/api/timer/classes`, {
          method: 'POST',
          headers: headers(token),
          body: JSON.stringify({
            name: 'E2E 테스트 수학반',
            grade: '중2',
            dayOfWeek: new Date().getDay(),
            startTime: '15:00',
            endTime: '17:00',
            capacity: 10,
          }),
        });
        const json = await res.json() as any;
        testClassId = (json.data || json).id;
        console.log(`  수업 생성: ${testClassId}`);
      }

      // 여전히 학생 없으면 스킵
      if (!testStudentId) {
        console.log('⚠️ 학생 데이터 없음 — 배정 스킵');
        return;
      }
    }

    const res = await fetch(`${API}/api/absence/class-students`, {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify({ classId: testClassId, studentId: testStudentId }),
    });
    expect(res.status).toBeLessThan(300);
    const json = await res.json() as any;
    console.log(`✅ 학생 배정 완료:`, JSON.stringify(json.data || json).slice(0, 100));
  });

  test('UC-05: 수업별 배정 학생 조회', async () => {
    if (!testClassId) { console.log('⏭️ 수업 없음 스킵'); return; }

    const res = await fetch(`${API}/api/absence/class-students?classId=${testClassId}`, {
      headers: headers(token),
    });
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    const students = json.data || json;
    console.log(`✅ 배정 학생 ${students.length}명 조회`);
    expect(students.length).toBeGreaterThanOrEqual(1);
  });

  test('UC-06: 결석 기록 (단건)', async () => {
    if (!testClassId || !testStudentId) { console.log('⏭️ 데이터 없음 스킵'); return; }

    const today = new Date().toISOString().split('T')[0];
    const res = await fetch(`${API}/api/absence`, {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify({
        studentId: testStudentId,
        classId: testClassId,
        absenceDate: today,
        reason: '병원',
        notifiedBy: '학부모',
      }),
    });
    expect(res.status).toBeLessThan(300);
    const json = await res.json() as any;
    testAbsenceId = (json.data || json).id;
    console.log(`✅ 결석 기록: ${testAbsenceId}`);
  });

  test('UC-07: 날짜별 결석 조회', async () => {
    const today = new Date().toISOString().split('T')[0];
    const res = await fetch(`${API}/api/absence?date=${today}`, {
      headers: headers(token),
    });
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    const absences = json.data || json;
    console.log(`✅ 오늘 결석 ${absences.length}건 조회`);
    expect(absences.length).toBeGreaterThanOrEqual(1);

    // 결석 데이터 검증
    const found = absences.find((a: any) => a.student_id === testStudentId || a.id === testAbsenceId);
    if (found) {
      console.log(`  학생: ${found.student_name}, 사유: ${found.reason}, 수업: ${found.class_name}`);
    }
  });

  test('UC-08: 미출석자 조회 (수업 마침 시)', async () => {
    if (!testClassId) { console.log('⏭️ 수업 없음 스킵'); return; }

    const today = new Date().toISOString().split('T')[0];
    const res = await fetch(`${API}/api/absence/unchecked?classId=${testClassId}&date=${today}`, {
      headers: headers(token),
    });
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    const unchecked = json.data || json;
    console.log(`✅ 미출석자 ${unchecked.length}명 조회`);
  });

  test('UC-09: 일괄 결석 기록 (수업 마침)', async () => {
    if (!testClassId || !testStudentId) { console.log('⏭️ 데이터 없음 스킵'); return; }

    // 다른 날짜로 일괄 기록 테스트
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const res = await fetch(`${API}/api/absence/batch`, {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify({
        absences: [
          { studentId: testStudentId, classId: testClassId, absenceDate: yesterday, reason: '미통보', notifiedBy: '' },
        ],
      }),
    });
    expect(res.status).toBeLessThan(300);
    const json = await res.json() as any;
    const result = json.data || json;
    console.log(`✅ 일괄 결석 기록: ${result.recorded}건`);
    expect(result.recorded).toBe(1);
  });

  test('UC-10: 보강 목록 조회 (전체)', async () => {
    const res = await fetch(`${API}/api/makeup`, {
      headers: headers(token),
    });
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    const makeups = json.data || json;
    console.log(`✅ 보강 목록 ${makeups.length}건 조회`);
    expect(makeups.length).toBeGreaterThanOrEqual(1);

    // pending 상태인 것 찾기
    const pending = makeups.find((m: any) => m.status === 'pending');
    if (pending) {
      testMakeupId = pending.id;
      testAbsenceId = pending.absence_id;
      console.log(`  미보강: ${pending.student_name} (${pending.absence_date}) — makeupId: ${testMakeupId}`);
    }
  });

  test('UC-11: 보강 목록 상태 필터 (pending)', async () => {
    const res = await fetch(`${API}/api/makeup?status=pending`, {
      headers: headers(token),
    });
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    const pending = json.data || json;
    console.log(`✅ 미보강 ${pending.length}건`);
    // 모두 pending인지 확인
    for (const m of pending) {
      expect(m.status).toBe('pending');
    }
  });

  test('UC-12: 보강일 지정 (pending → scheduled)', async () => {
    if (!testAbsenceId) { console.log('⏭️ 결석 데이터 없음 스킵'); return; }

    const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
    const res = await fetch(`${API}/api/makeup`, {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify({
        absenceId: testAbsenceId,
        scheduledDate: nextWeek,
        notes: 'E2E 테스트 보강',
      }),
    });
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    console.log(`✅ 보강일 지정: ${nextWeek}`, JSON.stringify(json.data || json));
  });

  test('UC-13: 보강일 지정 확인 (scheduled 상태)', async () => {
    const res = await fetch(`${API}/api/makeup?status=scheduled`, {
      headers: headers(token),
    });
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    const scheduled = json.data || json;
    console.log(`✅ 보강예정 ${scheduled.length}건`);
    expect(scheduled.length).toBeGreaterThanOrEqual(1);

    // scheduled 상태인 것에서 makeup ID 갱신
    const target = scheduled.find((m: any) => m.absence_id === testAbsenceId);
    if (target) {
      testMakeupId = target.id;
      console.log(`  보강예정: ${target.student_name} → ${target.scheduled_date}`);
    }
  });

  test('UC-14: 보강 완료 처리 (scheduled → completed)', async () => {
    if (!testMakeupId) { console.log('⏭️ 보강 ID 없음 스킵'); return; }

    const res = await fetch(`${API}/api/makeup/${testMakeupId}/complete`, {
      method: 'PATCH',
      headers: headers(token),
    });
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    console.log(`✅ 보강 완료:`, JSON.stringify(json.data || json));
  });

  test('UC-15: 보강 완료 확인', async () => {
    const res = await fetch(`${API}/api/makeup?status=completed`, {
      headers: headers(token),
    });
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    const completed = json.data || json;
    console.log(`✅ 보강완료 ${completed.length}건`);
    expect(completed.length).toBeGreaterThanOrEqual(1);
  });

  test('UC-16: 퇴근 요약 (daily-summary)', async () => {
    const today = new Date().toISOString().split('T')[0];
    const res = await fetch(`${API}/api/absence/daily-summary?date=${today}`, {
      headers: headers(token),
    });
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    const summary = json.data || json;

    console.log(`✅ 퇴근 요약:`);
    console.log(`  날짜: ${summary.date}`);
    console.log(`  오늘 결석: ${summary.todayAbsences.length}명`);
    console.log(`  미보강 누적: ${summary.pendingMakeups.length}건`);
    console.log(`  클립보드 텍스트:\n${summary.clipboardText}`);

    expect(summary.clipboardText).toContain('와와학습코칭센터');
  });

  test('UC-17: 결석 수정 (PATCH)', async () => {
    if (!testAbsenceId) { console.log('⏭️ 결석 ID 없음 스킵'); return; }

    const res = await fetch(`${API}/api/absence/${testAbsenceId}`, {
      method: 'PATCH',
      headers: headers(token),
      body: JSON.stringify({ reason: '가족행사' }),
    });
    expect(res.status).toBe(200);
    console.log('✅ 결석 사유 수정 완료 (병원 → 가족행사)');
  });

  // ── 정리: 테스트 데이터 클린업 ──

  test('CLEANUP: 테스트 데이터 정리', async () => {
    // 테스트 결석/보강은 실 데이터에 남아도 무방 (날짜로 구분 가능)
    // class_students 배정만 해제
    if (testClassId) {
      const res = await fetch(`${API}/api/absence/class-students?classId=${testClassId}`, {
        headers: headers(token),
      });
      const json = await res.json() as any;
      const assignments = json.data || json;
      console.log(`📋 배정 해제 대상: ${assignments.length}건`);

      // E2E 테스트로 배정한 것만 해제하지 않고, 남겨둠 (실 운영에 활용)
      console.log('✅ 정리 완료 (배정 데이터는 유지)');
    }
  });
});
