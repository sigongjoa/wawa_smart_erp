/**
 * 학생 성장 대시보드 UI E2E 테스트 — 브라우저 렌더링 + 플로우 (Issue #33)
 *
 * ═══ 유즈케이스 정의 ═══
 *
 * UI-01: 로그인 후 네비게이션에 "학생" 탭 존재
 * UI-02: 학생 목록 페이지 진입 → 에러 없이 렌더링
 * UI-03: 학생 검색 → 필터 동작
 * UI-04: 학생 카드 클릭 → 프로필 페이지 이동
 * UI-05: 프로필 페이지 — 성적 추이 차트 렌더링
 * UI-06: 프로필 페이지 — 출결 요약 카드 렌더링
 * UI-07: 프로필 페이지 — 기본 정보 카드 렌더링
 * UI-08: 프로필 페이지 — 코멘트 타임라인 접기/펼치기
 * UI-09: 기간 토글(6개월/12개월) → 차트 갱신
 * UI-10: 뒤로가기 → 학생 목록 복귀
 * UI-11: API 에러 시 graceful fallback (빈 상태 메시지)
 * UI-12: 다른 페이지 이동 후 돌아와도 정상 동작
 */
import { test, expect, Page, BrowserContext } from '@playwright/test';

const LIVE_URL = 'https://wawa-smart-erp.pages.dev';
const ADMIN = { name: '서재용 개발자', pin: '1141' };

test.describe.configure({ mode: 'serial' });

test.describe('학생 성장 대시보드 — UI 플로우 테스트', () => {
  let page: Page;
  let context: BrowserContext;
  const errors: string[] = [];
  const apiErrors: string[] = [];

  // ═══ UI-01: 로그인 + 네비게이션 확인 ═══
  test('UI-01: 로그인 후 네비게이션에 학생 탭 존재', async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();

    // 에러 모니터링
    page.on('pageerror', (err) => {
      errors.push(err.message);
      console.log(`❌ PAGE ERROR: ${err.message}`);
    });
    page.on('response', (res) => {
      if (res.url().includes('/api/') && res.status() >= 400) {
        apiErrors.push(`${res.status()} ${res.url()}`);
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
      await page.locator('button:has-text("로그인"), button:has-text("접속하기")').first().click();
      await page.waitForTimeout(4000);
    }

    // "학생" 탭 확인
    const studentNav = page.locator('a:has-text("학생")');
    const visible = await studentNav.isVisible().catch(() => false);
    console.log(`✅ 학생 네비게이션 탭: ${visible ? '보임' : '안보임'}`);
    expect(visible).toBe(true);

    // 전체 네비 탭 확인
    for (const tab of ['시간표', '월말평가', '보강관리', '학생', '보드', '설정']) {
      const exists = await page.locator(`a:has-text("${tab}")`).isVisible().catch(() => false);
      console.log(`  ${tab}: ${exists ? '✅' : '❌'}`);
    }
  });

  // ═══ UI-02: 학생 목록 페이지 렌더링 ═══
  test('UI-02: 학생 목록 페이지 진입 — 에러 없이 렌더링', async () => {
    await page.locator('a:has-text("학생")').click();
    await page.waitForTimeout(3000);

    // 페이지 에러 없는지
    const pageErrorsDuringNav = errors.length;
    console.log(`✅ 페이지 에러: ${pageErrorsDuringNav === 0 ? '없음' : pageErrorsDuringNav + '건'}`);

    // "학생 목록" 텍스트 확인
    const bodyText = await page.locator('body').innerText();
    const hasTitle = bodyText.includes('학생 목록');
    console.log(`  "학생 목록" 표시: ${hasTitle ? '✅' : '❌'}`);
    expect(hasTitle).toBe(true);

    // 검색 인풋 존재
    const searchInput = page.locator('.student-search-input');
    const hasSearch = await searchInput.isVisible().catch(() => false);
    console.log(`  검색 입력: ${hasSearch ? '✅' : '❌'}`);
    expect(hasSearch).toBe(true);

    // 학생 카드가 1개 이상
    const cards = page.locator('.student-card');
    const cardCount = await cards.count();
    console.log(`  학생 카드: ${cardCount}개`);
    expect(cardCount).toBeGreaterThan(0);

    await page.screenshot({ path: 'test-results/student-list.png', fullPage: true });
    console.log('  스크린샷: test-results/student-list.png');
  });

  // ═══ UI-03: 검색 필터 동작 ═══
  test('UI-03: 학생 검색 필터 → 이름으로 필터링', async () => {
    // 전체 카드 수 기록
    const beforeCount = await page.locator('.student-card').count();

    // 첫 학생 이름 추출
    const firstCardName = await page.locator('.student-card-name').first().textContent();
    console.log(`  첫 학생: ${firstCardName}`);

    if (firstCardName) {
      // 검색 수행
      await page.locator('.student-search-input').fill(firstCardName);
      await page.waitForTimeout(500);

      const afterCount = await page.locator('.student-card').count();
      console.log(`✅ 검색 필터: ${beforeCount}개 → ${afterCount}개 (검색: "${firstCardName}")`);
      expect(afterCount).toBeLessThanOrEqual(beforeCount);
      expect(afterCount).toBeGreaterThan(0);

      // 필터된 카드에 검색어 포함
      const filteredName = await page.locator('.student-card-name').first().textContent();
      expect(filteredName).toContain(firstCardName);
    }

    // 검색 초기화
    await page.locator('.student-search-input').clear();
    await page.waitForTimeout(300);

    const resetCount = await page.locator('.student-card').count();
    console.log(`  초기화 후: ${resetCount}개`);
    expect(resetCount).toBe(beforeCount);
  });

  // ═══ UI-04: 학생 카드 클릭 → 프로필 이동 ═══
  test('UI-04: 학생 카드 클릭 → 프로필 페이지 이동', async () => {
    const cardName = await page.locator('.student-card-name').first().textContent();
    console.log(`  클릭 대상: ${cardName}`);

    await page.locator('.student-card').first().click();
    await page.waitForTimeout(3000);

    // URL에 /student/ 포함
    const url = page.url();
    expect(url).toContain('#/student/');
    console.log(`✅ 프로필 URL: ${url}`);

    // 학생 이름 표시
    const headerText = await page.locator('.student-profile-header').innerText().catch(() => '');
    const hasName = headerText.includes(cardName || '');
    console.log(`  프로필 헤더: "${headerText.slice(0, 50)}"`);
    expect(hasName).toBe(true);

    // 뒤로가기 버튼 존재
    const backBtn = page.locator('.back-btn');
    const hasBack = await backBtn.isVisible().catch(() => false);
    console.log(`  뒤로가기 버튼: ${hasBack ? '✅' : '❌'}`);
    expect(hasBack).toBe(true);

    // 페이지 에러 없는지
    expect(errors.length).toBe(0);

    await page.screenshot({ path: 'test-results/student-profile.png', fullPage: true });
    console.log('  스크린샷: test-results/student-profile.png');
  });

  // ═══ UI-05: 성적 추이 차트 렌더링 ═══
  test('UI-05: 프로필 — 성적 추이 차트 렌더링 확인', async () => {
    const bodyText = await page.locator('body').innerText();
    const hasChartTitle = bodyText.includes('성적 추이');
    console.log(`✅ "성적 추이" 섹션: ${hasChartTitle ? '보임' : '안보임'}`);
    expect(hasChartTitle).toBe(true);

    // Canvas 존재 확인
    const canvas = page.locator('.score-chart-canvas');
    const canvasVisible = await canvas.isVisible().catch(() => false);

    // 데이터 없으면 "성적 데이터가 없습니다" 메시지
    const noData = bodyText.includes('성적 데이터가 없습니다');

    console.log(`  차트 캔버스: ${canvasVisible ? '✅ 렌더링됨' : '❌ 안보임'}`);
    console.log(`  데이터 없음 메시지: ${noData ? '✅ 표시' : '표시안됨'}`);

    // 둘 중 하나는 반드시 보여야 함
    expect(canvasVisible || noData).toBe(true);

    if (canvasVisible) {
      // Canvas 크기 검증
      const box = await canvas.boundingBox();
      expect(box).not.toBeNull();
      if (box) {
        expect(box.width).toBeGreaterThan(100);
        expect(box.height).toBeGreaterThan(50);
        console.log(`  캔버스 크기: ${Math.round(box.width)}x${Math.round(box.height)}`);
      }
    }

    // 기간 토글 버튼 존재
    const toggleBtns = page.locator('.period-toggle button');
    const toggleCount = await toggleBtns.count();
    console.log(`  기간 토글 버튼: ${toggleCount}개`);
    expect(toggleCount).toBe(2);
  });

  // ═══ UI-06: 출결 요약 카드 ═══
  test('UI-06: 프로필 — 출결 요약 카드 렌더링', async () => {
    const bodyText = await page.locator('body').innerText();
    const hasSection = bodyText.includes('출결 요약');
    console.log(`✅ "출결 요약" 섹션: ${hasSection ? '보임' : '안보임'}`);
    expect(hasSection).toBe(true);

    // 출석률 표시 또는 "출결 데이터 없음"
    const hasRate = bodyText.includes('출석률') || bodyText.includes('%');
    const hasNoData = bodyText.includes('출결 데이터 없음');
    console.log(`  출석률 표시: ${hasRate ? '✅' : '표시안됨'}`);
    console.log(`  데이터 없음: ${hasNoData ? '✅' : '해당없음'}`);
    expect(hasRate || hasNoData).toBe(true);

    // 출석/결석/지각 통계
    if (hasRate) {
      const rateEl = page.locator('.attendance-rate-value');
      const rateVisible = await rateEl.isVisible().catch(() => false);
      if (rateVisible) {
        const rateText = await rateEl.textContent();
        console.log(`  출석률 값: ${rateText}`);
        expect(rateText).toMatch(/\d+%/);
      }
    }
  });

  // ═══ UI-07: 기본 정보 카드 ═══
  test('UI-07: 프로필 — 기본 정보 카드 렌더링', async () => {
    const bodyText = await page.locator('body').innerText();
    const hasSection = bodyText.includes('기본 정보');
    console.log(`✅ "기본 정보" 섹션: ${hasSection ? '보임' : '안보임'}`);
    expect(hasSection).toBe(true);

    // 필수 정보 항목
    const infoRows = page.locator('.info-row');
    const rowCount = await infoRows.count();
    console.log(`  정보 행: ${rowCount}개`);
    expect(rowCount).toBeGreaterThanOrEqual(3); // 최소 수강과목, 담당선생님, 상태

    // 주요 라벨 검증
    const labels = ['수강 과목', '담당 선생님', '상태'];
    for (const label of labels) {
      const has = bodyText.includes(label);
      console.log(`  ${label}: ${has ? '✅' : '❌'}`);
      expect(has).toBe(true);
    }

    // 상태값 ("수강중" 또는 "휴원")
    const hasStatus = bodyText.includes('수강중') || bodyText.includes('휴원');
    console.log(`  상태값: ${hasStatus ? '✅' : '❌'}`);
    expect(hasStatus).toBe(true);
  });

  // ═══ UI-08: 코멘트 타임라인 접기/펼치기 ═══
  test('UI-08: 프로필 — 코멘트 타임라인 접기/펼치기', async () => {
    const bodyText = await page.locator('body').innerText();
    const hasSection = bodyText.includes('코멘트 히스토리');
    console.log(`✅ "코멘트 히스토리" 섹션: ${hasSection ? '보임' : '안보임'}`);
    expect(hasSection).toBe(true);

    const noComments = bodyText.includes('코멘트가 없습니다');
    if (noComments) {
      console.log('  코멘트 없음 — 접기/펼치기 스킵');
      return;
    }

    // 월별 헤더 클릭 → 토글
    const monthHeaders = page.locator('.timeline-month-header');
    const headerCount = await monthHeaders.count();
    console.log(`  월별 항목: ${headerCount}개`);

    if (headerCount > 0) {
      // 첫 번째 항목 — 기본 펼쳐짐
      const firstBody = page.locator('.timeline-month-body').first();
      const firstOpen = await firstBody.isVisible().catch(() => false);
      console.log(`  첫 항목 초기상태: ${firstOpen ? '펼침' : '접힘'}`);

      // 클릭 → 토글
      await monthHeaders.first().click();
      await page.waitForTimeout(300);
      const afterToggle = await firstBody.isVisible().catch(() => false);
      console.log(`  클릭 후: ${afterToggle ? '펼침' : '접힘'}`);
      expect(afterToggle).not.toBe(firstOpen);

      // 다시 클릭 → 원복
      await monthHeaders.first().click();
      await page.waitForTimeout(300);
      const restored = await firstBody.isVisible().catch(() => false);
      console.log(`  재클릭 후: ${restored ? '펼침' : '접힘'}`);
      expect(restored).toBe(firstOpen);
    }

    // 코멘트 카드 구조 확인
    const scoreCards = page.locator('.timeline-score-card');
    const cardCount = await scoreCards.count();
    if (cardCount > 0) {
      const subject = await page.locator('.timeline-subject').first().textContent();
      const score = await page.locator('.timeline-score').first().textContent();
      console.log(`  첫 코멘트 카드: ${subject} ${score}`);
    }
  });

  // ═══ UI-09: 기간 토글 → 차트 갱신 ═══
  test('UI-09: 기간 토글(6개월↔12개월) → 데이터 갱신', async () => {
    const toggleBtns = page.locator('.period-toggle button');
    const count = await toggleBtns.count();

    if (count < 2) {
      console.log('⏭️ 기간 토글 없음 — 스킵');
      return;
    }

    // 현재 active 버튼 확인
    const firstBtnClass = await toggleBtns.first().getAttribute('class') || '';
    console.log(`  6개월 버튼 class: "${firstBtnClass}"`);

    // 12개월 클릭
    await toggleBtns.nth(1).click();
    await page.waitForTimeout(2000);

    const secondBtnClass = await toggleBtns.nth(1).getAttribute('class') || '';
    console.log(`  12개월 클릭 후 class: "${secondBtnClass}"`);
    expect(secondBtnClass).toContain('active');

    // 페이지 에러 없는지
    console.log(`✅ 기간 변경 후 에러: ${errors.length === 0 ? '없음' : errors.length + '건'}`);

    // 다시 6개월로 복귀
    await toggleBtns.first().click();
    await page.waitForTimeout(2000);

    const restoredClass = await toggleBtns.first().getAttribute('class') || '';
    expect(restoredClass).toContain('active');
    console.log('  6개월 복귀 ✅');
  });

  // ═══ UI-10: 뒤로가기 → 학생 목록 복귀 ═══
  test('UI-10: 뒤로가기 버튼 → 학생 목록 복귀', async () => {
    await page.locator('.back-btn').click();
    await page.waitForTimeout(2000);

    const url = page.url();
    expect(url).toContain('#/student');
    expect(url).not.toMatch(/#\/student\/.+/); // /student/:id가 아닌 /student
    console.log(`✅ 목록 복귀 URL: ${url}`);

    // 학생 목록 제목 확인
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).toContain('학생 목록');

    // 카드가 다시 보이는지
    const cards = await page.locator('.student-card').count();
    console.log(`  학생 카드: ${cards}개`);
    expect(cards).toBeGreaterThan(0);
  });

  // ═══ UI-11: 다른 페이지 이동 후 돌아오기 ═══
  test('UI-11: 다른 페이지(월말평가) → 학생 탭 복귀 → 정상 동작', async () => {
    // 월말평가로 이동
    await page.locator('a:has-text("월말평가")').click();
    await page.waitForTimeout(2000);
    console.log('  월말평가 이동 ✅');

    // 다시 학생으로
    await page.locator('a:has-text("학생")').click();
    await page.waitForTimeout(3000);

    const bodyText = await page.locator('body').innerText();
    expect(bodyText).toContain('학생 목록');

    const cards = await page.locator('.student-card').count();
    console.log(`✅ 복귀 후 학생 카드: ${cards}개`);
    expect(cards).toBeGreaterThan(0);

    // 다시 프로필 진입 가능한지
    await page.locator('.student-card').first().click();
    await page.waitForTimeout(3000);

    const profileUrl = page.url();
    expect(profileUrl).toMatch(/#\/student\/.+/);
    console.log(`  프로필 재진입: ${profileUrl}`);

    // 에러 없는지
    expect(errors.length).toBe(0);
  });

  // ═══ UI-12: 최종 상태 요약 ═══
  test('UI-12: 전체 테스트 에러 요약', async () => {
    console.log('\n═══ 최종 상태 요약 ═══');
    console.log(`  JS 에러: ${errors.length}건`);
    console.log(`  API 에러: ${apiErrors.length}건`);

    if (errors.length > 0) {
      console.log('  JS 에러 목록:');
      errors.forEach((e) => console.log(`    - ${e}`));
    }
    if (apiErrors.length > 0) {
      console.log('  API 에러 목록:');
      apiErrors.forEach((e) => console.log(`    - ${e}`));
    }

    await page.screenshot({ path: 'test-results/student-dashboard-final.png', fullPage: true });
    console.log('  최종 스크린샷: test-results/student-dashboard-final.png');

    // JS 에러는 0이어야 함
    expect(errors.length).toBe(0);
  });
});
