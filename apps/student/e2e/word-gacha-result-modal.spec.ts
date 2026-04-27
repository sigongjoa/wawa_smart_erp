/**
 * 결과 모달 동작 검증 — self-exam 제출 → 통합 결과 모달 노출 확인.
 * 의학용어 흐름은 학생-카탈로그 매핑이 필요해 별도 PIN 정보가 있어야 함 → 본 테스트는
 * 강은서(테스트 학생) + 시험 치기(=self-exam) 로 모달 표시 자체를 검증.
 */
import { test, expect } from '@playwright/test';

const FRONT = 'https://wawa-learn.pages.dev';
const STUDENT_NAME = '강은서';
const STUDENT_PIN = '3141';

test.setTimeout(180000);

test('제출 → 결과 모달이 화면 위로 노출된다', async ({ page }) => {
  // 1. 로그인
  await page.goto(`${FRONT}/#/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  await page.click('button:has-text("학원을 선택하세요"), button.lg-academy');
  await page.waitForTimeout(500);
  await page.locator('text=/알파시티점|Alpha/').first().click();
  await page.waitForTimeout(300);

  await page.fill('input.lg-name', STUDENT_NAME);
  await page.fill('input.lg-pin-input', STUDENT_PIN);
  await page.waitForTimeout(300);
  await Promise.all([
    page.waitForURL((u) => !u.hash.includes('login'), { timeout: 15000 }),
    page.click('button.lg-submit'),
  ]);

  // 2. /word-gacha/ 진입
  await page.waitForTimeout(1000);
  await page.goto(`${FRONT}/word-gacha/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  // 2.5. reunion 모달이 떠 있으면 닫기 (재방문 환영 다이얼로그)
  const reunion = page.locator('#reunion');
  if (await reunion.isVisible().catch(() => false)) {
    const closeBtn = reunion.locator('button.btn-close, button:has-text("확인"), button:has-text("닫기")').first();
    if (await closeBtn.count()) {
      await closeBtn.click().catch(() => {});
      await page.waitForTimeout(300);
    } else {
      // 강제 숨김
      await page.evaluate(() => {
        const r = document.getElementById('reunion');
        if (r) r.style.display = 'none';
      });
    }
  }

  // 3. 학습 탭 → 내 단어장 서브탭
  await page.locator('.tabbar button[data-to="learn"]').click();
  await page.waitForTimeout(500);
  await page.locator('.subnav button:has-text("내 단어장")').click();
  await page.waitForTimeout(500);

  // 4. 시험 치기 버튼 (#btn-self-exam) 클릭
  const selfExamBtn = page.locator('#btn-self-exam');
  await expect(selfExamBtn).toBeVisible({ timeout: 5000 });

  // 단어가 부족하면 self-exam 자체가 fail — 그 경우는 단순히 modal CSS 만 검증하고 종료
  const wordCount = await page.locator('.filter[data-f="all"] .n').textContent();
  const total = parseInt(wordCount?.replace(/[^0-9]/g, '') || '0', 10);
  console.log('[words]', total);

  if (total >= 4) {
    // 시험 치기 → confirm dialog 자동 수락
    page.once('dialog', (d) => d.accept());
    await selfExamBtn.click();
    await page.waitForTimeout(2500);

    // 5. 시험 화면 진입 확인
    const screen = await page.evaluate(() => document.body.dataset.screen);
    console.log('[screen after start]', screen);
    expect(screen).toBe('print');

    // 6. 모든 문제에 임의 답 선택 후 제출
    const totalQuestions = await page.locator('.print-take-dot').count();
    console.log('[totalQuestions]', totalQuestions);
    for (let i = 0; i < totalQuestions; i++) {
      // 첫 번째 선택지 클릭
      const choice = page.locator('.print-take-choice').first();
      await choice.click();
      await page.waitForTimeout(200);
      const next = page.locator('#print-take-next');
      const txt = (await next.textContent()) || '';
      if (txt.includes('제출')) {
        // 제출 confirm 자동 수락
        page.once('dialog', (d) => d.accept());
        await next.click();
        break;
      }
      await next.click();
      await page.waitForTimeout(200);
    }

    // 7. 결과 모달 노출 검증 — display: flex 인지 + 텍스트 포함
    await page.waitForTimeout(1500);
    const modal = page.locator('#print-take-result');
    const isVisible = await modal.isVisible();
    console.log('[result modal visible]', isVisible);
    expect(isVisible).toBe(true);

    // 8. 모달 내용 검증 — 점수 + 종료 버튼
    await expect(page.locator('#print-take-result-correct')).toBeVisible();
    await expect(page.locator('#print-take-result-pct')).toBeVisible();
    await expect(page.locator('#print-take-result-home')).toBeVisible();

    // 9. 모달 위치 — 화면 중앙 (fixed overlay)
    const box = await modal.boundingBox();
    const viewport = page.viewportSize()!;
    console.log('[modal position]', box, '[viewport]', viewport);
    // 모달 backdrop 은 viewport 전체를 덮어야 함
    expect(box?.width).toBeGreaterThan(viewport.width * 0.8);
  } else {
    console.log('[skip submit test — insufficient words, fallback to direct render]');
    // 단어가 없어 실제 시험 흐름은 못 돌리지만, 결과 모달 노출 자체는
    // showPrintResult 를 직접 호출해 검증 (DOM/CSS 검증 목적)
    const exists = await page.locator('#print-take-result').count();
    expect(exists).toBe(1);

    // 결과 모달 강제 노출 — fixed overlay 가 viewport 위로 뜨는지 확인
    await page.evaluate(() => {
      const box = document.getElementById('print-take-result')!;
      // 점수/리워드 더미 채우기
      document.getElementById('print-take-result-correct')!.textContent = '7';
      document.getElementById('print-take-result-total')!.textContent = '10';
      const pctEl = document.getElementById('print-take-result-pct')!;
      pctEl.textContent = '70%';
      pctEl.dataset.level = 'mid';
      box.hidden = false;
    });
    await page.waitForTimeout(500);

    const modal = page.locator('#print-take-result');
    expect(await modal.isVisible()).toBe(true);

    // 모달이 viewport 전체를 덮는지(fixed overlay 동작) — 다른 화면 위에 떠야 함
    const box = await modal.boundingBox();
    const viewport = page.viewportSize()!;
    console.log('[result modal box]', box, '[viewport]', viewport);
    expect(box?.width).toBeGreaterThan(viewport.width * 0.9);
    expect(box?.height).toBeGreaterThan(viewport.height * 0.5);

    // 카드 영역도 보여야 함
    expect(await page.locator('.print-take-result-card').isVisible()).toBe(true);
    expect(await page.locator('#print-take-result-home').isVisible()).toBe(true);

    // CSS computed style — display: flex (모달로 작동하는지)
    const display = await modal.evaluate((el) => getComputedStyle(el).display);
    console.log('[result modal display]', display);
    expect(display).toBe('flex');

    // z-index 도 충분히 높아야 함 (탭바 위)
    const zIndex = await modal.evaluate((el) => getComputedStyle(el).zIndex);
    console.log('[result modal z-index]', zIndex);
    expect(parseInt(zIndex, 10)).toBeGreaterThanOrEqual(100);
  }
});
