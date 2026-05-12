# 알림 시스템 설계 — MVP

> 2026-05-13 작성 · 학생 자가 가입 요청 발견성 문제에서 출발
> 범위: 교사용 + 가입 요청 1종류 + polling + 헤더 종 아이콘

---

## 1. 문제와 목표

**문제:** 학생이 `/signup-request` 로 자가 가입을 보내도 교사는 `/gacha` 페이지에 직접 진입해야만 카드를 볼 수 있음. 발견성 0.

**목표 (MVP):**
- 교사가 어느 페이지에 있든 헤더 종 아이콘으로 unread 가입 요청 수를 인지
- 클릭 → 드롭다운에서 요약 → 항목 클릭 → 처리 페이지로 이동 + 읽음 처리
- 다른 알림 종류 추가 시 스키마/라우트 변경 없이 type 만 늘리면 됨

**비목표 (Phase 2 이후):**
- 학생 앱 알림 (승인/거절 결과 수신)
- 실시간 push (SSE/WebSocket)
- 외부 채널 (이메일/푸시)
- 다른 type (과제 제출, 시험 결과 등)

---

## 2. 데이터 모델 — migration 063

```sql
-- 알림 — 다형 type + payload 구조로 향후 확장 대응
CREATE TABLE IF NOT EXISTS notifications (
  id                  TEXT PRIMARY KEY,
  academy_id          TEXT NOT NULL,
  recipient_user_id   TEXT,                -- NULL = recipient_role 으로 broadcast
  recipient_role      TEXT,                -- 'all_teachers' (admin+instructor) | 'admin' | 'instructor' | 'student'
  type                TEXT NOT NULL,       -- 'student_signup_request' | (확장)
  title               TEXT NOT NULL,       -- "신창섭 학생이 가입 요청"
  body                TEXT,                -- "지정 선생님: 김OO · 학년: 중2"
  link                TEXT,                -- desktop 라우트 (예: '/gacha?request=ssr-xxx')
  payload             TEXT,                -- JSON 문자열 — type 별 추가 데이터
  is_read             INTEGER NOT NULL DEFAULT 0,
  read_at             DATETIME,
  created_at          DATETIME NOT NULL DEFAULT (datetime('now')),
  expires_at          DATETIME,            -- 자동 정리 (없으면 영구)
  FOREIGN KEY (recipient_user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 본인 직접 수신 알림 — 페이지네이션
CREATE INDEX IF NOT EXISTS idx_notif_user_unread
  ON notifications(academy_id, recipient_user_id, is_read, created_at DESC)
  WHERE recipient_user_id IS NOT NULL;

-- broadcast 알림 — 학원 + role 기준
CREATE INDEX IF NOT EXISTS idx_notif_broadcast
  ON notifications(academy_id, recipient_role, is_read, created_at DESC)
  WHERE recipient_user_id IS NULL;

-- 자동 정리 잡 (Phase 2) — expires_at 인덱스
CREATE INDEX IF NOT EXISTS idx_notif_expires
  ON notifications(expires_at) WHERE expires_at IS NOT NULL;
```

**설계 결정:**
- **recipient_user_id NULL = broadcast** — 학원 내 모든 교사에게 보임. MVP 기본값. 단일 수신자 알림(예: 본인 가입 요청 결과)은 Phase 2 에서 사용.
- **payload TEXT (JSON)** — type 별 자유 구조. SQLite 라 JSON 컬럼 없어도 충분.
- **read 상태는 broadcast 알림에서도 글로벌 1개** — 즉 한 명이 처리하면 모두 read 처리됨 (가입 요청은 일회성 작업이므로 OK). 사용자별 read 추적이 필요해지면 별도 `notification_reads(user_id, notification_id)` 테이블 추가.
- **link 컬럼** — 클라이언트가 어떻게 처리할지 추상화. 미래에 다른 type 추가해도 라우팅 일관.

---

## 3. API 설계

모든 endpoint는 `requireAuth` + `requireRole('admin','instructor')` + academy_id 격리.

### 3.1 `GET /api/notifications`
- query: `status=unread|read|all` (default unread), `limit=20` (max 50), `cursor=<created_at>` (페이지네이션)
- 응답:
  ```json
  {
    "data": [
      {
        "id": "notif-xxx",
        "type": "student_signup_request",
        "title": "신창섭 학생이 가입 요청",
        "body": "지정 선생님: 김OO · 학년: 중2",
        "link": "/gacha?request=ssr-yyy",
        "payload": { "request_id": "ssr-yyy", "student_name": "신창섭" },
        "is_read": false,
        "created_at": "2026-05-13T00:47:06Z"
      }
    ],
    "next_cursor": null
  }
  ```
- WHERE 조건:
  ```sql
  WHERE academy_id = ? AND (
    recipient_user_id = ?  -- 본인 직접
    OR (recipient_user_id IS NULL AND recipient_role IN ('all_teachers', <my_role>))
  )
  ```

### 3.2 `GET /api/notifications/unread-count`
- 헤더 배지 전용 — 가벼움
- 응답: `{ "data": { "count": 3 } }`
- KV 60s 캐시 (academy_id + user_id 키) — 가입 요청 INSERT 시 invalidate

### 3.3 `POST /api/notifications/:id/read`
- 단건 읽음 처리. broadcast 알림이면 글로벌 is_read=1.
- 멱등 가드: `WHERE id = ? AND academy_id = ? AND is_read = 0`
- 응답: `{ "data": { "id": "notif-xxx", "is_read": true } }`

### 3.4 `POST /api/notifications/read-all`
- 학원 + 본인 수신 가능한 모든 unread → read
- 응답: `{ "data": { "marked": 3 } }`

---

## 4. 알림 생성 — server side helper

`workers/src/services/notify.ts`

```ts
export async function createNotification(
  db: D1Database,
  params: {
    academy_id: string;
    recipient_user_id?: string | null;
    recipient_role?: 'all_teachers' | 'admin' | 'instructor' | 'student' | null;
    type: string;
    title: string;
    body?: string | null;
    link?: string | null;
    payload?: Record<string, unknown> | null;
    expires_in_days?: number;
  },
): Promise<string> {
  const id = generatePrefixedId('notif');
  await db.prepare(
    `INSERT INTO notifications
     (id, academy_id, recipient_user_id, recipient_role, type, title, body, link, payload, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
  ).bind(
    id, params.academy_id,
    params.recipient_user_id ?? null,
    params.recipient_role ?? 'all_teachers',
    params.type, params.title,
    params.body ?? null, params.link ?? null,
    params.payload ? JSON.stringify(params.payload) : null,
    params.expires_in_days ? new Date(Date.now() + params.expires_in_days * 86400_000).toISOString() : null,
  ).run();
  return id;
}
```

### 호출 지점 (MVP)

`workers/src/routes/onboard-handler.ts` — 학생 자가 가입 요청 INSERT 직후:

```ts
// (기존 INSERT 끝난 직후)
await createNotification(context.env.DB, {
  academy_id: academy.id,
  recipient_role: 'all_teachers',
  type: 'student_signup_request',
  title: `${safeName} 학생이 가입 요청`,
  body: [
    safeTeacherName ? `지정 선생님: ${safeTeacherName}` : null,
    safeGrade ? `학년: ${safeGrade}` : null,
  ].filter(Boolean).join(' · ') || null,
  link: `/gacha?request=${id}`,
  payload: { request_id: id, student_name: safeName },
});

// unread-count 캐시 invalidate
await context.env.KV.delete(`notif:unread:${academy.id}`);
```

### 알림 종료 시점 (해당 요청 처리 시)

`handleApproveSignupRequest` / `handleRejectSignupRequest` 끝부분:

```ts
await context.env.DB.prepare(
  `UPDATE notifications
   SET is_read = 1, read_at = datetime('now')
   WHERE academy_id = ? AND type = 'student_signup_request'
     AND json_extract(payload, '$.request_id') = ?`,
).bind(academyId, requestId).run();
```

---

## 5. Frontend — desktop

### 5.1 `<NotificationBell>` (Layout 헤더 우상단)

```
┌─────────────────────────────────────────────┐
│  WAWA · ERP                          🔔 3   │
│                                             │
│  Sidebar              메인 컨텐츠           │
```

**State:**
- `unreadCount` — 30s polling
- `items` — 드롭다운 열 때 fetch (`GET /api/notifications?status=unread&limit=10`)

**Behavior:**
- 클릭 → 드롭다운 토글
- 항목 클릭 → `POST /:id/read` → `navigate(link)`
- "모두 읽음" 버튼 → `POST /read-all`
- "전체 보기" 링크 → `/notifications`

### 5.2 `<NotificationsPage>` (`/notifications`)

- 무한 스크롤 (cursor)
- 필터: unread / read / all
- 항목 클릭 = 드롭다운과 동일 동작

### 5.3 Polling 정책

- `unreadCount` 만 30s polling (`/unread-count` — 가벼움, KV 캐시)
- `items` 는 드롭다운 열 때만 fetch (cold)
- Visibility API — 탭 hidden 시 polling 정지 (배터리/요금 절약)

---

## 6. 학생 가입 요청 카드 위치 결정

기존 `/gacha` 페이지의 카드는 **유지** — 알림 클릭 후 진입 지점. 알림 시스템은 발견성을 더하는 레이어이지 카드를 대체하지 않음.

후속 개선:
- 알림 link 에 `?request=<id>` 가 붙어 진입 시 해당 카드를 highlight + scroll-into-view

---

## 7. 보안

- 모든 endpoint `requireAuth` + academy_id 격리 (`WHERE academy_id = ?`)
- `read`/`read-all` 은 본인 + 본인 academy 한정
- payload JSON 은 sanitize 된 값만 저장 (학생 이름 등 — 이미 sanitize 거침)
- KV 캐시 키: `notif:unread:{academy_id}:{user_id}` — 다른 학원/사용자 cross-read 불가
- rate limit 불필요 (인증 경로)

---

## 8. 구현 순서 / 작업 단위

1. **migration 063** — notifications 테이블
2. **workers/src/services/notify.ts** — createNotification helper
3. **workers/src/routes/notifications-handler.ts** — 4개 endpoint
4. **workers/src/index.ts** — 라우팅 등록
5. **onboard-handler.ts** — signup 요청 INSERT 직후 createNotification 호출
6. **gacha-student-handler.ts** — approve/reject 시 관련 알림 read 처리
7. **apps/desktop/src/api.ts** — notifications client (4개 메서드 + 타입)
8. **apps/desktop/src/components/NotificationBell.tsx** — 헤더 종 + 드롭다운
9. **apps/desktop/src/components/Layout.tsx** — 헤더에 Bell 슬롯
10. **apps/desktop/src/pages/NotificationsPage.tsx** — 전체 페이지 (lazy)
11. **App.tsx** — `/notifications` 라우트
12. **prod 배포** — backup → migration → workers → desktop

예상 작업량: 마이그레이션 + 백엔드 4시간, 프론트 3시간, 배포·검증 1시간.

---

## 9. Phase 2 확장 후보

- 학생 앱 알림 (`recipient_role='student'`, `recipient_user_id=<student_id>`) — 승인/거절 결과 수신
- 알림 type 추가: `assignment_submitted`, `exam_result_ready`, `parent_consultation_requested`
- 사용자별 read 추적 (broadcast에서 누가 읽었는지) — `notification_reads(user_id, notification_id)` N:M
- SSE 또는 WebSocket — Cloudflare Durable Objects 또는 Pub/Sub
- 외부 채널 — 이메일 (SES/Resend), 모바일 푸시 (FCM/APNS)
- 알림 환경설정 — 사용자가 type 별 on/off

---

## 10. 미루지 않을 의사결정

- broadcast vs per-user fan-out → **MVP는 broadcast** (구현 단순, 가입 요청은 일회성)
- read 상태 글로벌 vs 사용자별 → **MVP는 글로벌** (가입 요청 처리하면 모두에게 read 처리)
- polling vs push → **MVP는 polling 30s** (실시간성 요구 낮음)
- 영구 저장 vs 휘발성 → **영구 저장 + expires_at** (감사 로그·디버깅 가치)
- 종료된 알림 처리 → **is_read=1 로 갱신** (삭제 X — 감사 보존, 30일 후 자동 정리)
