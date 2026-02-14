import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const SCREENSHOT_DIR = path.join(__dirname, '../e2e-screenshots');
const CONFIG_PATH = '/mnt/d/progress/wawa_smart_erp/notion_config.json';

test('verify unified search with chosung', async ({ page }) => {
    test.setTimeout(180000); // 3 minutes

    // Verbose logging
    page.on('console', msg => console.log(`BROWSER [${msg.type()}]: ${msg.text()}`));
    page.on('pageerror', err => console.log(`BROWSER ERROR: ${err.message}`));

    // 1. Open App
    console.log('Opening App...');
    await page.goto('http://localhost:5173');
    await page.waitForTimeout(3000);

    // Initial setup if needed
    const uploadArea = page.locator('text=시스템 초기 설정');
    if (await uploadArea.isVisible({ timeout: 5000 }).catch(() => false)) {
        console.log('→ Uploading config...');
        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles(CONFIG_PATH);
        await page.waitForTimeout(10000); // Give plenty of time for Notion fetch
    }

    // 3. Login
    console.log('Checking for login screen...');
    const loginTitle = page.locator('text=WAWA ERP 로그인');
    await expect(loginTitle).toBeVisible({ timeout: 60000 });

    const teacherSelect = page.locator('select').first();
    await teacherSelect.waitFor({ state: 'visible', timeout: 30000 });

    console.log('Polling for "서재용" teacher option...');
    let targetValue = '';
    for (let i = 0; i < 60; i++) {
        const options = await teacherSelect.locator('option').evaluateAll(opts =>
            opts.map(o => ({ text: o.textContent?.trim(), value: o.value }))
        );
        const match = options.find(o => o.text && o.text.includes('서재용'));
        if (match) {
            targetValue = match.value;
            console.log(`✅ Found teacher match: "${match.text}" with value "${match.value}"`);
            break;
        }
        if (i % 5 === 0) console.log(`Waiting... Current options: ${options.map(o => o.text).join(', ')}`);
        await page.waitForTimeout(1000);
    }

    if (!targetValue) throw new Error('Teacher "서재용" not found in dropdown after 60s');

    console.log(`Selecting teacher value "${targetValue}" and entering PIN...`);
    await teacherSelect.selectOption(targetValue);
    await page.fill('input[type="password"]', '1141');

    const loginButton = page.locator('button:has-text("접속하기")');
    await loginButton.click();

    // Check for error toasts
    const toast = page.locator('div[style*="background: rgb(239, 68, 68)"], div[style*="background: #ef4444"]');
    if (await toast.isVisible({ timeout: 5000 }).catch(() => false)) {
        const msg = await toast.innerText();
        console.log(`❌ LOGIN ERROR TOAST DETECTED: "${msg}"`);
    }

    // Verify login success
    console.log('Waiting for sidebar...');
    await expect(page.locator('.sidebar')).toBeVisible({ timeout: 30000 });

    if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01_login_success.png') });

    // 4. Navigate to Student List
    console.log('Navigating to Student Management...');
    await page.click('nav >> text=학생관리');
    await page.waitForTimeout(5000);

    // 5. Test Chosung Search for "정지효" (ㅈㅈㅎ)
    const searchInput = page.locator('input[placeholder*="검색"]').first();

    console.log('Testing Chosung search: ㅈㅈㅎ');
    await searchInput.fill('ㅈㅈㅎ');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02_student_search_chosung.png') });
    await expect(page.locator('tbody')).toContainText('정지효');

    // Search by Prefix
    console.log('Testing Prefix search: 정지');
    await searchInput.clear();
    await searchInput.fill('정지');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03_student_search_prefix.png') });
    await expect(page.locator('tbody')).toContainText('정지효');

    // 6. Navigate to Pending Makeup
    console.log('Navigating to Pending Makeup...');
    await page.click('nav.header-nav >> text=보강관리');
    await page.waitForTimeout(2000);
    await page.click('.sidebar-nav >> text=대기 중');
    await page.waitForTimeout(5000);

    // Search by Chosung in Makeup
    const makeupSearch = page.locator('input[placeholder*="검색"]').first();
    console.log('Testing Makeup Chosung search: ㅈㅈㅎ');
    await makeupSearch.fill('ㅈㅈㅎ');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04_makeup_search_chosung.png') });
    await expect(page.locator('tbody')).toContainText('정지효');

    console.log('Verification COMPLETE.');
});
