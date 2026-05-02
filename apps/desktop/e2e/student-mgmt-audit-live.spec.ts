/**
 * #114 desktop-student-mgmt audit — 1024·768·375 캡처.
 * 인증 게이트가 있어 스크린샷은 비로그인 redirect 화면 + 페이지별.
 */
import { test } from '@playwright/test';

const VIEWPORTS = [
  { name: '1024', w: 1024, h: 768 },
  { name: '768', w: 768, h: 1024 },
  { name: '375', w: 375, h: 812 },
];

const PAGES = [
  { path: '/students', name: 'student-list' },
  { path: '/homeroom', name: 'homeroom' },
  { path: '/homeroom/consultations', name: 'consultations' },
  { path: '/homeroom/exams', name: 'exams' },
  { path: '/homeroom/follow-ups', name: 'follow-ups' },
];

for (const vp of VIEWPORTS) {
  for (const pg of PAGES) {
    test(`${vp.name}-${pg.name}`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
      const p = await ctx.newPage();
      await p.goto(pg.path).catch(() => {});
      await p.waitForTimeout(800);
      await p.screenshot({
        path: `../../design/audits/2026-05-design-round-1/screenshots/desktop-student-mgmt/${pg.name}-${vp.name}.png`,
        fullPage: true,
      });
      await ctx.close();
    });
  }
}
