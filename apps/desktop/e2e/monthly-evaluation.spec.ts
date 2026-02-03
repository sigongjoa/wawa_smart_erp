import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// Define types for config to avoid TS errors
const SCREENSHOT_DIR = path.join(__dirname, '../e2e-screenshots');
// Continue numbering from where teacher-verification left off (approx 60)
let screenshotCounter = 70;

async function takeScreenshot(page: Page, name: string) {
    screenshotCounter++;
    const filename = `${String(screenshotCounter).padStart(2, '0')}_${name}.png`;
    if (!fs.existsSync(SCREENSHOT_DIR)) {
        fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    }
    await page.screenshot({
        path: path.join(SCREENSHOT_DIR, filename),
        fullPage: true
    });
    console.log(`📸 Screenshot: ${filename}`);
    return filename;
}

// Config Upload Helper (Robust)
async function ensureConfigUploaded(page: Page) {
    const uploadArea = page.locator('text=파일 선택 또는 드래그 앤 드롭');
    if (await uploadArea.count() > 0) {
        console.log('  → Config needed, uploading...');
        const configPath = path.join(__dirname, 'test-config.json');
        if (!fs.existsSync(configPath)) {
            // ... (keep existing config logic if needed, or assume it exists)
        }
        await page.locator('input[type="file"]').setInputFiles(configPath);
        await page.waitForTimeout(3000);
    }
}

// Login Helper
async function loginAs(page: Page, name: string, pin: string) {
    console.log(`\nLogging in as ${name}...`);
    if (await page.locator('.sidebar').count() > 0) {
        await page.evaluate(() => localStorage.clear());
        await page.goto('/');
        await page.waitForLoadState('networkidle');
    }
    await ensureConfigUploaded(page);

    const teacherSelect = page.locator('select.search-input').first();
    await expect(teacherSelect).toBeVisible({ timeout: 15000 });
    await teacherSelect.selectOption({ label: name });
    await page.locator('input[type="password"]').fill(pin);
    await page.click('button:has-text("접속하기")');

    // Race condition handling
    const successLocator = page.locator('.sidebar');
    const failureLocator = page.locator('text=PIN 번호가 일치하지');
    try {
        await Promise.race([
            successLocator.waitFor({ state: 'visible', timeout: 5000 }),
            failureLocator.waitFor({ state: 'visible', timeout: 5000 })
        ]);
    } catch { }

    if (await failureLocator.isVisible()) return false;
    if (await successLocator.isVisible()) return true;
    return false;
}

test('Wawa Smart ERP - Monthly Evaluation Full Cycle', async ({ page }) => {
    test.setTimeout(300000); // 5 minutes

    console.log('\n📌 Monthly Evaluation Full Cycle Test Started');

    // Debug: Log all console output from the browser
    page.on('console', msg => console.log(`  [Browser] ${msg.type()}: ${msg.text()}`));
    // Debug: Log all network requests
    page.on('request', request => console.log(`  [Network] ${request.method()} ${request.url()}`));

    // 🌟 SETUP NETWORK MOCKS FIRST (Before Login)

    // Page Creation Mock
    await page.route('**/api/notion/v1/pages', async route => {
        if (route.request().method() === 'POST') {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    id: 'mock-exam-id-123',
                    created_time: new Date().toISOString(),
                    last_edited_time: new Date().toISOString(),
                    properties: {}
                })
            });
            return;
        }
        await route.continue();
    });

    // Database GET Mock (Connection Check)
    // Use FUNCTION for absolute reliability
    await page.route(url => url.href.includes('12345678-1234-1234-1234-1234567890ab') && !url.href.includes('/query'), async route => {
        console.log('  [Mock] Intercepted Exam DB Connection Check (GET)');
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                id: '12345678-1234-1234-1234-1234567890ab',
                object: 'database',
                title: [{ type: 'text', text: { content: 'Mock Exams DB' } }]
            })
        });
    });

    // Database Query Mock (Query POST)
    await page.route(url => url.href.includes('12345678-1234-1234-1234-1234567890ab') && url.href.includes('/query'), async route => {
        console.log('  [Mock] Intercepted Exam DB Query (POST)');
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                results: [
                    {
                        id: 'mock-exam-existing-1',
                        created_time: new Date().toISOString(),
                        last_edited_time: new Date().toISOString(),
                        properties: {
                            '과목': { select: { name: '수학' } },
                            '년월': { rich_text: [{ text: { content: '2023-10' } }] },
                            '난이도': { select: { name: 'B' } },
                            '범위': { rich_text: [{ text: { content: 'Chapter 5' } }] },
                            '등록자': { rich_text: [{ text: { content: 'TestUser' } }] }
                        }
                    }
                ],
                has_more: false,
                next_cursor: null,
                object: 'list'
            })
        });
    });

    // 1. Login
    await page.goto('/');
    if (!await loginAs(page, '서재용', '1141')) {
        throw new Error("Failed to login as Seo Jaeyong");
    }

    // 2. Go to Monthly Evaluation
    console.log('\n📌 Step 2: Navigate to Report System');
    await page.click('nav.header-nav >> text=월말평가');
    await page.waitForTimeout(2000);
    await expect(page.locator('.sidebar-title')).toHaveText('리포트 시스템');
    await takeScreenshot(page, '71_report_01_Dashboard');

    // 3. Create Exam (Data Setup)
    console.log('\n📌 Step 3: Create New Exam (Data Setup)');
    await page.click('text=시험 관리');
    await expect(page.locator('h1.page-title')).toContainText('시험 관리');

    // Click Add Exam
    await page.click('button:has-text("시험 추가")');
    await expect(page.locator('h2:has-text("새 시험지 정보 등록")')).toBeVisible();

    // Fill Form
    // Subject: Math (수학)
    await page.locator('select').first().selectOption('수학');
    // Difficulty: B
    await page.locator('select').nth(1).selectOption('B');
    // Scope
    await page.locator('input[placeholder="예: 평면좌표 ~ 원의 방정식"]').fill('Chapter 5: Calculus Basics');

    // 4. Navigate to Exams Page
    // (Already there, just clicked button. No need to re-navigate or inject)

    // Submit (Modal button is '등록하기' but type submit usually works)
    // Code says: <button type="submit" ...>등록하기</button>
    await page.click('button[type="submit"]');

    // Check for success toast
    try {
        await expect(page.locator('text=시험지가 등록되었습니다')).toBeVisible({ timeout: 5000 });
        console.log('  ✓ Success toast appeared.');
    } catch {
        console.log('  ! Success toast NOT found. Taking screenshot.');
        await takeScreenshot(page, '98_ExamCreation_NoToast');
    }

    await page.waitForTimeout(2000); // Wait for save

    // Verify it appears in list - Robust Wait
    try {
        // Reload to ensure list is fresh (crucial for Notion sync delay)
        console.log('  → Reloading page to refresh exam list...');
        await page.reload();
        await page.waitForLoadState('networkidle');

        console.log('  → Waiting for .card element...');
        await page.waitForSelector('.card', { state: 'visible', timeout: 20000 });

        console.log('  → Checking for "수학" badge...');
        const mathBadge = page.locator('.subject-badge').filter({ hasText: '수학' }).first();
        await expect(mathBadge).toBeVisible({ timeout: 10000 });
        console.log('  ✓ Created "Math" exam found.');
    } catch (e) {
        console.log('  ! Failed to verify exam creation. Taking debug screenshot...');
        await takeScreenshot(page, '99_ExamVerify_Failed');
        console.log('  ! List Content:', await page.locator('.grid').textContent().catch(() => 'Grid not found'));
        throw e;
    }
    await takeScreenshot(page, '72_report_02_ExamCreated');

    // 4. Input Scores (Data Entry)
    console.log('\n📌 Step 4: Input Scores for Student');
    await page.click('text=성적 입력');
    await page.waitForTimeout(1000);

    // Select 'Jung Jihyo' (Student) from sidebar list
    // The sidebar has a search input. Let's filter first.
    await page.locator('input[placeholder="학생 검색..."]').fill('정지효');
    await page.waitForTimeout(500);
    await page.locator('div', { hasText: '정지효' }).first().click();
    await page.waitForTimeout(1000);

    // Verify Student Panel Loaded
    await expect(page.locator('h2:has-text("정지효 학생")')).toBeVisible();

    // Find "Math" (수학) card
    // Depending on Input.tsx, it renders cards for each subject.
    const mathCard = page.locator('div').filter({ has: page.locator('span', { hasText: '수학' }) }).last();

    // Input Score: 95
    const scoreInput = mathCard.locator('input[type="number"]');
    await scoreInput.fill('95');

    // Input Comment
    const commentInput = mathCard.locator('textarea');
    await commentInput.fill('Demonstrates excellent understanding of calculus concepts.');

    // Save
    await mathCard.locator('button:has-text("저장")').click();
    // Wait for success toast
    await expect(page.locator('text=수학 점수가 저장되었습니다')).toBeVisible();
    await takeScreenshot(page, '73_report_03_ScoreInput');
    console.log('  ✓ Input Score: 95 for Math');

    // 5. Verify Report Preview
    console.log('\n📌 Step 5: Verify Report Preview');
    await page.click('text=리포트 미리보기');
    await page.waitForTimeout(1000);

    // Select 'Jung Jihyo' from list (re-select might be needed or it might persist)
    // The Preview page has a similar sidebar.
    await page.locator('div', { hasText: '정지효' }).first().click();
    await page.waitForTimeout(2000); // Wait for generation

    // Verify Report Content
    const reportPaper = page.locator('.report-paper');
    await expect(reportPaper).toBeVisible();
    await expect(reportPaper).toContainText('정지효 학생 월별 평가서');

    // Verify Score 95 is visible in table or chart
    // Check table cell
    await expect(reportPaper).toContainText('95점');
    await expect(reportPaper).toContainText('Demonstrates excellent understanding');

    console.log('  ✓ Report generated with correct score (95) and comment.');
    await takeScreenshot(page, '74_report_04_PreviewVerified');

});
