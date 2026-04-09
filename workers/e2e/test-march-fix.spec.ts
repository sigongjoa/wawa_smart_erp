import { test, expect } from '@playwright/test';

test('March Flow - Hard Refresh', async ({ page, context }) => {
  console.log('\n=== Clearing browser cache ===');
  
  // Clear all browser data
  await context.clearCookies();
  
  // Navigate with cache clear
  await page.goto('http://localhost:5174', { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    // Clear service workers and caches
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => caches.delete(name));
      });
    }
  });
  
  // Hard refresh
  await page.keyboard.press('Control+Shift+R');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  
  console.log('✅ Browser cleared and refreshed');
  
  // Login
  console.log('\n=== Login ===');
  await page.locator('input[placeholder*="예:"]').first().fill('서재용 개발자');
  await page.locator('input[type="password"]').first().fill('1141');
  await page.locator('button:has-text("접속하기")').first().click();
  
  await page.waitForTimeout(3000);
  console.log('✅ Logged in');
  
  // Go to Input page
  console.log('\n=== Navigate to Report Input ===');
  await page.locator('a:has-text("월말평가")').first().click();
  await page.waitForTimeout(2000);
  
  // Check for errors
  const errors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  
  // Select March
  console.log('\n=== Select March ===');
  const select = page.locator('select').first();
  await select.selectOption('2026-03');
  await page.waitForTimeout(1000);
  
  // Check if page loaded
  const bodyText = await page.locator('body').textContent();
  const has3Month = bodyText?.includes('3월');
  const hasStudent = bodyText?.includes('강은서');
  
  console.log(`\n📄 Page loaded:
    - Has "3월": ${has3Month}
    - Has "강은서": ${hasStudent}
    - Errors: ${errors.length}`);
  
  if (errors.length > 0) {
    console.log('\nErrors found:');
    errors.forEach(e => console.log(`  - ${e.substring(0, 100)}`));
  }
  
  // Try to select student
  console.log('\n=== Select Student ===');
  const searchInput = page.locator('input[placeholder*="학생"]');
  if (await searchInput.isVisible()) {
    await searchInput.fill('강은서');
    await page.waitForTimeout(500);
  }
  
  const student = page.locator('text=강은서').first();
  if (await student.isVisible()) {
    await student.click();
    await page.waitForTimeout(1000);
    console.log('✅ Selected 강은서');
  }
  
  // Check score inputs
  const scores = page.locator('input[type="number"]');
  const count = await scores.count();
  console.log(`\n📊 Score inputs found: ${count}`);
  
  if (count > 0) {
    console.log('✅ Score input fields are visible - Fix worked!');
  } else {
    console.log('❌ Score input fields not visible - Issue still exists');
  }
});
