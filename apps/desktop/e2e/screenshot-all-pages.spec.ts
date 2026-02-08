import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// Load config
const configPath = path.join(__dirname, 'test-config.json');
const NOTION_CONFIG = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

const SCREENSHOT_DIR = path.join(__dirname, '../e2e-screenshots-all');
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
  console.log(`  📸 ${filename}`);
  return filename;
}

async function setupAndLogin(page: Page) {
  await page.goto('/');
  await page.waitForTimeout(1500);

  // Setup 페이지 처리
  const setupTitle = page.locator('text=시스템 초기 설정');
  const isSetupPage = await setupTitle.isVisible({ timeout: 3000 }).catch(() => false);

  if (isSetupPage) {
    console.log('  📋 Setup 페이지 - config 업로드...');
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
    const tempConfigPath = path.join(__dirname, '_temp_config.json');
    fs.writeFileSync(tempConfigPath, JSON.stringify(configForUpload, null, 2));

    const fileInput = page.locator('input[type="file"][accept=".json"]');
    await fileInput.setInputFiles(tempConfigPath);
    await page.waitForTimeout(2000);

    const spinner = page.locator('text=Notion 데이터 연동 중');
    const hasSpinner = await spinner.isVisible({ timeout: 2000 }).catch(() => false);
    if (hasSpinner) {
      await spinner.waitFor({ state: 'hidden', timeout: 60000 });
    }

    if (fs.existsSync(tempConfigPath)) fs.unlinkSync(tempConfigPath);
    await page.waitForTimeout(2000);
  }

  // Login 페이지 처리
  const loginTitle = page.locator('text=WAWA ERP 로그인');
  const isLoginPage = await loginTitle.isVisible({ timeout: 5000 }).catch(() => false);

  if (isLoginPage) {
    console.log('  🔑 로그인 중...');
    const teacherSelect = page.locator('select.search-input').first();
    await teacherSelect.waitFor({ state: 'visible', timeout: 15000 });

    for (let i = 0; i < 20; i++) {
      await page.waitForTimeout(1000);
      const options = teacherSelect.locator('option');
      if (await options.count() > 1) break;
    }

    const targetName = NOTION_CONFIG.testTeacherName || '';
    if (targetName) {
      const targetOption = teacherSelect.locator(`option:has-text("${targetName}")`);
      const hasTarget = await targetOption.count();
      if (hasTarget > 0) {
        const targetValue = await targetOption.first().getAttribute('value');
        if (targetValue) await teacherSelect.selectOption(targetValue);
      } else {
        const firstValue = await teacherSelect.locator('option').nth(1).getAttribute('value');
        if (firstValue) await teacherSelect.selectOption(firstValue);
      }
    }

    const pinInput = page.locator('input[type="password"]');
    await pinInput.fill(NOTION_CONFIG.testTeacherPin || '0000');

    const loginBtn = page.locator('button:has-text("접속하기")');
    await loginBtn.click();
    await page.waitForTimeout(3000);
  }

  const headerNav = page.locator('.header-nav');
  await expect(headerNav).toBeVisible({ timeout: 15000 });
  console.log('  ✅ 로그인 성공');
}

// ============================================================
// 각 모듈 페이지 정의
// ============================================================
const ALL_PAGES = [
  // Timer 모듈
  { module: '시간표', name: '요일별_시간표', path: '/timer/day', description: '요일별 학생 시간표 보기' },
  { module: '시간표', name: '실시간_현황', path: '/timer/realtime', description: '현재 수업중인 학생 실시간 현황' },
  { module: '시간표', name: '학생별_시간표', path: '/timer/student', description: '학생 개인별 시간표 확인' },
  { module: '시간표', name: '시간대별_보기', path: '/timer/timeslot', description: '시간대별 학생 배치 현황' },
  { module: '시간표', name: '시간표_설정', path: '/timer/settings', description: '시간표 모듈 설정' },

  // Report 모듈
  { module: '성적표', name: '성적표_대시보드', path: '/report', description: '성적표 모듈 대시보드' },
  { module: '성적표', name: '학생_관리', path: '/report/students', description: '성적표 학생 관리' },
  { module: '성적표', name: '시험_관리', path: '/report/exams', description: '시험 난이도 및 일정 관리' },
  { module: '성적표', name: '성적_입력', path: '/report/input', description: '월별 성적 및 코멘트 입력' },
  { module: '성적표', name: '성적표_미리보기', path: '/report/preview', description: '6개월 추세 차트 미리보기' },
  { module: '성적표', name: '성적표_발송', path: '/report/send', description: '카카오톡 알림톡 발송' },
  { module: '성적표', name: 'AI_설정', path: '/report/ai-settings', description: 'AI 종합평가 생성 설정' },
  { module: '성적표', name: '성적표_설정', path: '/report/settings', description: '성적표 모듈 설정' },

  // Grader 모듈
  { module: '채점', name: '개별_채점', path: '/grader', description: '개별 학생 채점' },
  { module: '채점', name: '일괄_채점', path: '/grader/batch', description: '다수 학생 일괄 채점' },
  { module: '채점', name: '채점_이력', path: '/grader/history', description: '채점 이력 조회' },
  { module: '채점', name: '채점_통계', path: '/grader/stats', description: '채점 통계 분석' },
  { module: '채점', name: '채점_설정', path: '/grader/settings', description: '채점 모듈 설정' },

  // Student 모듈
  { module: '학생관리', name: '학생_목록', path: '/student', description: '전체 학생 목록 및 관리' },

  // Makeup 모듈
  { module: '보강관리', name: '보강_대시보드', path: '/makeup', description: '보강 현황 대시보드' },
  { module: '보강관리', name: '대기중_보강', path: '/makeup/pending', description: '대기 중인 보강 관리' },
  { module: '보강관리', name: '완료_보강', path: '/makeup/completed', description: '완료된 보강 이력' },
  { module: '보강관리', name: '보강_설정', path: '/makeup/settings', description: '보강관리 모듈 설정' },

  // Schedule 모듈
  { module: '일정', name: '오늘_일정', path: '/schedule', description: '오늘의 일정 현황' },
  { module: '일정', name: '대기중_일정', path: '/schedule/pending', description: '대기 중인 일정' },
  { module: '일정', name: '예정_일정', path: '/schedule/upcoming', description: '다가오는 일정' },
  { module: '일정', name: '일정_이력', path: '/schedule/history', description: '지난 일정 이력' },
  { module: '일정', name: '일정_설정', path: '/schedule/settings', description: '일정 모듈 설정' },
];

test('전체 페이지 스크린샷 캡처', async ({ page }) => {
  test.setTimeout(600000); // 10분

  // 스크린샷 디렉토리 초기화
  if (fs.existsSync(SCREENSHOT_DIR)) {
    const files = fs.readdirSync(SCREENSHOT_DIR);
    for (const file of files) {
      if (file.endsWith('.png')) fs.unlinkSync(path.join(SCREENSHOT_DIR, file));
    }
  }
  screenshotCounter = 0;

  // 1. 로그인
  console.log('🚀 전체 페이지 스크린샷 캡처 시작\n');
  await setupAndLogin(page);
  await takeScreenshot(page, '00_로그인_완료');

  // 2. 각 페이지 순회
  let currentModule = '';
  for (const pg of ALL_PAGES) {
    if (pg.module !== currentModule) {
      currentModule = pg.module;
      console.log(`\n📂 [${currentModule}] 모듈`);
    }

    try {
      await page.goto(`/#${pg.path}`);
      await page.waitForTimeout(2000);

      // 페이지 로딩 대기 (spinner 사라질 때까지)
      const spinner = page.locator('.spinner');
      if (await spinner.isVisible({ timeout: 500 }).catch(() => false)) {
        await spinner.waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
      }

      // 추가 데이터 로딩 대기
      await page.waitForTimeout(1000);

      await takeScreenshot(page, `${pg.module}_${pg.name}`);
      console.log(`  ✅ ${pg.name}: ${pg.description}`);
    } catch (err) {
      console.log(`  ⚠️ ${pg.name}: 스크린샷 실패 - ${err}`);
      // 실패해도 계속 진행
    }
  }

  // 3. DM 위젯 스크린샷
  console.log('\n📂 [DM 위젯]');
  try {
    const dmBtn = page.locator('.dm-floating-btn');
    if (await dmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await dmBtn.click();
      await page.waitForTimeout(1500);
      await takeScreenshot(page, 'DM_연락처목록');
      console.log('  ✅ DM 연락처 목록');

      // 첫 번째 연락처 클릭
      const firstContact = page.locator('.dm-contact-item').first();
      if (await firstContact.isVisible({ timeout: 2000 }).catch(() => false)) {
        await firstContact.click();
        await page.waitForTimeout(2000);
        await takeScreenshot(page, 'DM_채팅창');
        console.log('  ✅ DM 채팅창');
      }

      // 위젯 닫기
      await dmBtn.click();
      await page.waitForTimeout(500);
    }
  } catch (err) {
    console.log(`  ⚠️ DM 위젯: ${err}`);
  }

  // 4. 스크린샷 인덱스 파일 생성 (PDF 변환용)
  const screenshots = fs.readdirSync(SCREENSHOT_DIR)
    .filter(f => f.endsWith('.png'))
    .sort();

  const indexContent = {
    generatedAt: new Date().toISOString(),
    totalPages: screenshots.length,
    screenshots: screenshots.map(f => {
      const match = f.match(/^\d+_(.+)\.png$/);
      const name = match ? match[1] : f;
      const pageInfo = ALL_PAGES.find(p => f.includes(p.name));
      return {
        filename: f,
        name,
        module: pageInfo?.module || 'DM',
        description: pageInfo?.description || 'DM 위젯',
      };
    }),
  };

  fs.writeFileSync(
    path.join(SCREENSHOT_DIR, 'index.json'),
    JSON.stringify(indexContent, null, 2)
  );

  console.log('\n' + '='.repeat(50));
  console.log(`📊 스크린샷 캡처 완료: 총 ${screenshots.length}개`);
  console.log(`📁 저장 위치: ${SCREENSHOT_DIR}`);
  console.log('='.repeat(50));
});
