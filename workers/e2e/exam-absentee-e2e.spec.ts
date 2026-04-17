/**
 * 정기고사 결시/재시험 관리 E2E 테스트
 *
 * 배경:
 *   정기고사를 제 날짜에 못 친 학생(병결/학교행사/지각 등)을
 *   결시 등록 → 재시험 배정(시간표 자동 등록) → 응시 완료까지 추적.
 *
 * 유즈케이스:
 *   UC1: 관리자 로그인 + 테스트 학생 생성 + 시험 배정
 *   UC2: 결시 등록 (absent + 사유) — adhoc 생성 없음
 *   UC3: absentees 조회 — 결시 학생이 목록에 포함
 *   UC4: 재시험 배정 (rescheduled + 날짜 + 시간) — adhoc_sessions 자동 생성
 *   UC5: 재시험 날짜/시간 변경 — 동일 adhoc 갱신 (중복 생성 X)
 *   UC6: 재시험 취소(absent로 되돌림) — 기존 adhoc cancelled
 *   UC7: 재시험 재설정 후 응시 완료 — exam_status=completed, 점수 입력
 *   UC8: 정리 (assignment 삭제, adhoc 삭제, period 삭제, student 삭제)
 *
 * 실행: cd workers && npx playwright test e2e/exam-absentee-e2e.spec.ts
 */

import { test, expect } from '@playwright/test';

const TEACHER = {
  name: process.env.E2E_TEACHER_NAME || 'E2E관리자',
  pin: process.env.E2E_TEACHER_PIN || '9999',
  slug: process.env.E2E_SLUG || 'e2e-test',
};
const UNIQUE = Date.now().toString(36);
const MONTH = `2099-${UNIQUE.slice(0, 2).padStart(2, '0').replace(/[^0-9]/g, '1')}`;

let adminToken = '';
let periodId = '';
let studentId = '';
let assignmentId = '';
let adhocId: string | null = null;
const studentName = `absent-e2e-${UNIQUE}`;

function auth() {
  return { Authorization: `Bearer ${adminToken}` };
}

test.describe.serial('정기고사 결시/재시험 E2E', () => {
  // ── UC1: 사전 준비 ──
  test('UC1: 관리자 로그인 + 학생 생성 + 시험 배정', async ({ request }) => {
    const loginRes = await request.post('/api/auth/login', {
      data: { slug: TEACHER.slug, name: TEACHER.name, pin: TEACHER.pin },
    });
    expect(loginRes.ok()).toBeTruthy();
    adminToken = (await loginRes.json()).data?.accessToken;
    expect(adminToken).toBeTruthy();

    // 테스트 학생 (중1) — students 테이블에 생성 (by-month/toggle 용)
    const stuRes = await request.post('/api/student', {
      headers: auth(),
      data: { name: studentName, grade: '중1', status: 'active' },
    });
    if (!stuRes.ok()) {
      console.error('학생 생성 실패:', stuRes.status(), await stuRes.text());
    }
    expect(stuRes.ok()).toBeTruthy();
    studentId = (await stuRes.json()).data?.id;
    expect(studentId).toBeTruthy();

    // 월 기반 시험 period 생성 + 학생 배정
    const byMonthRes = await request.get(`/api/exam-mgmt/by-month?month=${MONTH}&scope=all`, {
      headers: auth(),
    });
    expect(byMonthRes.ok()).toBeTruthy();
    const byMonth = (await byMonthRes.json()).data;
    periodId = byMonth.period.id;
    expect(periodId).toBeTruthy();

    // 학생 배정 토글
    const toggleRes = await request.post(`/api/exam-mgmt/by-month/toggle`, {
      headers: auth(),
      data: { month: MONTH, student_id: studentId },
    });
    expect(toggleRes.ok()).toBeTruthy();
    const toggle = (await toggleRes.json()).data;
    expect(toggle.assigned).toBe(true);
    assignmentId = toggle.assignment_id;
    expect(assignmentId).toBeTruthy();
    console.log(`✅ UC1: period=${periodId}, assignment=${assignmentId}`);
  });

  // ── UC2: 결시 등록 ──
  test('UC2: 결시 등록 (absent + 사유) — adhoc 미생성', async ({ request }) => {
    const res = await request.patch(`/api/exam-mgmt/${periodId}/assignments/${assignmentId}`, {
      headers: auth(),
      data: {
        exam_status: 'absent',
        absence_reason: '병결 — 독감',
      },
    });
    expect(res.ok()).toBeTruthy();
    const body = (await res.json()).data;
    expect(body.adhoc_session_id ?? null).toBeNull();

    // 상태 확인
    const listRes = await request.get(`/api/exam-mgmt/by-month?month=${MONTH}&scope=all`, { headers: auth() });
    const row = (await listRes.json()).data.students.find((s: any) => s.student_id === studentId);
    expect(row.exam_status).toBe('absent');
    expect(row.absence_reason).toBe('병결 — 독감');
    console.log('✅ UC2: 결시 등록 + 사유 저장');
  });

  // ── UC3: 결시 현황 조회 ──
  test('UC3: absentees 엔드포인트 — 결시 학생 포함', async ({ request }) => {
    const res = await request.get(`/api/exam-mgmt/absentees?month=${MONTH}&scope=all`, { headers: auth() });
    expect(res.ok()).toBeTruthy();
    const body = (await res.json()).data;
    const row = body.absentees.find((a: any) => a.student_id === studentId);
    expect(row).toBeTruthy();
    expect(row.exam_status).toBe('absent');
    expect(row.absence_reason).toContain('독감');
    expect(row.adhoc_session_id).toBeNull();
    console.log(`✅ UC3: 결시 ${body.absentees.length}건 조회`);
  });

  // ── UC4: 재시험 배정 (adhoc 자동 생성) ──
  test('UC4: 재시험 배정 → adhoc_sessions 자동 생성', async ({ request }) => {
    const res = await request.patch(`/api/exam-mgmt/${periodId}/assignments/${assignmentId}`, {
      headers: auth(),
      data: {
        exam_status: 'rescheduled',
        rescheduled_date: '2099-12-20',
        rescheduled_start: '18:00',
        rescheduled_end: '20:00',
        rescheduled_memo: '토요일 저녁 재시험',
      },
    });
    expect(res.ok()).toBeTruthy();
    const body = (await res.json()).data;
    expect(body.adhoc_session_id).toBeTruthy();
    adhocId = body.adhoc_session_id;

    // absentees에서 시간 포함 확인
    const absRes = await request.get(`/api/exam-mgmt/absentees?month=${MONTH}&scope=all`, { headers: auth() });
    const row = (await absRes.json()).data.absentees.find((a: any) => a.student_id === studentId);
    expect(row.exam_status).toBe('rescheduled');
    expect(row.rescheduled_date).toBe('2099-12-20');
    expect(row.rescheduled_start).toBe('18:00');
    expect(row.rescheduled_end).toBe('20:00');
    expect(row.adhoc_status).toBe('scheduled');
    console.log(`✅ UC4: adhoc=${adhocId} 생성 확인`);
  });

  // ── UC5: 재시험 날짜 변경 (동일 adhoc 갱신) ──
  test('UC5: 재시험 날짜/시간 변경 — 동일 adhoc 갱신', async ({ request }) => {
    const prevAdhocId = adhocId;
    const res = await request.patch(`/api/exam-mgmt/${periodId}/assignments/${assignmentId}`, {
      headers: auth(),
      data: {
        exam_status: 'rescheduled',
        rescheduled_date: '2099-12-21',
        rescheduled_start: '19:00',
        rescheduled_end: '21:00',
      },
    });
    expect(res.ok()).toBeTruthy();

    const absRes = await request.get(`/api/exam-mgmt/absentees?month=${MONTH}&scope=all`, { headers: auth() });
    const row = (await absRes.json()).data.absentees.find((a: any) => a.student_id === studentId);
    expect(row.rescheduled_date).toBe('2099-12-21');
    expect(row.rescheduled_start).toBe('19:00');
    expect(row.adhoc_session_id).toBe(prevAdhocId); // 동일 adhoc 재사용
    console.log('✅ UC5: 날짜/시간 변경되어도 adhoc id 동일');
  });

  // ── UC6: 재시험 취소(absent로 되돌림) → adhoc cancelled ──
  test('UC6: absent로 되돌리면 adhoc cancelled', async ({ request }) => {
    const res = await request.patch(`/api/exam-mgmt/${periodId}/assignments/${assignmentId}`, {
      headers: auth(),
      data: { exam_status: 'absent' },
    });
    expect(res.ok()).toBeTruthy();

    // absentees에서 adhoc이 cancelled 또는 null 인지 확인
    const absRes = await request.get(`/api/exam-mgmt/absentees?month=${MONTH}&scope=all`, { headers: auth() });
    const row = (await absRes.json()).data.absentees.find((a: any) => a.student_id === studentId);
    expect(row.exam_status).toBe('absent');
    expect(row.adhoc_session_id).toBeNull();
    console.log('✅ UC6: 재시험 취소 후 adhoc 연결 끊김');
  });

  // ── UC7: 재시험 재설정 → 새 adhoc 생성 → 응시 완료 ──
  test('UC7: 재배정 + 응시 완료 처리', async ({ request }) => {
    // 재배정 (새 adhoc 생성)
    const re = await request.patch(`/api/exam-mgmt/${periodId}/assignments/${assignmentId}`, {
      headers: auth(),
      data: {
        exam_status: 'rescheduled',
        rescheduled_date: '2099-12-28',
        rescheduled_start: '14:00',
        rescheduled_end: '16:00',
      },
    });
    expect(re.ok()).toBeTruthy();
    const newAdhocId = (await re.json()).data.adhoc_session_id;
    expect(newAdhocId).toBeTruthy();
    adhocId = newAdhocId;

    // 응시 완료 + 점수
    const done = await request.patch(`/api/exam-mgmt/${periodId}/assignments/${assignmentId}`, {
      headers: auth(),
      data: { exam_status: 'completed', score: 88 },
    });
    expect(done.ok()).toBeTruthy();

    const byMonth = await request.get(`/api/exam-mgmt/by-month?month=${MONTH}&scope=all`, { headers: auth() });
    const row = (await byMonth.json()).data.students.find((s: any) => s.student_id === studentId);
    expect(row.exam_status).toBe('completed');
    expect(row.score).toBe(88);

    // absentees 목록에서 빠졌는지 (completed는 포함 X)
    const absRes = await request.get(`/api/exam-mgmt/absentees?month=${MONTH}&scope=all`, { headers: auth() });
    const stillAbsent = (await absRes.json()).data.absentees.find((a: any) => a.student_id === studentId);
    expect(stillAbsent).toBeUndefined();
    console.log('✅ UC7: 응시 완료 + 점수 저장 + absentees에서 제외');
  });

  // ── UC8: 검증 — rescheduled 조건 누락 시 adhoc 미생성 ──
  test('UC8: 시간 없이 rescheduled만 보내면 adhoc 생성 안 됨', async ({ request }) => {
    // 기존 assignment를 다시 absent로 되돌리고 시간 없이 rescheduled만 설정
    await request.patch(`/api/exam-mgmt/${periodId}/assignments/${assignmentId}`, {
      headers: auth(),
      data: { exam_status: 'absent' },
    });
    const res = await request.patch(`/api/exam-mgmt/${periodId}/assignments/${assignmentId}`, {
      headers: auth(),
      data: {
        exam_status: 'rescheduled',
        rescheduled_date: '2099-12-30',
        // 시간 없음
      },
    });
    expect(res.ok()).toBeTruthy();
    const body = (await res.json()).data;
    // 시간 미입력 → adhoc 미생성 (null 또는 undefined)
    expect(body.adhoc_session_id ?? null).toBeNull();
    console.log('✅ UC8: 시간 미입력 시 adhoc 생성 스킵');
  });

  // ── 정리 ──
  test('정리: 테스트 데이터 삭제', async ({ request }) => {
    // 배정 삭제
    if (assignmentId) {
      await request.delete(`/api/exam-mgmt/${periodId}/assignments/${assignmentId}`, { headers: auth() });
    }
    // adhoc 취소
    if (adhocId) {
      await request.delete(`/api/timer/adhoc/${adhocId}`, { headers: auth() });
    }
    // period 삭제
    if (periodId) {
      await request.delete(`/api/exam-mgmt/${periodId}`, { headers: auth() });
    }
    // 학생 삭제
    if (studentId) {
      await request.delete(`/api/student/${studentId}`, { headers: auth() });
    }
    console.log('✅ 정리 완료');
  });
});
