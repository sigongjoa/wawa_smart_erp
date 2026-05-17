/**
 * Pitch-deck screenshot capture — runs against production.
 *
 *   npx playwright test apps/desktop/e2e/pitch-deck-screenshots.spec.ts
 *
 * Outputs to /mnt/g/vine_academy/wawa_smart_erp/claudedocs/pitch-deck/img/
 *
 * Two suites:
 *   1) Desktop (강사) — 서재용 / 1141 / alpha academy
 *   2) Student (모바일) — 서재용 / 1234
 */
import { test, expect } from '@playwright/test';
import path from 'node:path';

const OUT = '/mnt/g/vine_academy/wawa_smart_erp/claudedocs/pitch-deck/img';
const DESKTOP_BASE = 'https://wawa-smart-erp.pages.dev';
const STUDENT_BASE = 'https://wawa-learn.pages.dev';

const desktopShot = (name: string) => path.join(OUT, `desktop-${name}.png`);
const studentShot = (name: string) => path.join(OUT, `student-${name}.png`);

test.setTimeout(120_000);

test.describe('Desktop (강사) — 서재용 / 1141', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('login and capture pages', async ({ page }) => {
    await page.goto(DESKTOP_BASE, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    // wait for academy options
    await page.waitForFunction(() => {
      const opts = document.querySelectorAll('#login-academy option');
      return opts.length > 1;
    }, { timeout: 15_000 });

    await page.locator('#login-academy').selectOption('alpha');
    await page.waitForTimeout(800);
    await page.fill('#login-name', '서재용');
    await page.fill('#login-pin', '1141');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(4000);

    // Verify logged in by URL change (away from /login)
    const afterUrl = page.url();
    console.log('[DESKTOP] After login URL:', afterUrl);

    // ── Capture key teacher pages ──
    const targets: Array<{ name: string; hash: string; wait?: number }> = [
      { name: 'homeroom',     hash: '#/homeroom',     wait: 2500 },
      { name: 'student-list', hash: '#/students',     wait: 2000 },
      { name: 'timer',        hash: '#/timer',        wait: 2000 },
      { name: 'report',       hash: '#/parent-report',wait: 2000 },
      { name: 'gacha-cards',  hash: '#/gacha/cards',  wait: 2000 },
      { name: 'gacha-dash',   hash: '#/gacha',        wait: 2000 },
      { name: 'vocab-admin',  hash: '#/vocab',        wait: 2500 },
      { name: 'exam-mgmt',    hash: '#/exam-management', wait: 2000 },
      { name: 'medterm-admin',hash: '#/medterm',      wait: 2500 },
      { name: 'absence',      hash: '#/absence',      wait: 2000 },
      { name: 'assignments',  hash: '#/assignments',  wait: 2000 },
      { name: 'settings',     hash: '#/settings',     wait: 1500 },
    ];

    for (const t of targets) {
      try {
        await page.goto(`${DESKTOP_BASE}/${t.hash}`, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(t.wait ?? 2000);
        await page.screenshot({ path: desktopShot(t.name), fullPage: false });
        console.log(`[DESKTOP] ✓ ${t.name}`);
      } catch (e) {
        console.log(`[DESKTOP] ✗ ${t.name}:`, (e as Error).message);
      }
    }
  });
});

test.describe('Student (모바일) — 서재용 / 1234', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('login and capture pages', async ({ page }) => {
    // Token-injection auth (bypass UI form) — pattern from screenshot-ask-ai-auth.spec.ts
    const API = 'https://wawa-smart-erp-api-production.zeskywa499.workers.dev';
    const res = await fetch(`${API}/api/play/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ academy_slug: 'alpha', name: '서재용', pin: '1234' }),
    });
    const body: any = await res.json();
    if (!body.success) throw new Error('Student login failed: ' + JSON.stringify(body));
    const { token, student } = body.data;
    console.log('[STUDENT] Got token for:', student?.name);

    await page.addInitScript(({ token, student }) => {
      localStorage.setItem('play_token', token);
      localStorage.setItem('play_token_created_at', String(Date.now()));
      localStorage.setItem('play_student', JSON.stringify(student));
      localStorage.setItem('play_slug', 'alpha');
    }, { token, student });

    await page.goto(`${STUDENT_BASE}/#/`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    console.log('[STUDENT] After token inject URL:', page.url());

    // ── Capture key student pages ──
    const targets: Array<{ name: string; hash: string; wait?: number }> = [
      { name: 'home',         hash: '#/',           wait: 2500 },
      { name: 'ask-ai-hub',   hash: '#/ask-ai',     wait: 2500 },
      { name: 'ask-ai-write', hash: '#/ask-ai/write', wait: 2000 },
      { name: 'vocab-exam',   hash: '#/vocab',      wait: 2500 },
      { name: 'gacha',        hash: '#/gacha',      wait: 2500 },
      { name: 'dex',          hash: '#/dex',        wait: 2000 },
      { name: 'baseball',     hash: '#/baseball',   wait: 2500 },
      { name: 'medterm',      hash: '#/medterm',    wait: 2500 },
      { name: 'medterm-exams',hash: '#/medterm/exams', wait: 2500 },
      { name: 'writing-draft',hash: '#/writing/draft', wait: 2000 },
      { name: 'proof',        hash: '#/proof',      wait: 2000 },
      { name: 'me',           hash: '#/me',         wait: 1500 },
      { name: 'assignments',  hash: '#/assignments',wait: 2000 },
    ];

    for (const t of targets) {
      try {
        await page.goto(`${STUDENT_BASE}/${t.hash}`, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(t.wait ?? 2000);
        await page.screenshot({ path: studentShot(t.name), fullPage: false });
        console.log(`[STUDENT] ✓ ${t.name}`);
      } catch (e) {
        console.log(`[STUDENT] ✗ ${t.name}:`, (e as Error).message);
      }
    }
  });
});
