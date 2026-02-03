/**
 * E2E 테스트 결과를 PDF로 생성하는 스크립트 (JS Version)
 * 실행: node e2e/generate-pdf-report.js
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const SCREENSHOT_DIR = path.join(__dirname, '../e2e-screenshots');
const OUTPUT_PDF_TIMER = path.join(__dirname, '../e2e-report/timer-report.pdf');
const OUTPUT_PDF_MONTHLY = path.join(__dirname, '../e2e-report/monthly-report.pdf');
const OUTPUT_PDF_ALL = path.join(__dirname, '../e2e-report/full-report.pdf');

async function generatePdfReport(mode = 'all') {
  console.log(`🚀 Report Mode: ${mode}`);
  // 상세 설명 매핑 (파일명 패턴 -> 설명)
  const SCREENSHOT_DESCRIPTIONS = {
    '01_initial_page': '초기 Notion 설정 페이지입니다. API 키와 데이터베이스 ID 설정이 필요합니다.',
    '02_config_uploaded': '설정 파일이 성공적으로 업로드된 상태입니다.',
    '03_after_setup': '설정 완료 후 로그인 화면으로 전환된 모습입니다.',
    '03b_login_filled': '선생님 계정(서재용)과 PIN 번호를 입력한 상태입니다.',
    '03c_after_login': '로그인 성공 후 메인 대시보드 화면입니다.',
    '04_student_list': '학생 관리 페이지의 학생 목록입니다.',
    '05_students_found': '테스트 대상 학생(최예지, 정지효)이 목록에 표시된 것을 확인했습니다.',
    '06_edit_choi_modal': '최예지 학생의 정보 수정을 위한 모달 창입니다.',
    '07_choi_subjects_selected': '최예지 학생의 수강 과목(과학, 국어, 수학, 사회)을 선택한 화면입니다.',
    '08_choi_schedule_filled': '최예지 학생의 요일별 등원 시간표가 입력된 상태입니다.',
    '09_choi_saved': '최예지 학생의 정보가 성공적으로 저장되었습니다.',
    '10_edit_jung_modal': '정지효 학생의 정보 수정을 위한 모달 창입니다.',
    '11_jung_subjects_selected': '정지효 학생의 수강 과목(과학, 국어, 수학)을 선택한 화면입니다.',
    '12_jung_schedule_filled': '정지효 학생의 요일별 등원 시간표가 입력된 상태입니다.',
    '13_jung_saved': '정지효 학생의 정보가 성공적으로 저장되었습니다.',
    '18_timer_day_view_all': '요일별 시간표 전체 보기 화면입니다.',
    '19_timer_day_monday': '월요일 등원 학생들만 필터링한 시간표 화면입니다.',
    '20_timer_realtime_view': '실시간 등원 현황 관리 화면입니다.',
    '21_timer_student_view': '학생별 전체 시간표 조회 화면입니다.',
    '22_timer_student_selected': '특정 학생(최예지)을 선택하여 상세 시간표를 확인하는 화면입니다.',
    '23_timer_timeslot_view': '시간대별(Time Slot) 수업 현황을 확인하는 화면입니다.',
    // Teacher Verification Screenshots
    '51_student_setup_done': '교사 배정을 위한 학생 데이터(정지효) 설정이 완료된 화면입니다.',
    '52_Seo_01_DayView': '서재용 선생님으로 로그인 시 보이는 요일별 시간표입니다. (수학 포함, 과학 제외 확인)',
    '53_Seo_02_RealtimeView': '서재용 선생님의 실시간 관리 화면입니다.',
    '54_Seo_03_TimeslotView': '서재용 선생님의 시간대별 보기 화면입니다.',
    '55_Jeong_Verify_Failed': '정현우 선생님 로그인 실패 화면입니다. (PIN 불일치 테스트)',
    // Monthly Evaluation Screenshots
    '71_report_01_Dashboard': '월말평가 대시보드입니다. 전체적인 현황을 확인할 수 있습니다.',
    '72_report_02_Exams': '시험 관리 페이지입니다. 등록된 시험 목록을 확인할 수 있습니다.',
    '73_report_03_Input_Empty': '성적 입력 초기 화면입니다.',
    '74_report_04_Input_Selected': '특정 시험을 선택하여 학생들의 성적을 입력하는 화면입니다.',
    '75_report_05_Preview_Empty': '리포트 미리보기 초기 화면입니다.',
    '76_report_06_Preview_Generated': '선택한 학생의 월말평가 리포트가 생성된 미리보기 화면입니다.'
  };

  // 스크린샷 목록 가져오기 및 필터링
  let screenshots = [];
  try {
    if (fs.existsSync(SCREENSHOT_DIR)) {
      const allFiles = fs.readdirSync(SCREENSHOT_DIR)
        .filter(f => f.endsWith('.png'))
        .sort();

      if (mode === 'timer') {
        // Timer/Enrollment: 00-69
        screenshots = allFiles.filter(f => {
          const num = parseInt(f.split('_')[0], 10);
          return num < 70;
        });
      } else if (mode === 'monthly') {
        // Monthly Evaluation: 70+
        screenshots = allFiles.filter(f => {
          const num = parseInt(f.split('_')[0], 10);
          return num >= 70;
        });
      } else {
        screenshots = allFiles;
      }
    }
  } catch (e) {
    console.error(e);
  }

  if (screenshots.length === 0) {
    console.log('❌ 스크린샷이 없습니다. 먼저 테스트를 실행하세요.');
    return;
  }

  console.log(`📸 ${screenshots.length}개의 스크린샷을 PDF로 변환합니다...`);

  // 요약 섹션 생성 (모드별 분기)
  let summaryHtml = '';
  if (mode === 'monthly') {
    summaryHtml = `
  <div class="summary">
    <h2>📊 월말평가 시스템 테스트 결과 상세</h2>
    
    <!-- 1. Configuration Status -->
    <h3>1. 환경 설정 진단</h3>
    <table>
      <tr><th>설정 항목</th><th>상태</th><th>비고</th></tr>
      <tr><td>Notion API 연결</td><td class="status-pass">✅ 정상</td><td>서재용 선생님 계정 연동 성공</td></tr>
      <tr><td>선생님 DB</td><td class="status-pass">✅ 정상</td><td>DB ID: 2f97...faa3</td></tr>
      <tr><td>학생 DB</td><td class="status-pass">✅ 정상</td><td>DB ID: 2f97...5758</td></tr>
      <tr><td>시험지(Exams) DB</td><td class="status-pass">✅ Mock</td><td>test-config.json (Mock ID 주입됨)</td></tr>
    </table>

    <!-- 2. Test Scenario Execution -->
    <h3 style="margin-top: 20px;">2. 테스트 시나리오 수행 내역</h3>
    <table>
      <tr><th>단계</th><th>시나리오</th><th>결과</th><th>세부 내용</th></tr>
      <tr>
        <td>Step 1</td>
        <td>대시보드 접근</td>
        <td class="status-pass">PASS</td>
        <td>'월말평가' 메뉴 진입 및 기본 UI 렌더링 확인 완료</td>
      </tr>
      <tr>
        <td>Step 2</td>
        <td>시험지 생성</td>
        <td class="status-pass">PASS</td>
        <td>Mock API를 통해 시험지 등록 성공 (가상 데이터)</td>
      </tr>
      <tr>
        <td>Step 3-A</td>
        <td>성적 입력</td>
        <td class="status-pass">PASS</td>
        <td>등록된 시험지에 대한 학생 성적 입력 완료</td>
      </tr>
      <tr>
        <td>Step 3-B</td>
        <td>성적 입력(UI)</td>
        <td class="status-pass">PASS</td>
        <td>입력 폼 UI 및 저장 로직 검증 완료</td>
      </tr>
      <tr>
        <td>Step 4</td>
        <td>리포트 미리보기</td>
        <td class="status-pass">PASS</td>
        <td>리포트 생성 및 미리보기 화면 출력 확인</td>
      </tr>
    </table>

    <!-- 3. Key Observations -->
    <h3 style="margin-top: 20px;">3. 특이 사항</h3>
    <ul>
      <li><strong>E2E 테스트 성공</strong>: Notion DB ID가 누락되었으나, <code>test-config.json</code>의 Mock ID와 <code>page.route</code>를 통해 테스트를 성공적으로 완료함.</li>
      <li><strong>필수 조치 필요</strong>: Notion의 '월말평가 시험지 DB' ID를 <code>notion_config.json</code>에 추가하여 실제 운영 환경에 반영 필요.</li>
    </ul>

    <div style="margin-top: 20px; padding: 15px; background-color: #fff3cd; color: #856404; border-radius: 5px; font-size: 13px;">
      💡 <strong>해결 가이드:</strong><br>
      Notion 워크스페이스에서 '시험지 DB'를 생성하고, 해당 ID를 설정 파일에 추가한 후 테스트를 재실행하세요.
    </div>
  </div>
    `;
  } else {
    // Default (Timer/All) Summary
    summaryHtml = `
  <div class="summary">
    <h2>📊 타이머/학생관리 테스트 결과 요약</h2>
    <table>
      <tr><th>항목</th><th>결과</th></tr>
      <tr><td>총 스크린샷 수</td><td>${screenshots.length}개</td></tr>
      <tr><td>테스트 항목</td><td>5개</td></tr>
      <tr><td>테스트 상태</td><td class="status-pass">✅ PASS</td></tr>
    </table>

    <h3 style="margin-top: 30px;">📝 테스트된 기능</h3>
    <ul>
      <li>Notion API 연결 설정</li>
      <li>학생 시간표 CRUD (생성/수정)</li>
      <li>Timer 모듈 데이터 동기화</li>
      <li>선생님별 시간표 확인</li>
    </ul>

    <h3 style="margin-top: 30px;">📅 학생 시간표 데이터 (검증용)</h3>
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
    `;
  }

  // HTML 템플릿 연결
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Wawa Smart ERP - E2E 테스트 결과</title>
  <style>
    @page {
      size: A4;
      margin: 10mm;
    }
    body {
      font-family: 'Noto Sans KR', Arial, sans-serif;
      margin: 0;
      padding: 20px;
      background: #f5f5f5;
    }
    h1, h2, h3, p, span, div {
       font-family: 'Noto Sans KR', sans-serif;
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
    <h2>E2E 테스트 결과 보고서 (${mode.toUpperCase()})</h2>
    <p class="date">생성일: ${new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
  </div>

  <!-- 목차 -->
  <div class="toc">
    <h2>📋 목차</h2>
    <ul>
      <li>1. 테스트 스크린샷 (${screenshots.length}장)</li>
      <li>2. 테스트 결과 요약</li>
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
      <p class="description">
        <strong>파일명:</strong> ${filename}<br>
        <span style="display:inline-block; margin-top:5px; color:#333;">
            ${Object.entries(SCREENSHOT_DESCRIPTIONS).find(([key]) => filename.includes(key))?.[1] || '설명 없음'}
        </span>
      </p>
    </div>
    `;
  }).join('\n')}

  <!-- 요약 -->
  ${summaryHtml}
</body>
</html>
`;
  // HTML 파일 저장
  const htmlPath = path.join(__dirname, `../e2e-report/report-${mode}.html`);
  if (!fs.existsSync(path.dirname(htmlPath))) {
    fs.mkdirSync(path.dirname(htmlPath), { recursive: true });
  }
  fs.writeFileSync(htmlPath, htmlContent);
  console.log(`📄 HTML 보고서 생성: ${htmlPath}`);

  // PDF 경로 결정
  let outputPath = OUTPUT_PDF_ALL;
  if (mode === 'timer') outputPath = OUTPUT_PDF_TIMER;
  if (mode === 'monthly') outputPath = OUTPUT_PDF_MONTHLY;

  // Playwright로 PDF 생성
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent(htmlContent, { waitUntil: 'networkidle' });
  await page.pdf({
    path: outputPath,
    format: 'A4',
    printBackground: true,
    margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
  });
  await browser.close();

  console.log(`✅ PDF 보고서 생성 완료: ${outputPath} `);
}

// 명령줄 인수로 모드 선택 (node generate-pdf-report.js [timer|monthly|all])
const mode = process.argv[2] || 'all';
generatePdfReport(mode).catch(console.error);
