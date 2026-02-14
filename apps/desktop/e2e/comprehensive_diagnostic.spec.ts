import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const SCREENSHOT_DIR = path.join(__dirname, '../e2e-screenshots');
const CONFIG_PATH = '/mnt/d/progress/wawa_smart_erp/notion_config.json';

test('diagnostic: login and list navigation', async ({ page }) => {
    // Pipe browser console to terminal
    page.on('console', msg => console.log(`BROWSER [${msg.type()}]: ${msg.text()}`));
    page.on('pageerror', err => console.log(`BROWSER ERROR: ${err.message}`));

    await page.goto('http://localhost:5173');
    await page.waitForTimeout(3000);

    // 1. Initial setup if needed
    const uploadArea = page.locator('text=시스템 초기 설정');
    if (await uploadArea.isVisible({ timeout: 5000 }).catch(() => false)) {
        console.log('→ Uploading config...');
        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles(CONFIG_PATH);
        await page.waitForTimeout(10000);
    }

    // 2. Login
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
        await page.waitForTimeout(1000);
    }

    if (!targetValue) throw new Error('Teacher "서재용" not found');

    await teacherSelect.selectOption(targetValue);
    await page.fill('input[type="password"]', '1141');
    await page.click('button:has-text("접속하기")');

    // 3. Inspect Navigation after Login
    console.log('Waiting for sidebar or dashboard...');
    await page.waitForTimeout(5000);

    const headerLinks = await page.locator('.header-nav .header-nav-item span:not(.material-symbols-outlined)').allInnerTexts();
    console.log(`HEADER LINKS: ${headerLinks.join(', ')}`);

    const sidebarLinks = await page.locator('.sidebar-nav .sidebar-item-label').allInnerTexts();
    console.log(`SIDEBAR LINKS: ${sidebarLinks.join(', ')}`);

    if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'diagnostic_after_login.png') });

    // 4. Try to navigate to student management if it exists
    if (headerLinks.includes('학생관리')) {
        console.log('Navigating to 학생관리...');
        await page.click('nav.header-nav >> text=학생관리');
        await page.waitForTimeout(5000);
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'diagnostic_student_list.png') });

        // Final search verification in this diagnostic
        const searchInput = page.locator('input[placeholder*="검색"]').first();
        if (await searchInput.isVisible()) {
            console.log('Search input found! Searching for "ㅈㅈㅎ"...');
            await searchInput.fill('ㅈㅈㅎ');
            await page.waitForTimeout(3000);
            await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'diagnostic_search_results.png') });
            const tbodyText = await page.locator('tbody').innerText();
            console.log(`TBODY CONTENT: ${tbodyText.substring(0, 100)}...`);
        }
    } else {
        console.warn('WARNING: "학생관리" not found in header navigation!');
    }
});
