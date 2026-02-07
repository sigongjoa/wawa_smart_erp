import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// Load config
const configPath = path.join(__dirname, 'test-config.json');
const NOTION_CONFIG = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

// 스크린샷 저장 경로
const SCREENSHOT_DIR = path.join(__dirname, '../e2e-screenshots-makeup-dm');
let screenshotCounter = 0;

async function takeScreenshot(page: Page, name: string) {
  screenshotCounter++;
  const filename = `${String(screenshotCounter).padStart(2, '0')}_${name}.png`;
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, filename),
    fullPage: true,
  });
  console.log(`📸 Screenshot: ${filename}`);
  return filename;
}

async function setupAndLogin(page: Page) {
  await page.goto('/');
  await page.waitForTimeout(1500);

  // ---- Step 1: Setup 페이지 처리 (wawa_config.json 파일 업로드) ----
  const setupTitle = page.locator('text=시스템 초기 설정');
  const isSetupPage = await setupTitle.isVisible({ timeout: 3000 }).catch(() => false);

  if (isSetupPage) {
    console.log('  📋 Setup 페이지 감지 - config 파일 업로드 중...');

    // wawa_config.json 임시 파일 생성 (test-config.json의 내용 사용)
    const configForUpload = {
      notionApiKey: NOTION_CONFIG.notionApiKey,
      notionTeachersDb: NOTION_CONFIG.notionTeachersDb,
      notionStudentsDb: NOTION_CONFIG.notionStudentsDb,
      notionScoresDb: NOTION_CONFIG.notionScoresDb,
      notionExamScheduleDb: NOTION_CONFIG.notionExamScheduleDb,
      notionEnrollmentDb: NOTION_CONFIG.notionEnrollmentDb,
      notionMakeupDb: NOTION_CONFIG.notionMakeupDb,
      notionDmMessagesDb: NOTION_CONFIG.notionDmMessagesDb,
    };
    const tempConfigPath = path.join(__dirname, '_temp_wawa_config.json');
    fs.writeFileSync(tempConfigPath, JSON.stringify(configForUpload, null, 2));

    // 파일 업로드 (hidden file input에 직접 파일 설정)
    const fileInput = page.locator('input[type="file"][accept=".json"]');
    await fileInput.setInputFiles(tempConfigPath);

    // Notion 연결 검증 대기 (spinner가 뜨고 사라질 때까지)
    console.log('  ⏳ Notion API 연결 검증 중...');
    await page.waitForTimeout(2000);

    // "Notion 데이터 연동 중..." 스피너가 보이면 사라질 때까지 대기
    const spinner = page.locator('text=Notion 데이터 연동 중');
    const hasSpinner = await spinner.isVisible({ timeout: 2000 }).catch(() => false);
    if (hasSpinner) {
      await spinner.waitFor({ state: 'hidden', timeout: 60000 });
    }

    // 임시 파일 정리
    if (fs.existsSync(tempConfigPath)) {
      fs.unlinkSync(tempConfigPath);
    }

    console.log('  ✅ 설정 파일 업로드 완료');
    await page.waitForTimeout(2000);
  }

  // ---- Step 2: Login 페이지 처리 (실제 선생님 선택 + PIN 입력) ----
  const loginTitle = page.locator('text=WAWA ERP 로그인');
  const isLoginPage = await loginTitle.isVisible({ timeout: 5000 }).catch(() => false);

  if (isLoginPage) {
    console.log('  🔑 로그인 페이지 감지 - 선생님 목록 로딩 대기...');

    // 선생님 목록이 Notion에서 로딩될 때까지 대기
    const teacherSelect = page.locator('select.search-input').first();
    await teacherSelect.waitFor({ state: 'visible', timeout: 15000 });

    // 선생님 옵션이 로딩될 때까지 폴링 (Notion API 호출 대기)
    let optionCount = 0;
    for (let i = 0; i < 20; i++) {
      await page.waitForTimeout(1000);
      const options = teacherSelect.locator('option');
      optionCount = await options.count();
      if (optionCount > 1) break; // 기본 placeholder 외에 옵션이 있으면
    }
    console.log(`  👨‍🏫 선생님 ${optionCount - 1}명 로딩됨`);

    // 테스트 선생님 선택 (test-config.json에 지정된 이름으로)
    const targetName = NOTION_CONFIG.testTeacherName || '';
    if (targetName) {
      const targetOption = teacherSelect.locator(`option:has-text("${targetName}")`);
      const hasTarget = await targetOption.count();
      if (hasTarget > 0) {
        const targetValue = await targetOption.first().getAttribute('value');
        if (targetValue) {
          await teacherSelect.selectOption(targetValue);
          console.log(`  ✅ 선생님 선택: ${targetName}`);
        }
      } else {
        // 지정된 선생님이 없으면 첫 번째 선생님 선택
        const firstOption = teacherSelect.locator('option').nth(1);
        const firstValue = await firstOption.getAttribute('value');
        if (firstValue) await teacherSelect.selectOption(firstValue);
        console.log('  ⚠️ 지정된 선생님 없음 - 첫 번째 선생님 선택');
      }
    } else {
      // 첫 번째 선생님 선택
      const firstOption = teacherSelect.locator('option').nth(1);
      const firstValue = await firstOption.getAttribute('value');
      if (firstValue) await teacherSelect.selectOption(firstValue);
    }

    // PIN 입력
    const pinInput = page.locator('input[type="password"]');
    const testPin = NOTION_CONFIG.testTeacherPin || '0000';
    await pinInput.fill(testPin);

    // 접속하기 버튼 클릭
    const loginBtn = page.locator('button:has-text("접속하기")');
    await loginBtn.click();
    console.log('  🔐 로그인 시도...');

    await page.waitForTimeout(3000);
  }

  // 정상적으로 로그인된 상태인지 확인 (Header nav가 보여야 함)
  const headerNav = page.locator('.header-nav');
  await expect(headerNav).toBeVisible({ timeout: 15000 });
  console.log('  ✅ 로그인 성공 - 메인 화면 진입');
}

test('보강관리 & DM 모듈 - E2E 테스트', async ({ page }) => {
  test.setTimeout(300000); // 5분

  // 스크린샷 디렉토리 초기화
  if (fs.existsSync(SCREENSHOT_DIR)) {
    const files = fs.readdirSync(SCREENSHOT_DIR);
    for (const file of files) {
      if (file.endsWith('.png')) fs.unlinkSync(path.join(SCREENSHOT_DIR, file));
    }
  }
  screenshotCounter = 0;

  // ============================
  // 1. 로그인
  // ============================
  await setupAndLogin(page);
  await takeScreenshot(page, '로그인_완료');

  // ============================
  // 2. 보강관리 - 대시보드
  // ============================
  console.log('\n📋 보강관리 모듈 테스트 시작...');

  // 헤더에서 보강관리 탭 클릭
  const makeupTab = page.locator('a:has-text("보강관리"), nav a[href*="makeup"]');
  await makeupTab.click();
  await page.waitForTimeout(2000);
  await takeScreenshot(page, '보강관리_대시보드');

  // 대시보드 요소 확인
  const dashboardTitle = page.locator('h1.page-title:has-text("보강관리 대시보드")');
  await expect(dashboardTitle).toBeVisible({ timeout: 5000 });

  // 통계 카드 확인
  const statsCards = page.locator('.card');
  const cardCount = await statsCards.count();
  console.log(`  ✅ 대시보드 카드: ${cardCount}개`);

  // ============================
  // 3. 보강관리 - 대기 중 페이지
  // ============================
  const pendingMenu = page.locator('a:has-text("대기 중")').first();
  await pendingMenu.click();
  await page.waitForTimeout(1500);
  await takeScreenshot(page, '보강관리_대기중');

  // 페이지 타이틀 확인
  const pendingTitle = page.locator('h1.page-title:has-text("대기 중인 보강")');
  await expect(pendingTitle).toBeVisible({ timeout: 5000 });

  // 결석 기록 추가 버튼 확인
  const addBtn = page.locator('button:has-text("결석 기록 추가")');
  await expect(addBtn).toBeVisible();

  // ============================
  // 4. 결석 기록 추가 모달
  // ============================
  await addBtn.click();
  await page.waitForTimeout(500);
  await takeScreenshot(page, '결석기록_추가_모달');

  // 모달 타이틀 확인
  const modalTitle = page.locator('.modal-header h3, h2:has-text("결석 기록 추가")').first();
  await expect(modalTitle).toBeVisible({ timeout: 3000 });

  // 필수 필드 확인
  const studentSelect = page.locator('select').first();
  await expect(studentSelect).toBeVisible();

  // 모달 닫기
  const closeBtn = page.locator('.modal-close, .modal-overlay button:has-text("취소")').first();
  await closeBtn.click();
  await page.waitForTimeout(500);

  // ============================
  // 5. 보강관리 - 완료 페이지
  // ============================
  const completedMenu = page.locator('a:has-text("완료")').first();
  await completedMenu.click();
  await page.waitForTimeout(1500);
  await takeScreenshot(page, '보강관리_완료');

  const completedTitle = page.locator('h1.page-title:has-text("완료된 보강")');
  await expect(completedTitle).toBeVisible({ timeout: 5000 });

  // ============================
  // 6. 보강관리 - 설정 페이지
  // ============================
  const settingsMenu = page.locator('.sidebar-nav a:has-text("설정")');
  await settingsMenu.click();
  await page.waitForTimeout(1000);
  await takeScreenshot(page, '보강관리_설정');

  const settingsTitle = page.locator('h1.page-title:has-text("보강관리 설정")');
  await expect(settingsTitle).toBeVisible({ timeout: 5000 });

  // ============================
  // 7. 검색 기능 테스트
  // ============================
  console.log('\n🔍 검색 기능 테스트...');
  await pendingMenu.click();
  await page.waitForTimeout(1500);

  const searchInput = page.locator('input[placeholder*="검색"]');
  if (await searchInput.isVisible().catch(() => false)) {
    await searchInput.fill('존재하지않는학생');
    await page.waitForTimeout(500);
    await takeScreenshot(page, '보강관리_검색_빈결과');

    // 빈 결과 메시지 확인
    const emptyMsg = page.locator('text=대기 중인 보강이 없습니다');
    await expect(emptyMsg).toBeVisible({ timeout: 3000 });
    console.log('  ✅ 검색 빈 결과 처리 확인');

    // 검색어 지우기
    await searchInput.clear();
    await page.waitForTimeout(500);
  }

  // ============================
  // 8. DM 위젯 테스트
  // ============================
  console.log('\n💬 DM 위젯 테스트 시작...');

  // 플로팅 버튼 확인
  const dmFloatingBtn = page.locator('.dm-floating-btn');
  await expect(dmFloatingBtn).toBeVisible({ timeout: 5000 });
  await takeScreenshot(page, 'DM_플로팅버튼');
  console.log('  ✅ DM 플로팅 버튼 표시됨');

  // 위젯 열기
  await dmFloatingBtn.click();
  await page.waitForTimeout(1000);
  await takeScreenshot(page, 'DM_위젯_연락처목록');

  // 위젯 헤더 확인
  const dmTitle = page.locator('.dm-widget-title');
  await expect(dmTitle).toBeVisible({ timeout: 3000 });
  console.log('  ✅ DM 위젯 열림');

  // 연락처 목록 확인
  const contacts = page.locator('.dm-contact-item');
  const contactCount = await contacts.count();
  console.log(`  ✅ DM 연락처: ${contactCount}명`);

  // 연락처 클릭 (첫 번째 선생님)
  if (contactCount > 0) {
    await contacts.first().click();
    await page.waitForTimeout(2000);
    await takeScreenshot(page, 'DM_채팅창');

    // 채팅 입력창 확인
    const chatInput = page.locator('.dm-input');
    await expect(chatInput).toBeVisible({ timeout: 3000 });
    console.log('  ✅ DM 채팅창 열림');

    // 메시지 입력 테스트
    await chatInput.fill('E2E 테스트 메시지입니다 ' + new Date().toLocaleString('ko-KR'));
    await takeScreenshot(page, 'DM_메시지_입력');

    // 전송 버튼 확인
    const sendBtn = page.locator('.dm-send-btn');
    await expect(sendBtn).toBeVisible();
    await expect(sendBtn).toBeEnabled();

    // 메시지 전송
    await sendBtn.click();
    await page.waitForTimeout(2000);
    await takeScreenshot(page, 'DM_메시지_전송완료');

    // 전송된 메시지 확인
    const sentMessages = page.locator('.dm-message.sent');
    const sentCount = await sentMessages.count();
    console.log(`  ✅ 전송된 메시지: ${sentCount}개`);

    // 뒤로가기
    const backBtn = page.locator('.dm-header-btn:has(span:has-text("arrow_back"))');
    if (await backBtn.isVisible().catch(() => false)) {
      await backBtn.click();
      await page.waitForTimeout(500);
      await takeScreenshot(page, 'DM_뒤로가기');
    }
  }

  // 위젯 닫기
  const closeWidget = page.locator('.dm-floating-btn');
  await closeWidget.click();
  await page.waitForTimeout(500);
  await takeScreenshot(page, 'DM_위젯_닫힘');

  // DM 위젯이 닫혔는지 확인
  const widgetHidden = await page.locator('.dm-widget').isVisible().catch(() => false);
  expect(widgetHidden).toBe(false);
  console.log('  ✅ DM 위젯 닫힘 확인');

  // ============================
  // 9. 다른 모듈에서도 DM 위젯 접근 확인
  // ============================
  console.log('\n🔄 다른 모듈에서 DM 접근 테스트...');

  // 시간표 모듈로 이동
  const timerTab = page.locator('nav a[href*="timer"]').first();
  await timerTab.click();
  await page.waitForTimeout(1500);

  // DM 플로팅 버튼이 여전히 보이는지 확인
  await expect(dmFloatingBtn).toBeVisible({ timeout: 3000 });
  await takeScreenshot(page, '타이머모듈_DM버튼_확인');
  console.log('  ✅ 시간표 모듈에서도 DM 버튼 표시됨');

  // 학생관리 모듈로 이동
  const studentTab = page.locator('nav a[href*="student"]').first();
  await studentTab.click();
  await page.waitForTimeout(1500);
  await expect(dmFloatingBtn).toBeVisible({ timeout: 3000 });
  await takeScreenshot(page, '학생관리모듈_DM버튼_확인');
  console.log('  ✅ 학생관리 모듈에서도 DM 버튼 표시됨');

  // ============================
  // 최종 요약
  // ============================
  console.log('\n' + '='.repeat(50));
  console.log('📊 E2E 테스트 완료!');
  console.log(`  📸 총 스크린샷: ${screenshotCounter}개`);
  console.log('='.repeat(50));
});
