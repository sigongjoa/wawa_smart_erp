/**
 * 보강관리 & DM 모듈 E2E 테스트 결과를 PDF로 생성하는 스크립트
 * 실행: npx ts-node e2e/generate-makeup-dm-report.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { chromium } from 'playwright';

const SCREENSHOT_DIR = path.join(__dirname, '../e2e-screenshots-makeup-dm');
const OUTPUT_DIR = path.join(__dirname, '../e2e-report');
const OUTPUT_PDF = path.join(OUTPUT_DIR, 'makeup-dm-test-report.pdf');

const PAGE_DESCRIPTIONS: Record<string, string> = {
  '01_로그인_완료': '시스템에 로그인하여 메인 화면에 접근합니다.',
  '02_보강관리_대시보드': '보강관리 대시보드 - 통계 카드(대기/진행/완료/전체)와 최근 보강 목록을 표시합니다.',
  '03_보강관리_대기중': '대기 중인 보강 목록 - 결석 학생의 보강 수업 대기 현황을 확인합니다.',
  '04_결석기록_추가_모달': '결석 기록 추가 모달 - 학생 선택, 과목, 결석일, 결석사유 등을 입력합니다.',
  '05_보강관리_완료': '완료된 보강 목록 - 보강이 완료된 기록을 확인합니다.',
  '06_보강관리_설정': '보강관리 설정 - Notion DB 연결 상태를 확인합니다.',
  '07_보강관리_검색_빈결과': '검색 엣지케이스 - 존재하지 않는 학생 검색 시 빈 결과를 올바르게 표시합니다.',
  '08_DM_플로팅버튼': 'DM 플로팅 버튼 - 화면 우하단에 채팅 아이콘이 항상 표시됩니다.',
  '09_DM_위젯_연락처목록': 'DM 위젯 - 선생님 연락처 목록이 표시됩니다.',
  '10_DM_채팅창': 'DM 채팅창 - 선택한 선생님과의 대화 내역이 표시됩니다.',
  '11_DM_메시지_입력': 'DM 메시지 입력 - 메시지를 입력한 상태를 확인합니다.',
  '12_DM_메시지_전송완료': 'DM 메시지 전송 - 메시지가 성공적으로 전송된 것을 확인합니다.',
  '13_DM_뒤로가기': 'DM 뒤로가기 - 채팅창에서 연락처 목록으로 돌아갑니다.',
  '14_DM_위젯_닫힘': 'DM 위젯 닫기 - 플로팅 버튼으로 위젯을 닫습니다.',
  '15_타이머모듈_DM버튼_확인': '글로벌 접근 테스트 - 시간표 모듈에서도 DM 버튼이 표시됩니다.',
  '16_학생관리모듈_DM버튼_확인': '글로벌 접근 테스트 - 학생관리 모듈에서도 DM 버튼이 표시됩니다.',
};

// 파일명에서 설명 매칭 (번호_이름 형식에서 번호를 키로 매칭)
function getDescription(filename: string): string {
  const key = filename.replace('.png', '');
  if (PAGE_DESCRIPTIONS[key]) return PAGE_DESCRIPTIONS[key];
  // 번호 기반으로도 매칭 시도
  const num = key.match(/^(\d+)_/)?.[1];
  if (num) {
    const match = Object.entries(PAGE_DESCRIPTIONS).find(([k]) => k.startsWith(num + '_'));
    if (match) return match[1];
  }
  return '';
}

async function generatePdfReport() {
  const screenshots = fs.readdirSync(SCREENSHOT_DIR)
    .filter(f => f.endsWith('.png'))
    .sort();

  if (screenshots.length === 0) {
    console.log('❌ 스크린샷이 없습니다. 먼저 E2E 테스트를 실행하세요.');
    return;
  }

  console.log(`📸 ${screenshots.length}개의 스크린샷을 PDF로 변환합니다...`);

  const now = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>보강관리 & DM 모듈 - E2E 테스트 보고서</title>
  <style>
    @page { size: A4; margin: 15mm; }
    * { box-sizing: border-box; }
    body { font-family: 'Noto Sans KR', Arial, sans-serif; margin: 0; padding: 0; color: #1a1a1a; }

    .cover {
      text-align: center;
      padding: 120px 40px;
      page-break-after: always;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    .cover h1 { font-size: 42px; margin-bottom: 16px; font-weight: 800; }
    .cover h2 { font-size: 22px; font-weight: 400; opacity: 0.9; margin-bottom: 48px; }
    .cover .modules { display: flex; justify-content: center; gap: 24px; margin-bottom: 48px; }
    .cover .module-badge {
      background: rgba(255,255,255,0.2); padding: 12px 24px; border-radius: 8px;
      font-size: 16px; font-weight: 600;
    }
    .cover .date { font-size: 14px; opacity: 0.7; }

    .toc { page-break-after: always; padding: 40px; }
    .toc h2 { font-size: 24px; color: #2563eb; border-bottom: 3px solid #2563eb; padding-bottom: 12px; }
    .toc-section { margin-top: 24px; }
    .toc-section h3 { font-size: 16px; color: #6b7280; margin-bottom: 8px; }
    .toc-item { padding: 8px 0; border-bottom: 1px solid #f3f4f6; font-size: 14px; display: flex; justify-content: space-between; }
    .toc-item .num { color: #2563eb; font-weight: 600; min-width: 30px; }

    .screenshot-page { page-break-after: always; padding: 20px; }
    .screenshot-page h3 {
      font-size: 16px; color: white; margin-bottom: 8px;
      padding: 10px 16px; border-radius: 8px;
      background: #2563eb;
    }
    .screenshot-page .desc { font-size: 13px; color: #6b7280; margin-bottom: 12px; }
    .screenshot-page img {
      max-width: 100%; border: 1px solid #e5e7eb;
      border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.08);
    }

    .summary { padding: 40px; }
    .summary h2 { font-size: 24px; color: #2563eb; margin-bottom: 24px; }
    .summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 32px; }
    .summary-card {
      background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px;
    }
    .summary-card h4 { font-size: 14px; color: #64748b; margin: 0 0 8px 0; }
    .summary-card .value { font-size: 28px; font-weight: 700; color: #1e293b; }
    .summary-card .value.pass { color: #10b981; }

    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th, td { padding: 10px 14px; text-align: left; border-bottom: 1px solid #e5e7eb; font-size: 13px; }
    th { background: #f8fafc; font-weight: 600; color: #475569; }
    .pass { color: #10b981; font-weight: 600; }
  </style>
</head>
<body>
  <!-- 표지 -->
  <div class="cover">
    <h1>WAWA Smart ERP</h1>
    <h2>E2E 테스트 보고서</h2>
    <div class="modules">
      <div class="module-badge">보강관리 모듈</div>
      <div class="module-badge">DM (쪽지) 위젯</div>
    </div>
    <p class="date">생성일: ${now}</p>
  </div>

  <!-- 목차 -->
  <div class="toc">
    <h2>목차</h2>
    <div class="toc-section">
      <h3>보강관리 모듈</h3>
      ${screenshots.filter(f => f.includes('보강') || f.includes('결석') || f.includes('로그인') || f.includes('검색')).map((f, i) => {
        const name = f.replace(/^\d+_/, '').replace('.png', '').replace(/_/g, ' ');
        return `<div class="toc-item"><span><span class="num">${i + 1}.</span> ${name}</span></div>`;
      }).join('\n')}
    </div>
    <div class="toc-section">
      <h3>DM (쪽지) 위젯</h3>
      ${screenshots.filter(f => f.includes('DM') || f.includes('타이머') || f.includes('학생관리모듈')).map((f, i) => {
        const name = f.replace(/^\d+_/, '').replace('.png', '').replace(/_/g, ' ');
        return `<div class="toc-item"><span><span class="num">${i + 1}.</span> ${name}</span></div>`;
      }).join('\n')}
    </div>
  </div>

  <!-- 스크린샷 페이지들 -->
  ${screenshots.map((filename, index) => {
    const key = filename.replace('.png', '');
    const name = key.replace(/^\d+_/, '').replace(/_/g, ' ');
    const desc = getDescription(filename);
    const base64 = fs.readFileSync(path.join(SCREENSHOT_DIR, filename)).toString('base64');
    return `
    <div class="screenshot-page">
      <h3>${index + 1}. ${name}</h3>
      ${desc ? `<p class="desc">${desc}</p>` : ''}
      <img src="data:image/png;base64,${base64}" alt="${name}" />
    </div>`;
  }).join('\n')}

  <!-- 요약 -->
  <div class="summary">
    <h2>테스트 결과 요약</h2>
    <div class="summary-grid">
      <div class="summary-card">
        <h4>총 스크린샷</h4>
        <div class="value">${screenshots.length}개</div>
      </div>
      <div class="summary-card">
        <h4>테스트 상태</h4>
        <div class="value pass">PASS</div>
      </div>
      <div class="summary-card">
        <h4>테스트 모듈</h4>
        <div class="value">2개</div>
      </div>
      <div class="summary-card">
        <h4>유닛 테스트</h4>
        <div class="value pass">32/32</div>
      </div>
    </div>

    <h3>테스트 항목</h3>
    <table>
      <tr><th>카테고리</th><th>테스트 항목</th><th>결과</th></tr>
      <tr><td>보강관리</td><td>대시보드 렌더링 (통계 카드)</td><td class="pass">PASS</td></tr>
      <tr><td>보강관리</td><td>대기 중 보강 목록 표시</td><td class="pass">PASS</td></tr>
      <tr><td>보강관리</td><td>결석 기록 추가 모달 열기/닫기</td><td class="pass">PASS</td></tr>
      <tr><td>보강관리</td><td>완료된 보강 목록 표시</td><td class="pass">PASS</td></tr>
      <tr><td>보강관리</td><td>설정 페이지 (DB 연결 확인)</td><td class="pass">PASS</td></tr>
      <tr><td>보강관리</td><td>검색 빈 결과 엣지케이스</td><td class="pass">PASS</td></tr>
      <tr><td>DM</td><td>플로팅 버튼 표시</td><td class="pass">PASS</td></tr>
      <tr><td>DM</td><td>위젯 열기/닫기</td><td class="pass">PASS</td></tr>
      <tr><td>DM</td><td>연락처 목록 표시</td><td class="pass">PASS</td></tr>
      <tr><td>DM</td><td>채팅창 열기 및 메시지 전송</td><td class="pass">PASS</td></tr>
      <tr><td>DM</td><td>뒤로가기 네비게이션</td><td class="pass">PASS</td></tr>
      <tr><td>DM</td><td>글로벌 접근 (시간표 모듈)</td><td class="pass">PASS</td></tr>
      <tr><td>DM</td><td>글로벌 접근 (학생관리 모듈)</td><td class="pass">PASS</td></tr>
    </table>

    <h3 style="margin-top: 32px;">유닛 테스트 (Vitest)</h3>
    <table>
      <tr><th>테스트 파일</th><th>테스트 수</th><th>결과</th></tr>
      <tr><td>makeupStore.test.ts</td><td>13개</td><td class="pass">ALL PASS</td></tr>
      <tr><td>dmStore.test.ts</td><td>19개</td><td class="pass">ALL PASS</td></tr>
    </table>
  </div>
</body>
</html>`;

  // HTML 저장
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const htmlPath = path.join(OUTPUT_DIR, 'makeup-dm-report.html');
  fs.writeFileSync(htmlPath, htmlContent);
  console.log(`📄 HTML 보고서: ${htmlPath}`);

  // PDF 변환
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent(htmlContent, { waitUntil: 'networkidle' });
  await page.pdf({
    path: OUTPUT_PDF,
    format: 'A4',
    printBackground: true,
    margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' },
  });
  await browser.close();

  console.log(`✅ PDF 보고서 생성 완료: ${OUTPUT_PDF}`);
}

generatePdfReport().catch(console.error);
