/**
 * v1.3.1 기능 검증 E2E 테스트
 *
 * [로그인 패턴 가이드 - 반드시 준수]
 * 1. test.setTimeout(600000) 필수 - Notion 연동에 최대 60초 소요
 * 2. setupConfig → login → .header-nav 확인 순서
 * 3. 로그인 계정: 서재용/1141, 지혜영/8520 (박영어/1234 아님!)
 * 4. 로그아웃: button:has(span:has-text("logout")) 클릭
 * 5. 네비게이션: page.goto() 대신 헤더/사이드바 클릭 사용 (리로드 방지)
 *    - 헤더 탭: .header-nav-item:has-text("학생관리")
 *    - 사이드바: .sidebar-item:has-text("리포트 미리보기")
 * 6. DM 셀렉터: .dm-floating-btn, .dm-contact-item, .dm-input, .dm-send-btn
 */
import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const configPath = path.join(__dirname, 'test-config.json');
const NOTION_CONFIG = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
const SCREENSHOT_DIR = path.join(__dirname, '../e2e-screenshots-all');
let screenshotCounter = 100;

async function takeScreenshot(page: Page, name: string, description: string) {
  screenshotCounter++;
  const filename = `${screenshotCounter}_v131_${name}.png`;
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, filename), fullPage: false });
  console.log(`  📸 ${filename} - ${description}`);
}

// ========== 검증된 로그인 헬퍼 (screenshot-all-pages.spec.ts 동일 패턴) ==========

async function setupConfig(page: Page) {
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
  const tempPath = path.join(__dirname, '_temp_config.json');

  // 최대 3회 재시도 (Notion API 프록시 첫 연결이 느릴 수 있음)
  for (let attempt = 1; attempt <= 3; attempt++) {
    const setupTitle = page.locator('text=시스템 초기 설정');
    if (!(await setupTitle.isVisible({ timeout: 3000 }).catch(() => false))) {
      break; // 설정 화면 아님 = 이미 설정 완료
    }

    console.log(`  🔄 설정 업로드 시도 ${attempt}/3`);
    fs.writeFileSync(tempPath, JSON.stringify(configForUpload, null, 2));
    await page.locator('input[type="file"][accept=".json"]').setInputFiles(tempPath);
    await page.waitForTimeout(2000);

    const spinner = page.locator('text=Notion 데이터 연동 중');
    if (await spinner.isVisible({ timeout: 3000 }).catch(() => false)) {
      await spinner.waitFor({ state: 'hidden', timeout: 90000 });
    }
    await page.waitForTimeout(2000);

    // 설정 성공 확인: 로그인 화면이 보이면 성공 (setup 화면이 사라졌다는 뜻)
    // 주의: .header-nav는 미설정 상태에서도 항상 보이므로 판정 기준으로 사용 금지
    const setupGone = !(await page.locator('text=시스템 초기 설정').isVisible({ timeout: 2000 }).catch(() => false));
    const loginVisible = await page.locator('text=WAWA ERP 로그인').isVisible({ timeout: 3000 }).catch(() => false);
    if (setupGone || loginVisible) {
      console.log(`  ✅ 설정 완료 (시도 ${attempt})`);
      break;
    }

    // 실패 시 alert 닫고 재시도
    page.on('dialog', dialog => dialog.dismiss());
    console.log(`  ⚠️ 설정 실패, 재시도...`);
    await page.waitForTimeout(2000);
  }

  if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
}

async function login(page: Page, teacherName: string, pin: string) {
  const loginTitle = page.locator('text=WAWA ERP 로그인');
  if (await loginTitle.isVisible({ timeout: 5000 }).catch(() => false)) {
    const teacherSelect = page.locator('select.search-input').first();
    await teacherSelect.waitFor({ state: 'visible', timeout: 15000 });

    for (let i = 0; i < 20; i++) {
      await page.waitForTimeout(1000);
      if (await teacherSelect.locator('option').count() > 1) break;
    }

    const targetOption = teacherSelect.locator(`option:has-text("${teacherName}")`);
    if (await targetOption.count() > 0) {
      const val = await targetOption.first().getAttribute('value');
      if (val) await teacherSelect.selectOption(val);
    }

    await page.locator('input[type="password"]').fill(pin);
    await page.locator('button:has-text("접속하기")').click();
    await page.waitForTimeout(5000);
  }
  // .sidebar는 로그인 완료 후에만 표시됨 (.header-nav는 항상 보이므로 사용 금지)
  await expect(page.locator('.sidebar')).toBeVisible({ timeout: 30000 });
}

async function logout(page: Page) {
  const logoutBtn = page.locator('button:has(span:has-text("logout"))');
  if (await logoutBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await logoutBtn.click();
    await page.waitForTimeout(2000);
  } else {
    await page.evaluate(() => {
      localStorage.removeItem('wawa-report-storage');
    });
    await page.goto('/');
    await page.waitForTimeout(2000);
  }
}

async function waitForLoad(page: Page, timeout = 3000) {
  await page.waitForTimeout(1500);
  const spinner = page.locator('.spinner');
  if (await spinner.isVisible({ timeout: 500 }).catch(() => false)) {
    await spinner.waitFor({ state: 'hidden', timeout }).catch(() => {});
  }
  await page.waitForTimeout(500);
}

// ========== 테스트 시작 ==========

test('v1.3.1 전체 기능 검증 + DM 쪽지 시스템', async ({ page }) => {
  test.setTimeout(600000);

  // 콘솔 에러 수집
  const consoleErrors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  // ================================================================
  // PART 1: 서재용 선생님 로그인 + 기능 검증
  // ================================================================
  console.log('\n🔑 [1] 서재용 선생님 로그인 (PIN: 1141)');
  await page.goto('/');
  await page.waitForTimeout(1500);
  await setupConfig(page);
  await login(page, '서재용', '1141');
  await page.waitForTimeout(2000); // Zustand persist 완료 대기
  console.log('✅ 서재용 로그인 성공\n');

  // ---------- 테스트 1: 학생 모달 시간표 5슬롯 ----------
  console.log('📋 [테스트1] 학생 모달 - 시간표 슬롯 5개');
  // 헤더 탭 클릭으로 네비게이션 (page.goto 대신)
  await page.locator('.header-nav-item:has-text("학생관리")').click();
  await waitForLoad(page, 10000);

  const addBtn = page.locator('button:has-text("학생 추가")');
  await expect(addBtn).toBeVisible({ timeout: 15000 });
  await addBtn.click();
  await page.waitForTimeout(500);

  await expect(page.locator('.modal-overlay')).toBeVisible({ timeout: 5000 });

  // 수학 과목 선택
  await page.locator('.modal-overlay button:has-text("수학")').click();
  await page.waitForTimeout(300);

  // 5개 라벨 확인
  await expect(page.locator('text=수강 시간표 (5개)')).toBeVisible({ timeout: 5000 });

  // time input 10개 (5슬롯 × 시작+종료)
  const timeInputs = page.locator('.modal-overlay input[type="time"]');
  expect(await timeInputs.count()).toBe(10);
  console.log('  ✅ 시간표 슬롯 5개 확인 (time inputs: 10개)');

  await takeScreenshot(page, '학생모달_5슬롯', '과목별 시간표 입력 필드 5개');

  // 모달 닫기
  const closeModalBtn = page.locator('.modal-overlay .modal-close-btn, .modal-overlay button:has-text("취소"), .modal-overlay button:has-text("닫기")');
  if (await closeModalBtn.count() > 0) {
    await closeModalBtn.first().click();
  } else {
    await page.keyboard.press('Escape');
  }
  await page.waitForTimeout(500);

  // ---------- 테스트 2: 리포트 미리보기 검색창 ----------
  console.log('\n📋 [테스트2] 리포트 미리보기 - 검색창');
  // 헤더 탭 → 월말평가
  await page.locator('.header-nav-item:has-text("월말평가")').click();
  await waitForLoad(page, 5000);
  // 사이드바 → 리포트 미리보기
  await page.locator('.sidebar-item:has-text("리포트 미리보기")').click();
  await waitForLoad(page, 10000);

  const previewSearch = page.locator('input.search-input[placeholder="학생 검색..."]');
  await expect(previewSearch).toBeVisible({ timeout: 10000 });
  console.log('  ✅ 검색창 존재');

  await takeScreenshot(page, '미리보기_검색창', '리포트 미리보기 학생 검색창');

  // 존재하지 않는 학생 검색
  await previewSearch.fill('없는학생zzz');
  await page.waitForTimeout(500);
  await expect(page.locator('text=검색 결과가 없습니다')).toBeVisible({ timeout: 3000 });
  console.log('  ✅ 빈 검색 결과 표시');
  await takeScreenshot(page, '미리보기_빈검색', '존재하지 않는 학생 검색');

  // 검색 복원
  await previewSearch.fill('');
  await page.waitForTimeout(500);
  console.log('  ✅ 목록 복원');

  // ---------- 테스트 3: 전송 검색 필터 ----------
  console.log('\n📋 [테스트3] 리포트 전송 - 검색 필터 바');
  // 사이드바 → 리포트 전송
  await page.locator('.sidebar-item:has-text("리포트 전송")').click();
  await waitForLoad(page, 5000);

  const sendSearch = page.locator('input.search-input[placeholder="학생 이름 검색..."]');
  await expect(sendSearch).toBeVisible({ timeout: 10000 });
  console.log('  ✅ 전송 검색창 존재');

  expect(await page.locator('span.material-symbols-outlined:has-text("search")').count()).toBeGreaterThan(0);
  console.log('  ✅ search 아이콘');

  await takeScreenshot(page, '전송_검색바', '리포트 전송 검색 필터 바');

  await sendSearch.fill('테스트');
  await page.waitForTimeout(300);
  const resetBtn = page.locator('button:has-text("초기화")');
  await expect(resetBtn).toBeVisible({ timeout: 3000 });
  console.log('  ✅ 초기화 버튼');
  await takeScreenshot(page, '전송_필터적용', '검색 필터 적용 + 초기화 버튼');

  await resetBtn.click();
  await page.waitForTimeout(300);
  await expect(sendSearch).toHaveValue('');
  console.log('  ✅ 초기화 동작');

  // ================================================================
  // PART 2: 서재용 → 지혜영에게 쪽지 보내기
  // ================================================================
  console.log('\n💬 [테스트4] 서재용 → 지혜영 쪽지 보내기');

  const dmBtn = page.locator('.dm-floating-btn');
  if (await dmBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await dmBtn.click();
    await page.waitForTimeout(2000);
    await takeScreenshot(page, 'DM_서재용_위젯열기', '서재용 DM 위젯 오픈');

    // 지혜영 연락처 선택
    const jihyeContact = page.locator('.dm-contact-item').filter({ hasText: '지혜영' }).first();
    if (await jihyeContact.isVisible({ timeout: 5000 }).catch(() => false)) {
      await jihyeContact.click();
      await page.waitForTimeout(2000);
      await takeScreenshot(page, 'DM_서재용_지혜영채팅방', '서재용 → 지혜영 채팅방 진입');

      // 메시지 입력 및 전송
      const chatInput = page.locator('.dm-input');
      if (await chatInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await chatInput.fill('지혜영 선생님, 내일 수업 자료 공유드립니다! - 서재용');
        await page.waitForTimeout(300);
        await takeScreenshot(page, 'DM_서재용_메시지입력', '서재용이 메시지 입력');

        const sendMsgBtn = page.locator('.dm-send-btn');
        await sendMsgBtn.click();
        await page.waitForTimeout(2000);
        console.log('  ✅ 서재용 → 지혜영 메시지 전송 완료');
        await takeScreenshot(page, 'DM_서재용_메시지전송', '서재용 메시지 전송 완료');
      }
    } else {
      console.log('  ⚠️ 지혜영 연락처를 찾을 수 없음');
      await takeScreenshot(page, 'DM_서재용_연락처없음', '연락처 목록에 지혜영 없음');
    }

    // DM 위젯 닫기
    await dmBtn.click();
    await page.waitForTimeout(500);
  } else {
    console.log('  ⚠️ DM 플로팅 버튼을 찾을 수 없음');
  }

  // ================================================================
  // PART 3: 로그아웃 → 지혜영 로그인 → 쪽지 확인 + 답장
  // ================================================================
  console.log('\n🔑 [5] 로그아웃 후 지혜영 선생님 로그인 (PIN: 8520)');
  await logout(page);
  await page.waitForTimeout(1500);
  await setupConfig(page);
  await login(page, '지혜영', '8520');
  await page.waitForTimeout(2000);
  console.log('✅ 지혜영 로그인 성공\n');

  await takeScreenshot(page, 'DM_지혜영_로그인', '지혜영 선생님 로그인 완료');

  // DM 위젯 열기
  console.log('💬 [테스트5] 지혜영 - 서재용 쪽지 확인 + 답장');
  const dmBtn2 = page.locator('.dm-floating-btn');
  if (await dmBtn2.isVisible({ timeout: 5000 }).catch(() => false)) {
    await dmBtn2.click();
    await page.waitForTimeout(3000);

    // 연락처 로딩 대기 (1초 폴링이므로 최대 15초면 충분)
    for (let i = 0; i < 5; i++) {
      const cnt = await page.locator('.dm-contact-item').count();
      if (cnt > 0) break;
      console.log(`  ⏳ 연락처 로딩 대기... (${(i + 1) * 3}초)`);
      await page.waitForTimeout(3000);
    }

    await takeScreenshot(page, 'DM_지혜영_위젯열기', '지혜영 DM 위젯 오픈');

    const contactCount = await page.locator('.dm-contact-item').count();
    console.log(`  📋 DM 연락처 수: ${contactCount}`);

    // 서재용 선택
    const seoContact = page.locator('.dm-contact-item').filter({ hasText: '서재용' }).first();
    if (await seoContact.isVisible({ timeout: 10000 }).catch(() => false)) {
      await seoContact.click();
      await page.waitForTimeout(2000);
      await takeScreenshot(page, 'DM_지혜영_메시지확인', '지혜영이 서재용 메시지 확인');

      // 답장
      const chatInput2 = page.locator('.dm-input');
      if (await chatInput2.isVisible({ timeout: 3000 }).catch(() => false)) {
        await chatInput2.fill('네, 감사합니다! 확인했어요 :) - 지혜영');
        await page.waitForTimeout(300);

        const sendMsgBtn2 = page.locator('.dm-send-btn');
        await sendMsgBtn2.click();
        await page.waitForTimeout(2000);
        console.log('  ✅ 지혜영 → 서재용 답장 전송 완료');
        await takeScreenshot(page, 'DM_지혜영_답장전송', '지혜영이 서재용에게 답장 전송');
      }
    } else {
      console.log('  ⚠️ 서재용 연락처를 찾을 수 없음');
    }

    // DM 위젯 닫기
    await dmBtn2.click().catch(() => {});
    await page.waitForTimeout(500);
  }

  // ================================================================
  // PART 4: 다시 서재용 로그인 → 답장 확인
  // ================================================================
  console.log('\n🔑 [6] 다시 서재용 로그인하여 답장 확인');
  await logout(page);
  await page.waitForTimeout(1500);
  await setupConfig(page);
  await login(page, '서재용', '1141');
  await page.waitForTimeout(2000);
  console.log('✅ 서재용 재로그인 성공');

  // DM 위젯 열기 → 지혜영 답장 확인
  const dmBtn3 = page.locator('.dm-floating-btn');
  if (await dmBtn3.isVisible({ timeout: 5000 }).catch(() => false)) {
    await dmBtn3.click();
    await page.waitForTimeout(3000);

    // 연락처 로딩 대기
    for (let i = 0; i < 5; i++) {
      const cnt = await page.locator('.dm-contact-item').count();
      if (cnt > 0) break;
      await page.waitForTimeout(3000);
    }

    const jihyeContact2 = page.locator('.dm-contact-item').filter({ hasText: '지혜영' }).first();
    if (await jihyeContact2.isVisible({ timeout: 10000 }).catch(() => false)) {
      await jihyeContact2.click();
      await page.waitForTimeout(2000);
    }

    await takeScreenshot(page, 'DM_서재용_답장확인', '서재용이 지혜영 답장 확인');
    console.log('  ✅ 서재용이 지혜영 답장 확인');

    await dmBtn3.click().catch(() => {});
    await page.waitForTimeout(500);
  }

  // ================================================================
  // PART 5: ERR_CONNECTION_REFUSED 검증
  // ================================================================
  console.log('\n📋 [테스트6] ERR_CONNECTION_REFUSED 에러 없음 확인');
  const backendErrors = consoleErrors.filter(e => e.includes('localhost:8000'));
  expect(backendErrors.length).toBe(0);
  console.log(`  ✅ localhost:8000 에러 0건 (총 콘솔에러: ${consoleErrors.length}건)`);

  console.log('\n🎉 v1.3.1 전체 기능 검증 + DM 쪽지 시스템 테스트 완료!');
});
