import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const configPath = path.join(__dirname, 'test-config.json');
const NOTION_CONFIG = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

const SCREENSHOT_DIR = path.join(__dirname, '../e2e-screenshots-all');
let screenshotCounter = 0;
const screenshotMeta: Array<{ filename: string; name: string; module: string; description: string }> = [];

async function takeScreenshot(page: Page, module: string, name: string, description: string) {
  screenshotCounter++;
  const filename = `${String(screenshotCounter).padStart(2, '0')}_${module}_${name}.png`;
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, filename), fullPage: true });
  screenshotMeta.push({ filename, name, module, description });
  console.log(`  📸 ${filename} - ${description}`);
}

async function setupConfig(page: Page) {
  const setupTitle = page.locator('text=시스템 초기 설정');
  if (await setupTitle.isVisible({ timeout: 3000 }).catch(() => false)) {
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
    fs.writeFileSync(tempPath, JSON.stringify(configForUpload, null, 2));
    await page.locator('input[type="file"][accept=".json"]').setInputFiles(tempPath);
    await page.waitForTimeout(2000);
    const spinner = page.locator('text=Notion 데이터 연동 중');
    if (await spinner.isVisible({ timeout: 2000 }).catch(() => false)) {
      await spinner.waitFor({ state: 'hidden', timeout: 60000 });
    }
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    await page.waitForTimeout(2000);
  }
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
    await page.waitForTimeout(3000);
  }
  await expect(page.locator('.header-nav')).toBeVisible({ timeout: 15000 });
}

async function logout(page: Page) {
  // 로그아웃 버튼 찾기
  const logoutBtn = page.locator('button:has-text("로그아웃"), a:has-text("로그아웃"), button:has(span:has-text("logout"))');
  if (await logoutBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await logoutBtn.click();
    await page.waitForTimeout(2000);
  } else {
    // 직접 로그인 페이지로 이동
    await page.evaluate(() => {
      localStorage.removeItem('wawa-app-settings');
      localStorage.removeItem('wawa-report-settings');
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

// ============================================================
test('전체 유즈케이스 스크린샷', async ({ page }) => {
  test.setTimeout(600000);

  // 초기화
  if (fs.existsSync(SCREENSHOT_DIR)) {
    for (const f of fs.readdirSync(SCREENSHOT_DIR)) {
      if (f.endsWith('.png') || f === 'index.json') fs.unlinkSync(path.join(SCREENSHOT_DIR, f));
    }
  }
  screenshotCounter = 0;

  // ========================================
  // 1. 서재용 선생님 로그인
  // ========================================
  console.log('\n🔑 [1] 서재용 선생님 로그인 (PIN: 1141)');
  await page.goto('/');
  await page.waitForTimeout(1500);
  await setupConfig(page);
  await login(page, '서재용', '1141');
  await takeScreenshot(page, '로그인', '서재용_로그인_완료', '서재용 선생님 로그인 성공');

  // ========================================
  // 2. 실시간 시간표 - 학생 타이머 동작
  // ========================================
  console.log('\n⏱️ [2] 실시간 시간표 - 타이머 동작');
  await page.goto('/#/timer/realtime');
  await waitForLoad(page, 5000);
  await takeScreenshot(page, '시간표', '실시간_현황_학생목록', '실시간 현황 - 현재 등록된 학생 목록');

  // 학생 클릭하여 체크인 (대기 중인 학생 카드 클릭)
  const realtimeCard = page.locator('.realtime-card').first();
  if (await realtimeCard.isVisible({ timeout: 5000 }).catch(() => false)) {
    await realtimeCard.click();
    await page.waitForTimeout(2000);
    await takeScreenshot(page, '시간표', '타이머_체크인', '학생 체크인 - 타이머 동작 중');
  }

  // 요일별 시간표
  await page.goto('/#/timer/day');
  await waitForLoad(page, 5000);
  await takeScreenshot(page, '시간표', '요일별_시간표', '요일별 학생 시간표');

  // 시간대별 보기
  await page.goto('/#/timer/timeslot');
  await waitForLoad(page, 5000);
  await takeScreenshot(page, '시간표', '시간대별_보기', '시간대별 학생 배치 현황');

  // ========================================
  // 3. 성적 입력 - 정지효(중3) 성적 입력
  // ========================================
  console.log('\n📝 [3] 성적 입력 - 정지효(중3)');
  await page.goto('/#/report/input');
  await waitForLoad(page, 5000);
  await takeScreenshot(page, '성적표', '성적_입력_페이지', '성적 입력 페이지 진입');

  // 학생 리스트에서 정지효 클릭 (div 리스트 UI)
  const jihyoItem = page.locator('div:has(> div > div:text-is("정지효"))').first();
  if (await jihyoItem.isVisible({ timeout: 5000 }).catch(() => false)) {
    await jihyoItem.click();
    await page.waitForTimeout(2000);
    await takeScreenshot(page, '성적표', '정지효_성적_입력중', '정지효 학생 선택 - 성적 입력 화면');

    // 과목 점수 입력 시도
    const scoreInputs = page.locator('input[type="number"]');
    const scoreCount = await scoreInputs.count();
    if (scoreCount > 0) {
      await scoreInputs.first().fill('85');
      if (scoreCount > 1) await scoreInputs.nth(1).fill('92');
      if (scoreCount > 2) await scoreInputs.nth(2).fill('78');
      await page.waitForTimeout(500);
      await takeScreenshot(page, '성적표', '성적_점수_입력', '과목별 점수 입력 완료');

      // 첫 번째 과목 저장 버튼 클릭
      const saveBtn = page.locator('button:has-text("저장")').first();
      if (await saveBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await saveBtn.click();
        await page.waitForTimeout(3000);
        await takeScreenshot(page, '성적표', '성적_저장_완료', '성적 저장 완료');
      }
    }
  }

  // ========================================
  // 4. 성적표 미리보기 - 정지효 월말평가서
  // ========================================
  console.log('\n📊 [4] 성적표 미리보기 - 정지효 월말평가서');
  await page.goto('/#/report/preview');
  await waitForLoad(page, 5000);

  // 학생 목록 로딩 대기 (Notion API에서 데이터 가져오기)
  const jihyoPreviewItem = page.locator('text=정지효').first();
  await jihyoPreviewItem.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
  await takeScreenshot(page, '성적표', '미리보기_페이지', '성적표 미리보기 페이지');

  // 학생 리스트에서 정지효 클릭
  if (await jihyoPreviewItem.isVisible({ timeout: 3000 }).catch(() => false)) {
    await jihyoPreviewItem.click();
    await page.waitForTimeout(4000); // 차트 렌더링 대기
    await takeScreenshot(page, '성적표', '정지효_월말평가서', '정지효 학생 월말평가서 - 6개월 추세 차트');
  }

  // 성적표 학생관리
  await page.goto('/#/report/students');
  await waitForLoad(page, 5000);
  await takeScreenshot(page, '성적표', '학생_관리', '성적표 학생 관리');

  // AI 설정
  await page.goto('/#/report/ai-settings');
  await waitForLoad(page, 3000);
  await takeScreenshot(page, '성적표', 'AI_설정', 'AI 종합평가 생성 설정');

  // ========================================
  // 5. 보강관리 - 정지효 보강 등록
  // ========================================
  console.log('\n📋 [5] 보강관리 - 정지효(중3) 보강 등록');
  await page.goto('/#/makeup/pending');
  await waitForLoad(page, 5000);
  await takeScreenshot(page, '보강관리', '대기중_보강_목록', '대기 중인 보강 목록');

  // 결석 기록 추가
  const addBtn = page.locator('button:has-text("결석 기록 추가")');
  if (await addBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await addBtn.click();
    await page.waitForTimeout(1000);
    await takeScreenshot(page, '보강관리', '결석기록_모달', '결석 기록 추가 모달');

    // 학생 선택: 정지효
    const modalSelect = page.locator('.modal-content select').first();
    if (await modalSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
      const jihyoMakeup = modalSelect.locator('option:has-text("정지효")');
      if (await jihyoMakeup.count() > 0) {
        const val = await jihyoMakeup.first().getAttribute('value');
        if (val) await modalSelect.selectOption(val);
        await page.waitForTimeout(500);
      }
    }

    // 결석일 입력
    const dateInput = page.locator('.modal-content input[type="date"]').first();
    if (await dateInput.isVisible().catch(() => false)) {
      await dateInput.fill('2026-02-06');
    }

    // 결석사유 입력
    const reasonInput = page.locator('.modal-content input[placeholder*="사유"], .modal-content textarea').first();
    if (await reasonInput.isVisible().catch(() => false)) {
      await reasonInput.fill('감기');
    }

    await takeScreenshot(page, '보강관리', '정지효_결석등록_입력', '정지효 결석 기록 입력 완료');

    // 등록 버튼 클릭
    const submitBtn = page.locator('.modal-content button[type="submit"], .modal-footer button:has-text("등록")');
    if (await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await submitBtn.click();
      await page.waitForTimeout(3000);
      await takeScreenshot(page, '보강관리', '정지효_보강_등록완료', '정지효 보강 학생 등록 완료 - 대기 목록에 표시');
    } else {
      // 모달 닫기
      const closeBtn = page.locator('.modal-close, .modal-content button:has-text("취소")').first();
      if (await closeBtn.isVisible().catch(() => false)) await closeBtn.click();
      await page.waitForTimeout(500);
    }
  }

  // 보강 대시보드
  await page.goto('/#/makeup');
  await waitForLoad(page, 3000);
  await takeScreenshot(page, '보강관리', '보강_대시보드', '보강관리 대시보드 - 현황 통계');

  // 완료된 보강
  await page.goto('/#/makeup/completed');
  await waitForLoad(page, 3000);
  await takeScreenshot(page, '보강관리', '완료된_보강', '완료된 보강 이력');

  // 보강 캘린더
  await page.goto('/#/makeup/calendar');
  await waitForLoad(page, 5000);
  await takeScreenshot(page, '보강관리', '보강_캘린더', '보강 캘린더 - 월별 보강 일정 보기');

  // ========================================
  // 6. 학생관리
  // ========================================
  console.log('\n👨‍🎓 [6] 학생관리');
  await page.goto('/#/student');
  await waitForLoad(page, 5000);
  await takeScreenshot(page, '학생관리', '학생_목록', '전체 학생 목록');

  // ========================================
  // 7. DM - 서재용이 메시지 전송
  // ========================================
  console.log('\n💬 [7] DM - 서재용 → 지혜영 메시지 전송');
  const dmBtn = page.locator('.dm-floating-btn');
  if (await dmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await dmBtn.click();
    await page.waitForTimeout(1500);
    await takeScreenshot(page, 'DM', '서재용_연락처목록', '서재용 선생님 DM 연락처 목록');

    // 지혜영 선택
    const jihyeContact = page.locator('.dm-contact-item:has-text("지혜영")');
    if (await jihyeContact.isVisible({ timeout: 3000 }).catch(() => false)) {
      await jihyeContact.click();
      await page.waitForTimeout(2000);
      await takeScreenshot(page, 'DM', '서재용_지혜영_채팅방', '서재용 → 지혜영 채팅방');

      // 메시지 전송
      const chatInput = page.locator('.dm-input');
      if (await chatInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await chatInput.fill('지혜영 선생님, 정지효 학생 보강 일정 확인 부탁드립니다!');
        await takeScreenshot(page, 'DM', '서재용_메시지_입력', '서재용이 메시지 입력');

        const sendBtn = page.locator('.dm-send-btn');
        await sendBtn.click();
        await page.waitForTimeout(2000);
        await takeScreenshot(page, 'DM', '서재용_메시지_전송완료', '서재용 메시지 전송 완료');
      }
    }

    // 위젯 닫기
    await dmBtn.click();
    await page.waitForTimeout(500);
  }

  // ========================================
  // 8. 로그아웃 → 지혜영으로 재로그인
  // ========================================
  console.log('\n🔄 [8] 지혜영 선생님으로 전환 (PIN: 8520)');
  await logout(page);
  await page.waitForTimeout(1500);
  await takeScreenshot(page, '로그인', '로그아웃_후', '로그아웃 후 로그인 화면');

  await login(page, '지혜영', '8520');
  await takeScreenshot(page, '로그인', '지혜영_로그인_완료', '지혜영 선생님 로그인 성공');

  // ========================================
  // 9. DM - 지혜영이 DM 위젯 확인
  // ========================================
  console.log('\n💬 [9] DM - 지혜영이 서재용 메시지 확인 및 회신');
  const dmBtn2 = page.locator('.dm-floating-btn');
  if (await dmBtn2.isVisible({ timeout: 5000 }).catch(() => false)) {
    await dmBtn2.click();
    await page.waitForTimeout(3000);
    await takeScreenshot(page, 'DM', '지혜영_연락처목록', '지혜영 선생님 DM 연락처 (알림 표시)');

    // 연락처 수 확인 (데이터가 없을 수 있음)
    const contactCount = await page.locator('.dm-contact-item').count();
    console.log(`  📋 DM 연락처 수: ${contactCount}`);

    if (contactCount > 0) {
      // 서재용 연락처가 있으면 클릭
      const sjyContact = page.locator('.dm-contact-item').filter({ hasText: '서재용' }).first();
      if (await sjyContact.isVisible({ timeout: 2000 }).catch(() => false)) {
        await sjyContact.click();
        await page.waitForTimeout(2000);
        await takeScreenshot(page, 'DM', '지혜영_서재용_채팅', '지혜영이 서재용과의 채팅 확인');
      }
    } else {
      console.log('  ⚠️ DM 연락처 없음 - 위젯 캡처만 진행');
    }

    // 위젯 닫기
    await dmBtn2.click().catch(() => {});
    await page.waitForTimeout(500);
  }

  // ========================================
  // 10. 채점 모듈 (개발 중 - 페이지만 캡처)
  // ========================================
  console.log('\n📝 [10] 채점 모듈 (개발 중)');
  await page.goto('/#/grader');
  await waitForLoad(page, 3000);
  await takeScreenshot(page, '채점', '개별_채점', '채점 모듈 - 개별 채점 (개발 중)');

  // ========================================
  // 인덱스 파일 생성
  // ========================================
  const indexContent = {
    generatedAt: new Date().toISOString(),
    totalPages: screenshotMeta.length,
    screenshots: screenshotMeta,
  };
  fs.writeFileSync(path.join(SCREENSHOT_DIR, 'index.json'), JSON.stringify(indexContent, null, 2));

  console.log('\n' + '='.repeat(50));
  console.log(`📊 유즈케이스 스크린샷 완료: 총 ${screenshotMeta.length}개`);
  console.log('='.repeat(50));
});
