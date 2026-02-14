import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test('verify electron fix', async ({ page }) => {
    const config = JSON.parse(fs.readFileSync('../../notion_config.json', 'utf8'));

    await page.addInitScript((config) => {
        window.wawaAPI = {
            getConfig: async () => ({ success: true, data: config }),
            navigate: async (module) => ({ success: true, module }),
            notionFetch: async (endpoint, options) => {
                const baseUrl = 'https://api.notion.com/v1';
                const resp = await fetch(`${baseUrl}${endpoint}`, {
                    method: options.method || 'GET',
                    headers: {
                        'Authorization': options.headers['Authorization'],
                        'Notion-Version': '2022-06-28',
                        'Content-Type': 'application/json',
                    },
                    body: options.body,
                });
                const data = await resp.json();
                return { success: resp.ok, data };
            },
            sendMessage: async () => ({ success: true }),
            onBroadcast: () => { },
            platform: 'linux',
            version: '1.0.0'
        };
    }, config);

    await page.goto('http://localhost:5173');

    // Wait for AppShell to load and auto-load config
    await page.waitForTimeout(5000);

    // Take screenshot of dashboard
    await page.screenshot({ path: 'verify_dashboard.png', fullPage: true });

    // Open DM Widget
    await page.click('.dm-floating-btn');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'verify_dm.png' });

    console.log('Screenshots saved: verify_dashboard.png, verify_dm.png');
});
