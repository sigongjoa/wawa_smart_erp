import { test, expect } from '@playwright/test';

// 관리자 로그인 헬퍼
async function loginAsAdmin(page: any) {
  await page.goto('/');
  await page.waitForSelector('select');
  // 첫 번째 선생님 (관리자) 선택 - value는 't1'
  await page.selectOption('select', 't1');
  await page.fill('input[type="password"]', '1234');
  await page.click('button:has-text("로그인")');
  await page.waitForURL(/.*admin.*/, { timeout: 10000 });
}

// 일반 선생님 로그인 헬퍼
async function loginAsTeacher(page: any) {
  await page.goto('/');
  await page.waitForSelector('select');
  // 이영어 선생님 선택 - value는 't2'
  await page.selectOption('select', 't2');
  await page.fill('input[type="password"]', '2345');
  await page.click('button:has-text("로그인")');
  await page.waitForURL(/.*teacher.*/, { timeout: 10000 });
}

test.describe('월말평가 리포트 앱 E2E 테스트', () => {

  test.describe('1. 로그인 및 네비게이션', () => {
    test('로그인 페이지가 정상 로드되어야 함', async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('text=월말평가 리포트')).toBeVisible();
      await expect(page.locator('input[type="password"]')).toBeVisible();
      await expect(page.locator('select')).toBeVisible();
    });

    test('관리자 PIN으로 로그인하면 관리자 대시보드로 이동', async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('select');

      // 선생님 선택 (김수학 - 관리자, value=t1)
      await page.selectOption('select', 't1');

      // PIN 입력
      await page.fill('input[type="password"]', '1234');
      await page.click('button:has-text("로그인")');

      // 관리자 대시보드 확인
      await expect(page.locator('text=관리자 대시보드')).toBeVisible({ timeout: 10000 });
    });

    test('일반 선생님 PIN으로 로그인하면 점수입력 페이지로 이동', async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('select');

      // 선생님 선택 (이영어 - 일반, value=t2)
      await page.selectOption('select', 't2');

      // PIN 입력
      await page.fill('input[type="password"]', '2345');
      await page.click('button:has-text("로그인")');

      // 점수 입력 페이지 확인 (헤더에 이름 확인)
      await expect(page.locator('text=이영어 선생님')).toBeVisible({ timeout: 10000 });
    });

    test('잘못된 PIN으로 로그인 시 에러 메시지', async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('select');
      await page.selectOption('select', 't1');
      await page.fill('input[type="password"]', '9999');
      await page.click('button:has-text("로그인")');

      await expect(page.locator('text=PIN이 올바르지 않습니다')).toBeVisible();
    });
  });

  test.describe('2. 설정 페이지 - Notion 연동', () => {
    test('설정 페이지에 Notion 연동 탭이 있어야 함', async ({ page }) => {
      await loginAsAdmin(page);
      await page.click('button:has-text("설정")');

      // 탭 확인
      await expect(page.locator('button:has-text("학원 정보")')).toBeVisible();
      await expect(page.locator('button:has-text("Notion 연동")')).toBeVisible();
      await expect(page.locator('button:has-text("카카오 비즈")')).toBeVisible();
    });

    test('Notion 연동 탭에서 API Key와 DB ID 입력 필드가 있어야 함', async ({ page }) => {
      await loginAsAdmin(page);
      await page.click('button:has-text("설정")');
      await page.click('button:has-text("Notion 연동")');

      // 입력 필드 확인
      await expect(page.locator('text=Notion API Key')).toBeVisible();
      await expect(page.locator('text=선생님 DB ID')).toBeVisible();
      await expect(page.locator('text=학생 DB ID')).toBeVisible();
      await expect(page.locator('text=점수 DB ID')).toBeVisible();
      await expect(page.locator('text=시험지 DB ID')).toBeVisible();

      // 연결 테스트 버튼 확인
      await expect(page.locator('button:has-text("연결 테스트")')).toBeVisible();
    });

    test('Notion 설정을 저장하면 localStorage에 저장됨', async ({ page }) => {
      await loginAsAdmin(page);
      await page.click('button:has-text("설정")');
      await page.click('button:has-text("Notion 연동")');

      // API Key 입력
      await page.fill('input[placeholder="secret_xxxxxxxxxxxxxxx"]', 'secret_test_key_123');

      // 저장
      await page.click('button:has-text("설정 저장")');
      await expect(page.locator('text=설정이 저장되었습니다')).toBeVisible();

      // localStorage 확인
      const storage = await page.evaluate(() => localStorage.getItem('wawa-report-storage'));
      expect(storage).toContain('secret_test_key_123');
    });

    test('연결 테스트 - API Key 없으면 에러 메시지', async ({ page }) => {
      await loginAsAdmin(page);
      await page.click('button:has-text("설정")');
      await page.click('button:has-text("Notion 연동")');

      // API Key 비우기 (clear)
      await page.fill('input[placeholder="secret_xxxxxxxxxxxxxxx"]', '');

      // 연결 테스트
      await page.click('button:has-text("연결 테스트")');

      // 에러 메시지 확인
      await expect(page.locator('text=API Key를 입력해주세요')).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('3. 학생 관리 페이지 CRUD', () => {
    test('학생 관리 페이지로 이동 가능', async ({ page }) => {
      await loginAsAdmin(page);
      await page.click('button:has-text("학생 관리")');
      await expect(page.locator('h1:has-text("학생 관리")')).toBeVisible();
    });

    test('목업 학생 데이터가 표시되어야 함', async ({ page }) => {
      await loginAsAdmin(page);
      await page.click('button:has-text("학생 관리")');

      // 목업 학생 확인
      await expect(page.locator('td:has-text("홍길동")')).toBeVisible();
      await expect(page.locator('td:has-text("김철수")')).toBeVisible();
      await expect(page.locator('td:has-text("이영희")')).toBeVisible();
    });

    test('학생 추가 모달이 열려야 함', async ({ page }) => {
      await loginAsAdmin(page);
      await page.click('button:has-text("학생 관리")');
      await page.click('button:has-text("학생 추가")');

      // 모달 확인
      await expect(page.locator('text=새 학생 추가')).toBeVisible();
      await expect(page.locator('input[placeholder="학생 이름"]')).toBeVisible();
    });

    test('새 학생을 추가할 수 있어야 함', async ({ page }) => {
      await loginAsAdmin(page);
      await page.click('button:has-text("학생 관리")');
      await page.click('button:has-text("학생 추가")');

      // 모달이 열릴 때까지 대기
      await expect(page.locator('text=새 학생 추가')).toBeVisible();

      const modal = page.locator('div[style*="position: fixed"]');

      // 폼 입력
      await modal.locator('input[placeholder="학생 이름"]').fill('테스트학생');

      // 학년 선택 (모달 내 select)
      await modal.locator('select').selectOption('중2');

      // 과목 선택 버튼
      await modal.locator('button:has-text("수학")').click();
      await modal.locator('button:has-text("영어")').click();

      // 추가 버튼 클릭
      await modal.locator('button:has-text("추가")').click();

      // 모달이 닫히고 목록에 추가되었는지 확인
      await expect(page.locator('text=새 학생 추가')).not.toBeVisible({ timeout: 5000 });
      await expect(page.locator('td:has-text("테스트학생")')).toBeVisible({ timeout: 5000 });
    });

    test('학생 정보 수정 모달이 열려야 함', async ({ page }) => {
      await loginAsAdmin(page);
      await page.click('button:has-text("학생 관리")');

      // 홍길동 행의 수정 버튼 클릭
      const row = page.locator('tr', { has: page.locator('td:has-text("홍길동")') });
      await row.locator('button:has-text("수정")').click();

      // 수정 모달 확인
      await expect(page.locator('text=학생 정보 수정')).toBeVisible();
      // 기존 이름이 입력되어 있는지 확인
      await expect(page.locator('input[placeholder="학생 이름"]')).toHaveValue('홍길동');
    });

    test('학생 검색이 동작해야 함', async ({ page }) => {
      await loginAsAdmin(page);
      await page.click('button:has-text("학생 관리")');

      // 검색
      await page.fill('input[placeholder*="검색"]', '홍길동');

      // 검색 결과 확인
      await expect(page.locator('td:has-text("홍길동")')).toBeVisible();
      await expect(page.locator('td:has-text("김철수")')).not.toBeVisible();
    });
  });

  test.describe('4. 시험 일정 관리 페이지', () => {
    test('시험 일정 페이지로 이동 가능', async ({ page }) => {
      await loginAsAdmin(page);
      await page.click('button:has-text("시험 일정")');
      await expect(page.locator('h1:has-text("시험 일정 관리")')).toBeVisible();
    });

    test('3개 탭이 표시되어야 함', async ({ page }) => {
      await loginAsAdmin(page);
      await page.click('button:has-text("시험 일정")');

      await expect(page.locator('button:has-text("오늘 시험")')).toBeVisible();
      await expect(page.locator('button:has-text("결시/미지정")')).toBeVisible();
      await expect(page.locator('button:has-text("예정 학생")')).toBeVisible();
    });

    test('통계 카드가 클릭 가능하고 탭 전환', async ({ page }) => {
      await loginAsAdmin(page);
      await page.click('button:has-text("시험 일정")');

      // 결시/미지정 카드 클릭
      await page.locator('text=결시/미지정').first().click();

      // 탭이 전환되었는지 확인 (font-weight 600)
      const absentTab = page.locator('button:has-text("결시/미지정")');
      await expect(absentTab).toHaveCSS('font-weight', '600');
    });

    test('학생 선택 시 일괄 처리 버튼 표시', async ({ page }) => {
      await loginAsAdmin(page);
      await page.click('button:has-text("시험 일정")');
      await page.click('button:has-text("결시/미지정")');

      // 체크박스가 있으면 클릭
      const checkbox = page.locator('tbody input[type="checkbox"]').first();
      if (await checkbox.isVisible()) {
        await checkbox.click();
        await expect(page.locator('button:has-text("일괄 날짜 지정")')).toBeVisible();
      }
    });
  });

  test.describe('5. 관리자 점수 수정 기능', () => {
    test('학생 목록에 수정 버튼이 있어야 함', async ({ page }) => {
      await loginAsAdmin(page);

      // AdminPage의 테이블에서 수정 버튼 확인
      await expect(page.locator('button:has-text("수정")').first()).toBeVisible();
    });

    test('수정 버튼 클릭 시 점수 수정 모달이 열려야 함', async ({ page }) => {
      await loginAsAdmin(page);

      // 첫 번째 수정 버튼 클릭
      await page.locator('button:has-text("수정")').first().click();

      // 모달 확인
      await expect(page.locator('text=점수 수정')).toBeVisible();
    });

    test('점수 수정 모달에 과목별 입력 필드가 있어야 함', async ({ page }) => {
      await loginAsAdmin(page);
      await page.locator('button:has-text("수정")').first().click();

      // 모달이 열릴 때까지 대기
      await expect(page.locator('text=점수 수정')).toBeVisible();

      const modal = page.locator('div[style*="position: fixed"]');

      // 점수 입력 필드 확인
      await expect(modal.locator('input[type="number"]').first()).toBeVisible();

      // 난이도 선택 확인
      await expect(modal.locator('select').first()).toBeVisible();

      // 코멘트 입력 필드 확인
      await expect(modal.locator('input[placeholder="코멘트 입력 (선택)"]').first()).toBeVisible();

      // 저장/취소 버튼 확인
      await expect(modal.locator('button:has-text("저장")')).toBeVisible();
      await expect(modal.locator('button:has-text("취소")')).toBeVisible();
    });

    test('점수를 수정하고 저장할 수 있어야 함', async ({ page }) => {
      await loginAsAdmin(page);
      await page.locator('button:has-text("수정")').first().click();

      // 모달이 열릴 때까지 대기
      await expect(page.locator('text=점수 수정')).toBeVisible();

      const modal = page.locator('div[style*="position: fixed"]');

      // 점수 수정
      const scoreInput = modal.locator('input[type="number"]').first();
      await scoreInput.fill('95');

      // 코멘트 입력
      const commentInput = modal.locator('input[placeholder="코멘트 입력 (선택)"]').first();
      await commentInput.fill('테스트 코멘트입니다');

      // 저장
      await modal.locator('button:has-text("저장")').click();

      // 모달이 닫혀야 함 (저장 성공)
      await expect(page.locator('text=점수 수정')).not.toBeVisible({ timeout: 5000 });
    });

    test('취소 버튼으로 모달 닫기', async ({ page }) => {
      await loginAsAdmin(page);
      await page.locator('button:has-text("수정")').first().click();

      await expect(page.locator('text=점수 수정')).toBeVisible();

      const modal = page.locator('div[style*="position: fixed"]');

      // 취소 클릭
      await modal.locator('button:has-text("취소")').click();

      // 모달이 닫혀야 함
      await expect(page.locator('text=점수 수정')).not.toBeVisible();
    });
  });

  test.describe('6. 목업 모드 동작 확인', () => {
    test('Notion 미연결 시 목업 선생님 데이터 로드', async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('select');

      // 목업 선생님 확인 (select option에 있는지)
      const options = await page.locator('select option').allTextContents();
      expect(options.join(',')).toContain('김수학');
      expect(options.join(',')).toContain('이영어');
      expect(options.join(',')).toContain('박국어');
      expect(options.join(',')).toContain('최과학');
    });

    test('Notion 미연결 시 목업 학생 데이터 로드', async ({ page }) => {
      await loginAsAdmin(page);
      await page.click('button:has-text("학생 관리")');

      // 목업 학생들이 로드되었는지 확인
      await expect(page.locator('td:has-text("홍길동")')).toBeVisible();
      await expect(page.locator('td:has-text("김철수")')).toBeVisible();
    });
  });
});
