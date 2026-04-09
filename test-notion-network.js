/**
 * Notion API 호출 모니터링 테스트
 * 네트워크 요청을 추적하여 Notion API 호출 여부 확인
 */

const { chromium } = require('playwright');

async function test() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const notionRequests = [];
  const d1Requests = [];
  const otherRequests = [];

  // 네트워크 요청 모니터링
  page.on('request', (request) => {
    const url = request.url();
    if (url.includes('notion.com') || url.includes('/api/notion')) {
      notionRequests.push({
        method: request.method(),
        url: url,
        time: new Date().toISOString(),
      });
      console.log(`[NOTION] ${request.method()} ${url}`);
    } else if (url.includes('/api/') || url.includes('localhost')) {
      d1Requests.push({
        method: request.method(),
        url: url,
        time: new Date().toISOString(),
      });
      if (!url.includes('hot-update') && !url.includes('sourcemap')) {
        console.log(`[API] ${request.method()} ${url}`);
      }
    }
  });

  try {
    console.log('\n');
    console.log('════════════════════════════════════════════════════════');
    console.log('🧪 Notion API 호출 모니터링 테스트');
    console.log('════════════════════════════════════════════════════════');
    console.log('');

    // 1. 앱 로드
    console.log('📍 1️⃣ 앱 로드...');
    await page.goto('http://localhost:5174');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);
    console.log('✅ 앱 로드 완료');
    console.log('');

    // 2. 로그인
    console.log('📍 2️⃣ 로그인...');
    const inputs = await page.locator('input');
    await inputs.nth(0).fill('김상현');
    await inputs.nth(1).fill('1234');

    const loginButton = await page.locator('button:has-text("로그인")');
    await loginButton.click();

    await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(2000);

    console.log('✅ 로그인 성공');
    console.log('');

    // 3. 성적 입력 페이지
    console.log('📍 3️⃣ 성적 입력 페이지 방문...');
    await page.goto('http://localhost:5174/#/report/input');
    await page.waitForTimeout(3000);
    console.log('✅ 성적 입력 페이지 진입');
    console.log('');

    // 4. 미리보기 페이지
    console.log('📍 4️⃣ 미리보기 페이지 방문...');
    await page.goto('http://localhost:5174/#/report/preview');
    await page.waitForTimeout(3000);
    console.log('✅ 미리보기 페이지 진입');
    console.log('');

    // 최종 결과
    console.log('════════════════════════════════════════════════════════');
    console.log('📊 네트워크 요청 분석 결과');
    console.log('════════════════════════════════════════════════════════');
    console.log('');

    console.log(`❌ Notion API 호출: ${notionRequests.length}건`);
    if (notionRequests.length > 0) {
      console.log('  요청 목록:');
      notionRequests.forEach((req) => {
        console.log(`    - ${req.method} ${req.url}`);
      });
    }
    console.log('');

    console.log(`✅ D1/Worker API 호출: ${d1Requests.length}건`);
    const apiEndpoints = [...new Set(d1Requests.map((r) => r.url.split('?')[0]))];
    console.log('  엔드포인트:');
    apiEndpoints.forEach((url) => {
      const count = d1Requests.filter((r) => r.url.startsWith(url)).length;
      console.log(`    - ${url} (${count}건)`);
    });
    console.log('');

    // 판정
    console.log('════════════════════════════════════════════════════════');
    if (notionRequests.length === 0) {
      console.log('✅ D1 마이그레이션 성공: Notion API 호출 없음');
    } else {
      console.log('❌ D1 마이그레이션 실패: 여전히 Notion API 호출 있음');
    }
    console.log('════════════════════════════════════════════════════════');
    console.log('');

  } catch (error) {
    console.error('❌ 테스트 중 오류:', error);
  } finally {
    await browser.close();
  }
}

test();
