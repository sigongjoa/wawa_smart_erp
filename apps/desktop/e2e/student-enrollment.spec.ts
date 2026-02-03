import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// Load config from external file (not committed to git)
const configPath = path.join(__dirname, 'test-config.json');
if (!fs.existsSync(configPath)) {
  throw new Error(`Test config not found: ${configPath}. Copy test-config.sample.json and fill in your values.`);
}
const NOTION_CONFIG = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

// 학생별 시간표 데이터
const STUDENT_SCHEDULES: Record<string, { day: string; startTime: string; endTime: string; subject: string }[]> = {
  '최예지': [
    { day: '월', startTime: '15:00', endTime: '16:30', subject: '과학' },
    { day: '화', startTime: '15:00', endTime: '16:30', subject: '국어' },
    { day: '화', startTime: '16:30', endTime: '18:00', subject: '수학' },
    { day: '수', startTime: '15:00', endTime: '16:30', subject: '국어' },
    { day: '수', startTime: '16:30', endTime: '18:00', subject: '사회' },
    { day: '목', startTime: '15:00', endTime: '16:30', subject: '수학' },
    { day: '목', startTime: '16:30', endTime: '18:00', subject: '과학' },
  ],
  '정지효': [
    { day: '월', startTime: '16:00', endTime: '17:30', subject: '과학' },
    { day: '화', startTime: '16:00', endTime: '18:00', subject: '수학' },
    { day: '수', startTime: '16:00', endTime: '17:30', subject: '국어' },
    { day: '수', startTime: '17:30', endTime: '19:00', subject: '과학' },
    { day: '목', startTime: '16:00', endTime: '18:30', subject: '수학' },
    { day: '금', startTime: '16:00', endTime: '17:30', subject: '국어' },
  ],
  // 가상 학생 - 테스트용
  '김민준': [
    { day: '월', startTime: '14:00', endTime: '15:30', subject: '영어' },
    { day: '월', startTime: '15:30', endTime: '17:00', subject: '수학' },
    { day: '화', startTime: '14:00', endTime: '15:30', subject: '영어' },
    { day: '수', startTime: '14:00', endTime: '16:00', subject: '국어' },
    { day: '목', startTime: '14:00', endTime: '15:30', subject: '영어' },
    { day: '금', startTime: '14:00', endTime: '15:30', subject: '수학' },
    { day: '금', startTime: '15:30', endTime: '17:00', subject: '영어' },
  ],
};

// 스크린샷 저장 경로
const SCREENSHOT_DIR = path.join(__dirname, '../e2e-screenshots');

// 스크린샷 카운터
let screenshotCounter = 0;

async function takeScreenshot(page: Page, name: string) {
  screenshotCounter++;
  const filename = `${String(screenshotCounter).padStart(2, '0')}_${name}.png`;
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, filename),
    fullPage: true
  });
  console.log(`📸 Screenshot: ${filename}`);
  return filename;
}

// Config JSON 파일 생성
function createConfigFile(): string {
  const configPath = path.join(__dirname, 'test-config.json');
  fs.writeFileSync(configPath, JSON.stringify(NOTION_CONFIG, null, 2));
  return configPath;
}

// 전체 E2E 테스트 (하나의 테스트로 진행)
test('Wawa Smart ERP - 전체 E2E 테스트', async ({ page }) => {
  test.setTimeout(300000); // 5분 타임아웃

  // 스크린샷 디렉토리 초기화
  if (fs.existsSync(SCREENSHOT_DIR)) {
    const files = fs.readdirSync(SCREENSHOT_DIR);
    for (const file of files) {
      if (file.endsWith('.png')) {
        fs.unlinkSync(path.join(SCREENSHOT_DIR, file));
      }
    }
  } else {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  // ==========================================
  // 1. 초기 설정 - Notion API 연결
  // ==========================================
  console.log('\n📌 Step 1: 초기 설정 - Notion API 연결');

  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await takeScreenshot(page, '01_initial_page');

  // 초기 설정 화면 확인 - JSON 파일 업로드 영역이 있는지 확인
  const uploadArea = page.locator('text=파일 선택 또는 드래그 앤 드롭');
  const hasUploadArea = await uploadArea.count() > 0;

  if (hasUploadArea) {
    console.log('  → 초기 설정 화면 감지, JSON 업로드 진행');

    // Config JSON 파일 생성 및 업로드
    const configPath = createConfigFile();
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(configPath);

    await page.waitForTimeout(3000);
    await takeScreenshot(page, '02_config_uploaded');

    // 연결 성공 대기
    await page.waitForTimeout(5000);
  } else {
    console.log('  → 이미 설정됨, 스킵');
  }

  await takeScreenshot(page, '03_after_setup');

  // ==========================================
  // 1-2. 로그인 (선생님 선택 + PIN)
  // ==========================================
  const loginForm = page.locator('text=선생님 선택');
  if (await loginForm.count() > 0) {
    console.log('  → 로그인 화면 감지');

    // 선생님 목록 로딩 대기
    await page.waitForTimeout(2000);

    // 선생님 선택 (서재용)
    const teacherSelect = page.locator('select.search-input').first();
    await teacherSelect.selectOption({ label: '서재용' });
    await page.waitForTimeout(500);

    // PIN 입력 (서재용: 1141)
    const pinInput = page.locator('input[type="password"]');
    await pinInput.fill('1141');

    await takeScreenshot(page, '03b_login_filled');

    // 접속하기 버튼 클릭
    await page.click('button:has-text("접속하기")');
    await page.waitForTimeout(3000);
    await takeScreenshot(page, '03c_after_login');
  }

  // ==========================================
  // 2. 학생 관리 페이지로 이동
  // ==========================================
  console.log('\n📌 Step 2: 학생 관리 페이지');

  await page.click('text=학생관리');
  await page.waitForTimeout(3000);
  await takeScreenshot(page, '04_student_list');

  // 학생 목록 확인
  const studentTable = page.locator('.data-table, table').first();
  await expect(studentTable).toBeVisible({ timeout: 15000 });

  // 학생 확인
  const choiExists = await page.locator('text=최예지').count() > 0;
  const jungExists = await page.locator('text=정지효').count() > 0;
  console.log(`  → 최예지: ${choiExists ? '있음 ✅' : '없음 ❌'}`);
  console.log(`  → 정지효: ${jungExists ? '있음 ✅' : '없음 ❌'}`);

  await takeScreenshot(page, '05_students_found');

  // ==========================================
  // 3. 최예지 학생 시간표 입력
  // ==========================================
  console.log('\n📌 Step 3: 최예지 학생 시간표 입력');

  // 최예지 학생이 있는지 확인
  if (choiExists) {
    console.log('  → 최예지 학생 발견, 수정 진행');
    const choiRow = page.locator('tr', { hasText: '최예지' }).first();
    const editBtnChoi = choiRow.locator('button').first();
    await editBtnChoi.click();
  } else {
    console.log('  → 최예지 학생 없음, 새로 추가');
    await page.click('button:has-text("학생 추가")');
  }

  await page.waitForTimeout(1000);
  await takeScreenshot(page, '06_edit_choi_modal');

  // 모달 확인
  const modal = page.locator('.modal-content');
  await expect(modal).toBeVisible({ timeout: 5000 });

  // 새 학생인 경우 기본 정보 입력
  if (!choiExists) {
    const nameInput = modal.locator('input').first();
    await nameInput.fill('최예지');
    await page.waitForTimeout(300);

    // 학년 선택 - 중2
    const gradeSelect = modal.locator('select.form-select').first();
    await gradeSelect.selectOption('중2');
    await page.waitForTimeout(300);
  }

  // 과목 선택 (과학, 국어, 수학, 사회) - 이미 선택된 과목은 클릭하지 않음
  console.log('  → 과목 선택 중...');
  const subjectsChoi = ['과학', '국어', '수학', '사회'];

  for (const subject of subjectsChoi) {
    const subjectBtn = modal.locator(`button[type="button"]`).filter({ hasText: new RegExp(`^${subject}$`) });
    const btnCount = await subjectBtn.count();

    if (btnCount > 0) {
      // 버튼 스타일 확인 - 선택된 상태면 border-color가 primary
      const btn = subjectBtn.first();
      const borderColor = await btn.evaluate(el => getComputedStyle(el).borderColor);
      const isSelected = borderColor.includes('59') || borderColor.includes('99'); // primary blue 색상

      if (!isSelected) {
        await btn.click();
        await page.waitForTimeout(500);
        console.log(`    ✓ ${subject} 선택됨 (새로 클릭)`);
      } else {
        console.log(`    ✓ ${subject} 이미 선택됨 (스킵)`);
      }
    } else {
      console.log(`    ! ${subject} 버튼을 찾을 수 없음`);
    }
  }

  await page.waitForTimeout(1000);
  await takeScreenshot(page, '07_choi_subjects_selected');

  // 선택된 과목들의 섹션이 나타났는지 확인
  const selectedSubjectSections = modal.locator('.subject-badge');
  const sectionCount = await selectedSubjectSections.count();
  console.log(`  → 선택된 과목 섹션 수: ${sectionCount}`);

  if (sectionCount === 0) {
    console.log('  ! 경고: 선택된 과목 섹션이 없습니다. 과목 버튼 선택 실패');
    // 디버깅: 모든 버튼 출력
    const allButtons = modal.locator('button[type="button"]');
    const allCount = await allButtons.count();
    console.log(`  디버깅: 모달 내 type="button" 개수: ${allCount}`);
    for (let i = 0; i < Math.min(allCount, 10); i++) {
      const text = await allButtons.nth(i).textContent();
      console.log(`    버튼 ${i}: "${text}"`);
    }
  }

  // 시간표 입력
  console.log('  → 시간표 입력 중...');
  const schedulesChoi = STUDENT_SCHEDULES['최예지'];
  const bySubjectChoi: Record<string, typeof schedulesChoi> = {};
  for (const s of schedulesChoi) {
    if (!bySubjectChoi[s.subject]) bySubjectChoi[s.subject] = [];
    bySubjectChoi[s.subject].push(s);
  }

  // 과목 섹션들을 순서대로 처리 (formData.subjects 순서로 렌더링됨)
  // 섹션 컨테이너 찾기: background 스타일이 있는 div들
  const subjectContainers = modal.locator('div[style*="background"]').filter({
    has: page.locator('.subject-badge')
  });
  const containerCount = await subjectContainers.count();
  console.log(`  → 과목 컨테이너 수: ${containerCount}`);

  // 각 과목별 선생님 선택 및 시간표 입력
  for (const [subject, entries] of Object.entries(bySubjectChoi)) {
    console.log(`    - ${subject}: ${entries.length}개 일정`);

    // 해당 과목의 섹션 찾기 - 정확한 텍스트 매칭
    let section = null;
    for (let ci = 0; ci < containerCount; ci++) {
      const container = subjectContainers.nth(ci);
      const badge = container.locator('.subject-badge');
      if (await badge.count() > 0) {
        const badgeText = await badge.textContent();
        if (badgeText?.trim() === subject) {
          section = container;
          break;
        }
      }
    }

    if (!section) {
      console.log(`    ! ${subject} 섹션을 찾을 수 없음`);
      continue;
    }

    // 섹션 내의 모든 select와 input[type="time"] 찾기
    // 구조: teacher select (1개) + day selects (3개) = 총 4개 select
    // time inputs: 3 slots × 2 (start, end) = 총 6개
    const allSelects = section.locator('select');
    const allTimeInputs = section.locator('input[type="time"]');

    const selectCount = await allSelects.count();
    const timeInputCount = await allTimeInputs.count();
    console.log(`      (${selectCount} selects, ${timeInputCount} time inputs)`);

    // 선생님 선택 (첫 번째 select가 teacher select) - UI가 이미 해당 과목 선생님만 필터링함
    if (selectCount > 0) {
      const teacherSelect = allSelects.first();
      const options = await teacherSelect.locator('option').allTextContents();
      // 첫 번째 유효한 선생님 선택 (미지정 제외)
      const validOption = options.find(opt => opt && !opt.includes('미지정') && !opt.includes('없음'));
      if (validOption) {
        await teacherSelect.selectOption({ label: validOption });
        console.log(`      ✓ 선생님: ${validOption}`);
        await page.waitForTimeout(100);
      }
    }

    for (let i = 0; i < Math.min(entries.length, 3); i++) {
      const entry = entries[i];
      try {
        // Day select: index 1, 2, 3 (0번은 teacher select)
        const daySelectIdx = i + 1;
        if (daySelectIdx < selectCount) {
          await allSelects.nth(daySelectIdx).selectOption(entry.day);
          await page.waitForTimeout(100);
        }
        // Time inputs: 0-1 for slot 0, 2-3 for slot 1, 4-5 for slot 2
        const startTimeIdx = i * 2;
        const endTimeIdx = i * 2 + 1;
        if (startTimeIdx < timeInputCount) {
          await allTimeInputs.nth(startTimeIdx).fill(entry.startTime);
          await page.waitForTimeout(100);
        }
        if (endTimeIdx < timeInputCount) {
          await allTimeInputs.nth(endTimeIdx).fill(entry.endTime);
          await page.waitForTimeout(100);
        }
        console.log(`      슬롯 ${i}: ${entry.day} ${entry.startTime}~${entry.endTime} ✓`);
      } catch (e) {
        console.log(`    ! ${subject} 슬롯 ${i} 입력 실패: ${e}`);
      }
    }
  }
  await takeScreenshot(page, '08_choi_schedule_filled');

  // 저장
  console.log('  → 저장 중...');
  const saveBtnChoi = modal.locator('button[type="submit"], button:has-text("수정 완료"), button:has-text("저장"), button:has-text("등록")').first();
  await saveBtnChoi.click();
  await page.waitForTimeout(3000);
  await takeScreenshot(page, '09_choi_saved');

  // ==========================================
  // 4. 정지효 학생 시간표 입력
  // ==========================================
  console.log('\n📌 Step 4: 정지효 학생 시간표 입력');

  // 모달이 닫혔는지 확인하고, 안 닫혔으면 새로고침
  if (await page.locator('.modal-content').count() > 0) {
    await page.click('.modal-close-btn, .modal-overlay');
    await page.waitForTimeout(500);
  }

  // 페이지 새로고침 후 다시 학생관리로
  await page.click('text=학생관리');
  await page.waitForTimeout(2000);

  // 정지효 학생이 있는지 확인
  const jungExistsNow = await page.locator('text=정지효').count() > 0;

  if (jungExistsNow) {
    console.log('  → 정지효 학생 발견, 수정 진행');
    const jungRow = page.locator('tr', { hasText: '정지효' }).first();
    const editBtnJung = jungRow.locator('button').first();
    await editBtnJung.click();
  } else {
    console.log('  → 정지효 학생 없음, 새로 추가');
    await page.click('button:has-text("학생 추가")');
  }

  await page.waitForTimeout(1000);
  await takeScreenshot(page, '10_edit_jung_modal');

  // 모달 확인
  await expect(page.locator('.modal-content')).toBeVisible({ timeout: 5000 });
  const modal2 = page.locator('.modal-content');

  // 새 학생인 경우 기본 정보 입력
  if (!jungExistsNow) {
    const nameInput = modal2.locator('input').first();
    await nameInput.fill('정지효');
    await page.waitForTimeout(300);

    // 학년 선택 - 중1
    const gradeSelect = modal2.locator('select.form-select').first();
    await gradeSelect.selectOption('중1');
    await page.waitForTimeout(300);
  }

  // 과목 선택 (과학, 국어, 수학) - 이미 선택된 과목은 클릭하지 않음
  console.log('  → 과목 선택 중...');
  const subjectsJung = ['과학', '국어', '수학'];

  for (const subject of subjectsJung) {
    const subjectBtn = modal2.locator(`button[type="button"]`).filter({ hasText: new RegExp(`^${subject}$`) });
    const btnCount = await subjectBtn.count();

    if (btnCount > 0) {
      const btn = subjectBtn.first();
      const borderColor = await btn.evaluate(el => getComputedStyle(el).borderColor);
      const isSelected = borderColor.includes('59') || borderColor.includes('99');

      if (!isSelected) {
        await btn.click();
        await page.waitForTimeout(500);
        console.log(`    ✓ ${subject} 선택됨 (새로 클릭)`);
      } else {
        console.log(`    ✓ ${subject} 이미 선택됨 (스킵)`);
      }
    }
  }

  await page.waitForTimeout(1000);
  await takeScreenshot(page, '11_jung_subjects_selected');

  // 시간표 입력
  console.log('  → 시간표 입력 중...');
  const schedulesJung = STUDENT_SCHEDULES['정지효'];
  const bySubjectJung: Record<string, typeof schedulesJung> = {};
  for (const s of schedulesJung) {
    if (!bySubjectJung[s.subject]) bySubjectJung[s.subject] = [];
    bySubjectJung[s.subject].push(s);
  }

  // 과목 섹션들 찾기
  const subjectContainers2 = modal2.locator('div[style*="background"]').filter({
    has: page.locator('.subject-badge')
  });
  const containerCount2 = await subjectContainers2.count();
  console.log(`  → 과목 컨테이너 수: ${containerCount2}`);

  for (const [subject, entries] of Object.entries(bySubjectJung)) {
    console.log(`    - ${subject}: ${entries.length}개 일정`);

    // 해당 과목의 섹션 찾기
    let section = null;
    for (let ci = 0; ci < containerCount2; ci++) {
      const container = subjectContainers2.nth(ci);
      const badge = container.locator('.subject-badge');
      if (await badge.count() > 0) {
        const badgeText = await badge.textContent();
        if (badgeText?.trim() === subject) {
          section = container;
          break;
        }
      }
    }

    if (!section) {
      console.log(`    ! ${subject} 섹션을 찾을 수 없음`);
      continue;
    }

    const allSelects = section.locator('select');
    const allTimeInputs = section.locator('input[type="time"]');

    const selectCount = await allSelects.count();
    const timeInputCount = await allTimeInputs.count();
    console.log(`      (${selectCount} selects, ${timeInputCount} time inputs)`);

    // 선생님 선택 (첫 번째 select) - UI가 이미 해당 과목 선생님만 필터링함
    if (selectCount > 0) {
      const teacherSelect = allSelects.first();
      const options = await teacherSelect.locator('option').allTextContents();
      const validOption = options.find(opt => opt && !opt.includes('미지정') && !opt.includes('없음'));
      if (validOption) {
        await teacherSelect.selectOption({ label: validOption });
        console.log(`      ✓ 선생님: ${validOption}`);
        await page.waitForTimeout(100);
      }
    }

    for (let i = 0; i < Math.min(entries.length, 3); i++) {
      const entry = entries[i];
      try {
        const daySelectIdx = i + 1;
        if (daySelectIdx < selectCount) {
          await allSelects.nth(daySelectIdx).selectOption(entry.day);
          await page.waitForTimeout(100);
        }
        const startTimeIdx = i * 2;
        const endTimeIdx = i * 2 + 1;
        if (startTimeIdx < timeInputCount) {
          await allTimeInputs.nth(startTimeIdx).fill(entry.startTime);
          await page.waitForTimeout(100);
        }
        if (endTimeIdx < timeInputCount) {
          await allTimeInputs.nth(endTimeIdx).fill(entry.endTime);
          await page.waitForTimeout(100);
        }
        console.log(`      슬롯 ${i}: ${entry.day} ${entry.startTime}~${entry.endTime} ✓`);
      } catch (e) {
        console.log(`    ! ${subject} 슬롯 ${i} 입력 실패: ${e}`);
      }
    }
  }
  await takeScreenshot(page, '12_jung_schedule_filled');

  // 저장
  console.log('  → 저장 중...');
  const saveBtnJung = modal2.locator('button[type="submit"], button:has-text("수정 완료"), button:has-text("저장"), button:has-text("등록")').first();
  await saveBtnJung.click();
  await page.waitForTimeout(3000);
  await takeScreenshot(page, '13_jung_saved');

  // ==========================================
  // 5. 김민준 학생 시간표 입력 (가상 학생)
  // ==========================================
  console.log('\n📌 Step 5: 김민준 학생 시간표 입력 (가상 학생)');

  // 모달이 닫혔는지 확인
  if (await page.locator('.modal-content').count() > 0) {
    await page.click('.modal-close-btn, .modal-overlay');
    await page.waitForTimeout(500);
  }

  // 학생관리로 이동
  await page.click('text=학생관리');
  await page.waitForTimeout(2000);

  // 김민준 학생이 있는지 확인
  const kimRow = page.locator('tr', { hasText: '김민준' });
  const kimExists = await kimRow.count() > 0;

  if (kimExists) {
    console.log('  → 김민준 학생 발견, 수정 진행');
    const editBtnKim = kimRow.first().locator('button').first();
    await editBtnKim.click();
  } else {
    // 학생 추가
    console.log('  → 김민준 학생 없음, 새로 추가');
    await page.click('button:has-text("학생 추가")');
  }

  await page.waitForTimeout(1000);
  await takeScreenshot(page, '14_edit_kim_modal');

  // 모달 확인
  await expect(page.locator('.modal-content')).toBeVisible({ timeout: 5000 });
  const modal3 = page.locator('.modal-content');

  // 새 학생인 경우 기본 정보 입력
  if (!kimExists) {
    const nameInput = modal3.locator('input').first();
    await nameInput.fill('김민준');
    await page.waitForTimeout(300);

    // 학년 선택
    const gradeSelect = modal3.locator('select.form-select').first();
    await gradeSelect.selectOption('중1');
    await page.waitForTimeout(300);
  }

  // 과목 선택 (영어, 수학, 국어) - 이미 선택된 과목은 클릭하지 않음
  console.log('  → 과목 선택 중...');
  const subjectsKim = ['영어', '수학', '국어'];

  for (const subject of subjectsKim) {
    const subjectBtn = modal3.locator(`button[type="button"]`).filter({ hasText: new RegExp(`^${subject}$`) });
    const btnCount = await subjectBtn.count();

    if (btnCount > 0) {
      const btn = subjectBtn.first();
      const borderColor = await btn.evaluate(el => getComputedStyle(el).borderColor);
      const isSelected = borderColor.includes('59') || borderColor.includes('99');

      if (!isSelected) {
        await btn.click();
        await page.waitForTimeout(500);
        console.log(`    ✓ ${subject} 선택됨 (새로 클릭)`);
      } else {
        console.log(`    ✓ ${subject} 이미 선택됨 (스킵)`);
      }
    }
  }

  await page.waitForTimeout(1000);
  await takeScreenshot(page, '15_kim_subjects_selected');

  // 시간표 입력
  console.log('  → 시간표 입력 중...');
  const schedulesKim = STUDENT_SCHEDULES['김민준'];
  const bySubjectKim: Record<string, typeof schedulesKim> = {};
  for (const s of schedulesKim) {
    if (!bySubjectKim[s.subject]) bySubjectKim[s.subject] = [];
    bySubjectKim[s.subject].push(s);
  }

  // 과목 섹션들 찾기
  const subjectContainers3 = modal3.locator('div[style*="background"]').filter({
    has: page.locator('.subject-badge')
  });
  const containerCount3 = await subjectContainers3.count();
  console.log(`  → 과목 컨테이너 수: ${containerCount3}`);

  for (const [subject, entries] of Object.entries(bySubjectKim)) {
    console.log(`    - ${subject}: ${entries.length}개 일정`);

    // 해당 과목의 섹션 찾기
    let section = null;
    for (let ci = 0; ci < containerCount3; ci++) {
      const container = subjectContainers3.nth(ci);
      const badge = container.locator('.subject-badge');
      if (await badge.count() > 0) {
        const badgeText = await badge.textContent();
        if (badgeText?.trim() === subject) {
          section = container;
          break;
        }
      }
    }

    if (!section) {
      console.log(`    ! ${subject} 섹션을 찾을 수 없음`);
      continue;
    }

    const allSelects = section.locator('select');
    const allTimeInputs = section.locator('input[type="time"]');

    const selectCount = await allSelects.count();
    const timeInputCount = await allTimeInputs.count();
    console.log(`      (${selectCount} selects, ${timeInputCount} time inputs)`);

    // 선생님 선택 (첫 번째 select) - UI가 이미 해당 과목 선생님만 필터링함
    if (selectCount > 0) {
      const teacherSelect = allSelects.first();
      const options = await teacherSelect.locator('option').allTextContents();
      const validOption = options.find(opt => opt && !opt.includes('미지정') && !opt.includes('없음'));
      if (validOption) {
        await teacherSelect.selectOption({ label: validOption });
        console.log(`      ✓ 선생님: ${validOption}`);
        await page.waitForTimeout(100);
      }
    }

    for (let i = 0; i < Math.min(entries.length, 3); i++) {
      const entry = entries[i];
      try {
        const daySelectIdx = i + 1;
        if (daySelectIdx < selectCount) {
          await allSelects.nth(daySelectIdx).selectOption(entry.day);
          await page.waitForTimeout(100);
        }
        const startTimeIdx = i * 2;
        const endTimeIdx = i * 2 + 1;
        if (startTimeIdx < timeInputCount) {
          await allTimeInputs.nth(startTimeIdx).fill(entry.startTime);
          await page.waitForTimeout(100);
        }
        if (endTimeIdx < timeInputCount) {
          await allTimeInputs.nth(endTimeIdx).fill(entry.endTime);
          await page.waitForTimeout(100);
        }
        console.log(`      슬롯 ${i}: ${entry.day} ${entry.startTime}~${entry.endTime} ✓`);
      } catch (e) {
        console.log(`    ! ${subject} 슬롯 ${i} 입력 실패: ${e}`);
      }
    }
  }
  await takeScreenshot(page, '16_kim_schedule_filled');

  // 저장
  console.log('  → 저장 중...');
  const saveBtnKim = modal3.locator('button[type="submit"], button:has-text("수정 완료"), button:has-text("저장"), button:has-text("등록")').first();
  await saveBtnKim.click();
  await page.waitForTimeout(3000);
  await takeScreenshot(page, '17_kim_saved');

  // ==========================================
  // 6. 시간표 (Timer) 모듈 - 모든 뷰 확인
  // ==========================================
  console.log('\n📌 Step 6: 시간표 모듈 - 모든 뷰 확인');

  // 1. 요일별 보기
  console.log('  → 요일별 보기');
  await page.goto('/timer/day');
  await page.waitForTimeout(2000);

  // 전체 선택 버튼 클릭 (요일, 학년)
  const daySelectAll = page.locator('text=전체 선택').first();
  if (await daySelectAll.count() > 0) {
    await daySelectAll.click();
    await page.waitForTimeout(500);
    console.log('    ✓ 요일 전체 선택');
  }

  const gradeSelectAll = page.locator('text=전체 선택').nth(1);
  if (await gradeSelectAll.count() > 0) {
    await gradeSelectAll.click();
    await page.waitForTimeout(500);
    console.log('    ✓ 학년 전체 선택');
  }

  await page.waitForTimeout(1000);
  await takeScreenshot(page, '18_timer_day_view_all');

  // 필터 결과 확인
  const filterResult = page.locator('text=필터 결과');
  if (await filterResult.count() > 0) {
    const resultText = await filterResult.locator('..').textContent();
    console.log(`    필터 결과: ${resultText}`);
  }

  // 요일별 필터링 테스트 (월요일만)
  const monBtn = page.locator('button').filter({ hasText: /^월$/ }).first();
  if (await monBtn.count() > 0) {
    // 선택 해제 먼저
    const deselectAll = page.locator('text=선택 해제').first();
    if (await deselectAll.count() > 0) {
      await deselectAll.click();
      await page.waitForTimeout(300);
    }
    await monBtn.click();
    await page.waitForTimeout(500);
  }
  await takeScreenshot(page, '19_timer_day_monday');

  // 2. 실시간 관리
  console.log('  → 실시간 관리');
  await page.goto('/timer/realtime');
  await page.waitForTimeout(2000);

  // 전체 선택
  const rtDaySelectAll = page.locator('text=전체 선택').first();
  if (await rtDaySelectAll.count() > 0) {
    await rtDaySelectAll.click();
    await page.waitForTimeout(500);
  }
  const rtGradeSelectAll = page.locator('text=전체 선택').nth(1);
  if (await rtGradeSelectAll.count() > 0) {
    await rtGradeSelectAll.click();
    await page.waitForTimeout(500);
  }

  await page.waitForTimeout(1000);
  await takeScreenshot(page, '20_timer_realtime_view');

  // 3. 학생별 보기
  console.log('  → 학생별 보기');
  await page.goto('/timer/student');
  await page.waitForTimeout(2000);

  // 전체 선택
  const stDaySelectAll = page.locator('text=전체 선택').first();
  if (await stDaySelectAll.count() > 0) {
    await stDaySelectAll.click();
    await page.waitForTimeout(500);
  }
  const stGradeSelectAll = page.locator('text=전체 선택').nth(1);
  if (await stGradeSelectAll.count() > 0) {
    await stGradeSelectAll.click();
    await page.waitForTimeout(500);
  }

  await page.waitForTimeout(1000);
  await takeScreenshot(page, '21_timer_student_view');

  // 학생 선택 테스트
  const studentItems = page.locator('tr', { hasText: '최예지' });
  if (await studentItems.count() > 0) {
    await studentItems.first().click();
    await page.waitForTimeout(1000);
    await takeScreenshot(page, '22_timer_student_selected');
  } else {
    console.log('    ! 최예지 학생을 찾을 수 없음');
  }

  // 4. 시간대별 보기
  console.log('  → 시간대별 보기');
  await page.goto('/timer/timeslot');
  await page.waitForTimeout(2000);

  // 전체 선택
  const tsDaySelectAll = page.locator('text=전체 선택').first();
  if (await tsDaySelectAll.count() > 0) {
    await tsDaySelectAll.click();
    await page.waitForTimeout(500);
  }
  const tsGradeSelectAll = page.locator('text=전체 선택').nth(1);
  if (await tsGradeSelectAll.count() > 0) {
    await tsGradeSelectAll.click();
    await page.waitForTimeout(500);
  }

  await page.waitForTimeout(1000);
  await takeScreenshot(page, '23_timer_timeslot_view');

  // ==========================================
  // 7. Notion DB 데이터 검증
  // ==========================================
  console.log('\n📌 Step 7: Notion DB 데이터 검증');

  const response = await fetch('https://api.notion.com/v1/databases/2fb73635-f415-8030-80c4-c1b906e6b78f/query', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${NOTION_CONFIG.notionApiKey}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ page_size: 100 }),
  });

  const data = await response.json();
  const recordCount = data.results?.length || 0;

  console.log(`\n📊 Notion Enrollment DB 레코드 수: ${recordCount}개`);

  if (recordCount > 0) {
    console.log('\n📋 저장된 시간표:');
    for (const record of data.results) {
      const name = record.properties['이름']?.title?.[0]?.plain_text || 'N/A';
      const day = record.properties['요일']?.select?.name || 'N/A';
      const subject = record.properties['과목']?.rich_text?.[0]?.plain_text || 'N/A';
      const start = record.properties['시작시간']?.rich_text?.[0]?.plain_text || 'N/A';
      const end = record.properties['종료시간']?.rich_text?.[0]?.plain_text || 'N/A';
      console.log(`  - ${name}: ${day} ${start}~${end} (${subject})`);
    }
  }

  await takeScreenshot(page, '24_final_state');

  // ==========================================
  // 완료
  // ==========================================
  console.log('\n' + '='.repeat(50));
  console.log('✅ E2E 테스트 완료!');
  console.log(`📁 스크린샷: ${SCREENSHOT_DIR}`);
  console.log(`📸 총 ${screenshotCounter}개`);
  console.log(`📊 Notion DB 레코드: ${recordCount}개`);
  console.log('='.repeat(50));
});
