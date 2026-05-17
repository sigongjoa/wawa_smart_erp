#!/usr/bin/env node
/**
 * result.json → REPORT.md 변환.
 * 실행: node e2e/uc-report/build-report.mjs
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'result.json'), 'utf8'));
const contentPath = path.join(__dirname, 'content-result.json');
const content = fs.existsSync(contentPath) ? JSON.parse(fs.readFileSync(contentPath, 'utf8')) : null;

const lines = [];
lines.push('# AskAI E2E UC 보고서');
lines.push('');
lines.push(`- **생성 시각**: ${data.generated_at}`);
lines.push(`- **검증 사이트**: ${data.site}`);
lines.push(`- **총 UC**: ${data.results.length}`);
const pass = data.results.filter((r) => r.status === 'PASS').length;
const fail = data.results.length - pass;
lines.push(`- **결과**: ${pass} PASS / ${fail} FAIL`);
lines.push('');
lines.push('각 UC는 Playwright 가 실제 브라우저로 사이트를 조작하면서 캡처한 결과입니다. 스크린샷은 같은 폴더의 PNG, 네트워크 응답 코드 + assertion 통과 여부도 함께 기록.');
lines.push('');

for (const r of data.results) {
  lines.push(`---`);
  lines.push('');
  lines.push(`## ${r.uc} — ${r.desc}`);
  lines.push('');
  lines.push(`- **상태**: ${r.status === 'PASS' ? '✅ PASS' : '❌ FAIL'}`);
  if (r.url) lines.push(`- **최종 URL**: \`${r.url}\``);
  lines.push('');
  if (r.error) {
    lines.push(`> ⚠ 에러: ${r.error}`);
    lines.push('');
  }

  if (r.network && r.network.length > 0) {
    lines.push('**네트워크 응답**:');
    lines.push('');
    lines.push('| Endpoint | Status |');
    lines.push('|---|---|');
    for (const n of r.network) {
      const ok = n.status >= 200 && n.status < 300;
      lines.push(`| \`${n.url}\` | ${ok ? '✅' : '⚠'} ${n.status} |`);
    }
    lines.push('');
  }

  if (r.assertions && r.assertions.length > 0) {
    lines.push('**검증**:');
    lines.push('');
    lines.push('| 항목 | 결과 | 상세 |');
    lines.push('|---|---|---|');
    for (const a of r.assertions) {
      const detail = (a.detail ?? '').toString().replace(/\|/g, '\\|').slice(0, 80);
      lines.push(`| ${a.check} | ${a.ok ? '✅' : '❌'} | \`${detail}\` |`);
    }
    lines.push('');
  }

  lines.push('**스크린샷**:');
  lines.push('');
  lines.push(`![${r.uc}](./${r.screenshot})`);
  lines.push('');
}

// ─────────── content (AI 답변 + 숙제) ───────────

if (content) {
  lines.push('---');
  lines.push('');
  lines.push('# 컨텐츠 검증 (AI 답변 + 숙제)');
  lines.push('');
  lines.push(`- **생성**: ${content.generated_at}`);
  const aiPass = content.ai.filter((r) => r.status === 'PASS').length;
  const hwPass = content.homework.filter((r) => r.status === 'PASS').length;
  lines.push(`- **AI**: ${aiPass}/${content.ai.length} PASS · **숙제**: ${hwPass}/${content.homework.length} PASS`);
  lines.push('');

  for (const r of content.ai) {
    lines.push(`## ${r.id.toUpperCase()} — AI 답변 검증`);
    lines.push('');
    lines.push(`- **상태**: ${r.status === 'PASS' ? '✅ PASS' : '❌ FAIL'}  · HTTP \`${r.http_status}\` · steps \`${r.step_count}\` · KaTeX \`${r.katex_count}\``);
    lines.push('');
    lines.push(`**질문**: ${r.question}`);
    lines.push('');

    if (r.assertions?.length) {
      lines.push('**검증**:');
      lines.push('');
      lines.push('| 항목 | 결과 | 상세 |');
      lines.push('|---|---|---|');
      for (const a of r.assertions) {
        const detail = (a.detail ?? '').toString().replace(/\|/g, '\\|').slice(0, 80);
        lines.push(`| ${a.check} | ${a.ok ? '✅' : '❌'} | \`${detail}\` |`);
      }
      lines.push('');
    }

    if (r.steps_summary?.length) {
      lines.push('**AI 응답 step**:');
      lines.push('');
      lines.push('| # | kind | 제목 / 질문 | 본문 미리보기 |');
      lines.push('|---|---|---|---|');
      r.steps_summary.forEach((s, i) => {
        const head = (s.title ?? s.question ?? '—').replace(/\|/g, '\\|').slice(0, 60);
        const prev = (s.preview ?? '').replace(/\n/g, ' ').replace(/\|/g, '\\|').slice(0, 100);
        lines.push(`| ${i + 1} | \`${s.kind}\` | ${head} | ${prev} |`);
      });
      lines.push('');
    }

    if (r.response_text) {
      lines.push('**첫 explain 본문 (raw)**:');
      lines.push('');
      lines.push('```markdown');
      lines.push(r.response_text.slice(0, 600));
      lines.push('```');
      lines.push('');
    }

    lines.push('**스크린샷**:');
    lines.push('');
    lines.push(`![${r.id}](./${r.screenshot})`);
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  for (const r of content.homework) {
    lines.push(`## ${r.id.toUpperCase()} — ${r.desc}`);
    lines.push('');
    lines.push(`- **상태**: ${r.status === 'PASS' ? '✅ PASS' : '❌ FAIL'}`);
    if (r.url) lines.push(`- **URL**: \`${r.url}\``);
    if (r.error) lines.push(`- **error**: ${r.error}`);
    lines.push('');

    if (r.assertions?.length) {
      lines.push('**검증**:');
      lines.push('');
      lines.push('| 항목 | 결과 | 상세 |');
      lines.push('|---|---|---|');
      for (const a of r.assertions) {
        const detail = (a.detail ?? '').toString().replace(/\|/g, '\\|').replace(/\n/g, ' ').slice(0, 100);
        lines.push(`| ${a.check} | ${a.ok ? '✅' : '❌'} | \`${detail}\` |`);
      }
      lines.push('');
    }

    lines.push('**스크린샷**:');
    lines.push('');
    lines.push(`![${r.id}](./${r.screenshot})`);
    lines.push('');
    lines.push('---');
    lines.push('');
  }
}

lines.push('---');
lines.push('');
lines.push('## 재현 방법');
lines.push('');
lines.push('```bash');
lines.push('cd apps/student');
lines.push('npx playwright test e2e/screenshot-uc-report.spec.ts --project=chromium --workers=1');
lines.push('npx playwright test e2e/screenshot-content-report.spec.ts --project=chromium --workers=1');
lines.push('node e2e/uc-report/build-report.mjs');
lines.push('```');
lines.push('');

fs.writeFileSync(path.join(__dirname, 'REPORT.md'), lines.join('\n'));
console.log(`✅ REPORT.md generated (${pass}/${data.results.length} passed)`);
