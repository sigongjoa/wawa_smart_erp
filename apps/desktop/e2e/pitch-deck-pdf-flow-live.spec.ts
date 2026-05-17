/**
 * Generate per-slide PNGs from the local pitch-deck server (5181).
 * Output to claudedocs/pitch-deck/slides/<NN>-<source>-<slide>.png
 *
 *   npx playwright test e2e/pitch-deck-pdf-live.spec.ts
 *
 * Then combine via:
 *   img2pdf claudedocs/pitch-deck/slides/*.png \
 *     --output claudedocs/pitch-deck/wawa-edutech-stack.pdf \
 *     --pagesize 1280pxx720px
 */
import { test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const SLIDE_W = 1280;
const SLIDE_H = 720;
const BASE = 'http://localhost:5181';
const OUT = '/mnt/g/vine_academy/wawa_smart_erp/claudedocs/pitch-deck/slides';

// Order matters — defines final PDF order
const FILES = [
  'index',      // 11 slides
  'erp',        // 4
  'askai',      // 6
  'proof',      // 4
  'english',    // 4
  'vocab',      // 4
  'tutorflow',  // 5
  'perfeval',   // 3
];

test.describe.configure({ mode: 'serial' });

test('Capture every slide → numbered PNGs', async ({ browser }) => {
  test.setTimeout(300_000);
  fs.mkdirSync(OUT, { recursive: true });

  const ctx = await browser.newContext({
    viewport: { width: SLIDE_W + 40, height: SLIDE_H + 40 },
    deviceScaleFactor: 2,  // crisp output for PDF
  });
  const page = await ctx.newPage();

  let pageNo = 0;

  for (const file of FILES) {
    const url = `${BASE}/${file}.html`;
    console.log(`\n[${file}] loading ${url}`);
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);

    // Wait for fonts to fully load
    await page.evaluate(() => (document as any).fonts?.ready);

    const frames = page.locator('.frame .slide');
    const count = await frames.count();
    console.log(`[${file}] ${count} slides`);

    for (let i = 0; i < count; i++) {
      pageNo++;
      const slide = frames.nth(i);
      // Scroll the slide into view to ensure proper layout
      await slide.scrollIntoViewIfNeeded();
      await page.waitForTimeout(150);

      const fname = `${String(pageNo).padStart(2, '0')}-${file}-${String(i + 1).padStart(2, '0')}.png`;
      const out = path.join(OUT, fname);
      // Element screenshot — captures exactly the .slide box at native size
      await slide.screenshot({ path: out, type: 'png' });
      console.log(`  ✓ ${fname}`);
    }
  }

  console.log(`\nTotal: ${pageNo} pages → ${OUT}`);
  await ctx.close();
});
