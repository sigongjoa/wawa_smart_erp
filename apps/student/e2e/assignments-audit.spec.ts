/**
 * #113 student-assignments audit — 320·375·480 캡처.
 */
import { test } from '@playwright/test';

const VIEWPORTS = [
  { name: '320', w: 320, h: 568 },
  { name: '375', w: 375, h: 667 },
  { name: '480', w: 480, h: 800 },
];

const PAGES = [
  { path: '/assignments', name: 'list' },
];

for (const vp of VIEWPORTS) {
  for (const pg of PAGES) {
    test(`${vp.name}-${pg.name}`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
      const p = await ctx.newPage();
      await p.goto(pg.path).catch(() => {});
      await p.waitForTimeout(1000);
      await p.screenshot({
        path: `../../design/audits/2026-05-design-round-1/screenshots/student-assignments/${pg.name}-${vp.name}.png`,
        fullPage: true,
      });
      await ctx.close();
    });
  }
}
