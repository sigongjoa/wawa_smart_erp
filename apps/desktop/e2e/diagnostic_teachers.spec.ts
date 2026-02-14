import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const CONFIG_PATH = '/mnt/d/progress/wawa_smart_erp/notion_config.json';
const SCREENSHOT_DIR = path.join(__dirname, '../e2e-screenshots');

test('diagnostic: list all teacher options', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.waitForTimeout(2000);

    // Upload config if screen is visible
    const uploadArea = page.locator('text=시스템 초기 설정');
    if (await uploadArea.isVisible({ timeout: 5000 }).catch(() => false)) {
        console.log('→ Config upload screen detected');
        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles(CONFIG_PATH);
        await page.waitForTimeout(5000);
    }

    const teacherSelect = page.locator('select').first();
    await teacherSelect.waitFor({ state: 'visible', timeout: 30000 });

    // Wait for options to load
    await page.waitForFunction(() => {
        const select = document.querySelector('select');
        return select && select.options.length > 1;
    }, { timeout: 30000 });

    const options = await teacherSelect.locator('option').evaluateAll(opts =>
        opts.map(o => ({ text: o.textContent?.trim(), value: o.value, isVisible: o.offsetParent !== null }))
    );

    console.log('--- DETAILED TEACHER LIST ---');
    options.forEach((opt, i) => {
        console.log(`[${i}] Text: "${opt.text}", Value: "${opt.value}", Visible: ${opt.isVisible}`);
    });
    console.log('-----------------------------');

    if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '00_diagnostic_teachers.png') });
});
