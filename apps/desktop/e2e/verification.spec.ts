import { test, expect } from '@playwright/test';
import path from 'path';

test('verify integrated exam management UI', async ({ page }) => {
    // Mirror browser logs
    page.on('console', msg => console.log(`BROWSER [${msg.type()}] ${msg.text()}`));

    // 1. Home
    await page.goto('http://127.0.0.1:5173');

    // 2. Handle Setup (if needed)
    if (await page.locator('text=시스템 초기 설정').isVisible()) {
        console.log('📝 Handling System Initial Setup...');
        const configPath = '/mnt/d/progress/wawa_smart_erp/notion_config.json';
        const fileChooserPromise = page.waitForEvent('filechooser');
        await page.click('.upload-zone');
        const fileChooser = await fileChooserPromise;
        await fileChooser.setFiles(configPath);
        await page.waitForSelector('select.search-input', { timeout: 30000 });
    }

    // 3. Login
    await page.waitForSelector('select.search-input', { timeout: 10000 });
    await page.selectOption('select.search-input', { label: '서재용 개발자' });
    await page.fill('input[type="password"]', '1141');
    await page.click('button.btn-primary');
    await page.waitForURL('**/#/**', { timeout: 10000 });

    // A. Verify Dashboard
    console.log('🚀 Navigating to Dashboard...');
    await page.goto('http://127.0.0.1:5173/#/report');
    await page.waitForSelector('text=이번 달 시험 현황', { timeout: 15000 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: '/root/.gemini/antigravity/brain/d7e5bfb3-0fd4-40af-a5f8-f55a1b9cd019/verify_dashboard_integrated.png', fullPage: true });
    console.log('📸 Dashboard screenshot captured.');

    // B. Verify Exams - Schedules Tab
    console.log('🚀 Navigating to Exams (Schedules)...');
    await page.goto('http://127.0.0.1:5173/#/report/exams');
    await page.waitForSelector('[data-testid="tab-schedules"]', { timeout: 15000 });
    await page.waitForSelector('.data-table', { timeout: 15000 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: '/root/.gemini/antigravity/brain/d7e5bfb3-0fd4-40af-a5f8-f55a1b9cd019/verify_exams_schedules.png', fullPage: true });
    console.log('📸 Exams (Schedules) screenshot captured.');

    // C. Verify Exams - Templates Tab
    console.log('🚀 Switching to Templates Tab...');
    await page.click('[data-testid="tab-templates"]');
    await page.waitForSelector('[data-testid="templates-grid"]', { timeout: 15000 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: '/root/.gemini/antigravity/brain/d7e5bfb3-0fd4-40af-a5f8-f55a1b9cd019/verify_exams_templates.png', fullPage: true });
    console.log('📸 Exams (Templates) screenshot captured.');

    // D. Verify Input Page
    console.log('🚀 Navigating to Grades Input...');
    await page.goto('http://127.0.0.1:5173/#/report/input');
    await page.waitForSelector('text=성적 입력', { timeout: 15000 });

    // Click first student if available
    const studentItem = page.locator('.card div[style*="cursor: pointer"]').first();
    if (await studentItem.isVisible()) {
        await studentItem.click();
        // Look for the "시험일:" span added earlier
        await page.waitForSelector('text=시험일:', { timeout: 15000 });
        await page.waitForTimeout(1000);
        await page.screenshot({ path: '/root/.gemini/antigravity/brain/d7e5bfb3-0fd4-40af-a5f8-f55a1b9cd019/verify_input_with_date.png', fullPage: true });
        console.log('📸 Input page screenshot captured.');
    }

    console.log('✅ Integrated UI Verification Successful');
});
