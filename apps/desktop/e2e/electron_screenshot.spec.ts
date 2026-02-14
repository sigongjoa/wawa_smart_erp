import { _electron as electron, test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test('capture electron screenshots', async () => {
    const configPath = path.join(__dirname, '../../../notion_config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    console.log('Launching Electron...');
    const electronApp = await electron.launch({
        args: [path.join(__dirname, '../')],
        executablePath: path.join(__dirname, '../node_modules/.bin/electron')
    });

    const window = await electronApp.firstWindow();
    console.log('Window opened');

    // Inject configuration into localStorage
    await window.evaluate((config) => {
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
                currentUser: {
                    teacher: { id: '2f973635-f415-8085-8f51-dc1615f53667', name: '서재용' }
                },
                currentYearMonth: '2026-02'
            }
        }));
        window.location.reload();
    }, config);

    console.log('Waiting for reload and data fetch...');
    await window.waitForTimeout(10000);

    // Take dashboard screenshot
    await window.screenshot({ path: '../../artifacts/electron_dashboard.png' });
    console.log('Dashboard screenshot taken');

    // Navigate to 보강관리
    console.log('Navigating to 보강관리...');
    const makeupLink = window.locator('text=보강관리');
    if (await makeupLink.isVisible()) {
        await makeupLink.click();
        await window.waitForTimeout(5000);
        await window.screenshot({ path: '../../artifacts/electron_makeup.png' });
        console.log('Makeup screenshot taken');
    }

    // Open DM Widget
    console.log('Opening DM Widget...');
    const dmBtn = window.locator('.dm-floating-btn');
    if (await dmBtn.isVisible()) {
        await dmBtn.click();
        await window.waitForTimeout(3000);
        await window.screenshot({ path: '../../artifacts/electron_dm.png' });
        console.log('DM screenshot taken');
    }

    await electronApp.close();
});
