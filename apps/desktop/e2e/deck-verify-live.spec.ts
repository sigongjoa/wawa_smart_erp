/**
 * 페인포인트 데크 시각 검증 — 슬라이드 몇 장을 실제로 렌더링해 스크린샷.
 */
import { test } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DECK = 'file://' + path.join(__dirname, '..', '..', '..', 'docs', 'wawa-pain-points-deck.html');
const OUT = path.join(__dirname, '..', '..', '..', 'docs', 'screenshots', 'deck-verify');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

test.use({ viewport: { width: 1600, height: 900 } });

test('deck visual verify', async ({ page }) => {
  await page.goto(DECK);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1200);

  await page.goto(DECK);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(800);
  const targets = [17, 18, 19, 20, 21];
  for (const s of targets) {
    // navigate by clicking dot directly
    await page.evaluate((idx) => {
      const dots = Array.from(document.querySelectorAll('#dots .dot')) as HTMLElement[];
      dots[idx - 1]?.click();
    }, s);
    await page.waitForTimeout(900);
    const info = await page.evaluate(() => {
      const a = document.querySelector('.slide.is-active') as HTMLElement | null;
      if (!a) return { idx: null };
      const r = a.getBoundingClientRect();
      const tag = a.querySelector('.uc-tag') as HTMLElement | null;
      const h2 = a.querySelector('h2') as HTMLElement | null;
      const flow = a.querySelector('.uc-flow') as HTMLElement | null;
      const tagR = tag?.getBoundingClientRect();
      const h2R = h2?.getBoundingClientRect();
      const flowR = flow?.getBoundingClientRect();
      return {
        slide: `${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)}`,
        tag: tagR ? `y=${Math.round(tagR.y)} ${Math.round(tagR.width)}x${Math.round(tagR.height)} vis=${tag!.offsetParent !== null}` : null,
        h2: h2R ? `y=${Math.round(h2R.y)} ${Math.round(h2R.width)}x${Math.round(h2R.height)}` : null,
        flow: flowR ? `y=${Math.round(flowR.y)} ${Math.round(flowR.width)}x${Math.round(flowR.height)}` : null,
      };
    });
    console.log(`  → #${s}`, JSON.stringify(info));
    await page.screenshot({ path: path.join(OUT, `slide-${String(s).padStart(2, '0')}.png`) });
    console.log(`  ✅ slide-${String(s).padStart(2, '0')}.png`);
  }
});
