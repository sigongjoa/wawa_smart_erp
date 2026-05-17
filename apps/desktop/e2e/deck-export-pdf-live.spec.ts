/**
 * 데크 21장을 고해상도 PNG로 캡처 → PDF 변환을 위한 입력 생성.
 * 결과: docs/screenshots/deck-pdf/slide-NN.png  (1920×1080)
 */
import { test } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DECK = 'file://' + path.join(__dirname, '..', '..', '..', 'docs', 'wawa-pain-points-deck.html');
const OUT = path.join(__dirname, '..', '..', '..', 'docs', 'screenshots', 'deck-pdf');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const TOTAL = 21;
// 16:9 high-res capture
test.use({ viewport: { width: 1920, height: 1080 } });

test('export all slides for PDF', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto(DECK);
  await page.waitForLoadState('domcontentloaded');
  // 폰트 로딩 + dot 빌드 대기
  await page.waitForFunction(() => document.querySelectorAll('#dots .dot').length >= 21, null, { timeout: 10000 });
  await page.waitForTimeout(1500);

  // 캡처 시 네비게이션 UI 숨김 (PDF용 깨끗한 슬라이드)
  await page.addStyleTag({ content: '.nav { display: none !important; }' });

  // deck 박스를 정확히 클립하기 위해 좌표 측정
  for (let n = 1; n <= TOTAL; n++) {
    await page.evaluate((idx) => {
      const dots = Array.from(document.querySelectorAll('#dots .dot')) as HTMLElement[];
      dots[idx - 1]?.click();
    }, n);
    await page.waitForTimeout(700);

    const box = await page.evaluate(() => {
      const d = document.querySelector('.deck') as HTMLElement | null;
      if (!d) return null;
      const r = d.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) };
    });
    if (!box) throw new Error('deck box missing');
    await page.screenshot({
      path: path.join(OUT, `slide-${String(n).padStart(2, '0')}.png`),
      clip: box,
    });
    console.log(`  ✅ slide-${String(n).padStart(2, '0')}.png  (${box.width}×${box.height})`);
  }
});
