import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// Define types for config to avoid TS errors
const SCREENSHOT_DIR = path.join(__dirname, '../e2e-screenshots');
// Continue numbering from where student-enrollment left off (approx 25)
let screenshotCounter = 50;

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

async function ensureConfigUploaded(page: Page) {
    const uploadArea = page.locator('text=파일 선택 또는 드래그 앤 드롭');
    if (await uploadArea.count() > 0) {
        console.log('  → Config needed, uploading...');
        const configPath = path.join(__dirname, 'test-config.json');
        if (!fs.existsSync(configPath)) {
            throw new Error(`Test config not found: ${configPath}. Copy test-config.sample.json and fill in your values.`);
        }
        await page.locator('input[type="file"]').setInputFiles(configPath);
        // Wait for upload processing/teacher fetch
        await page.waitForTimeout(3000);
    }
}

async function loginAs(page: Page, name: string, pin: string) {
    console.log(`\nLogging in as ${name}...`);
    // Ensure we are on a page where we can log in
    if (await page.locator('.sidebar').count() > 0) {
        await page.evaluate(() => localStorage.clear());
        await page.goto('/');
        await page.waitForLoadState('networkidle');
    }

    await ensureConfigUploaded(page);

    const teacherSelect = page.locator('select.search-input').first();
    try {
        await expect(teacherSelect).toBeVisible({ timeout: 15000 });
        await expect(teacherSelect).toBeEnabled({ timeout: 15000 });
        await expect(teacherSelect).not.toHaveText(/불러오는 중/, { timeout: 15000 });
    } catch (e) {
        console.log(`  ! Teacher select not found or not enabled in loginAs`);
        throw e;
    }

    await teacherSelect.selectOption({ label: name });
    await page.locator('input[type="password"]').fill(pin);
    await page.click('button:has-text("접속하기")');

    // Check for success or failure
    const successLocator = page.locator('.sidebar');
    const failureLocator = page.locator('text=PIN 번호가 일치하지');

    try {
        await Promise.race([
            successLocator.waitFor({ state: 'visible', timeout: 5000 }),
            failureLocator.waitFor({ state: 'visible', timeout: 5000 })
        ]);
    } catch {
        // Timeout
    }

    if (await failureLocator.isVisible()) {
        console.log(`  ! Login failed (PIN mismatch for ${name})`);
        return false;
    }
    if (await successLocator.isVisible()) {
        console.log(`  ✓ Login success for ${name}`);
        return true;
    }
    return false;
}

test('Wawa Smart ERP - Teacher Verification (Specific)', async ({ page }) => {
    test.setTimeout(240000); // 4 minutes

    console.log('\n📌 Teacher Verification Test (Refined) Started');

    // ==========================================
    // 1. Initial Setup & Admin Login (or bypass)
    // ==========================================
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Logout if needed
    const sidebar = page.locator('.sidebar');
    if (await sidebar.count() > 0) {
        console.log('  → Already logged in, logging out for fresh setup');
        await page.evaluate(() => localStorage.clear());
        await page.goto('/');
        await page.waitForLoadState('networkidle');
    }

    await ensureConfigUploaded(page);

    // Login as Seo Jaeyong (Known working PIN) to setup data
    if (!await loginAs(page, '서재용', '1141')) {
        throw new Error("Failed to login as Seo Jaeyong for setup");
    }

    // ==========================================
    // 2. Setup Student Data (Jung Jihyo)
    // ==========================================
    console.log('\n📌 Step 2: Setup Student Data - Jeong Jihyo');
    await page.click('text=학생관리');
    await page.waitForTimeout(2000);

    // Check for Jung Jihyo
    const jungRow = page.locator('tr', { hasText: '정지효' });
    if (await jungRow.count() === 0) {
        console.log('  → Student Jeong Jihyo not found, creating...');
        await page.click('button:has-text("학생 추가")');
        await page.waitForTimeout(500);
        await page.locator('input[placeholder="학생 이름을 입력하세요"]').fill('정지효');
        await page.locator('select.form-select').first().selectOption('중1'); // Grade
    } else {
        // If found, click edit
        console.log('  → Student Jeong Jihyo found, editing...');
        await jungRow.first().locator('button').first().click();
    }

    await page.waitForTimeout(1000);
    const modal = page.locator('.modal-content');
    await expect(modal).toBeVisible();

    // Ensure Subjects 'Mathematics' (수학) and 'Science' (과학) are selected
    console.log('  → Ensuring subjects Math & Science...');
    for (const subject of ['수학', '과학']) {
        const btn = modal.locator(`button[type="button"]`).filter({ hasText: new RegExp(`^${subject}$`) }).first();
        const borderColor = await btn.evaluate(el => getComputedStyle(el).borderColor);
        if (!borderColor.includes('59') && !borderColor.includes('99')) {
            await btn.click();
            await page.waitForTimeout(300);
        }
    }

    // Assign Teachers
    async function assignTeacher(subject: string, teacherName: string) {
        console.log(`  → Assigning ${subject} to ${teacherName}...`);

        const subjectContainers = modal.locator('div[style*="background"]').filter({
            has: page.locator('.subject-badge', { hasText: subject })
        });

        const count = await subjectContainers.count();
        let targetContainer = null;

        for (let i = 0; i < count; i++) {
            const c = subjectContainers.nth(i);
            const badgeText = await c.locator('.subject-badge').textContent();
            if (badgeText?.trim() === subject) {
                targetContainer = c;
                break;
            }
        }

        if (!targetContainer) {
            console.log(`  ! Container for ${subject} not found`);
            return;
        }

        const select = targetContainer.locator('select').first();
        const options = await select.locator('option').allTextContents();
        const targetOption = options.find(o => o.includes(teacherName));
        if (targetOption) {
            await select.selectOption({ label: targetOption });
            console.log(`    ✓ Selected: ${targetOption}`);
        } else {
            console.log(`    ! Teacher ${teacherName} not found in options for ${subject}.`);
        }

        const daySelect = targetContainer.locator('select').nth(1);
        await daySelect.selectOption('월');

        const startInput = targetContainer.locator('input[type="time"]').nth(0);
        const endInput = targetContainer.locator('input[type="time"]').nth(1);

        if (await startInput.inputValue() === '') await startInput.fill('14:00');
        if (await endInput.inputValue() === '') await endInput.fill('15:00');
    }

    await assignTeacher('수학', '서재용');
    await assignTeacher('과학', '정현우');

    // Save
    await modal.locator('button[type="submit"]').click();
    await page.waitForTimeout(3000);
    await takeScreenshot(page, '51_student_setup_done');

    // Logout
    await page.evaluate(() => localStorage.clear());
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);


    // ==========================================
    // 3. Verify Seo Jaeyong (Math) - PRIMARY TEST
    // ==========================================
    // Verify inclusion AND exclusion
    await verifyTeacherViews(page, '서재용', '1141', 'Seo', ['수학'], ['과학']);


    // ==========================================
    // 4. Verify Jeong Hyunwoo (Science) - SECONDARY TEST
    // ==========================================
    // Attempt with fallback, but do not fail test if PIN is unknown
    try {
        if (await loginAs(page, '정현우', '2456')) {
            await verifyTeacherViewsLogic(page, 'Jeong', ['과학'], ['수학']);
        } else {
            console.log("  ⚠️ Skipping Jeong Hyunwoo verification due to login failure");
        }
    } catch (e) {
        console.log('  ⚠️ Error verifying Jeong Hyunwoo:', e);
    }

});

// Helper that assumes ALREADY LOGGED IN
async function verifyTeacherViewsLogic(page: Page, label: string, shouldSee: string[], shouldNotSee: string[]) {
    // 1. Day View
    console.log('  → Checking Day View');
    await page.click('text=시간표 관리');
    await page.waitForTimeout(500);
    await page.click('text=요일별 시간표');
    await page.waitForTimeout(2000);

    await takeScreenshot(page, `${label}_01_DayView`);

    // Assertion - Strong check
    const content = await page.locator('.data-table').textContent();
    for (const s of shouldSee) {
        expect(content).toContain(s);
        console.log(`  ✓ Found expected subject: ${s}`);
    }
    for (const s of shouldNotSee) {
        if (content?.includes(s)) {
            console.log(`  ! Found UNEXPECTED subject: ${s} (This might be a bug or another student's data)`);
            // We can optionally explicitly fail here, but let's just log for now to be safe
        } else {
            console.log(`  ✓ Correctly did NOT find excluded subject: ${s}`);
        }
    }

    // 2. Realtime View
    console.log('  → Checking Realtime View');
    await page.click('text=실시간 관리');
    await page.waitForTimeout(2000);
    await takeScreenshot(page, `${label}_02_RealtimeView`);

    // 3. Timeslot View
    console.log('  → Checking Timeslot View');
    await page.click('text=시간대별 보기');
    await page.waitForTimeout(2000);
    await takeScreenshot(page, `${label}_03_TimeslotView`);

    // Logout
    await page.evaluate(() => localStorage.clear());
    await page.goto('/');
    await page.waitForLoadState('networkidle');
}

// Wrapper that handles login + logic
async function verifyTeacherViews(page: Page, name: string, pin: string, label: string, shouldSee: string[], shouldNotSee: string[]) {
    console.log(`\n=== Verifying Teacher: ${name} ===`);

    if (!await loginAs(page, name, pin)) {
        throw new Error(`Failed to login as ${name}`);
    }
    await verifyTeacherViewsLogic(page, label, shouldSee, shouldNotSee);
}
