import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const CONFIG_PATH = '/mnt/d/progress/wawa_smart_erp/notion_config.json';
const SCREENSHOT_DIR = path.join(__dirname, '../e2e-screenshots');

test('diagnostic: verbose list teachers', async ({ page }) => {
    // Pipe browser console to terminal
    page.on('console', msg => console.log(`BROWSER: ${msg.text()}`));
    page.on('pageerror', err => console.log(`BROWSER ERROR: ${err.message}`));

    await page.goto('http://localhost:5173');
    await page.waitForTimeout(2000);

    // Initial setup if needed
    const uploadArea = page.locator('text=시스템 초기 설정');
    if (await uploadArea.isVisible({ timeout: 5000 }).catch(() => false)) {
        console.log('→ Uploading config...');
        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles(CONFIG_PATH);
        await page.waitForTimeout(5000);
    }

    const teacherSelect = page.locator('select').first();
    await teacherSelect.waitFor({ state: 'visible', timeout: 30000 });

    console.log('Clicking select dropdown to ensure focus/activation...');
    await teacherSelect.click();
    await page.waitForTimeout(2000);

    console.log('Polling for teacher options...');
    for (let i = 0; i < 60; i++) {
        const options = await teacherSelect.locator('option').evaluateAll(opts =>
            opts.map(o => o.textContent?.trim()).filter(Boolean)
        );
        console.log(`[T+${i}s] Options (${options.length}): ${options.join(', ')}`);

        if (options.some(opt => opt.includes('서재용'))) {
            console.log('✅ Found "서재용"!');
            break;
        }
        await page.waitForTimeout(1000);
    }

    if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '00_verbose_diagnostic.png') });
});
