import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test('capture web screenshots', async ({ page }) => {
    const configPath = path.join(__dirname, '../../../notion_config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    console.log('Setting localStorage...');
    await page.addInitScript((config) => {
        const settings = {
            notionApiKey: config.notionApiKey,
            notionTeachersDb: config.notionTeachersDb,
            notionStudentsDb: config.notionStudentsDb,
            notionScoresDb: config.notionScoresDb,
            notionExamScheduleDb: config.notionExamScheduleDb,
            notionEnrollmentDb: config.notionEnrollmentDb,
            notionMakeupDb: config.notionMakeupDb,
            notionDmMessagesDb: config.notionDmMessagesDb,
        };
        localStorage.setItem('wawa-report-storage', JSON.stringify({
            state: {
                appSettings: settings,
                currentUser: { teacher: { id: '2f973635-f415-8085-8f51-dc1615f53667', name: '서재용' } },
                currentYearMonth: '2026-02'
            }
        }));
    }, config);

    console.log('Navigating to app...');
    await page.goto('http://localhost:5173');
    await page.waitForTimeout(5000);

    // Take dashboard screenshot
    await page.screenshot({ path: '../../artifacts/web_dashboard.png', fullPage: true });
    console.log('Dashboard screenshot taken');

    // Navigate to 보강관리
    console.log('Navigating to 보강관리...');
    const makeupLink = page.locator('text=보강관리');
    if (await makeupLink.isVisible()) {
        await makeupLink.click();
        await page.waitForTimeout(5000);
        await page.screenshot({ path: '../../artifacts/web_makeup.png', fullPage: true });
        console.log('Makeup screenshot taken');
    }

    // Open DM Widget
    console.log('Opening DM Widget...');
    const dmBtn = page.locator('.dm-floating-btn');
    if (await dmBtn.isVisible()) {
        await dmBtn.click();
        await page.waitForTimeout(3000);
        await page.screenshot({ path: '../../artifacts/web_dm.png' });
        console.log('DM screenshot taken');
    }
});
