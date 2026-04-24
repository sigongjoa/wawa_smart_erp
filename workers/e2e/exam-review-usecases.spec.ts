import { test, expect, request } from '@playwright/test';
import { API_URL } from './_env';

/**
 * 정기고사(중간/기말) 리포트 통합 — 전체 유즈케이스 라이브 E2E
 *
 * UC-1  관리자 정기고사 활성 학기 설정
 * UC-2  정기고사 시험 생성
 * UC-3  리포트 유형 탭 전환 (별도 스펙에서 커버)
 * UC-4  정기고사 성적 입력 (활성 학기 검증 포함)
 * UC-5  AI 코멘트 examContext 주입
 * UC-6  정기고사 리포트 이미지 업로드 → exam_review_sends UPSERT
 * UC-7  학부모 공유 링크 공개 열람
 */

const API = API_URL;
const ADMIN = { name: '서재용 개발자', pin: '1141' };

// 테스트 데이터 — 과거 학기로 고정해 실제 운영 데이터와 충돌 회피
const TEST_TERM = '2025-2';
const TEST_EXAM_TYPE = 'midterm' as const;
const TEST_EXAM_DATE = '2025-10-15';
const TEST_SUBJECT = '수학';
// 리포트 UI가 exam.name " - " 뒤를 subject로 추출하므로 네이밍 맞춤
const TEST_EXAM_NAME = `E2E중간고사_${Date.now()} - ${TEST_SUBJECT}`;

// 1x1 투명 PNG base64 (UC-6용 최소 이미지)
const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAoAAv/lxKUAAAAASUVORK5CYII=';

async function login(apiCtx: any): Promise<string> {
  const res = await apiCtx.post(`${API}/api/auth/login`, {
    data: { name: ADMIN.name, pin: ADMIN.pin },
    headers: { 'Content-Type': 'application/json' },
  });
  expect(res.ok(), `login failed: ${res.status()}`).toBeTruthy();
  const body = await res.json();
  const token = body?.data?.accessToken ?? body?.accessToken;
  expect(token, 'no accessToken in login response').toBeTruthy();
  return token;
}

function auth(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

test.describe('정기고사 리뷰 — 통합 유즈케이스 (Live)', () => {
  test('UC-1,2,4,5,6,7 직렬 흐름', async ({ playwright }) => {
    const apiCtx = await playwright.request.newContext();
    const token = await login(apiCtx);
    console.log('✅ [login] accessToken 획득');

    // ────────────────────────────────────────────────
    // UC-1: 정기고사 활성 학기 설정
    // ────────────────────────────────────────────────
    const uc1 = await apiCtx.post(`${API}/api/settings/active-exam-review`, {
      headers: auth(token),
      data: { activeTerm: TEST_TERM, activeExamType: TEST_EXAM_TYPE },
    });
    expect(uc1.status(), `UC-1 status: ${uc1.status()}`).toBeLessThan(300);
    const uc1Body = await uc1.json();
    const uc1Data = uc1Body?.data ?? uc1Body;
    expect(uc1Data.activeTerm).toBe(TEST_TERM);
    expect(uc1Data.activeExamType).toBe(TEST_EXAM_TYPE);
    console.log(`✅ [UC-1] 활성 학기 설정: ${TEST_TERM} ${TEST_EXAM_TYPE}`);

    // 조회로 영속화 확인
    const uc1Get = await apiCtx.get(`${API}/api/settings/active-exam-review`, {
      headers: auth(token),
    });
    expect(uc1Get.ok()).toBeTruthy();
    const uc1GetBody = await uc1Get.json();
    const uc1GetData = uc1GetBody?.data ?? uc1GetBody;
    expect(uc1GetData.activeTerm).toBe(TEST_TERM);
    console.log('✅ [UC-1] GET 조회 영속화 확인');

    // ────────────────────────────────────────────────
    // UC-2: 정기고사 시험 생성
    // ────────────────────────────────────────────────
    const uc2 = await apiCtx.post(`${API}/api/grader/exams`, {
      headers: auth(token),
      data: {
        name: TEST_EXAM_NAME,
        date: TEST_EXAM_DATE,
        exam_month: TEST_EXAM_DATE.slice(0, 7),
        total_score: 100,
        is_active: true,
        exam_type: TEST_EXAM_TYPE,
        term: TEST_TERM,
      },
    });
    if (uc2.status() >= 300) {
      console.log('❌ UC-2 body:', await uc2.text());
    }
    expect(uc2.status(), `UC-2 status: ${uc2.status()}`).toBeLessThan(300);
    const uc2Body = await uc2.json();
    const uc2Data = uc2Body?.data ?? uc2Body;
    const examId = uc2Data?.id;
    expect(examId, 'no exam id returned').toBeTruthy();
    expect(uc2Data.exam_type).toBe(TEST_EXAM_TYPE);
    expect(uc2Data.term).toBe(TEST_TERM);
    console.log(`✅ [UC-2] 정기고사 생성: id=${examId} (${TEST_SUBJECT} ${TEST_EXAM_TYPE} ${TEST_TERM})`);

    // ────────────────────────────────────────────────
    // UC-4: 정기고사 성적 입력 (학생 1명 필요)
    // ────────────────────────────────────────────────
    const studentsRes = await apiCtx.get(`${API}/api/student`, {
      headers: auth(token),
    });
    expect(studentsRes.ok()).toBeTruthy();
    const studentsBody = await studentsRes.json();
    const students = (studentsBody?.data ?? studentsBody) as any[];
    expect(students.length, '학생이 최소 1명 필요').toBeGreaterThan(0);
    const testStudent = students[0];
    console.log(`✅ [UC-4] 대상 학생: ${testStudent.name} (id=${testStudent.id})`);

    const uc4 = await apiCtx.post(`${API}/api/grader/grades`, {
      headers: auth(token),
      data: {
        student_id: testStudent.id,
        exam_id: examId,
        score: 85,
        comments: '중간고사 E2E 테스트',
      },
    });
    expect(uc4.status(), `UC-4 status: ${uc4.status()}`).toBeLessThan(300);
    console.log('✅ [UC-4] 정기고사 성적 저장 성공 (활성 학기 검증 통과)');

    // UC-4 검증: reportType=midterm&term=YYYY-N 쿼리에 반영
    const reportRes = await apiCtx.get(
      `${API}/api/report?reportType=${TEST_EXAM_TYPE}&term=${TEST_TERM}`,
      { headers: auth(token) }
    );
    expect(reportRes.ok()).toBeTruthy();
    const reportBody = await reportRes.json();
    const reports = (reportBody?.data ?? reportBody) as any[];
    const studentReport = reports.find((r: any) => r.studentId === testStudent.id);
    expect(studentReport, '성적 저장이 리포트 쿼리에 반영 안됨').toBeTruthy();
    const hasScore = studentReport.scores?.find(
      (s: any) => s.examId === examId && s.score === 85
    );
    expect(hasScore, '저장한 85점이 리포트에 없음').toBeTruthy();
    console.log('✅ [UC-4] 리포트 쿼리에 정기고사 성적 반영 확인');

    // ────────────────────────────────────────────────
    // UC-5: AI 코멘트 examContext 주입
    // ────────────────────────────────────────────────
    const uc5 = await apiCtx.post(`${API}/api/ai/generate-comment`, {
      headers: auth(token),
      data: {
        studentName: testStudent.name,
        subject: TEST_SUBJECT,
        score: 85,
        yearMonth: TEST_TERM,
        examContext: {
          reportType: TEST_EXAM_TYPE,
          term: TEST_TERM,
        },
      },
    });
    expect(uc5.status(), `UC-5 status: ${uc5.status()}`).toBeLessThan(300);
    const uc5Body = await uc5.json();
    const uc5Data = uc5Body?.data ?? uc5Body;
    expect(uc5Data.comment, 'AI 코멘트 응답 없음').toBeTruthy();
    expect(uc5Data.comment.length).toBeGreaterThan(20);
    console.log(`✅ [UC-5] AI 코멘트 생성 (${uc5Data.comment.length}자)`);
    console.log(`   샘플: "${uc5Data.comment.slice(0, 60)}..."`);

    // ────────────────────────────────────────────────
    // UC-6: 정기고사 리포트 이미지 업로드
    // ────────────────────────────────────────────────
    const uc6 = await apiCtx.post(`${API}/api/report/upload-image`, {
      headers: auth(token),
      data: {
        imageBase64: TINY_PNG_BASE64,
        studentId: testStudent.id,
        studentName: testStudent.name,
        reportType: TEST_EXAM_TYPE,
        term: TEST_TERM,
      },
    });
    expect(uc6.status(), `UC-6 status: ${uc6.status()}`).toBeLessThan(300);
    const uc6Body = await uc6.json();
    const uc6Data = uc6Body?.data ?? uc6Body;
    const shareUrl = uc6Data.shareUrl;
    expect(shareUrl, 'no shareUrl').toBeTruthy();
    expect(shareUrl).toMatch(/\/api\/report\/image\/reports\//);
    console.log(`✅ [UC-6] 리포트 이미지 업로드 → ${shareUrl.slice(0, 70)}...`);

    // UC-6 검증: send-status에 반영
    const sendStatusRes = await apiCtx.get(
      `${API}/api/report/send-status?reportType=${TEST_EXAM_TYPE}&term=${TEST_TERM}`,
      { headers: auth(token) }
    );
    expect(sendStatusRes.ok()).toBeTruthy();
    const sendStatusBody = await sendStatusRes.json();
    const sendMap = (sendStatusBody?.data ?? sendStatusBody) as Record<string, any>;
    expect(sendMap[testStudent.id], 'exam_review_sends에 기록 없음').toBeTruthy();
    expect(sendMap[testStudent.id].shareUrl).toBe(shareUrl);
    console.log('✅ [UC-6] exam_review_sends UPSERT 확인');

    // UC-6 UPSERT 재업로드: 두 번째 업로드 시 이전 경로 삭제 후 새 경로 교체
    const uc6b = await apiCtx.post(`${API}/api/report/upload-image`, {
      headers: auth(token),
      data: {
        imageBase64: TINY_PNG_BASE64,
        studentId: testStudent.id,
        studentName: testStudent.name,
        reportType: TEST_EXAM_TYPE,
        term: TEST_TERM,
      },
    });
    expect(uc6b.ok()).toBeTruthy();
    const uc6bBody = await uc6b.json();
    const shareUrl2 = (uc6bBody?.data ?? uc6bBody).shareUrl;
    expect(shareUrl2).not.toBe(shareUrl);
    console.log('✅ [UC-6] UPSERT 재업로드 — 새 경로 발급');

    // ────────────────────────────────────────────────
    // UC-7: 학부모 공유 링크 공개 열람 (인증 없이)
    // ────────────────────────────────────────────────
    const publicCtx = await playwright.request.newContext(); // no auth header
    const uc7 = await publicCtx.get(shareUrl2);
    expect(uc7.ok(), `UC-7 public fetch status: ${uc7.status()}`).toBeTruthy();
    expect(uc7.headers()['content-type']).toContain('image/png');
    const bytes = await uc7.body();
    expect(bytes.length).toBeGreaterThan(0);
    console.log(`✅ [UC-7] 공개 링크 열람 (${bytes.length}바이트 PNG)`);
    await publicCtx.dispose();

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ 모든 유즈케이스 통과');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    await apiCtx.dispose();
  });
});
