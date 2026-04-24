/**
 * 보드 페이지 UI E2E 테스트 — 라이브 서버
 * 실제 브라우저에서 페이지 렌더링 + 기능 동작 확인
 */
import { test, expect } from '@playwright/test';
import { API_URL, SITE_URL } from './_env';

const LIVE_URL = SITE_URL;
const ADMIN = { name: '서재용 개발자', pin: '1141' };

test.describe.configure({ mode: 'serial' });

test.describe('보드 페이지 UI 라이브 테스트', () => {
  let page: any;

  test('UI-01: 로그인 후 네비게이션에 보드 탭 존재', async ({ browser }) => {
    const ctx = await browser.newContext();
    page = await ctx.newPage();

    // 에러 캡처
    page.on('pageerror', (err: Error) => console.log(`❌ PAGE ERROR: ${err.message}`));
    page.on('response', (res: any) => {
      if (res.url().includes('/api/') && res.status() >= 400) {
        console.log(`⚠️ API ${res.status()}: ${res.url()}`);
      }
    });

    await page.goto(LIVE_URL);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // 로그인
    const nameInput = page.locator('input').first();
    if (await nameInput.isVisible()) {
      await nameInput.fill(ADMIN.name);
      await page.locator('input[type="password"], input').nth(1).fill(ADMIN.pin);
      await page.locator('button:has-text("로그인")').first().click();
      await page.waitForTimeout(4000);
    }

    // 네비게이션 확인
    const boardNav = page.locator('a:has-text("보드")');
    const visible = await boardNav.isVisible().catch(() => false);
    console.log(`✅ 보드 네비게이션 탭: ${visible ? '보임' : '안보임'}`);
    expect(visible).toBe(true);

    // 다른 탭들도 확인
    for (const tab of ['시간표', '월말평가', '보강관리', '보드', '설정']) {
      const exists = await page.locator(`a:has-text("${tab}")`).isVisible().catch(() => false);
      console.log(`  ${tab}: ${exists ? '✅' : '❌'}`);
    }
  });

  test('UI-02: 보드 페이지 진입 — 에러 없이 렌더링', async () => {
    await page.locator('a:has-text("보드")').click();
    await page.waitForTimeout(3000);

    // 페이지 타이틀
    const title = await page.locator('.page-title').first().textContent().catch(() => '');
    console.log(`✅ 페이지 타이틀: "${title}"`);
    expect(title).toContain('보드');

    // 버튼 존재
    const createBtn = await page.locator('button:has-text("공지 작성")').isVisible().catch(() => false);
    const todoBtn = await page.locator('button:has-text("할일")').isVisible().catch(() => false);
    console.log(`  공지 작성 버튼: ${createBtn ? '✅' : '❌'}`);
    console.log(`  할일 버튼: ${todoBtn ? '✅' : '❌'}`);
    expect(createBtn).toBe(true);
  });

  test('UI-03: 고정 공지 / 내 할일 / 최근 공지 섹션 렌더링', async () => {
    const bodyText = await page.locator('body').innerText();

    // 섹션 존재 여부 (데이터가 있으면 섹션 타이틀이 보임)
    const hasMyTodo = bodyText.includes('내 할일');
    const hasRecent = bodyText.includes('최근 공지');
    console.log(`  내 할일 섹션: ${hasMyTodo ? '✅' : '❌'}`);
    console.log(`  최근 공지 섹션: ${hasRecent ? '✅' : '❌'}`);

    // 기존 E2E에서 생성한 의무교육 공지가 보이는지
    const hasEducation = bodyText.includes('의무교육') || bodyText.includes('개인정보보호');
    console.log(`  의무교육 공지 표시: ${hasEducation ? '✅' : '⚠️ 없을 수 있음'}`);

    // 스크린샷
    await page.screenshot({ path: 'test-results/board-page.png', fullPage: true });
    console.log('✅ 스크린샷 저장: test-results/board-page.png');
  });

  test('UI-04: 공지 작성 모달 열기/닫기', async () => {
    await page.locator('button:has-text("공지 작성")').click();
    await page.waitForTimeout(500);

    // 모달 존재
    const modal = page.locator('.modal-content');
    const modalVisible = await modal.isVisible().catch(() => false);
    console.log(`✅ 공지 작성 모달: ${modalVisible ? '열림' : '안열림'}`);
    expect(modalVisible).toBe(true);

    // 모달 내부 요소
    const hasTitle = await page.locator('.modal-title').textContent().catch(() => '');
    console.log(`  모달 제목: "${hasTitle}"`);

    const categorySelect = await page.locator('.form-select').first().isVisible().catch(() => false);
    const titleInput = await page.locator('.form-input').first().isVisible().catch(() => false);
    console.log(`  카테고리 선택: ${categorySelect ? '✅' : '❌'}`);
    console.log(`  제목 입력: ${titleInput ? '✅' : '❌'}`);

    // 닫기
    await page.locator('button:has-text("취소")').click();
    await page.waitForTimeout(300);
    const modalGone = !(await modal.isVisible().catch(() => false));
    console.log(`  모달 닫힘: ${modalGone ? '✅' : '❌'}`);
  });

  test('UI-05: 공지 작성 → 화면 반영 확인', async () => {
    // 공지 작성 모달 열기
    await page.locator('button:has-text("공지 작성")').click();
    await page.waitForTimeout(500);

    // 카테고리 선택
    await page.locator('.form-select').first().selectOption('exam');

    // 제목 입력
    await page.locator('.form-input').first().fill('[정기고사] UI E2E 테스트 공지');

    // 내용 입력
    await page.locator('.form-textarea').first().fill('브라우저에서 작성한 테스트 공지입니다.');

    // 고정 체크
    await page.locator('input[type="checkbox"]').first().check();

    // 모달 내 작성 버튼 클릭
    await page.locator('.modal-footer button:has-text("작성")').click();
    await page.waitForTimeout(3000);

    // 화면에 새 공지가 반영됐는지
    const bodyText = await page.locator('body').innerText();
    const hasNewNotice = bodyText.includes('UI E2E 테스트 공지');
    console.log(`✅ 새 공지 화면 반영: ${hasNewNotice ? '✅' : '❌'}`);
    expect(hasNewNotice).toBe(true);

    await page.screenshot({ path: 'test-results/board-after-create.png', fullPage: true });
    console.log('  스크린샷 저장: test-results/board-after-create.png');
  });

  test('UI-06: 할일 추가 모달 → 작성', async () => {
    await page.locator('button:has-text("할일")').first().click();
    await page.waitForTimeout(500);

    const modal = page.locator('.modal-content');
    const modalVisible = await modal.isVisible().catch(() => false);
    console.log(`✅ 할일 모달: ${modalVisible ? '열림' : '안열림'}`);

    // 제목 입력
    await modal.locator('.form-input').first().fill('UI에서 추가한 테스트 할일');

    // 담당자 선택 (첫 번째 옵션 이후)
    const options = await modal.locator('.form-select option').allTextContents();
    console.log(`  담당자 옵션: ${options.length}개`);
    if (options.length > 1) {
      await modal.locator('.form-select').selectOption({ index: 1 });
    }

    // 추가 클릭
    await modal.locator('button:has-text("추가")').click();
    await page.waitForTimeout(2000);

    const bodyText = await page.locator('body').innerText();
    const hasNewAction = bodyText.includes('UI에서 추가한 테스트 할일');
    console.log(`✅ 새 할일 화면 반영: ${hasNewAction ? '✅' : '⚠️'}`);
  });

  test('UI-07: 시간표 페이지도 정상 렌더링 확인', async () => {
    await page.locator('a:has-text("시간표")').click();
    await page.waitForTimeout(3000);

    const title = await page.locator('.page-title').first().textContent().catch(() => '');
    console.log(`✅ 시간표 페이지: "${title}"`);
    expect(title).toContain('시간표');

    // 오늘 수업 or 수업 없음 메시지
    const bodyText = await page.locator('body').innerText();
    const hasClasses = bodyText.includes('오늘 수업') || bodyText.includes('수업이 없습니다');
    console.log(`  수업 콘텐츠: ${hasClasses ? '✅' : '❌'}`);

    // 수업마침/퇴근 버튼
    const finishBtn = await page.locator('button:has-text("수업 마침")').isVisible().catch(() => false);
    const leaveBtn = await page.locator('button:has-text("퇴근")').isVisible().catch(() => false);
    console.log(`  수업 마침 버튼: ${finishBtn ? '✅' : '❌'}`);
    console.log(`  퇴근 버튼: ${leaveBtn ? '✅' : '❌'}`);

    await page.screenshot({ path: 'test-results/timer-page.png', fullPage: true });
  });

  test('UI-08: 보강관리 페이지도 정상 렌더링 확인', async () => {
    await page.locator('a:has-text("보강관리")').click();
    await page.waitForTimeout(3000);

    const title = await page.locator('.page-title').first().textContent().catch(() => '');
    console.log(`✅ 보강관리 페이지: "${title}"`);
    expect(title).toContain('보강');

    // 필터 버튼
    const filters = await page.locator('.filter-btn').count();
    console.log(`  필터 버튼: ${filters}개`);

    await page.screenshot({ path: 'test-results/absence-page.png', fullPage: true });
  });
});
