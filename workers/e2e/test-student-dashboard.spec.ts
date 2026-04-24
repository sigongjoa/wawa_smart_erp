/**
 * 학생 성장 대시보드 E2E 테스트 — API 데이터 검증 (Issue #33)
 *
 * ═══ 유즈케이스 정의 ═══
 *
 * UC-01: 로그인 → 토큰 획득
 * UC-02: 학생 목록 조회 → 대시보드 진입 대상 확인
 * UC-03: 학생 프로필 조회 → 기본 정보 + 담당 선생님 데이터 검증
 * UC-04: 성적 추이 조회 → months/subjects 구조 + null 허용 검증
 * UC-05: 코멘트 히스토리 조회 → 월별 정렬 + score/comment 구조
 * UC-06: 출결 요약 조회 → 통계 필드 + 출석률 계산 검증
 * UC-07: 존재하지 않는 학생 → 404 에러 처리
 * UC-08: 데이터 없는 학생 → 빈 배열/0값 정상 반환
 */
import { test, expect } from '@playwright/test';
import { API_URL, SITE_URL } from './_env';

const API = API_URL;

async function getToken(): Promise<string> {
  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: '서재용 개발자', pin: '1141' }),
  });
  const json = await res.json() as any;
  if (!json.data?.accessToken) throw new Error('로그인 실패: ' + JSON.stringify(json));
  return json.data.accessToken;
}

function headers(token: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

let token: string;
let testStudentId: string;
let testStudentName: string;

test.describe.configure({ mode: 'serial' });

test.describe('학생 성장 대시보드 — API 데이터 검증', () => {

  // ═══ UC-01: 로그인 ═══
  test('UC-01: 로그인 및 토큰 획득', async () => {
    token = await getToken();
    expect(token).toBeTruthy();
    console.log('✅ 토큰 획득 성공');
  });

  // ═══ UC-02: 학생 목록 조회 ═══
  test('UC-02: 학생 목록 조회 → 대시보드 진입 가능 학생 존재', async () => {
    const res = await fetch(`${API}/api/student`, { headers: headers(token) });
    expect(res.status).toBe(200);

    const json = await res.json() as any;
    const students = json.data || json;
    expect(Array.isArray(students)).toBe(true);
    console.log(`✅ 학생 ${students.length}명 조회`);

    // active 학생 찾기
    const active = students.filter((s: any) => s.status === 'active');
    expect(active.length).toBeGreaterThan(0);

    testStudentId = active[0].id;
    testStudentName = active[0].name;
    console.log(`  대상 학생: ${testStudentName} (${testStudentId})`);

    // 필수 필드 확인
    const s = active[0];
    expect(s).toHaveProperty('id');
    expect(s).toHaveProperty('name');
    expect(s).toHaveProperty('status');
    console.log(`  필드: id=${s.id}, name=${s.name}, subjects=${JSON.stringify(s.subjects)}`);
  });

  // ═══ UC-03: 학생 프로필 조회 ═══
  test('UC-03: 학생 프로필 → 기본 정보 + 담당 선생님', async () => {
    const res = await fetch(`${API}/api/student/${testStudentId}/profile`, {
      headers: headers(token),
    });
    expect(res.status).toBe(200);

    const json = await res.json() as any;
    const profile = json.data || json;

    // 필수 필드 검증
    expect(profile.id).toBe(testStudentId);
    expect(profile.name).toBe(testStudentName);
    expect(profile).toHaveProperty('grade');
    expect(profile).toHaveProperty('enrollment_date');
    expect(profile).toHaveProperty('status');
    console.log(`✅ 프로필: ${profile.name} / ${profile.grade} / ${profile.status}`);

    // subjects는 배열
    expect(Array.isArray(profile.subjects)).toBe(true);
    console.log(`  수강 과목: ${JSON.stringify(profile.subjects)}`);

    // teachers 배열 검증
    expect(Array.isArray(profile.teachers)).toBe(true);
    if (profile.teachers.length > 0) {
      expect(profile.teachers[0]).toHaveProperty('id');
      expect(profile.teachers[0]).toHaveProperty('name');
      console.log(`  담당 선생님: ${profile.teachers.map((t: any) => t.name).join(', ')}`);
    } else {
      console.log('  담당 선생님: (배정 없음)');
    }

    // guardian_contact은 있거나 null
    console.log(`  학부모 연락처: ${profile.guardian_contact || '(없음)'}`);
  });

  // ═══ UC-04: 성적 추이 조회 ═══
  test('UC-04: 성적 추이 → months/subjects 구조 검증', async () => {
    const res = await fetch(
      `${API}/api/report/history?studentId=${testStudentId}&months=12`,
      { headers: headers(token) }
    );
    expect(res.status).toBe(200);

    const json = await res.json() as any;
    const history = json.data || json;

    // 구조 검증
    expect(history).toHaveProperty('months');
    expect(history).toHaveProperty('subjects');
    expect(Array.isArray(history.months)).toBe(true);
    expect(typeof history.subjects).toBe('object');
    console.log(`✅ 성적 추이: ${history.months.length}개월 데이터`);

    // months는 YYYY-MM 포맷, 정렬됨
    for (const m of history.months) {
      expect(m).toMatch(/^\d{4}-\d{2}$/);
    }
    const sorted = [...history.months].sort();
    expect(history.months).toEqual(sorted);
    console.log(`  기간: ${history.months[0] || '없음'} ~ ${history.months[history.months.length - 1] || '없음'}`);

    // subjects 값 배열 길이 = months 길이
    for (const [subject, scores] of Object.entries(history.subjects)) {
      const arr = scores as (number | null)[];
      expect(arr.length).toBe(history.months.length);
      // 각 값은 number 또는 null
      for (const v of arr) {
        expect(v === null || typeof v === 'number').toBe(true);
        if (typeof v === 'number') {
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(100);
        }
      }
      const validScores = arr.filter((v): v is number => v !== null);
      console.log(`  ${subject}: [${arr.map(v => v ?? '-').join(', ')}] (${validScores.length}건)`);
    }
  });

  // ═══ UC-05: 코멘트 히스토리 조회 ═══
  test('UC-05: 코멘트 히스토리 → 월별 정렬 + 구조 검증', async () => {
    const res = await fetch(
      `${API}/api/student/${testStudentId}/comments?months=12`,
      { headers: headers(token) }
    );
    expect(res.status).toBe(200);

    const json = await res.json() as any;
    const comments = json.data || json;
    expect(Array.isArray(comments)).toBe(true);
    console.log(`✅ 코멘트 히스토리: ${comments.length}개월`);

    // 내림차순 정렬 검증
    for (let i = 1; i < comments.length; i++) {
      expect(comments[i - 1].yearMonth >= comments[i].yearMonth).toBe(true);
    }

    // 각 항목 구조
    for (const entry of comments) {
      expect(entry).toHaveProperty('yearMonth');
      expect(entry.yearMonth).toMatch(/^\d{4}-\d{2}$/);
      expect(Array.isArray(entry.scores)).toBe(true);
      expect(typeof entry.totalComment).toBe('string');

      // scores 내부 구조
      for (const s of entry.scores) {
        expect(s).toHaveProperty('subject');
        expect(s).toHaveProperty('score');
        expect(s).toHaveProperty('comment');
        expect(typeof s.subject).toBe('string');
        expect(typeof s.score).toBe('number');
        expect(typeof s.comment).toBe('string');
      }

      const subjects = entry.scores.map((s: any) => `${s.subject}(${s.score})`).join(', ');
      const hasTotal = entry.totalComment ? '총평있음' : '총평없음';
      console.log(`  ${entry.yearMonth}: ${subjects} — ${hasTotal}`);
    }
  });

  // ═══ UC-06: 출결 요약 조회 ═══
  test('UC-06: 출결 요약 → 통계 + 출석률 정합성', async () => {
    const res = await fetch(
      `${API}/api/student/${testStudentId}/attendance?months=6`,
      { headers: headers(token) }
    );
    expect(res.status).toBe(200);

    const json = await res.json() as any;
    const att = json.data || json;

    // 필수 필드 존재
    expect(att).toHaveProperty('totalClasses');
    expect(att).toHaveProperty('present');
    expect(att).toHaveProperty('absent');
    expect(att).toHaveProperty('late');
    expect(att).toHaveProperty('attendanceRate');
    expect(att).toHaveProperty('recentAbsences');
    expect(att).toHaveProperty('makeups');

    // 숫자 타입
    expect(typeof att.totalClasses).toBe('number');
    expect(typeof att.present).toBe('number');
    expect(typeof att.absent).toBe('number');
    expect(typeof att.late).toBe('number');
    expect(typeof att.attendanceRate).toBe('number');
    console.log(`✅ 출결 요약: 전체 ${att.totalClasses}회`);
    console.log(`  출석 ${att.present} / 결석 ${att.absent} / 지각 ${att.late}`);
    console.log(`  출석률: ${att.attendanceRate}%`);

    // 합계 정합성: present + absent + late = totalClasses
    expect(att.present + att.absent + att.late).toBe(att.totalClasses);

    // 출석률 계산 검증
    if (att.totalClasses > 0) {
      const expectedRate = Math.round((att.present / att.totalClasses) * 100);
      expect(att.attendanceRate).toBe(expectedRate);
    } else {
      expect(att.attendanceRate).toBe(100);
    }

    // recentAbsences 구조
    expect(Array.isArray(att.recentAbsences)).toBe(true);
    for (const a of att.recentAbsences) {
      expect(a).toHaveProperty('date');
      expect(a).toHaveProperty('className');
      expect(a).toHaveProperty('reason');
    }
    if (att.recentAbsences.length > 0) {
      console.log(`  최근 결석 ${att.recentAbsences.length}건: ${att.recentAbsences[0].date} ${att.recentAbsences[0].className}`);
    }

    // makeups 구조
    expect(att.makeups).toHaveProperty('completed');
    expect(att.makeups).toHaveProperty('pending');
    console.log(`  보강: 완료 ${att.makeups.completed} / 대기 ${att.makeups.pending}`);
  });

  // ═══ UC-07: 존재하지 않는 학생 → 404 ═══
  test('UC-07: 존재하지 않는 학생 ID → 404 반환', async () => {
    const fakeId = 'student-nonexistent-000';

    const profileRes = await fetch(`${API}/api/student/${fakeId}/profile`, {
      headers: headers(token),
    });
    expect(profileRes.status).toBe(404);
    console.log(`✅ profile 404: ${profileRes.status}`);

    // comments, attendance는 빈 결과 (학생 존재 여부 체크 안 함 → 빈 배열 반환)
    const commentsRes = await fetch(`${API}/api/student/${fakeId}/comments`, {
      headers: headers(token),
    });
    expect([200, 404].includes(commentsRes.status)).toBe(true);
    console.log(`  comments: ${commentsRes.status}`);

    const attRes = await fetch(`${API}/api/student/${fakeId}/attendance`, {
      headers: headers(token),
    });
    expect([200, 404].includes(attRes.status)).toBe(true);
    console.log(`  attendance: ${attRes.status}`);
  });

  // ═══ UC-08: 인증 없이 접근 → 401 ═══
  test('UC-08: 인증 없이 접근 → 401', async () => {
    const res = await fetch(`${API}/api/student/${testStudentId}/profile`);
    expect(res.status).toBe(401);
    console.log(`✅ 인증 없이 profile 접근: ${res.status} (401 확인)`);

    const res2 = await fetch(`${API}/api/student/${testStudentId}/comments`);
    expect(res2.status).toBe(401);
    console.log(`  인증 없이 comments: ${res2.status}`);
  });
});
