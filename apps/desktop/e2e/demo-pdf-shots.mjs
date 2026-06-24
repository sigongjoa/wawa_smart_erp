// 데모(협곡점) 공유용 스크린샷 → PDF (1회성 라이브 prod)
// 데스크톱: 협곡원장/1234 정상 로그인 / 학생앱: 이즈리얼/1001 토큰 주입
import { chromium } from '@playwright/test';
import fs from 'fs';
import { execSync } from 'child_process';

const DESKTOP = 'https://wawa-smart-erp.pages.dev';
const STUDENT = 'https://learn.wawa.app';
const API = 'https://wawa-smart-erp-api-production.zeskywa499.workers.dev';
const OUT = '/tmp/demo-shots';
const PDF = '/mnt/g/vine_academy/wawa_smart_erp/docs/DEMO_협곡점_스크린샷.pdf';

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const shots = [];
let n = 0;
async function shot(page, label) {
  await page.waitForTimeout(1600);
  const f = `${OUT}/${String(++n).padStart(2, '0')}-${label}.png`;
  await page.screenshot({ path: f, fullPage: true });
  shots.push(f);
  console.log('  📸', `${String(n).padStart(2, '0')}-${label}.png`);
}

const browser = await chromium.launch();

// ===================== 데스크톱 (강사/원장) =====================
const deskCtx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const dp = await deskCtx.newPage();
console.log('\n=== 데스크톱 로그인 (협곡원장/1234) ===');
await dp.goto(DESKTOP); await dp.waitForLoadState('networkidle'); await dp.waitForTimeout(2000);
const sel = dp.locator('select').first();
if (await sel.isVisible({ timeout: 5000 }).catch(() => false)) {
  await sel.selectOption({ value: 'test-canyon' }); await dp.waitForTimeout(500);
}
await dp.locator('#login-name').fill('협곡원장');
await dp.locator('#login-pin').fill('1234');
await dp.locator('button[type="submit"]').click();
await dp.waitForTimeout(3500); await dp.waitForLoadState('networkidle');
console.log('  ✅ 로그인');

const deskPages = [
  ['timer', '수업-타이머'],
  ['student', '학생목록'],
  ['exams', '시험관리'],
  ['report', '월말평가-리포트'],
  ['board', '보드-공지'],
  ['absence', '결석-보강'],
  ['assignments', '과제-검토'],
  ['homeroom', '담임'],
  ['calendar', '캘린더'],
  ['vocab', '단어관리'],
];
for (const [route, label] of deskPages) {
  await dp.goto(`${DESKTOP}/#/${route}`); await dp.waitForLoadState('networkidle');
  await shot(dp, `데스크톱-${label}`);
}
// 학생 프로필 (목록 첫 학생 클릭)
await dp.goto(`${DESKTOP}/#/student`); await dp.waitForLoadState('networkidle'); await dp.waitForTimeout(1500);
const firstStudent = dp.locator('a[href*="#/student/"], [href*="student/stu-"]').first();
if (await firstStudent.isVisible({ timeout: 4000 }).catch(() => false)) {
  await firstStudent.click(); await dp.waitForLoadState('networkidle');
  await shot(dp, '데스크톱-학생프로필');
}
await deskCtx.close();

// ===================== 학생앱 (모바일 뷰 + 토큰 주입) =====================
console.log('\n=== 학생앱 토큰 발급 (이즈리얼/1001) ===');
const apiCtx = await browser.newContext();
const res = await apiCtx.request.post(`${API}/api/play/login`, {
  data: { academy_slug: 'test-canyon', name: '이즈리얼', pin: '1001' },
});
const j = await res.json();
const token = j.data.token, student = j.data.student;
await apiCtx.close();
console.log('  ✅ 토큰:', token.slice(0, 8) + '…');

const mCtx = await browser.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const sp = await mCtx.newPage();
await sp.goto(STUDENT); await sp.waitForLoadState('networkidle');
await sp.evaluate(({ token, student }) => {
  localStorage.setItem('play_token', token);
  localStorage.setItem('play_token_created_at', String(Date.now()));
  localStorage.setItem('play_student', JSON.stringify(student));
  localStorage.setItem('play_slug', 'test-canyon');
}, { token, student });
await sp.reload(); await sp.waitForLoadState('networkidle'); await sp.waitForTimeout(2500);
console.log('  ✅ 학생앱 로그인 상태 주입');

const stuPages = [
  ['', '학생홈'],
  ['assignments', '과제'],
  ['calendar', '캘린더'],
  ['dex', '단어도감'],
  ['me', '마이페이지'],
];
for (const [route, label] of stuPages) {
  await sp.goto(`${STUDENT}/#/${route}`); await sp.waitForLoadState('networkidle');
  await shot(sp, `학생앱-${label}`);
}
await mCtx.close();
await browser.close();

// ===================== PDF 조립 =====================
console.log('\n=== PDF 생성 ===');
execSync(`img2pdf ${shots.map((s) => `'${s}'`).join(' ')} -o '${PDF}'`);
console.log('  ✅', PDF, '(' + shots.length + ' pages)');
