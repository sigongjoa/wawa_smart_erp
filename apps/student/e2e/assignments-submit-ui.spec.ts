/**
 * 학생앱 과제 제출 — 브라우저로 실제 업로드 + 제출까지 수행
 * 실행: STUDENT_URL=https://wawa-learn.pages.dev npx playwright test e2e/assignments-submit-ui.spec.ts
 */
import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

const API = process.env.API_URL || 'https://wawa-smart-erp-api.zeskywa499.workers.dev';
const SLUG = 'alpha';
const ACADEMY_NAME = '알파시티점';
const TEACHER = { name: '서재용', pin: '1141' };
const STUDENT_NAME = '강은서';
const STUDENT_PIN = '9999';

let teacherToken = '';
let studentId = '';
let assignmentId = '';
let tmpFile = '';

async function apiPost(p: string, body: any, token?: string) {
  const r = await fetch(`${API}${p}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, json: (j as any).data ?? j };
}
async function apiGet(p: string, token: string) {
  const r = await fetch(`${API}${p}`, { headers: { Authorization: `Bearer ${token}` } });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, json: (j as any).data ?? j };
}
async function apiDelete(p: string, token: string) {
  const r = await fetch(`${API}${p}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
  return r.status;
}

test.describe.serial('학생 과제 제출 UI 플로우', () => {

  test('셋업: 과제 생성 + 임시 이미지 파일 준비', async () => {
    const login = await apiPost('/api/auth/login', { slug: SLUG, name: TEACHER.name, pin: TEACHER.pin });
    teacherToken = login.json.accessToken;

    const list = await apiGet('/api/gacha/students?scope=all', teacherToken);
    studentId = (list.json as any[]).find((s: any) => s.name === STUDENT_NAME && s.status === 'active').id;
    await apiPost(`/api/gacha/students/${studentId}/reset-pin`, { pin: STUDENT_PIN }, teacherToken);

    const asn = await apiPost('/api/assignments', {
      title: `UI-SUBMIT 테스트 — ${new Date().toISOString()}`,
      instructions: '이 사진을 올려주세요.',
      kind: 'perf_eval',
      due_at: new Date(Date.now() + 3 * 86400_000).toISOString(),
      student_ids: [studentId],
    }, teacherToken);
    expect(asn.status).toBe(201);
    assignmentId = asn.json.id;

    tmpFile = path.join(os.tmpdir(), `ui-submit-${Date.now()}.png`);
    fs.writeFileSync(tmpFile, Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13]));
    console.log(`✅ 셋업 OK: 과제=${assignmentId}, 파일=${tmpFile}`);
  });

  test('UI: 로그인 → 과제 클릭 → 업로드 버튼 → 제출', async ({ page }) => {
    await loginAsStudent(page);
    await expect(page.locator('.home-page')).toBeVisible({ timeout: 15_000 });

    const card = page.getByText(/UI-SUBMIT 테스트/).first();
    await expect(card).toBeVisible({ timeout: 10_000 });
    await card.click();
    await page.waitForURL(/#\/assignments\/.+/);

    // 눈에 띄는 업로드 버튼(라벨) 확인
    const uploadBtn = page.getByText(/사진·PDF 파일 선택/);
    await expect(uploadBtn).toBeVisible();

    // 파일 업로드 (hidden input에 직접 setInputFiles)
    await page.setInputFiles('#assignment-file-input', tmpFile);

    // 업로드 완료 후 파일 목록에 나타남
    const fileLine = page.getByText(path.basename(tmpFile));
    await expect(fileLine).toBeVisible({ timeout: 15_000 });
    console.log('✅ 파일 업로드 → 목록 노출');

    // 메모 입력
    await page.fill('textarea', 'UI 테스트에서 올림');

    // 제출
    page.once('dialog', d => d.accept());
    await page.click('button:has-text("제출하기")');

    // 상태 뱃지가 "검토 대기 중"으로 바뀌었거나, 타임라인에 "내가 제출" 나옴
    await expect(page.getByText(/내가 제출/).first()).toBeVisible({ timeout: 15_000 });
    console.log('✅ 제출 완료 (타임라인에 "내가 제출" 렌더)');
  });

  test('API 검증: 서버에 제출 레코드 있음', async () => {
    const targets = await apiGet(`/api/assignments/${assignmentId}`, teacherToken);
    const t = (targets.json as any).targets.find((x: any) => x.student_id === studentId);
    expect(t.submission_count).toBeGreaterThanOrEqual(1);
    expect(['submitted', 'reviewed']).toContain(t.status);
    console.log(`✅ 서버 상태: status=${t.status}, submissions=${t.submission_count}`);
  });

  test('정리: 과제 닫기 + 임시파일 삭제', async () => {
    if (assignmentId) await apiDelete(`/api/assignments/${assignmentId}`, teacherToken);
    if (tmpFile && fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    console.log('✅ 정리 완료');
  });
});

async function loginAsStudent(page: Page) {
  await page.goto('/#/login');
  await page.click('.login-academy-select');
  await page.click(`.academy-item:has-text("${ACADEMY_NAME}")`);
  await page.fill('input[placeholder="이름"]', STUDENT_NAME);
  await page.fill('input[placeholder*="PIN"]', STUDENT_PIN);
  await page.click('.login-btn');
}
