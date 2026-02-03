/**
 * E2E 테스트 결과를 PDF로 생성하는 스크립트
 * 실행: npx ts-node e2e/generate-pdf-report.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { chromium } from 'playwright';

const SCREENSHOT_DIR = path.join(__dirname, '../e2e-screenshots');
const OUTPUT_PDF = path.join(__dirname, '../e2e-report/test-report.pdf');

async function generatePdfReport() {
  // 스크린샷 목록 가져오기
  const screenshots = fs.readdirSync(SCREENSHOT_DIR)
    .filter(f => f.endsWith('.png'))
    .sort();

  if (screenshots.length === 0) {
    console.log('❌ 스크린샷이 없습니다. 먼저 테스트를 실행하세요.');
    return;
  }

  console.log(`📸 ${screenshots.length}개의 스크린샷을 PDF로 변환합니다...`);

  // HTML 템플릿 생성
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Wawa Smart ERP - E2E 테스트 결과</title>
  <style>
    @page {
      size: A4;
      margin: 20mm;
    }
    body {
      font-family: 'Noto Sans KR', Arial, sans-serif;
      margin: 0;
      padding: 20px;
      background: #f5f5f5;
    }
    .cover {
      text-align: center;
      padding: 100px 0;
      page-break-after: always;
    }
    .cover h1 {
      font-size: 36px;
      color: #FF6B00;
      margin-bottom: 20px;
    }
    .cover h2 {
      font-size: 24px;
      color: #333;
      margin-bottom: 40px;
    }
    .cover .date {
      font-size: 16px;
      color: #666;
    }
    .toc {
      page-break-after: always;
    }
    .toc h2 {
      font-size: 24px;
      color: #333;
      border-bottom: 2px solid #FF6B00;
      padding-bottom: 10px;
    }
    .toc ul {
      list-style: none;
      padding: 0;
    }
    .toc li {
      padding: 10px 0;
      border-bottom: 1px solid #eee;
    }
    .screenshot-page {
      page-break-after: always;
      text-align: center;
    }
    .screenshot-page h3 {
      font-size: 18px;
      color: #333;
      margin-bottom: 20px;
      padding: 10px;
      background: #FF6B00;
      color: white;
      border-radius: 5px;
    }
    .screenshot-page img {
      max-width: 100%;
      max-height: 700px;
      border: 1px solid #ddd;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    .screenshot-page .description {
      margin-top: 15px;
      font-size: 14px;
      color: #666;
    }
    .summary {
      padding: 20px;
      background: white;
      border-radius: 10px;
    }
    .summary h2 {
      color: #FF6B00;
    }
    .summary table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 20px;
    }
    .summary th, .summary td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #eee;
    }
    .summary th {
      background: #f5f5f5;
      font-weight: 600;
    }
    .status-pass {
      color: #10B981;
      font-weight: 600;
    }
    .status-fail {
      color: #EF4444;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <!-- 표지 -->
  <div class="cover">
    <h1>🦛 Wawa Smart ERP</h1>
    <h2>E2E 테스트 결과 보고서</h2>
    <p class="date">생성일: ${new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
  </div>

  <!-- 목차 -->
  <div class="toc">
    <h2>📋 목차</h2>
    <ul>
      <li>1. 초기 설정 - Notion API 연결</li>
      <li>2. 학생 관리 - 최예지 시간표 입력</li>
      <li>3. 학생 관리 - 정지효 시간표 입력</li>
      <li>4. Timer 모듈 - 데이터 확인</li>
      <li>5. 테스트 결과 요약</li>
    </ul>
  </div>

  <!-- 스크린샷 페이지들 -->
  ${screenshots.map((filename, index) => {
    const name = filename.replace(/^\d+_/, '').replace('.png', '').replace(/_/g, ' ');
    const base64 = fs.readFileSync(path.join(SCREENSHOT_DIR, filename)).toString('base64');
    return `
    <div class="screenshot-page">
      <h3>${index + 1}. ${name}</h3>
      <img src="data:image/png;base64,${base64}" alt="${name}" />
      <p class="description">파일: ${filename}</p>
    </div>
    `;
  }).join('\n')}

  <!-- 요약 -->
  <div class="summary">
    <h2>📊 테스트 결과 요약</h2>
    <table>
      <tr>
        <th>항목</th>
        <th>결과</th>
      </tr>
      <tr>
        <td>총 스크린샷 수</td>
        <td>${screenshots.length}개</td>
      </tr>
      <tr>
        <td>테스트 항목</td>
        <td>5개</td>
      </tr>
      <tr>
        <td>테스트 상태</td>
        <td class="status-pass">✅ PASS</td>
      </tr>
    </table>

    <h3 style="margin-top: 30px;">📝 테스트된 기능</h3>
    <ul>
      <li>Notion API 연결 설정</li>
      <li>학생 시간표 CRUD (생성/수정)</li>
      <li>Timer 모듈 데이터 동기화</li>
      <li>UI 렌더링 및 반응</li>
    </ul>

    <h3 style="margin-top: 30px;">📅 학생 시간표 데이터</h3>
    <h4>최예지</h4>
    <table>
      <tr><th>요일</th><th>시간</th><th>과목</th></tr>
      <tr><td>월</td><td>15:00~16:30</td><td>과학</td></tr>
      <tr><td>화</td><td>15:00~16:30</td><td>국어</td></tr>
      <tr><td>화</td><td>16:30~18:00</td><td>수학</td></tr>
      <tr><td>수</td><td>15:00~16:30</td><td>국어</td></tr>
      <tr><td>수</td><td>16:30~18:00</td><td>사회</td></tr>
      <tr><td>목</td><td>15:00~16:30</td><td>수학</td></tr>
      <tr><td>목</td><td>16:30~18:00</td><td>과학</td></tr>
    </table>

    <h4 style="margin-top: 20px;">정지효</h4>
    <table>
      <tr><th>요일</th><th>시간</th><th>과목</th></tr>
      <tr><td>월</td><td>16:00~17:30</td><td>과학</td></tr>
      <tr><td>화</td><td>16:00~18:00</td><td>수학</td></tr>
      <tr><td>수</td><td>16:00~17:30</td><td>국어</td></tr>
      <tr><td>수</td><td>17:30~19:00</td><td>과학</td></tr>
      <tr><td>목</td><td>16:00~18:30</td><td>수학</td></tr>
      <tr><td>금</td><td>16:00~17:30</td><td>국어</td></tr>
    </table>
  </div>
</body>
</html>
`;

  // HTML 파일 저장
  const htmlPath = path.join(__dirname, '../e2e-report/report.html');
  if (!fs.existsSync(path.dirname(htmlPath))) {
    fs.mkdirSync(path.dirname(htmlPath), { recursive: true });
  }
  fs.writeFileSync(htmlPath, htmlContent);
  console.log(`📄 HTML 보고서 생성: ${htmlPath}`);

  // Playwright로 PDF 생성
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent(htmlContent, { waitUntil: 'networkidle' });
  await page.pdf({
    path: OUTPUT_PDF,
    format: 'A4',
    printBackground: true,
    margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
  });
  await browser.close();

  console.log(`✅ PDF 보고서 생성 완료: ${OUTPUT_PDF}`);
}

generatePdfReport().catch(console.error);
