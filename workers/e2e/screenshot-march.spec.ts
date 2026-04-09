import { test, expect } from '@playwright/test';

test('Screenshot March Data Flow', async ({ page }) => {
  console.log('\n=== Login ===');
  
  await page.goto('http://localhost:5174', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  
  // Login
  const nameInput = page.locator('input[placeholder*="예:"]').first();
  const pinInput = page.locator('input[type="password"]').first();
  
  await nameInput.fill('서재용 개발자');
  await pinInput.fill('1141');
  
  await page.locator('button:has-text("접속하기")').first().click();
  await page.waitForTimeout(4000);
  
  console.log('✅ Logged in');
  
  // Navigate to report/input
  console.log('\n=== Go to Report Input ===');
  await page.locator('a:has-text("월말평가")').first().click();
  await page.waitForTimeout(3000);
  
  console.log('✅ In Report Input page');
  
  // Screenshot 1: Initial page with April selected
  console.log('\n📸 Screenshot 1: April data loaded');
  await page.screenshot({ path: '/tmp/01-april-loaded.png', fullPage: true });
  
  // Select March
  console.log('\n=== Switch to March ===');
  const select = page.locator('select').first();
  await select.selectOption('2026-03');
  await page.waitForTimeout(2000);
  
  console.log('✅ March selected');
  
  // Screenshot 2: March data loaded
  console.log('\n📸 Screenshot 2: March data loaded');
  await page.screenshot({ path: '/tmp/02-march-loaded.png', fullPage: true });
  
  // Search for 강은서
  console.log('\n=== Search for Student ===');
  const searchInput = page.locator('input[placeholder*="학생"]');
  if (await searchInput.isVisible()) {
    await searchInput.fill('강은서');
    await page.waitForTimeout(1000);
  }
  
  // Screenshot 3: Search results
  console.log('\n📸 Screenshot 3: Search results');
  await page.screenshot({ path: '/tmp/03-search-result.png', fullPage: true });
  
  // Click on 강은서
  console.log('\n=== Select Student ===');
  const student = page.locator('text=강은서').first();
  if (await student.isVisible()) {
    await student.click();
    await page.waitForTimeout(2000);
    console.log('✅ Student selected');
  }
  
  // Screenshot 4: Score input form
  console.log('\n📸 Screenshot 4: Score input form');
  await page.screenshot({ path: '/tmp/04-score-input.png', fullPage: true });
  
  // Check score inputs
  const scoreInputs = page.locator('input[type="number"]');
  const count = await scoreInputs.count();
  console.log(`\n✅ Score input fields: ${count}`);
  
  // Enter score
  if (count > 0) {
    await scoreInputs.first().fill('85');
    await page.waitForTimeout(500);
    
    // Screenshot 5: Score entered
    console.log('\n📸 Screenshot 5: Score entered');
    await page.screenshot({ path: '/tmp/05-score-entered.png', fullPage: true });
  }
  
  console.log('\n✅ All screenshots captured!');
});
