/**
 * #112 student-learning audit — 320·375·480 캡처.
 * VocabExam·MedTerm·Gacha·Exam 페이지 (인증 없이 접근 가능한 라우트).
 */
import { test } from '@playwright/test';

const VIEWPORTS = [
  { name: '320', w: 320, h: 568 },
  { name: '375', w: 375, h: 667 },
  { name: '480', w: 480, h: 800 },
];

const PAGES = [
  { path: '/vocab/exam', name: 'vocab-exam' },
  { path: '/medterm', name: 'medterm' },
  { path: '/gacha', name: 'gacha' },
];

for (const vp of VIEWPORTS) {
  for (const pg of PAGES) {
    test(`${vp.name}-${pg.name}`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
      const p = await ctx.newPage();
      await p.goto(pg.path).catch(() => {});
      await p.waitForTimeout(1000);
      await p.screenshot({
        path: `../../design/audits/2026-05-design-round-1/screenshots/student-learning/${pg.name}-${vp.name}.png`,
        fullPage: true,
      });
      await ctx.close();
    });
  }
}
