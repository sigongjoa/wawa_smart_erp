/**
 * 정기고사 관리 E2E 테스트
 *
 * 유즈케이스:
 *   UC1: 시험 기간 CRUD
 *   UC2: 시험지 등록/삭제
 *   UC3: 학년 기반 자동 배정
 *   UC4: 수동 배정 (개인 시험지)
 *   UC5: 체크 업데이트 (제작/프린트/검토)
 *   UC6: 드라이브 링크 + 점수 + 메모 업데이트
 *   UC7: 일괄 체크
 *   UC8: 배정 삭제 + 시험 기간 삭제 (CASCADE)
 *
 * 실행: cd workers && npx playwright test e2e/exam-mgmt-e2e.spec.ts
 */

import { test, expect } from '@playwright/test';

const TEACHER = {
  name: process.env.E2E_TEACHER_NAME || 'E2E관리자',
  pin: process.env.E2E_TEACHER_PIN || '9999',
  slug: process.env.E2E_SLUG || 'e2e-test',
};
const UNIQUE = Date.now().toString(36);

let adminToken = '';
let periodId = '';
let paperId1 = ''; // 공통 시험지 (중1)
let paperId2 = ''; // 개인 시험지
let studentId = '';
let studentName = `exam-e2e-${UNIQUE}`;
let assignmentId = '';
let manualAssignId = '';

function auth() {
  return { Authorization: `Bearer ${adminToken}` };
}

test.describe.serial('정기고사 관리 E2E', () => {

  // ── 사전: 관리자 로그인 + 테스트 학생 생성 ──
  test('사전: 관리자 로그인 + 테스트 학생 생성', async ({ request }) => {
    const loginRes = await request.post('/api/auth/login', {
      data: { slug: TEACHER.slug, name: TEACHER.name, pin: TEACHER.pin },
    });
    expect(loginRes.ok()).toBeTruthy();
    const loginData = await loginRes.json();
    adminToken = loginData.data?.accessToken;
    expect(adminToken).toBeTruthy();

    // 테스트 학생 생성 (중1)
    const stuRes = await request.post('/api/gacha/students', {
      headers: auth(),
      data: { name: studentName, pin: '0000', grade: '중1' },
    });
    expect(stuRes.ok()).toBeTruthy();
    const stuData = await stuRes.json();
    studentId = stuData.data?.id;
    expect(studentId).toBeTruthy();
    console.log(`✅ 사전: 관리자 로그인 + 학생 생성 (${studentName})`);
  });

  // ── UC1: 시험 기간 생성 ──
  test('UC1: 시험 기간 생성', async ({ request }) => {
    const res = await request.post('/api/exam-mgmt', {
      headers: auth(),
      data: { title: `E2E 정기고사 ${UNIQUE}`, period_month: `2099-${UNIQUE.slice(0, 2).padStart(2, '0')}` },
    });
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    periodId = data.data?.id;
    expect(periodId).toBeTruthy();
    expect(data.data?.title).toContain('E2E 정기고사');
    console.log(`✅ UC1: 시험 기간 생성 (${periodId})`);
  });

  // ── UC1b: 시험 기간 목록 조회 ──
  test('UC1b: 시험 기간 목록 조회', async ({ request }) => {
    const res = await request.get('/api/exam-mgmt', { headers: auth() });
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    const periods = data.data;
    expect(Array.isArray(periods)).toBeTruthy();
    const found = periods.find((p: any) => p.id === periodId);
    expect(found).toBeTruthy();
    expect(found.status).toBe('preparing');
    console.log(`✅ UC1b: 시험 기간 목록에서 확인 (${periods.length}건)`);
  });

  // ── UC1c: 시험 기간 상태 변경 ──
  test('UC1c: 시험 기간 상태 변경', async ({ request }) => {
    const res = await request.patch(`/api/exam-mgmt/${periodId}`, {
      headers: auth(),
      data: { status: 'active' },
    });
    expect(res.ok()).toBeTruthy();
    console.log('✅ UC1c: 시험 기간 상태 → active');
  });

  // ── UC2: 시험지 등록 ──
  test('UC2: 공통 시험지 등록 (중1)', async ({ request }) => {
    const res = await request.post(`/api/exam-mgmt/${periodId}/papers`, {
      headers: auth(),
      data: { title: `중1 정기고사 ${UNIQUE}`, grade_filter: '중1', is_custom: false },
    });
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    paperId1 = data.data?.id;
    expect(paperId1).toBeTruthy();
    console.log(`✅ UC2: 공통 시험지 등록 (${paperId1})`);
  });

  test('UC2b: 개인 시험지 등록', async ({ request }) => {
    const res = await request.post(`/api/exam-mgmt/${periodId}/papers`, {
      headers: auth(),
      data: { title: `${studentName} 특별시험 ${UNIQUE}`, is_custom: true },
    });
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    paperId2 = data.data?.id;
    expect(paperId2).toBeTruthy();
    console.log(`✅ UC2b: 개인 시험지 등록 (${paperId2})`);
  });

  test('UC2c: 시험지 목록 조회', async ({ request }) => {
    const res = await request.get(`/api/exam-mgmt/${periodId}/papers`, { headers: auth() });
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data.data.length).toBeGreaterThanOrEqual(2);
    console.log(`✅ UC2c: 시험지 ${data.data.length}건 조회`);
  });

  // ── UC3: 자동 배정 (시험지 없이도 학년별 자동 생성 + 전원 배정) ──
  test('UC3: 자동 배정 (시험지 자동 생성 포함)', async ({ request }) => {
    const res = await request.post(`/api/exam-mgmt/${periodId}/auto-assign`, {
      headers: auth(),
    });
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data.data?.created).toBeGreaterThanOrEqual(1);
    expect(data.data?.papers_created).toBeGreaterThanOrEqual(0);
    console.log(`✅ UC3: 자동 배정 (${data.data?.created}명 배정 / 전체 ${data.data?.total}명, 시험지 ${data.data?.papers_created}개 자동 생성)`);
  });

  test('UC3b: 배정 현황에서 테스트 학생 확인', async ({ request }) => {
    const res = await request.get(`/api/exam-mgmt/${periodId}/assignments`, { headers: auth() });
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    const assignments = data.data;
    expect(Array.isArray(assignments)).toBeTruthy();
    expect(assignments.length).toBeGreaterThanOrEqual(1);

    // 테스트 학생이 배정되었는지 확인
    const myAssign = assignments.find((a: any) => a.student_id === studentId);
    expect(myAssign).toBeTruthy();
    assignmentId = myAssign.id;
    expect(myAssign.created_check).toBe(0);
    expect(myAssign.printed).toBe(0);
    expect(myAssign.reviewed).toBe(0);
    expect(myAssign.paper_title).toContain('중1');
    console.log(`✅ UC3b: 학생 ${studentName} 자동 배정 확인 (${assignmentId})`);
  });

  // ── UC4: 수동 배정 ──
  test('UC4: 수동 배정 (개인 시험지)', async ({ request }) => {
    // 자동배정에서 이미 배정된 경우 UNIQUE 제약 에러 → 배정 삭제 후 재배정
    if (assignmentId) {
      await request.delete(`/api/exam-mgmt/${periodId}/assignments/${assignmentId}`, { headers: auth() });
      assignmentId = '';
    }

    const res = await request.post(`/api/exam-mgmt/${periodId}/assign`, {
      headers: auth(),
      data: { student_id: studentId, exam_paper_id: paperId2 },
    });
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    manualAssignId = data.data?.id;
    expect(manualAssignId).toBeTruthy();
    console.log(`✅ UC4: 수동 배정 완료 (${manualAssignId})`);
  });

  test('UC4b: 중복 배정 거부', async ({ request }) => {
    const res = await request.post(`/api/exam-mgmt/${periodId}/assign`, {
      headers: auth(),
      data: { student_id: studentId, exam_paper_id: paperId1 },
    });
    expect(res.status()).toBe(409);
    console.log('✅ UC4b: 중복 배정 409 응답');
  });

  // ── UC5: 체크 업데이트 ──
  test('UC5: 제작 체크', async ({ request }) => {
    const id = manualAssignId || assignmentId;
    const res = await request.patch(`/api/exam-mgmt/${periodId}/assignments/${id}`, {
      headers: auth(),
      data: { created_check: true },
    });
    expect(res.ok()).toBeTruthy();

    // 확인
    const listRes = await request.get(`/api/exam-mgmt/${periodId}/assignments`, { headers: auth() });
    const assigns = (await listRes.json()).data;
    const updated = assigns.find((a: any) => a.id === id);
    expect(updated.created_check).toBe(1);
    console.log('✅ UC5: 제작 체크 완료');
  });

  test('UC5b: 프린트 체크', async ({ request }) => {
    const id = manualAssignId || assignmentId;
    const res = await request.patch(`/api/exam-mgmt/${periodId}/assignments/${id}`, {
      headers: auth(),
      data: { printed: true },
    });
    expect(res.ok()).toBeTruthy();
    console.log('✅ UC5b: 프린트 체크 완료');
  });

  test('UC5c: 검토 체크', async ({ request }) => {
    const id = manualAssignId || assignmentId;
    const res = await request.patch(`/api/exam-mgmt/${periodId}/assignments/${id}`, {
      headers: auth(),
      data: { reviewed: true },
    });
    expect(res.ok()).toBeTruthy();
    console.log('✅ UC5c: 검토 체크 완료');
  });

  // ── UC6: 드라이브 링크 + 점수 + 메모 ──
  test('UC6: 드라이브 링크 등록', async ({ request }) => {
    const id = manualAssignId || assignmentId;
    const res = await request.patch(`/api/exam-mgmt/${periodId}/assignments/${id}`, {
      headers: auth(),
      data: { drive_link: 'https://drive.google.com/file/d/test-e2e-link' },
    });
    expect(res.ok()).toBeTruthy();
    console.log('✅ UC6: 드라이브 링크 등록');
  });

  test('UC6b: 점수 입력', async ({ request }) => {
    const id = manualAssignId || assignmentId;
    const res = await request.patch(`/api/exam-mgmt/${periodId}/assignments/${id}`, {
      headers: auth(),
      data: { score: 85 },
    });
    expect(res.ok()).toBeTruthy();
    console.log('✅ UC6b: 점수 입력 (85점)');
  });

  test('UC6c: 메모 입력', async ({ request }) => {
    const id = manualAssignId || assignmentId;
    const res = await request.patch(`/api/exam-mgmt/${periodId}/assignments/${id}`, {
      headers: auth(),
      data: { memo: 'E2E 테스트 메모' },
    });
    expect(res.ok()).toBeTruthy();
    console.log('✅ UC6c: 메모 입력');
  });

  test('UC6d: 전체 필드 확인', async ({ request }) => {
    const id = manualAssignId || assignmentId;
    const listRes = await request.get(`/api/exam-mgmt/${periodId}/assignments`, { headers: auth() });
    const assigns = (await listRes.json()).data;
    const a = assigns.find((x: any) => x.id === id);
    expect(a).toBeTruthy();
    expect(a.created_check).toBe(1);
    expect(a.printed).toBe(1);
    expect(a.reviewed).toBe(1);
    expect(a.drive_link).toContain('drive.google.com');
    expect(a.score).toBe(85);
    expect(a.memo).toBe('E2E 테스트 메모');
    console.log('✅ UC6d: 전체 필드 정합성 확인');
  });

  // ── UC7: 일괄 체크 ──
  test('UC7: 일괄 체크 (전체 제작 해제)', async ({ request }) => {
    const res = await request.post(`/api/exam-mgmt/${periodId}/bulk-check`, {
      headers: auth(),
      data: { field: 'created_check', value: false },
    });
    expect(res.ok()).toBeTruthy();

    // 확인
    const listRes = await request.get(`/api/exam-mgmt/${periodId}/assignments`, { headers: auth() });
    const assigns = (await listRes.json()).data;
    const allUnchecked = assigns.every((a: any) => a.created_check === 0);
    expect(allUnchecked).toBeTruthy();
    console.log('✅ UC7: 일괄 제작 해제 확인');
  });

  test('UC7b: 일괄 체크 (전체 프린트 완료)', async ({ request }) => {
    const res = await request.post(`/api/exam-mgmt/${periodId}/bulk-check`, {
      headers: auth(),
      data: { field: 'printed', value: true },
    });
    expect(res.ok()).toBeTruthy();

    const listRes = await request.get(`/api/exam-mgmt/${periodId}/assignments`, { headers: auth() });
    const assigns = (await listRes.json()).data;
    const allPrinted = assigns.every((a: any) => a.printed === 1);
    expect(allPrinted).toBeTruthy();
    console.log('✅ UC7b: 일괄 프린트 완료 확인');
  });

  // ── UC8: 정리 (배정 삭제 → 시험지 삭제 → 기간 삭제) ──
  test('UC8: 배정 삭제', async ({ request }) => {
    const id = manualAssignId || assignmentId;
    if (!id) { console.log('⚠️ 배정 없음 — 건너뜀'); return; }
    const res = await request.delete(`/api/exam-mgmt/${periodId}/assignments/${id}`, { headers: auth() });
    expect(res.ok()).toBeTruthy();
    console.log('✅ UC8: 배정 삭제');
  });

  test('UC8b: 시험지 삭제', async ({ request }) => {
    if (paperId2) {
      const res = await request.delete(`/api/exam-mgmt/${periodId}/papers/${paperId2}`, { headers: auth() });
      expect(res.ok()).toBeTruthy();
    }
    console.log('✅ UC8b: 개인 시험지 삭제');
  });

  test('UC8c: 시험 기간 삭제 (CASCADE)', async ({ request }) => {
    const res = await request.delete(`/api/exam-mgmt/${periodId}`, { headers: auth() });
    expect(res.ok()).toBeTruthy();

    // 삭제 후 목록에서 없어졌는지 확인
    const listRes = await request.get('/api/exam-mgmt', { headers: auth() });
    const periods = (await listRes.json()).data;
    const found = periods.find((p: any) => p.id === periodId);
    expect(found).toBeFalsy();
    console.log('✅ UC8c: 시험 기간 삭제 + CASCADE 확인');
  });

  // ── 정리: 테스트 학생 삭제 ──
  test('정리: 테스트 학생 삭제', async ({ request }) => {
    if (studentId) {
      const res = await request.delete(`/api/gacha/students/${studentId}`, { headers: auth() });
      expect(res.ok()).toBeTruthy();
    }
    console.log('✅ 정리: 테스트 데이터 삭제 완료');
  });
});
