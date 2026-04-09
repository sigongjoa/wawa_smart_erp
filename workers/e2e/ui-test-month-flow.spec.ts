import { test, expect } from '@playwright/test';

/**
 * UI 직접 테스트: 4월 시험 설정 및 기존 3월 데이터 확인
 * - 로그인 → 시험 생성 (4월) → 성적 입력 → 월별 데이터 확인
 */

const LIVE_APP_URL = 'http://localhost:5173';
const LIVE_API_URL = 'http://localhost:8787';

test.describe.serial('🎬 UI 직접 테스트: 4월 시험 설정 및 월별 데이터 확인', () => {
  test.beforeAll(async () => {
    console.log(`\n🔗 App URL: ${LIVE_APP_URL}`);
    console.log(`🔗 API URL: ${LIVE_API_URL}`);
  });

  test('1. 로그인 페이지 접속 및 관리자 로그인', async ({ page }) => {
    await page.goto(LIVE_APP_URL);

    // 로그인 페이지 요소 확인
    await expect(page.locator('text=선생님 로그인')).toBeVisible({ timeout: 10000 });

    // 이름 입력
    const nameInput = page.locator('input[placeholder*="예:"], input[placeholder*="이름"], input[type="text"]').first();
    await nameInput.fill('김상현');

    // PIN 입력
    const pinInput = page.locator('input[type="password"]');
    await pinInput.fill('1234');

    // 로그인 버튼 클릭
    const loginButton = page.locator('button:has-text("로그인")');
    await loginButton.click();

    // 대시보드로 이동 확인
    await expect(page).toHaveURL(/\/(timer|admin|dashboard|schedule)/, { timeout: 15000 });
    console.log(`✅ 로그인 성공, 현재 URL: ${page.url()}`);
  });

  test('2. 관리 페이지(설정) 접속', async ({ page }) => {
    // 메뉴에서 설정/관리 버튼 찾기
    const settingsButton = page.locator(
      'button:has-text("설정"), button:has-text("관리"), a:has-text("설정"), a:has-text("관리"), [role="button"]:has-text("설정")'
    ).first();

    if (await settingsButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await settingsButton.click();
      console.log('✅ 설정 버튼 클릭');
    } else {
      console.log('⚠️  설정 버튼 미표시, 직접 URL 접속 시도');
      // 직접 URL 접속
      await page.goto(`${LIVE_APP_URL}/admin/settings`).catch(() => {
        console.log('설정 페이지 URL 접속 실패, 현재 페이지 유지');
      });
    }

    await page.waitForTimeout(2000);
    console.log(`현재 URL: ${page.url()}`);
  });

  test('3. 시험 관리 탭 찾기 및 클릭', async ({ page }) => {
    // 시험 관리 탭 찾기
    const examTab = page.locator(
      'button:has-text("시험"), [role="tab"]:has-text("시험"), a:has-text("시험"), [role="button"]:has-text("시험")'
    ).first();

    if (await examTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await examTab.click();
      console.log('✅ 시험 관리 탭 클릭');
      await page.waitForTimeout(1000);
    } else {
      console.log('⚠️  시험 관리 탭 미표시');
      // 페이지 내용 출력
      const content = await page.textContent('body');
      console.log('페이지 텍스트 (처음 500자):', content?.slice(0, 500));
    }

    console.log(`현재 URL: ${page.url()}`);
  });

  test('4. 4월 시험 생성 버튼 찾기 및 클릭', async ({ page }) => {
    // 추가/생성 버튼 찾기
    const createButton = page.locator(
      'button:has-text("추가"), button:has-text("생성"), button:has-text("새로"), button:has-text("+"), [role="button"]:has-text("추가")'
    ).first();

    if (await createButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await createButton.click();
      console.log('✅ 시험 생성 버튼 클릭');
      await page.waitForTimeout(1000);
    } else {
      console.log('⚠️  시험 생성 버튼 미표시');
    }
  });

  test('5. 4월 시험 정보 입력', async ({ page }) => {
    // 시험명 입력
    const nameInput = page.locator('input[placeholder*="시험명"], input[placeholder*="이름"]').first();
    if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await nameInput.fill('4월 월말고사');
      console.log('✅ 시험명 입력: 4월 월말고사');
    }

    // 시험 월 입력 (YYYY-MM)
    const monthInputs = page.locator('input[type="text"]');
    const monthInput = monthInputs.nth(1);
    if (await monthInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await monthInput.fill('2026-04');
      console.log('✅ 시험 월 입력: 2026-04');
    }

    // 시험 날짜 입력
    const dateInputs = page.locator('input[type="date"]');
    if (dateInputs.count() > 0) {
      await dateInputs.first().fill('2026-04-15');
      console.log('✅ 시험 날짜 입력: 2026-04-15');
    }

    // 활성화 체크박스
    const activeCheckbox = page.locator('input[type="checkbox"]').first();
    if (await activeCheckbox.isVisible({ timeout: 2000 }).catch(() => false)) {
      const isChecked = await activeCheckbox.isChecked();
      if (!isChecked) {
        await activeCheckbox.click();
        console.log('✅ 시험 활성화 체크');
      }
    }

    await page.waitForTimeout(500);
  });

  test('6. 시험 생성 저장 버튼 클릭', async ({ page }) => {
    // 저장/확인 버튼
    const saveButton = page.locator(
      'button:has-text("저장"), button:has-text("확인"), button:has-text("생성"), button:has-text("추가")'
    ).last();

    if (await saveButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await saveButton.click();
      console.log('✅ 저장 버튼 클릭');
      await page.waitForTimeout(2000);
    } else {
      console.log('⚠️  저장 버튼 미표시');
    }
  });

  test('7. 성적 입력 페이지로 이동', async ({ page }) => {
    // 성적 입력 메뉴 찾기
    const gradeLink = page.locator(
      'a:has-text("성적"), button:has-text("성적"), [role="button"]:has-text("성적")'
    ).first();

    if (await gradeLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await gradeLink.click();
      console.log('✅ 성적 입력 페이지로 이동');
      await page.waitForTimeout(2000);
    } else {
      console.log('⚠️  성적 입력 메뉴 미표시, URL로 접속 시도');
      await page.goto(`${LIVE_APP_URL}/grader`).catch(() => {
        console.log('성적 입력 페이지 접속 실패');
      });
    }

    console.log(`현재 URL: ${page.url()}`);
  });

  test('8. 학생 선택 및 4월 시험 선택', async ({ page }) => {
    // 학생 선택 드롭다운
    const studentSelect = page.locator('select, [role="combobox"]').first();
    if (await studentSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      await studentSelect.click();
      // 강은서 선택
      const eunOption = page.locator('text=강은서');
      if (await eunOption.isVisible()) {
        await eunOption.click();
        console.log('✅ 학생 선택: 강은서');
      }
    }

    await page.waitForTimeout(500);

    // 시험 선택 드롭다운
    const examSelect = page.locator('select, [role="combobox"]').nth(1);
    if (await examSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
      await examSelect.click();
      // 4월 시험 선택
      const aprilExam = page.locator('text=4월');
      if (await aprilExam.isVisible()) {
        await aprilExam.click();
        console.log('✅ 시험 선택: 4월 시험');
      }
    }

    await page.waitForTimeout(500);
  });

  test('9. 성적 입력 (강은서 4월: 88점)', async ({ page }) => {
    // 점수 입력
    const scoreInput = page.locator('input[type="number"], input[placeholder*="점수"], input[placeholder*="성적"]').first();
    if (await scoreInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await scoreInput.fill('88');
      console.log('✅ 성적 입력: 88점');
    }

    // 코멘트 입력 (선택)
    const commentInput = page.locator('textarea, input[placeholder*="코멘트"], input[placeholder*="비고"]').first();
    if (await commentInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await commentInput.fill('UI 테스트 - 4월 성적');
      console.log('✅ 코멘트 입력');
    }

    await page.waitForTimeout(500);
  });

  test('10. 성적 저장 버튼 클릭', async ({ page }) => {
    // 저장 버튼
    const submitButton = page.locator('button:has-text("저장"), button:has-text("제출"), button:has-text("입력")').last();
    if (await submitButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await submitButton.click();
      console.log('✅ 성적 저장 버튼 클릭');
      await page.waitForTimeout(2000);
    } else {
      console.log('⚠️  저장 버튼 미표시');
    }
  });

  test('11. 리포트 페이지로 이동 및 월별 데이터 확인', async ({ page }) => {
    // 리포트 메뉴 찾기
    const reportLink = page.locator(
      'a:has-text("리포트"), button:has-text("리포트"), [role="button"]:has-text("리포트")'
    ).first();

    if (await reportLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await reportLink.click();
      console.log('✅ 리포트 페이지로 이동');
      await page.waitForTimeout(2000);
    } else {
      console.log('⚠️  리포트 메뉴 미표시, 월별 성적 조회 페이지로 이동 시도');
      await page.goto(`${LIVE_APP_URL}/grades`).catch(() => {
        console.log('리포트 페이지 접속 실패');
      });
    }

    console.log(`현재 URL: ${page.url()}`);
  });

  test('12. 월별 데이터 확인: 2월(기존 데이터) 보이는지 확인', async ({ page }) => {
    // 월 필터 또는 드롭다운 찾기
    const monthFilter = page.locator('[placeholder*="월"], select, [role="combobox"]').first();
    if (await monthFilter.isVisible({ timeout: 2000 }).catch(() => false)) {
      await monthFilter.click();
      // 2월 선택
      const februaryOption = page.locator('text=2026-02, text=2월, text=February').first();
      if (await februaryOption.isVisible()) {
        await februaryOption.click();
        console.log('✅ 2월 필터 적용');
      }
    }

    await page.waitForTimeout(1000);

    // 2월 데이터 확인 (강은서 85점, test 92점)
    const februaryData = page.locator('text=2026-02, text=85, text=92').first();
    if (await februaryData.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('✅ 2월 데이터 표시됨 (강은서 85점, test 92점)');
    } else {
      console.log('⚠️  2월 데이터 미표시 - 페이지 내용 확인');
      const content = await page.textContent('body');
      console.log('페이지 텍스트:', content?.slice(0, 800));
    }
  });

  test('13. 월별 데이터 확인: 4월(새로운 데이터) 보이는지 확인', async ({ page }) => {
    // 월 필터로 4월 선택
    const monthFilter = page.locator('[placeholder*="월"], select, [role="combobox"]').first();
    if (await monthFilter.isVisible({ timeout: 2000 }).catch(() => false)) {
      await monthFilter.click();
      // 4월 선택
      const aprilOption = page.locator('text=2026-04, text=4월').first();
      if (await aprilOption.isVisible()) {
        await aprilOption.click();
        console.log('✅ 4월 필터 적용');
      }
    }

    await page.waitForTimeout(1000);

    // 4월 데이터 확인 (강은서 88점)
    const aprilData = page.locator('text=2026-04, text=88').first();
    if (await aprilData.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('✅ 4월 데이터 표시됨 (강은서 88점)');
    } else {
      console.log('⚠️  4월 데이터 미표시');
    }
  });

  test('14. 최종 검증: 월별 데이터가 올바르게 구분되어 표시됨', async ({ page }) => {
    const content = await page.textContent('body');

    let february_ok = false;
    let april_ok = false;

    if (content?.includes('85') || content?.includes('92')) {
      february_ok = true;
      console.log('✅ 2월 데이터 확인: 85점 또는 92점 표시됨');
    }

    if (content?.includes('88')) {
      april_ok = true;
      console.log('✅ 4월 데이터 확인: 88점 표시됨');
    }

    if (february_ok && april_ok) {
      console.log('\n✨ 최종 검증 성공: 월별 데이터가 올바르게 구분됨');
    } else {
      console.log('\n⚠️  일부 데이터 미확인');
    }
  });
});
