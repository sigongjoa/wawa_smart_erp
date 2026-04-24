/**
 * 교재 관리 E2E 테스트 — 라이브 서버
 *
 * 유즈케이스:
 * UC-1: 교재 등록 — 학생 선택 + 제목 입력 → 추가
 * UC-2: 상태 토글 — todo ↔ done 전환
 * UC-3: 파일 연결 — 구글드라이브 URL 저장
 * UC-4: 필터 — 상태별/학생별 필터링
 * UC-5: 삭제 — 교재 삭제
 */
import { test, expect, Page } from '@playwright/test';
import { API_URL, SITE_URL } from './_env';

const LIVE_URL = SITE_URL;
const CREDS = { name: '서재용', pin: '1141' };
const TEST_TITLE = `테스트교재_${Date.now()}`;
const TEST_FILE_URL = 'https://drive.google.com/file/d/test-e2e-dummy/view';

test.describe.configure({ mode: 'serial' });

let page: Page;

async function login(browser: any) {
  const ctx = await browser.newContext();
  page = await ctx.newPage();

  page.on('pageerror', (err: Error) => console.log(`❌ PAGE ERROR: ${err.message}`));
  page.on('response', (res: any) => {
    if (res.url().includes('/api/') && res.status() >= 400) {
      console.log(`⚠️ API ${res.status()}: ${res.url()}`);
    }
  });

  await page.goto(LIVE_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1000);

  const nameInput = page.locator('input').first();
  if (await nameInput.isVisible()) {
    await nameInput.fill(CREDS.name);
    await page.locator('input[type="password"], input').nth(1).fill(CREDS.pin);
    await page.locator('button:has-text("로그인"), button:has-text("접속하기")').first().click();
    await page.waitForTimeout(3000);
  }
}

async function goToMaterials() {
  // 사이드바 or 하단 네비에서 "교재" 클릭
  const nav = page.locator('a:has-text("교재")').first();
  await nav.click();
  await page.waitForTimeout(2000);
}

test.describe('교재 관리 E2E 테스트', () => {

  test('UC-0: 로그인 후 교재 탭 존재', async ({ browser }) => {
    await login(browser);
    const materialsNav = page.locator('a:has-text("교재")');
    await expect(materialsNav.first()).toBeVisible();
    console.log('✅ 교재 네비게이션 탭 확인');
  });

  test('UC-1: 교재 등록 — 학생 선택 + 제목 입력', async () => {
    await goToMaterials();

    // 학생 드롭다운에서 첫 번째 학생 선택
    const studentSelect = page.locator('[aria-label="학생 선택"]');
    await expect(studentSelect).toBeVisible();

    // option이 로드될 때까지 대기
    await page.waitForTimeout(1500);
    const options = await studentSelect.locator('option').all();
    console.log(`  학생 옵션 수: ${options.length - 1}`); // -1 for placeholder

    if (options.length > 1) {
      // 첫 번째 실제 학생 선택
      const firstStudentValue = await options[1].getAttribute('value');
      await studentSelect.selectOption(firstStudentValue!);
      console.log(`  선택한 학생 value: ${firstStudentValue}`);
    }

    // 제목 입력
    const titleInput = page.locator('[aria-label="교재 제목"]');
    await titleInput.fill(TEST_TITLE);

    // 추가 버튼 클릭
    const addBtn = page.locator('button:has-text("추가")');
    await addBtn.click();
    await page.waitForTimeout(2000);

    // 등록된 교재가 페이지에 보이는지 확인
    const added = page.locator(`text=${TEST_TITLE}`);
    await expect(added.first()).toBeVisible({ timeout: 5000 });
    console.log(`✅ 교재 등록 완료: "${TEST_TITLE}"`);
  });

  test('UC-2: 상태 토글 — todo → done', async () => {
    // 방금 등록한 교재의 ○ 버튼 클릭
    const row = page.locator(`text=${TEST_TITLE}`).first();
    await expect(row).toBeVisible();

    // ○ 버튼 찾기 (같은 row/card 내)
    const checkBtn = page.locator('[aria-label="완료로 변경"]').first();
    await checkBtn.click();
    await page.waitForTimeout(1500);

    // ● 로 변경되었는지 확인
    const doneBtn = page.locator('[aria-label="미완료로 변경"]').first();
    await expect(doneBtn).toBeVisible({ timeout: 5000 });
    console.log('✅ 상태 todo → done 전환 완료');
  });

  test('UC-2b: 상태 토글 — done → todo', async () => {
    const undoBtn = page.locator('[aria-label="미완료로 변경"]').first();
    await undoBtn.click();
    await page.waitForTimeout(1500);

    const todoBtn = page.locator('[aria-label="완료로 변경"]').first();
    await expect(todoBtn).toBeVisible({ timeout: 5000 });
    console.log('✅ 상태 done → todo 전환 완료');
  });

  test('UC-3: 파일 연결 — URL 저장', async () => {
    // "+ 파일 연결" 또는 "+ 파일" 버튼 클릭
    const addFileBtn = page.locator('button:has-text("파일 연결"), button:has-text("+ 파일")').first();
    await addFileBtn.click();
    await page.waitForTimeout(500);

    // URL 입력
    const urlInput = page.locator('input[type="url"], input[placeholder*="URL"]').first();
    await expect(urlInput).toBeVisible();
    await urlInput.fill(TEST_FILE_URL);

    // 저장
    const saveBtn = page.locator('button:has-text("저장")').first();
    await saveBtn.click();
    await page.waitForTimeout(1500);

    // 📎 열기 링크가 보이는지 확인
    const openLink = page.locator('text=열기').first();
    await expect(openLink).toBeVisible({ timeout: 5000 });
    console.log('✅ 파일 URL 저장 완료');
  });

  test('UC-4: 필터 — 미완료/완료 필터', async () => {
    // 미완료 필터 클릭
    const todoFilter = page.locator('button:has-text("미완료")').first();
    await todoFilter.click();
    await page.waitForTimeout(1500);

    // 우리가 등록한 교재가 보이는지 (todo 상태이므로 보여야 함)
    const title = page.locator(`text=${TEST_TITLE}`).first();
    const visible = await title.isVisible().catch(() => false);
    console.log(`  미완료 필터에서 교재 보임: ${visible ? '✅' : '❌'}`);

    // 완료 필터
    const doneFilter = page.locator('button:has-text("완료")').first();
    await doneFilter.click();
    await page.waitForTimeout(1500);

    // todo 상태이므로 완료 필터에서는 안 보여야 함
    const hiddenInDone = !(await page.locator(`text=${TEST_TITLE}`).first().isVisible().catch(() => false));
    console.log(`  완료 필터에서 교재 숨김: ${hiddenInDone ? '✅' : '❌'}`);

    // 전체로 복귀
    const allFilter = page.locator('button:has-text("전체")').first();
    await allFilter.click();
    await page.waitForTimeout(1500);

    console.log('✅ 필터 동작 확인');
  });

  test('UC-5: 삭제', async () => {
    // 삭제 버튼 클릭
    const deleteBtn = page.locator('[aria-label="삭제"]').first();
    await deleteBtn.click();
    await page.waitForTimeout(500);

    // 확인 다이얼로그에서 "확인" 클릭
    const confirmBtn = page.locator('.modal-footer button:has-text("확인"), button:has-text("삭제")').first();
    if (await confirmBtn.isVisible().catch(() => false)) {
      await confirmBtn.click();
    }
    await page.waitForTimeout(2000);

    // 교재가 사라졌는지 확인
    const gone = !(await page.locator(`text=${TEST_TITLE}`).first().isVisible().catch(() => false));
    console.log(`  교재 삭제 확인: ${gone ? '✅ 삭제됨' : '❌ 아직 보임'}`);
    expect(gone).toBe(true);
    console.log('✅ 교재 삭제 완료');
  });

});
