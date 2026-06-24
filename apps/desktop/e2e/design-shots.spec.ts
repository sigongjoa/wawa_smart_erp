import { test } from '@playwright/test';
import fs from 'fs';

// 로컬 디자인 검증용 스크린샷. prod 무접촉(/api/** abort), 가짜 user 주입으로 ProtectedRoute 통과.
// 데이터는 안 뜨지만 앱 셸·헤더·버튼·배지·빈상태 등 디자인 시스템 요소를 캡처.

const OUT = 'design-shots';
const FAKE_USER = JSON.stringify({ id: 'u-demo', name: '데모강사', role: 'admin', academySlug: 'demo' });

const PAGES: [string, string][] = [
  ['login', '/#/login'],
  ['register', '/#/register'],
  ['change-pin', '/#/change-pin'],
  ['student-list', '/#/student'],
  ['absence', '/#/absence'],
  ['assignments', '/#/assignments'],
  ['exam-management', '/#/exams'],
  ['exam-papers', '/#/exam-papers'],
  ['report', '/#/report'],
  ['homeroom', '/#/homeroom'],
  ['homeroom-consultations', '/#/homeroom/consultations'],
  ['notifications', '/#/notifications'],
  ['gacha', '/#/gacha'],
  ['gacha-students', '/#/gacha'],
  ['gacha-dashboard', '/#/gacha/dashboard'],
  ['calendar', '/#/calendar'],
  ['curriculum', '/#/curriculum'],
  ['settings', '/#/settings'],
  ['board', '/#/board'],
  ['meeting', '/#/meeting'],
  ['vocab', '/#/vocab'],
  ['teacher-ask-ai', '/#/teacher/ask-ai'],
  ['timer', '/#/timer'],
];

test.beforeAll(() => { fs.mkdirSync(OUT, { recursive: true }); });

test.use({ viewport: { width: 1440, height: 900 } });

for (const [name, hash] of PAGES) {
  test(`shot: ${name}`, async ({ page }) => {
    // prod API 무접촉
    await page.route('**/api/**', (r) => r.abort());
    // 가짜 인증 주입 (페이지 스크립트 실행 전)
    await page.addInitScript((u) => { localStorage.setItem('user', u); }, FAKE_USER);

    await page.goto(hash, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500); // 렌더/레이아웃 안정화
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  });
}
