/**
 * #115 desktop-learning-content audit — 1024·768·375 캡처.
 */
import { test } from '@playwright/test';

const VIEWPORTS = [
  { name: '1024', w: 1024, h: 768 },
  { name: '768', w: 768, h: 1024 },
  { name: '375', w: 375, h: 812 },
];

const PAGES = [
  { path: '/vocab/words', name: 'vocab-words' },
  { path: '/vocab/grade', name: 'vocab-grade' },
  { path: '/exams', name: 'exams' },
  { path: '/curriculum', name: 'curriculum' },
];

for (const vp of VIEWPORTS) {
  for (const pg of PAGES) {
    test(`${vp.name}-${pg.name}`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
      const p = await ctx.newPage();
      await p.goto(pg.path).catch(() => {});
      await p.waitForTimeout(800);
      await p.screenshot({
        path: `../../design/audits/2026-05-design-round-1/screenshots/desktop-learning-content/${pg.name}-${vp.name}.png`,
        fullPage: true,
      });
      await ctx.close();
    });
  }
}
