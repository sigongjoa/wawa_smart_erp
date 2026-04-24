import { test, expect } from '@playwright/test';
import { API_URL } from './_env';
const ADMIN = { name: '서재용 개발자', pin: '1141' };

let token = '';

test.beforeAll(async ({ request }) => {
  const res = await request.post(`${API_URL}/api/auth/login`, {
    data: { name: ADMIN.name, pin: ADMIN.pin },
  });
  const body = await res.json();
  console.log(`로그인 응답 (${res.status()}): ${JSON.stringify(body).slice(0, 300)}`);
  expect(res.ok()).toBeTruthy();
  token = body.data?.accessToken || body.data?.token || body.token;
  console.log('✅ 토큰:', token?.slice(0, 20) + '...');
});

function headers() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

// ─── 과목별 코멘트 테스트 ───

const commentCases = [
  { label: '고득점 (수학 95점)', studentName: 'test', subject: '수학', score: 95, yearMonth: '2026-03' },
  { label: '중간점수 (수학 72점)', studentName: 'test', subject: '수학', score: 72, yearMonth: '2026-03' },
  { label: '저득점 (수학 38점)', studentName: 'test', subject: '수학', score: 38, yearMonth: '2026-03' },
  { label: '메모 포함 (국어 80점)', studentName: 'test', subject: '국어', score: 80, yearMonth: '2026-03', existingComment: '수업 태도 좋음' },
  { label: '메모 포함 저득점 (영어 45점)', studentName: 'test', subject: '영어', score: 45, yearMonth: '2026-03', existingComment: '집중력 부족' },
];

for (const c of commentCases) {
  test(`과목 코멘트 품질: ${c.label}`, async ({ request }) => {
    const res = await request.post(`${API_URL}/api/ai/generate-comment`, {
      headers: headers(),
      data: {
        studentName: c.studentName,
        subject: c.subject,
        score: c.score,
        yearMonth: c.yearMonth,
        ...(c.existingComment ? { existingComment: c.existingComment } : {}),
      },
    });

    const body = await res.json();
    console.log(`\n━━━ ${c.label} (HTTP ${res.status()}) ━━━`);
    if (!res.ok()) {
      console.log(`에러: ${JSON.stringify(body)}`);
    }
    expect(res.ok(), `API 실패: ${JSON.stringify(body)}`).toBeTruthy();
    const comment: string = body.data?.comment || body.comment || '';

    console.log(``);
    console.log(`글자수: ${comment.length}자`);
    console.log(`문장수: ${comment.split(/[.!?。]\s*/).filter(Boolean).length}문장`);
    console.log(`내용:\n${comment}\n`);

    // 최소 길이 체크 (4~6문장이면 최소 80자 이상)
    expect(comment.length, `코멘트가 너무 짧음 (${comment.length}자)`).toBeGreaterThan(80);

    // 존댓말 체크
    expect(comment, '존댓말이 아님').toMatch(/니다|세요|습니다|겠습니다|드립니다/);

    // 점수 구간별 톤 체크
    if (c.score >= 90) {
      expect(comment, '고득점인데 칭찬이 없음').toMatch(/우수|훌륭|뛰어|잘|좋은|높은|성취/);
    }
    if (c.score < 50) {
      expect(comment, '저득점인데 격려가 없음').toMatch(/노력|응원|격려|기초|보강|함께|도움|차근|단계/);
    }

    // 메모 반영 체크
    if (c.existingComment) {
      // 메모 내용이 어떤 형태로든 반영되었는지
      const memoKeywords = c.existingComment.split(/\s+/);
      const reflected = memoKeywords.some(kw => comment.includes(kw));
      console.log(`메모 반영 여부: ${reflected ? '✅' : '⚠️ 키워드 미반영'}`);
    }
  });
}

// ─── 총평 테스트 ───

const summaryCases = [
  {
    label: '우수 학생 총평',
    studentName: 'test',
    yearMonth: '2026-03',
    scores: [
      { subject: '수학', score: 92, comment: '연산 정확도 높음' },
      { subject: '국어', score: 88, comment: '' },
      { subject: '영어', score: 95, comment: '발음 좋음' },
    ],
  },
  {
    label: '보통 학생 총평',
    studentName: 'test',
    yearMonth: '2026-03',
    scores: [
      { subject: '수학', score: 65, comment: '계산 실수 잦음' },
      { subject: '국어', score: 72, comment: '' },
      { subject: '영어', score: 58, comment: '단어 암기 부족' },
    ],
  },
  {
    label: '저득점 학생 총평',
    studentName: 'test',
    yearMonth: '2026-03',
    scores: [
      { subject: '수학', score: 35, comment: '구구단 연습 필요' },
      { subject: '국어', score: 42, comment: '독해력 부족' },
      { subject: '영어', score: 28, comment: '알파벳부터 다시' },
    ],
  },
];

for (const s of summaryCases) {
  test(`총평 품질: ${s.label}`, async ({ request }) => {
    const res = await request.post(`${API_URL}/api/ai/generate-summary`, {
      headers: headers(),
      data: {
        studentName: s.studentName,
        yearMonth: s.yearMonth,
        scores: s.scores,
      },
    });

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    const summary: string = body.data?.summary || body.summary || '';

    const avgScore = Math.round(s.scores.reduce((a, b) => a + b.score, 0) / s.scores.length);

    console.log(`\n━━━ ${s.label} (평균 ${avgScore}점) ━━━`);
    console.log(`글자수: ${summary.length}자`);
    console.log(`내용:\n${summary}\n`);

    // 총평은 800자 이상 요구
    expect(summary.length, `총평이 너무 짧음 (${summary.length}자, 최소 400자)`).toBeGreaterThan(400);

    // 존댓말
    expect(summary, '존댓말이 아님').toMatch(/니다|세요|습니다|겠습니다/);

    // 학원명 포함 (프롬프트에서 요구)
    const hasAcademyName = summary.includes('와와') || summary.includes('학습코칭');
    console.log(`학원명 포함: ${hasAcademyName ? '✅' : '❌'}`);

    // 액션 플랜 키워드 포함
    const actionKeywords = ['보충', '훈련', '복습', '연습', '지도', '계획', '프린트', '오답', '목표'];
    const foundActions = actionKeywords.filter(kw => summary.includes(kw));
    console.log(`액션 플랜 키워드 (${foundActions.length}개): ${foundActions.join(', ')}`);
    expect(foundActions.length, '구체적 액션 플랜이 부족').toBeGreaterThanOrEqual(2);

    // 가정 연계 키워드
    const homeKeywords = ['가정', '집', '부모', '어머님', '아버님', '댁'];
    const hasHome = homeKeywords.some(kw => summary.includes(kw));
    console.log(`가정 연계 언급: ${hasHome ? '✅' : '⚠️ 없음'}`);

    // 격려 톤
    expect(summary, '격려 톤이 없음').toMatch(/응원|격려|가능성|성장|발전|기대|믿|잠재/);

    // 메모 반영 체크
    const memos = s.scores.filter(sc => sc.comment).map(sc => sc.comment);
    const memoReflected = memos.filter(m => {
      const keywords = m.split(/\s+/);
      return keywords.some(kw => kw.length >= 2 && summary.includes(kw));
    });
    console.log(`메모 반영: ${memoReflected.length}/${memos.length}개`);
  });
}

// ─── 디버그: raw API 응답 확인 ───

test('디버그: generate-comment raw 응답 구조 확인', async ({ request }) => {
  const res = await request.post(`${API_URL}/api/ai/generate-comment`, {
    headers: headers(),
    data: {
      studentName: 'test',
      subject: '수학',
      score: 85,
      yearMonth: '2026-03',
    },
  });
  const body = await res.json();
  console.log(`\n━━━ RAW 응답 (HTTP ${res.status()}) ━━━`);
  console.log(JSON.stringify(body, null, 2));
});

test('디버그: generate-summary raw 응답 구조 확인', async ({ request }) => {
  const res = await request.post(`${API_URL}/api/ai/generate-summary`, {
    headers: headers(),
    data: {
      studentName: 'test',
      yearMonth: '2026-03',
      scores: [
        { subject: '수학', score: 85, comment: '계산 정확도 향상' },
        { subject: '국어', score: 70, comment: '' },
      ],
    },
  });
  const body = await res.json();
  console.log(`\n━━━ RAW 총평 응답 (HTTP ${res.status()}) ━━━`);
  console.log(JSON.stringify(body, null, 2));
});

// ─── 톤 일관성 테스트: 같은 입력 2회 비교 ───

test('톤 일관성: 같은 입력으로 2회 생성 비교', async ({ request }) => {
  const data = {
    studentName: 'test',
    subject: '수학',
    score: 75,
    yearMonth: '2026-03',
    existingComment: '풀이 과정은 잘 쓰지만 계산 실수가 잦음',
  };

  const results: string[] = [];
  for (let i = 0; i < 2; i++) {
    const res = await request.post(`${API_URL}/api/ai/generate-comment`, {
      headers: headers(),
      data,
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    results.push(body.data?.comment || body.comment || '');
  }

  console.log('\n━━━ 톤 일관성 비교 ━━━');
  for (let i = 0; i < results.length; i++) {
    console.log(`\n[${i + 1}회차] (${results[i].length}자):\n${results[i]}`);
  }

  // 두 결과의 길이 차이가 3배 이상이면 일관성 없음
  const ratio = Math.max(results[0].length, results[1].length) / Math.min(results[0].length, results[1].length);
  console.log(`\n길이 비율: ${ratio.toFixed(2)}배`);
  expect(ratio, `응답 길이 차이가 너무 큼 (${ratio.toFixed(2)}배)`).toBeLessThan(3);

  // 둘 다 존댓말인지
  for (const r of results) {
    expect(r, '존댓말이 아닌 응답 있음').toMatch(/니다|세요|습니다/);
  }
});
