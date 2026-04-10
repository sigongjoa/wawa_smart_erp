/**
 * 학원 공지/액션 보드 E2E 테스트 (Issue #28)
 * 라이브 API 직접 호출
 */
import { test, expect } from '@playwright/test';

const API = 'https://wawa-smart-erp-api.zeskywa499.workers.dev';

async function login(): Promise<{ token: string; userId: string }> {
  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: '서재용 개발자', pin: '1141' }),
  });
  const json = await res.json() as any;
  if (!json.data?.accessToken) throw new Error('로그인 실패: ' + JSON.stringify(json));
  return { token: json.data.accessToken, userId: json.data.user?.id || '' };
}

function h(token: string) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

let token: string;
let userId: string;
let noticeId: string;
let actionId: string;

test.describe.configure({ mode: 'serial' });

test.describe('공지/액션 보드', () => {

  test('UC-01: 로그인', async () => {
    const result = await login();
    token = result.token;
    userId = result.userId;
    expect(token).toBeTruthy();
    console.log(`✅ 토큰 획득, userId: ${userId}`);
  });

  test('UC-02: 선생님 목록 조회 (액션 할당용)', async () => {
    const res = await fetch(`${API}/api/board/teachers`, { headers: h(token) });
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    const teachers = json.data || json;
    console.log(`✅ 선생님 ${teachers.length}명`);
    expect(teachers.length).toBeGreaterThanOrEqual(1);
    // userId는 로그인 사용자 (서재용 개발자) 것을 사용
    const me = teachers.find((t: any) => t.id === userId);
    console.log(`  로그인 사용자: ${me?.name || 'NOT FOUND'} (${userId})`);
    // 만약 로그인 userId가 없으면 첫번째로 대체
    if (!me) {
      userId = teachers[0].id;
      console.log(`  대체 사용: ${teachers[0].name} (${userId})`);
    }
  });

  test('UC-03: 공지 작성 (액션 아이템 포함)', async () => {
    const res = await fetch(`${API}/api/board/notices`, {
      method: 'POST',
      headers: h(token),
      body: JSON.stringify({
        title: '[회의] E2E 테스트 — 강사미팅 결과',
        content: '이번 주 금요일 강사미팅 내용 공유합니다.\n1. 중간고사 일정 확정\n2. 보강 관리 체계화',
        category: 'meeting',
        isPinned: true,
        dueDate: new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0],
        actionItems: [
          { title: '중간고사 범위 학부모 안내', assignedTo: userId, dueDate: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0] },
          { title: '시험지 출제', assignedTo: userId, dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0] },
        ],
      }),
    });
    expect(res.status).toBeLessThan(300);
    const json = await res.json() as any;
    noticeId = (json.data || json).id;
    console.log(`✅ 공지 작성: ${noticeId} (액션 2개 포함)`);
  });

  test('UC-04: 공지 목록 조회', async () => {
    const res = await fetch(`${API}/api/board/notices`, { headers: h(token) });
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    const notices = json.data || json;
    console.log(`✅ 공지 ${notices.length}개 조회`);
    expect(notices.length).toBeGreaterThanOrEqual(1);

    const found = notices.find((n: any) => n.id === noticeId);
    expect(found).toBeTruthy();
    console.log(`  고정: ${found.is_pinned}, 카테고리: ${found.category}, 읽음: ${found.read_count}/${found.total_users}`);
  });

  test('UC-05: 카테고리 필터 (meeting)', async () => {
    const res = await fetch(`${API}/api/board/notices?category=meeting`, { headers: h(token) });
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    const notices = json.data || json;
    console.log(`✅ 회의 카테고리 ${notices.length}개`);
    for (const n of notices) {
      expect(n.category).toBe('meeting');
    }
  });

  test('UC-06: 공지 읽음 처리', async () => {
    const res = await fetch(`${API}/api/board/notices/${noticeId}/read`, {
      method: 'POST',
      headers: h(token),
    });
    expect(res.status).toBe(200);
    console.log('✅ 읽음 처리 완료');

    // 읽음 수 확인
    const res2 = await fetch(`${API}/api/board/notices`, { headers: h(token) });
    const json2 = await res2.json() as any;
    const notice = (json2.data || json2).find((n: any) => n.id === noticeId);
    console.log(`  읽음 수: ${notice?.read_count}, is_read: ${notice?.is_read}`);
    expect(notice?.is_read).toBeTruthy();
  });

  test('UC-07: 내 할일 조회', async () => {
    const res = await fetch(`${API}/api/board/my-actions`, { headers: h(token) });
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    const actions = json.data || json;
    console.log(`✅ 내 할일 ${actions.length}개`);
    expect(actions.length).toBeGreaterThanOrEqual(2);

    for (const a of actions) {
      console.log(`  - ${a.title} (${a.status}) ${a.due_date || ''}`);
    }
  });

  test('UC-08: 전체 액션 목록 조회', async () => {
    const res = await fetch(`${API}/api/board/actions`, { headers: h(token) });
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    const actions = json.data || json;
    console.log(`✅ 전체 액션 ${actions.length}개`);

    // pending인 것 찾기
    const pending = actions.find((a: any) => a.status === 'pending');
    if (pending) {
      actionId = pending.id;
      console.log(`  미완료: ${pending.title} → ${pending.assigned_to_name}`);
    }
  });

  test('UC-09: 독립 액션 추가', async () => {
    const res = await fetch(`${API}/api/board/actions`, {
      method: 'POST',
      headers: h(token),
      body: JSON.stringify({
        title: 'E2E 테스트 독립 할일',
        assignedTo: userId,
        dueDate: new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0],
        description: '테스트용 독립 할일입니다',
      }),
    });
    expect(res.status).toBeLessThan(300);
    const json = await res.json() as any;
    console.log(`✅ 독립 액션 추가: ${(json.data || json).id}`);
  });

  test('UC-10: 액션 완료 처리', async () => {
    if (!actionId) { console.log('⏭️ 액션 없음 스킵'); return; }

    const res = await fetch(`${API}/api/board/actions/${actionId}`, {
      method: 'PATCH',
      headers: h(token),
      body: JSON.stringify({ status: 'completed' }),
    });
    expect(res.status).toBe(200);
    console.log('✅ 액션 완료 처리');
  });

  test('UC-11: 완료 확인 — status 필터', async () => {
    const res = await fetch(`${API}/api/board/actions?status=completed`, { headers: h(token) });
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    const completed = json.data || json;
    console.log(`✅ 완료 액션 ${completed.length}개`);
    expect(completed.length).toBeGreaterThanOrEqual(1);
    for (const a of completed) {
      expect(a.status).toBe('completed');
    }
  });

  test('UC-12: 타임라인 조회', async () => {
    const res = await fetch(`${API}/api/board/timeline`, { headers: h(token) });
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    const timeline = json.data || json;
    console.log(`✅ 타임라인 ${timeline.length}건`);
    expect(timeline.length).toBeGreaterThanOrEqual(1);

    for (const item of timeline.slice(0, 5)) {
      console.log(`  [${item.type}] ${item.title} — ${item.created_at}`);
    }
  });

  test('UC-13: 공지 수정 (고정 해제)', async () => {
    const res = await fetch(`${API}/api/board/notices/${noticeId}`, {
      method: 'PATCH',
      headers: h(token),
      body: JSON.stringify({ isPinned: false }),
    });
    expect(res.status).toBe(200);
    console.log('✅ 고정 해제');
  });

  test('UC-14: 의무교육 공지 (D-day 테스트)', async () => {
    const dueIn3Days = new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0];
    const res = await fetch(`${API}/api/board/notices`, {
      method: 'POST',
      headers: h(token),
      body: JSON.stringify({
        title: '[의무교육] 개인정보보호 교육 이수',
        content: '기한 내 이수 필수',
        category: 'education',
        isPinned: true,
        dueDate: dueIn3Days,
      }),
    });
    expect(res.status).toBeLessThan(300);
    const json = await res.json() as any;
    console.log(`✅ 의무교육 공지 작성: ${(json.data || json).id} (기한: ${dueIn3Days})`);
  });

  test('UC-15: 공지 삭제', async () => {
    // 테스트 공지 삭제
    const res = await fetch(`${API}/api/board/notices/${noticeId}`, {
      method: 'DELETE',
      headers: h(token),
    });
    expect(res.status).toBe(200);
    console.log('✅ 테스트 공지 삭제');
  });
});
