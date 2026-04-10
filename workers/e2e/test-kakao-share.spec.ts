import { test, expect } from '@playwright/test';

const API_URL = 'https://wawa-smart-erp-api.zeskywa499.workers.dev';
const SITE_URL = 'https://wawa-smart-erp.pages.dev';
const ADMIN = { name: '서재용 개발자', pin: '1141' };

test('카카오톡 공유: 이미지 업로드 API 직접 테스트', async ({ request }) => {
  // 1. 로그인
  const loginRes = await request.post(`${API_URL}/api/auth/login`, {
    data: { name: ADMIN.name, pin: ADMIN.pin },
  });
  const loginBody = await loginRes.json();
  const token = loginBody.data?.accessToken;
  console.log(`로그인: ${loginRes.status()}`);

  // 2. 작은 테스트 PNG 생성 (1x1 투명 PNG base64)
  const testPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  // 3. 이미지 업로드
  const uploadRes = await request.post(`${API_URL}/api/report/upload-image`, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    data: {
      imageBase64: testPng,
      studentName: 'test',
      yearMonth: '2026-03',
    },
  });

  const uploadBody = await uploadRes.json();
  console.log(`업로드 응답 (${uploadRes.status()}): ${JSON.stringify(uploadBody, null, 2)}`);

  if (uploadRes.ok()) {
    const shareUrl = uploadBody.data?.shareUrl;
    console.log(`공유 URL: ${shareUrl}`);

    // 4. 공유 URL로 이미지 접근 테스트
    const imageRes = await request.get(shareUrl);
    console.log(`이미지 접근: ${imageRes.status()} (Content-Type: ${imageRes.headers()['content-type']})`);
    expect(imageRes.status()).toBe(200);
  } else {
    console.log(`❌ 업로드 실패!`);
  }
});

test('카카오톡 공유: UI 플로우 전체 테스트', async ({ page }) => {
  // 콘솔/네트워크 로그
  const errors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', err => errors.push(`PAGE ERROR: ${err.message}`));

  const apiLogs: string[] = [];
  page.on('response', async response => {
    if (response.url().includes('/api/')) {
      const status = response.status();
      const method = response.request().method();
      const path = response.url().split('/api/')[1];
      let body = '';
      try { body = JSON.stringify(await response.json()).slice(0, 200); } catch {}
      const log = `${method} /api/${path} → ${status} ${body}`;
      apiLogs.push(log);
      console.log(`📡 ${log}`);
    }
  });

  // 1. 로그인
  await page.goto(SITE_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.locator('input[placeholder*="이름"]').first().fill(ADMIN.name);
  await page.locator('input[placeholder*="PIN"]').first().fill(ADMIN.pin);
  await page.locator('button:has-text("로그인")').first().click();
  await page.waitForTimeout(3000);
  console.log('✅ 로그인 완료');

  // 2. 리포트 페이지 이동
  await page.locator('a:has-text("리포트")').first().click();
  await page.waitForTimeout(2000);
  console.log('✅ 리포트 페이지');

  // 3. 학생 선택
  const studentSelect = page.locator('#student-select, select[aria-label="학생 선택"]').first();
  const options = await studentSelect.locator('option').allTextContents();
  console.log(`학생 목록: ${options.join(', ')}`);

  // 첫 번째 실제 학생 선택 (빈값 제외)
  const studentOptions = options.filter(o => o && o !== '학생 선택');
  if (studentOptions.length === 0) {
    console.log('❌ 선택 가능한 학생이 없음');
    return;
  }
  await studentSelect.selectOption({ label: studentOptions[0] });
  await page.waitForTimeout(2000);
  console.log(`✅ 학생 선택: ${studentOptions[0]}`);

  // 4. 카카오톡 공유 버튼 클릭
  const shareBtn = page.locator('button').filter({ hasText: /카카오톡|공유/ }).first();
  const isVisible = await shareBtn.isVisible();
  console.log(`공유 버튼 표시: ${isVisible}`);

  if (!isVisible) {
    console.log('❌ 공유 버튼이 보이지 않음');
    return;
  }

  // 클릭 전 dialog 핸들러 (alert 에러 캡처)
  const alerts: string[] = [];
  page.on('dialog', async dialog => {
    alerts.push(dialog.message());
    console.log(`⚠️ Alert: ${dialog.message()}`);
    await dialog.dismiss();
  });

  await shareBtn.click();
  console.log('✅ 공유 버튼 클릭');

  // 결과 대기
  await page.waitForTimeout(10000);

  // 5. 결과 확인
  console.log('\n━━━ 결과 ━━━');
  if (alerts.length > 0) {
    console.log(`❌ Alert 에러: ${alerts.join('\n')}`);
  }

  // 버튼 텍스트 확인 (성공시 "복사 완료!")
  const btnText = await shareBtn.textContent();
  console.log(`버튼 상태: ${btnText}`);

  if (errors.length > 0) {
    console.log(`\n콘솔 에러:`);
    errors.forEach(e => console.log(`  - ${e}`));
  }

  // 실패한 API 요청 확인
  const failedApis = apiLogs.filter(l => {
    const status = parseInt(l.split('→ ')[1]);
    return status >= 400;
  });
  if (failedApis.length > 0) {
    console.log(`\n❌ 실패한 API:`);
    failedApis.forEach(l => console.log(`  - ${l}`));
  }

  expect(alerts.length, `공유 에러 발생: ${alerts.join(', ')}`).toBe(0);
});
