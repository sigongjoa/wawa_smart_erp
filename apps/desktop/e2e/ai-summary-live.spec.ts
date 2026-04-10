import { test, expect } from '@playwright/test';

const API = 'https://wawa-smart-erp-api.zeskywa499.workers.dev';

test.setTimeout(60000);

// 로그인 → 토큰 반환
async function getToken(): Promise<string> {
  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: '서재용 개발자', pin: '1141' }),
  });
  const json = await res.json() as any;
  return json.data.accessToken;
}

// 총평 생성 API 호출
async function generateSummary(
  token: string,
  studentName: string,
  scores: { subject: string; score: number; comment?: string }[]
): Promise<string> {
  const res = await fetch(`${API}/api/ai/generate-summary`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      studentName,
      yearMonth: '2026-03',
      scores,
    }),
  });
  const json = await res.json() as any;
  if (!json.data?.summary) {
    console.error('API 응답 오류:', JSON.stringify(json));
    throw new Error(`AI 총평 API 실패: ${JSON.stringify(json)}`);
  }
  return json.data.summary;
}

test.describe('AI 총평 품질 평가', () => {
  let token: string;

  test.beforeAll(async () => {
    token = await getToken();
  });

  // ── 케이스 1: 우수 학생 (전과목 85+) ──
  test('우수 학생 총평 — 분량 및 톤 검증', async () => {
    const summary = await generateSummary(token, '김민준', [
      { subject: '국어', score: 92, comment: '독해력 우수' },
      { subject: '수학', score: 88, comment: '응용문제 잘 풀었음' },
      { subject: '영어', score: 95 },
    ]);

    console.log('\n[우수 학생] 김민준:\n' + summary);
    console.log(`글자 수: ${summary.length}자\n`);

    // 분량 체크: 400~600자 (약간의 여유)
    expect(summary.length).toBeGreaterThanOrEqual(300);
    expect(summary.length).toBeLessThanOrEqual(700);

    // 톤 체크: 존댓말
    expect(summary).toMatch(/습니다|입니다|드립니다|겠습니다|주세요/);

    // 학생 이름 포함
    expect(summary).toContain('김민준');

    // 긍정적 키워드
    expect(summary).toMatch(/우수|잘|훌륭|좋|칭찬|뛰어|성장/);
  });

  // ── 케이스 2: 보통 학생 (50~70점대) ──
  test('보통 학생 총평 — 보완점 + 격려 포함', async () => {
    const summary = await generateSummary(token, '이서연', [
      { subject: '국어', score: 72, comment: '집중력 부족' },
      { subject: '수학', score: 55, comment: '계산 실수 많음' },
      { subject: '영어', score: 68 },
    ]);

    console.log('\n[보통 학생] 이서연:\n' + summary);
    console.log(`글자 수: ${summary.length}자\n`);

    expect(summary.length).toBeGreaterThanOrEqual(300);
    expect(summary.length).toBeLessThanOrEqual(700);
    expect(summary).toContain('이서연');

    // 보완점 언급
    expect(summary).toMatch(/보완|부족|노력|개선|실수|보충/);

    // 격려도 포함
    expect(summary).toMatch(/가능|잠재|격려|성장|발전|응원|믿/);
  });

  // ── 케이스 3: 부진 학생 (50점 미만) ──
  test('부진 학생 총평 — 따뜻한 격려 + 구체적 계획', async () => {
    const summary = await generateSummary(token, '박지호', [
      { subject: '국어', score: 35, comment: '기초 문법 약함' },
      { subject: '수학', score: 28 },
      { subject: '영어', score: 42, comment: '단어 암기 부족' },
    ]);

    console.log('\n[부진 학생] 박지호:\n' + summary);
    console.log(`글자 수: ${summary.length}자\n`);

    expect(summary.length).toBeGreaterThanOrEqual(300);
    expect(summary.length).toBeLessThanOrEqual(700);
    expect(summary).toContain('박지호');

    // 비하하지 않고 따뜻한 톤
    expect(summary).not.toMatch(/못하|안됨|불합격|낙제|포기/);

    // 구체적 계획 키워드
    expect(summary).toMatch(/기초|보충|반복|훈련|계획|연습|지도/);
  });

  // ── 케이스 4: 선생님 메모 반영 확인 ──
  test('선생님 메모가 총평에 반영되는지', async () => {
    const summary = await generateSummary(token, '최예지', [
      { subject: '수학', score: 78, comment: '도형 단원에서 실수가 잦음, 공식 암기는 완벽' },
      { subject: '과학', score: 82, comment: '실험 보고서 작성 능력 향상됨' },
    ]);

    console.log('\n[메모 반영] 최예지:\n' + summary);
    console.log(`글자 수: ${summary.length}자\n`);

    expect(summary.length).toBeGreaterThanOrEqual(300);
    expect(summary.length).toBeLessThanOrEqual(700);

    // 메모 내용이 자연스럽게 반영 (원문 그대로는 아닐 수 있음)
    expect(summary).toMatch(/도형|실수|공식|실험|보고서/);
  });

  // ── 케이스 5: 과목 1개만 있는 경우 ──
  test('단일 과목 총평 — 정상 생성', async () => {
    const summary = await generateSummary(token, '강은서', [
      { subject: '수학', score: 61, comment: '풀이과정 생략이 많음' },
    ]);

    console.log('\n[단일 과목] 강은서:\n' + summary);
    console.log(`글자 수: ${summary.length}자\n`);

    expect(summary.length).toBeGreaterThanOrEqual(200);
    expect(summary.length).toBeLessThanOrEqual(700);
    expect(summary).toContain('강은서');
    expect(summary).toMatch(/수학/);
  });
});
