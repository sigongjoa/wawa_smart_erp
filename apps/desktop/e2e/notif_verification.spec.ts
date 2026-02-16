import { test, expect } from '@playwright/test';

test.describe('Notification System Verification', () => {
    test('Login and Verify Notification Center', async ({ page }) => {
        // Mirror browser logs
        page.on('console', msg => console.log(`BROWSER [${msg.type()}] ${msg.text()}`));

        // 1. Navigate to the app
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

        // 3. Login as 서재용 (1141)
        await page.waitForSelector('select.search-input', { timeout: 15000 });
        console.log('✅ Selecting teacher...');
        await page.selectOption('select.search-input', { label: '서재용 개발자' });
        await page.fill('input[type="password"]', '1141');
        await page.click('button.btn-primary');

        // Wait for header to appear
        await page.waitForSelector('header', { timeout: 15000 });
        console.log('✅ Logged in successfully');
        await page.screenshot({ path: 'e2e-screenshots/01-logged-in.png' });

        // 4. Check for Notification Bell
        const bellIcon = page.locator('button[title="알림"]');
        await expect(bellIcon).toBeVisible();
        console.log('✅ Bell icon is visible');

        // Check if there is a badge
        const badge = bellIcon.locator('.notification-dot, .bg-red-500');
        if (await badge.isVisible()) {
            const count = await badge.innerText();
            console.log(`Initial unread count: ${count}`);
        }

        // 5. Open Notification Center
        await bellIcon.click();
        await page.waitForSelector('h3:has-text("알림 센터")');
        console.log('✅ Notification Center opened');
        await page.screenshot({ path: 'e2e-screenshots/02-notification-center.png' });

        // 6. Verify DM section
        const dmSection = page.locator('div:has-text("새로운 쪽지가 있습니다")');
        if (await dmSection.isVisible()) {
            console.log('✅ DM notification detected');
            await dmSection.click();
            // Should open DM widget
            await page.waitForTimeout(2000);
            await page.screenshot({ path: 'e2e-screenshots/03-dm-widget-opened.png' });
        } else {
            console.log('ℹ️ No unread DMs in notification center');
        }

        // 7. Verify System Notifications
        const systemNotif = page.locator('div[class*="border-b"]:has-text("보강"), div[class*="border-b"]:has-text("성적")');
        const notifCount = await systemNotif.count();
        console.log(`ℹ️ System notifications found: ${notifCount}`);

        if (notifCount > 0) {
            await systemNotif.first().screenshot({ path: 'e2e-screenshots/04-system-notification.png' });
        }

        // 8. Verify mark all as read
        const markAllBtn = page.locator('button:has-text("모두 읽음 처리")');
        if (await markAllBtn.isVisible()) {
            await markAllBtn.click();
            await page.waitForTimeout(2000); // Wait for sync
            console.log('✅ Clicked Mark All as Read');
        }

        await page.screenshot({ path: 'e2e-screenshots/05-final-state.png' });
    });
});
