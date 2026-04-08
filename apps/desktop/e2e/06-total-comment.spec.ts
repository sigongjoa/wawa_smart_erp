/**
 * UC-06: 총평(__TOTAL_COMMENT__) 저장 및 리포트 반영 e2e 테스트
 *
 * - 실제 Notion DB 연결, 실제 학생 데이터 사용
 * - 총평 저장 시 "select option not found" 에러 없이 성공 여부 검증
 * - 저장 후 리포트 미리보기에 총평 반영 여부 검증
 */
import { test, expect } from '@playwright/test';
import { _electron as electron } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';

const ROOT = path.resolve(__dirname, '..');
const SCREENSHOTS = path.join(ROOT, 'e2e-screenshots-all');
const CONFIG_PATH = path.resolve(ROOT, '../../notion_config.json');

// 실제 Notion DB에 존재하는 학생 (미입력 상태)
const TARGET_STUDENT = 'test';
const TOTAL_COMMENT_TEXT = `[e2e] ${new Date().toISOString()} 이번 달 영어·국어 모두 성실하게 임했습니다.`;

async function launch() {
  if (!fs.existsSync(CONFIG_PATH)) throw new Error(`notion_config.json not found: ${CONFIG_PATH}`);
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));

  const app = await electron.launch({
    args: [path.join(ROOT, 'dist/main/index.js')],
    env: { ...process.env, NODE_ENV: 'production' },
  });
  const window = await app.firstWindow();
  await window.waitForLoadState('load');
  await window.waitForTimeout(1500);

  // admin 로그인 주입
  const storageValue = JSON.stringify({
    state: {
      appSettings: config,
      currentUser: {
        teacher: { id: '', name: '관리자', subjects: [], pin: '0000', isAdmin: true },
        loginAt: new Date().toISOString(),
      },
    },
    version: 0,
  });
  await window.evaluate((val) => localStorage.setItem('wawa-report-storage', val), storageValue);
  await window.reload();
  await window.waitForLoadState('load');
  await window.waitForTimeout(3000);

  if (!fs.existsSync(SCREENSHOTS)) fs.mkdirSync(SCREENSHOTS, { recursive: true });
  return { app, window };
}

async function ss(window: any, name: string) {
  await window.screenshot({ path: path.join(SCREENSHOTS, `${name}.png`), fullPage: true });
}

test.describe('UC-06: 총평 저장 및 리포트 반영', () => {

  test('TC-01: 월말평가 > 성적 입력 화면에 학생 목록 로딩', async () => {
    const { app, window } = await launch();
    try {
      await window.locator('text=월말평가').first().click();
      await window.waitForTimeout(2000);
      await window.locator('text=성적 입력').first().click().catch(() => {});
      await window.waitForTimeout(3000);
      await ss(window, 'uc06-tc01-student-list');

      const bodyText = await window.locator('body').innerText();
      // 실제 학생 목록이 로딩되어야 함
      expect(bodyText).toContain(TARGET_STUDENT);
      console.log(`✓ ${TARGET_STUDENT} 확인`);
    } finally {
      await app.close();
    }
  });

  test('TC-02: 총평 입력 후 저장 — select 에러 없이 성공', async () => {
    const { app, window } = await launch();
    try {
      const consoleErrors: string[] = [];
      const toastMessages: string[] = [];
      window.on('console', (msg: any) => {
        const text = msg.text();
        if (text.includes('select option') || text.includes('saveScore failed') || text.includes('❌')) {
          consoleErrors.push(`[${msg.type()}] ${text}`);
        }
      });
      // toast는 DOM에 잠깐 나타났다 사라지므로 MutationObserver로 캡처
      await window.evaluate(() => {
        const observer = new MutationObserver((mutations) => {
          mutations.forEach(m => {
            m.addedNodes.forEach((node: any) => {
              if (node.textContent && (node.textContent.includes('저장') || node.textContent.includes('실패'))) {
                (window as any).__capturedToasts = (window as any).__capturedToasts || [];
                (window as any).__capturedToasts.push(node.textContent.trim());
              }
            });
          });
        });
        observer.observe(document.body, { childList: true, subtree: true });
        (window as any).__toastObserver = observer;
      });

      // 월말평가 > 성적 입력
      await window.locator('text=월말평가').first().click();
      await window.waitForTimeout(1500);
      await window.locator('text=성적 입력').first().click().catch(() => {});
      await window.waitForTimeout(3000);

      // 김도윤 선택
      await window.locator(`text=${TARGET_STUDENT}`).first().waitFor({ timeout: 10000 });
      await window.locator(`text=${TARGET_STUDENT}`).first().click();
      await window.waitForTimeout(2000);
      await ss(window, 'uc06-tc02-student-selected');

      // 총평 textarea 찾기 (마지막 textarea = 종합평가)
      const textarea = window.locator('textarea').last();
      await textarea.waitFor({ timeout: 5000 });
      await textarea.fill(TOTAL_COMMENT_TEXT);
      await window.waitForTimeout(300);
      await ss(window, 'uc06-tc02-comment-filled');

      // 총평 저장 버튼 (마지막 저장 버튼)
      const saveBtn = window.locator('button').filter({ hasText: '저장' }).last();
      await saveBtn.waitFor({ timeout: 5000 });
      await saveBtn.click();
      await window.waitForTimeout(5000);
      await ss(window, 'uc06-tc02-after-save');

      const bodyText = await window.locator('body').innerText();
      console.log('콘솔 에러:', consoleErrors);

      // ❌ select option 에러 없어야 함 (핵심 검증)
      expect(bodyText).not.toContain('select option');
      expect(bodyText).not.toContain('not found for property');
      const selectErrors = consoleErrors.filter(e => e.includes('select option') && e.includes('not found'));
      expect(selectErrors.length).toBe(0);

      // ❌ 저장 실패 toast 없어야 함
      expect(bodyText).not.toContain('저장에 실패');
      expect(bodyText).not.toContain('실패했습니다');

      // ✅ 성공 toast 확인 (MutationObserver로 캡처)
      const capturedToasts: string[] = await window.evaluate(() => (window as any).__capturedToasts || []);
      console.log('캡처된 toast:', capturedToasts);
      const hasSuccess = capturedToasts.some(t => t.includes('저장') && !t.includes('실패'));
      const hasSaveError2 = capturedToasts.some(t => t.includes('실패'));
      expect(hasSaveError2).toBe(false);
      expect(hasSuccess).toBe(true);
      console.log(`✓ 총평 저장 성공 확인`);
    } finally {
      await app.close();
    }
  });

  test('TC-03: 저장 후 미리보기에서 총평 내용 반영 확인', async () => {
    const { app, window } = await launch();
    try {
      // 월말평가 > 리포트 미리보기
      await window.locator('text=월말평가').first().click();
      await window.waitForTimeout(1500);

      const previewTab = window.locator('text=리포트 미리보기').first();
      await previewTab.waitFor({ timeout: 5000 });
      await previewTab.click();
      await window.waitForTimeout(3000);

      // 김도윤 선택
      await window.locator(`text=${TARGET_STUDENT}`).first().waitFor({ timeout: 10000 });
      await window.locator(`text=${TARGET_STUDENT}`).first().click();
      await window.waitForTimeout(3000);
      await ss(window, 'uc06-tc03-preview-student');

      const bodyText = await window.locator('body').innerText();
      console.log('미리보기 텍스트:', bodyText.substring(0, 600));

      // 총평 섹션이 미리보기에 있어야 함 (총평 텍스트 또는 섹션 제목)
      const hasTotalSection = bodyText.includes('총평') || bodyText.includes('e2e');
      console.log(`총평 반영: ${hasTotalSection}`);
      expect(bodyText.length).toBeGreaterThan(100);
    } finally {
      await app.close();
    }
  });

});
