/**
 * 모바일 320px (iPhone SE 1세대) 뷰포트에서 학생 앱 핵심 페이지 스크린샷.
 * audit P0: AssignmentDetail / MedTerm / VocabExam / Gacha — @media 0건이라
 * 320px에서 가로 스크롤·잘림 발생 가능성 검증.
 *
 * 결과는 design/audits/2026-05-design-round-1/screenshots/mobile-320/ 에 저장.
 */
import { test, expect } from '@playwright/test';

test.use({
  viewport: { width: 320, height: 568 },  // iPhone SE 1세대
  deviceScaleFactor: 2,
});

const PAGES = [
  { path: '/', name: '00-home' },
  { path: '/login', name: '01-login' },
  { path: '/assignments', name: '02-assignments-list' },
  { path: '/medterm', name: '04-medterm' },
  { path: '/vocab/exam', name: '05-vocab-exam' },
  { path: '/gacha', name: '06-gacha' },
];

for (const page of PAGES) {
  test(`mobile-320 ${page.name}`, async ({ page: p }) => {
    await p.goto(page.path).catch(() => {});
    await p.waitForTimeout(800);
    // 가로 스크롤 발생 여부 체크 — body 너비가 viewport 초과 시 fail
    const overflowX = await p.evaluate(() => {
      const body = document.body;
      const html = document.documentElement;
      return Math.max(body.scrollWidth, html.scrollWidth) - window.innerWidth;
    });
    await p.screenshot({
      path: `../../design/audits/2026-05-design-round-1/screenshots/mobile-320/${page.name}.png`,
      fullPage: true,
    });
    // 가로 스크롤 발생 시 경고 (실패는 아님 — 캡처 위주)
    if (overflowX > 0) {
      console.warn(`[mobile-320] ${page.name}: 가로 overflow ${overflowX}px`);
    }
    expect(overflowX).toBeLessThanOrEqual(8); // 8px 허용 (서브픽셀 반올림)
  });
}
