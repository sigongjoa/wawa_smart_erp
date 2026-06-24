// 학생앱 부분만 (pages.dev 도메인 사용) + 기존 데스크톱 PNG와 합쳐 PDF
import { chromium } from '@playwright/test';
import fs from 'fs';
import { execSync } from 'child_process';

const STUDENT = 'https://wawa-learn.pages.dev';
const API = 'https://wawa-smart-erp-api-production.zeskywa499.workers.dev';
const OUT = '/tmp/demo-shots';
const PDF = '/mnt/g/vine_academy/wawa_smart_erp/docs/DEMO_협곡점_스크린샷.pdf';

const shots = [];
let n = 11; // 데스크톱 01~11 이미 존재
async function shot(page, label) {
  await page.waitForTimeout(1600);
  const f = `${OUT}/${String(++n).padStart(2, '0')}-${label}.png`;
  await page.screenshot({ path: f, fullPage: true });
  console.log('  📸', `${String(n).padStart(2, '0')}-${label}.png`);
}

const browser = await chromium.launch();
console.log('=== 학생앱 토큰 발급 (이즈리얼/1001) ===');
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
console.log('  ✅ 로그인 상태 주입');

const stuPages = [['', '학생홈'], ['assignments', '과제'], ['calendar', '캘린더'], ['dex', '단어도감'], ['me', '마이페이지']];
for (const [route, label] of stuPages) {
  await sp.goto(`${STUDENT}/#/${route}`); await sp.waitForLoadState('networkidle');
  await shot(sp, `학생앱-${label}`);
}
await mCtx.close();
await browser.close();

console.log('\n=== PDF 생성 (데스크톱+학생앱 전체) ===');
const all = fs.readdirSync(OUT).filter((f) => f.endsWith('.png')).sort().map((f) => `${OUT}/${f}`);
execSync(`img2pdf ${all.map((s) => `'${s}'`).join(' ')} -o '${PDF}'`);
console.log('  ✅', PDF, '(' + all.length + ' pages)');
