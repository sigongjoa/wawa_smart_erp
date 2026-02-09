/**
 * 스크린샷 → PDF 변환 스크립트
 * Usage: npx tsx e2e/generate-pdf.ts
 *
 * 의존성: 순수 Node.js (외부 패키지 불필요)
 * PNG 이미지를 HTML로 조합 → Playwright로 PDF 렌더링
 */
import * as fs from 'fs';
import * as path from 'path';
import { chromium } from 'playwright';

const SCREENSHOT_DIR = path.join(__dirname, '../e2e-screenshots-all');
const OUTPUT_PDF = path.join(__dirname, '../WAWA_ERP_유즈케이스_스크린샷.pdf');

async function generatePDF() {
  // 스크린샷 파일 목록
  const screenshots = fs.readdirSync(SCREENSHOT_DIR)
    .filter(f => f.endsWith('.png'))
    .sort();

  if (screenshots.length === 0) {
    console.error('❌ 스크린샷이 없습니다. 먼저 E2E 테스트를 실행하세요.');
    process.exit(1);
  }

  // index.json 로드 (메타데이터)
  const indexPath = path.join(SCREENSHOT_DIR, 'index.json');
  let indexData: any = null;
  if (fs.existsSync(indexPath)) {
    indexData = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
  }

  // HTML 생성
  const today = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  let currentModule = '';
  let pagesHtml = '';

  for (const screenshot of screenshots) {
    const imgPath = path.join(SCREENSHOT_DIR, screenshot);
    const imgBase64 = fs.readFileSync(imgPath).toString('base64');
    const imgSrc = `data:image/png;base64,${imgBase64}`;

    const meta = indexData?.screenshots?.find((s: any) => s.filename === screenshot);
    const moduleName = meta?.module || '';
    const pageName = meta?.name?.replace(/_/g, ' ') || screenshot;
    const description = meta?.description || '';

    // 모듈 변경 시 구분선
    if (moduleName && moduleName !== currentModule) {
      currentModule = moduleName;
      pagesHtml += `
        <div class="module-divider">
          <h2>${currentModule} 모듈</h2>
        </div>
      `;
    }

    pagesHtml += `
      <div class="page">
        <div class="page-header">
          <span class="module-badge">${moduleName}</span>
          <h3>${pageName}</h3>
          ${description ? `<p class="description">${description}</p>` : ''}
        </div>
        <div class="screenshot-container">
          <img src="${imgSrc}" alt="${pageName}" />
        </div>
      </div>
    `;
  }

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif; color: #1e293b; }

    .cover {
      page-break-after: always;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      height: 100vh; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }
    .cover h1 { font-size: 42px; margin-bottom: 12px; }
    .cover .subtitle { font-size: 20px; opacity: 0.9; margin-bottom: 40px; }
    .cover .meta { font-size: 14px; opacity: 0.7; }
    .cover .meta p { margin: 4px 0; }

    .toc {
      page-break-after: always; padding: 60px 50px;
    }
    .toc h2 { font-size: 28px; margin-bottom: 30px; color: #4f46e5; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; }
    .toc-module { margin-bottom: 20px; }
    .toc-module h3 { font-size: 16px; color: #6366f1; margin-bottom: 8px; }
    .toc-module ul { list-style: none; padding-left: 16px; }
    .toc-module li { font-size: 13px; color: #475569; padding: 3px 0; }
    .toc-module li::before { content: "•"; color: #a5b4fc; margin-right: 8px; }

    .module-divider {
      page-break-before: always;
      display: flex; align-items: center; justify-content: center;
      height: 100vh; background: #f8fafc;
    }
    .module-divider h2 {
      font-size: 36px; color: #4f46e5;
      padding: 20px 50px; border: 3px solid #c7d2fe; border-radius: 16px;
    }

    .page {
      page-break-before: always; padding: 30px 40px;
    }
    .page-header {
      margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid #e2e8f0;
    }
    .module-badge {
      display: inline-block; background: #eef2ff; color: #4f46e5;
      font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 12px;
      margin-bottom: 6px;
    }
    .page-header h3 { font-size: 20px; color: #1e293b; }
    .page-header .description { font-size: 13px; color: #64748b; margin-top: 4px; }

    .screenshot-container {
      text-align: center;
    }
    .screenshot-container img {
      max-width: 100%; max-height: 820px;
      border: 1px solid #e2e8f0; border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.08);
    }

    .summary {
      page-break-before: always; padding: 60px 50px;
    }
    .summary h2 { font-size: 28px; color: #4f46e5; margin-bottom: 30px; }
    .summary table { width: 100%; border-collapse: collapse; }
    .summary th, .summary td { padding: 10px 14px; text-align: left; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
    .summary th { background: #f8fafc; font-weight: 600; color: #475569; }
    .summary td { color: #334155; }
    .summary .count { text-align: center; font-weight: 600; color: #4f46e5; }
  </style>
</head>
<body>
  <!-- 표지 -->
  <div class="cover">
    <h1>WAWA Smart ERP</h1>
    <div class="subtitle">전체 유즈케이스 스크린샷 보고서</div>
    <div class="meta">
      <p>생성일: ${today}</p>
      <p>총 페이지: ${screenshots.length}개</p>
      <p>버전: v1.3.2</p>
    </div>
  </div>

  <!-- 목차 -->
  <div class="toc">
    <h2>목차</h2>
    ${(() => {
      const modules: Record<string, string[]> = {};
      for (const s of indexData?.screenshots || []) {
        if (!modules[s.module]) modules[s.module] = [];
        modules[s.module].push(s.description || s.name);
      }
      return Object.entries(modules).map(([mod, pages]) => `
        <div class="toc-module">
          <h3>${mod}</h3>
          <ul>${pages.map(p => `<li>${p}</li>`).join('')}</ul>
        </div>
      `).join('');
    })()}
  </div>

  <!-- 페이지들 -->
  ${pagesHtml}

  <!-- 요약 -->
  <div class="summary">
    <h2>테스트 요약</h2>
    <table>
      <tr><th>모듈</th><th>페이지 수</th></tr>
      ${(() => {
        const counts: Record<string, number> = {};
        for (const s of indexData?.screenshots || []) {
          counts[s.module] = (counts[s.module] || 0) + 1;
        }
        return Object.entries(counts).map(([mod, cnt]) => `
          <tr><td>${mod}</td><td class="count">${cnt}</td></tr>
        `).join('');
      })()}
      <tr><th>합계</th><th class="count">${screenshots.length}</th></tr>
    </table>
  </div>
</body>
</html>`;

  // Playwright로 PDF 생성
  console.log('📄 PDF 생성 중...');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.pdf({
    path: OUTPUT_PDF,
    format: 'A4',
    printBackground: true,
    margin: { top: '0', bottom: '0', left: '0', right: '0' },
  });
  await browser.close();

  const fileSize = (fs.statSync(OUTPUT_PDF).size / 1024 / 1024).toFixed(2);
  console.log(`\n✅ PDF 생성 완료!`);
  console.log(`  📁 파일: ${OUTPUT_PDF}`);
  console.log(`  📊 크기: ${fileSize} MB`);
  console.log(`  📸 스크린샷: ${screenshots.length}개`);
}

generatePDF().catch(console.error);
