# 라이브 문제 세션 (Live Problem Session) 설계

> 교사가 풀이/문제를 띄우고, 학생이 자기 디바이스에서 동시에 풀이를 작성·제출하는 1:1 세션 기능.

## 1. 목표 / 비목표

### 목표 (MVP)
- 교사 데스크톱과 학생 디바이스(모바일/태블릿)가 같은 세션을 공유
- 교사: 좌측 = 본인 풀이 영역, 우측 = 학생 풀이 실시간 미리보기
- 학생: 상단 = 교사가 띄운 문제, 하단 = 본인 풀이 입력
- 입력은 **텍스트 + 이미지 업로드 + 간단한 캔버스 낙서** 3가지 모두 지원
- 세션 종료 시 결과물을 학생 프로필의 교과 메모(`student_teacher_notes`)에 자동 기록

### 비목표 (MVP 제외)
- 동시 다중 학생 세션 (N:1 강의)
- 음성/영상 통화
- 1초 이내 실시간 (3~5초 폴링 지연 허용)
- 펜 압력/지우개 등 정교한 필기 기능

---

## 2. 핵심 결정 (Recommended Defaults)

| 항목 | 선택 | 이유 |
|------|------|------|
| 시나리오 | **1:1 면담/과외** | 가장 단순, 학원 면담실 사용 케이스 |
| 문제 출처 | 즉석 이미지 업로드 + 텍스트 입력 | 기존 시험·숙제 연동은 v2 |
| 학생 입력 | 텍스트 + 이미지 + 캔버스 낙서 | 태블릿 펜·모바일 사진·키보드 모두 커버 |
| 동기화 | **Cloudflare KV 폴링 (3초)** | Durable Object 없이도 충분, 비용 0 |
| 세션 저장 | 종료 시 `student_teacher_notes`에 자동 메모 + R2에 캡처 보관 | 담임 대시보드와 자연스럽게 연계 |
| 인증 | 기존 JWT (교사) / 학생 로그인 토큰 (student app) | 별도 세션 코드 불요 |

---

## 3. 데이터 모델

### 3.1 D1 테이블 — `live_sessions`

```sql
CREATE TABLE IF NOT EXISTS live_sessions (
  id              TEXT PRIMARY KEY,           -- 'lvs_xxx'
  academy_id      TEXT NOT NULL,
  teacher_id      TEXT NOT NULL,              -- users.id
  student_id      TEXT NOT NULL,              -- students.id
  subject         TEXT NOT NULL,              -- '수학' / '영어' ...
  status          TEXT NOT NULL DEFAULT 'active', -- active | ended | abandoned
  started_at      TEXT NOT NULL DEFAULT (datetime('now')),
  ended_at        TEXT,
  duration_sec    INTEGER,                    -- ended_at - started_at
  problem_text    TEXT,                       -- 마지막 띄운 문제 (텍스트)
  problem_r2_key  TEXT,                       -- 마지막 띄운 이미지 R2 키
  teacher_solution_text TEXT,                 -- 교사 풀이 (텍스트, 최종)
  teacher_solution_r2_key TEXT,               -- 교사 캔버스/이미지 (최종)
  student_answer_text TEXT,                   -- 학생 답안 (텍스트, 최종)
  student_answer_r2_key TEXT,                 -- 학생 캔버스/이미지 (최종)
  note_id         TEXT,                       -- 종료 시 생성한 student_teacher_notes.id
  FOREIGN KEY (academy_id) REFERENCES academies(id) ON DELETE CASCADE,
  FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_lvs_student_time ON live_sessions(student_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_lvs_teacher_time ON live_sessions(teacher_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_lvs_active ON live_sessions(status, academy_id);
```

### 3.2 KV — 라이브 상태 (단명, TTL 1시간)

세션 동안만 살아있는 "현재 화면 상태" 저장. D1에 매번 쓰면 비용 + 락 경합 → KV가 적합.

```
key:   lvs:state:{session_id}
value: JSON {
  problem: { text?: string, image_url?: string, updated_at: number },
  teacher: { text?: string, strokes?: Stroke[], updated_at: number },
  student: { text?: string, strokes?: Stroke[], image_url?: string, updated_at: number },
  pulse: number  // 마지막 활동 unix timestamp (ms)
}
TTL: 3600s
```

```
key:   lvs:active:student:{student_id}
value: session_id
TTL:   3600s
```
→ 학생이 student app 열면 "내가 참여 중인 라이브가 있는지" 빠르게 조회.

### 3.3 R2 — 이미지/캔버스 영구 저장

```
academies/{academy_id}/live/{session_id}/problem.png       # 교사가 업로드한 문제 이미지
academies/{academy_id}/live/{session_id}/teacher.png       # 교사 풀이 캔버스 PNG
academies/{academy_id}/live/{session_id}/student.png       # 학생 풀이 캔버스 PNG
academies/{academy_id}/live/{session_id}/student-photo-{n}.jpg  # 학생이 사진 첨부
```

Stroke 데이터는 KV에만 (세션 중), 종료 시 캔버스를 PNG로 직렬화해서 R2.

---

## 4. API 설계

베이스: `/api/live` (워커: `workers/src/routes/live-handler.ts` 신규)

### 4.1 교사 → 세션 시작
```
POST /api/live/sessions
Auth: instructor | admin
Body: { student_id: string, subject: string, problem_text?: string }
Resp: { id: string, started_at: string }
```
- D1에 row 삽입 (status=active)
- KV `lvs:state:{id}` 초기화
- KV `lvs:active:student:{student_id}` = id

### 4.2 양쪽 → 상태 폴링 (핵심)
```
GET /api/live/sessions/:id/state?since=<ms_timestamp>
Auth: 세션의 teacher_id 또는 student_id (학생 토큰)
Resp 304 if-not-modified | 200 { ...state, pulse: number }
```
- 학생 측은 `since`에 직전 받은 `pulse` 보내서 변경 없으면 304
- KV 1회 GET (Cache HIT 비용 1) → 매우 저렴

### 4.3 양쪽 → 상태 PATCH (공동)
```
PATCH /api/live/sessions/:id/state
Auth: teacher_id 또는 student_id
Body: { side: 'teacher' | 'student' | 'problem', text?, strokes?, image_url? }
Resp: { pulse: number }
```
- 검증: side === 'teacher'이면 caller가 teacher여야 함 (학생은 'student'만 가능, 'problem'은 교사 전용)
- KV merge → put (TTL 갱신)
- pulse = Date.now()

### 4.4 학생 → 사진 업로드
```
POST /api/live/sessions/:id/photo
Auth: 세션의 student_id
Body: multipart/form-data (file)
Resp: { url: string, r2_key: string }
```
- R2 PUT → 결과 URL을 PATCH state로 등록

### 4.5 교사 → 문제 이미지 업로드
```
POST /api/live/sessions/:id/problem-image
Auth: teacher_id
Body: multipart/form-data (file)
Resp: { url: string }
```

### 4.6 교사 → 세션 종료
```
POST /api/live/sessions/:id/end
Auth: teacher_id
Body: {
  teacher_solution_image?: base64 PNG,
  student_answer_image?: base64 PNG,
  create_note?: { sentiment: 'positive'|'neutral'|'concern', summary: string }
}
Resp: { id, note_id?: string }
```
- R2에 PNG 저장
- D1 update (ended_at, duration_sec, status='ended', *_r2_key, teacher_solution_text, student_answer_text)
- `create_note` 있으면 `student_teacher_notes` INSERT (subject = 세션 subject, source='manual', source_ref_id=session_id, content = summary + 자동 메타)
- KV 키 삭제

### 4.7 학생 → 활성 세션 확인 (student app 진입 시)
```
GET /api/live/active
Auth: student
Resp: { session: { id, subject, teacher_name } | null }
```

### 4.8 권한 매트릭스

| 엔드포인트 | 교사 | 해당 학생 | 다른 사용자 |
|------|------|-----|-----|
| POST /sessions | ✅ instructor/admin + canAccessStudent | ❌ | ❌ |
| GET state | ✅ session.teacher_id | ✅ session.student_id | ❌ 403 |
| PATCH state side=teacher/problem | ✅ | ❌ | ❌ |
| PATCH state side=student | ❌ | ✅ | ❌ |
| POST photo | ❌ | ✅ | ❌ |
| POST problem-image | ✅ | ❌ | ❌ |
| POST end | ✅ | ❌ | ❌ |

---

## 5. 클라이언트 컴포넌트

### 5.1 데스크톱 (교사) — 신규 페이지 `LiveSessionPage`

라우트: `/student/:id/live` 또는 학생 프로필에서 "라이브 시작" 버튼

```
┌─────────────────────────────────────────────────────────────┐
│ 라이브 세션 — [학생명] · [과목] · 00:12:34         [종료]   │
├─────────────────────────────────┬───────────────────────────┤
│ 📋 문제                          │  👁 학생 화면 미리보기    │
│ ┌─────────────────────────────┐  │  ┌─────────────────────┐ │
│ │ [텍스트 입력 / 이미지 첨부] │  │  │ (학생 캔버스+텍스트) │ │
│ └─────────────────────────────┘  │  │  실시간 미러         │ │
│                                  │  └─────────────────────┘ │
│ ✏️ 내 풀이                        │                           │
│ ┌─────────────────────────────┐  │  💬 빠른 코멘트          │
│ │ <Canvas + 텍스트 토글>       │  │  [긍정][보통][우려]      │
│ └─────────────────────────────┘  │  [요약 메모 ___________]  │
└─────────────────────────────────┴───────────────────────────┘
```

**폴링 전략**
- 학생 영역만 `setInterval(3000)` 으로 GET state
- 교사 입력은 디바운스 500ms → PATCH state

**컴포넌트 분해**
```
LiveSessionPage
├── LiveSessionHeader (타이머, 종료 버튼)
├── ProblemEditor (텍스트 + 이미지 업로드)
├── TeacherSolutionPad (Canvas + 텍스트 탭)
├── StudentMirror (읽기 전용, 폴링)
└── EndSessionDialog (요약 + sentiment → 자동 메모 생성)
```

### 5.2 학생 앱 (`apps/student`) — 신규 페이지 `LiveSessionPage`

```
┌──────────────────────────────────┐
│ 📋 [선생님이 띄운 문제 — 텍스트]  │
│ ┌──────────────────────────────┐ │
│ │ [문제 이미지 / 자동 스크롤]   │ │
│ └──────────────────────────────┘ │
├──────────────────────────────────┤
│ ✏️ 내 풀이                       │
│ [텍스트 ▼] [캔버스 ▼] [📷 사진]  │
│ ┌──────────────────────────────┐ │
│ │ <입력 영역>                   │ │
│ └──────────────────────────────┘ │
│        ┌───────────────────┐    │
│        │ 자동 저장됨 · 3초전│    │
│        └───────────────────┘    │
└──────────────────────────────────┘
```

- 진입 트리거: HomePage에서 `GET /api/live/active`로 활성 세션 감지 → 자동 이동 또는 배너
- 학생은 종료 권한 없음 (교사만)
- 교사가 종료하면 폴링 응답에 status=ended 받고 "수고했어요" 화면 → 홈으로

### 5.3 캔버스 컴포넌트 (`SimpleCanvas`)

신규 공용 컴포넌트 (`apps/desktop/src/components/SimpleCanvas.tsx`, 학생 앱에 복사 또는 packages/ui로)

```typescript
interface SimpleCanvasProps {
  width: number;
  height: number;
  strokes: Stroke[];
  onChange?: (strokes: Stroke[]) => void;
  readOnly?: boolean;
}
type Stroke = { color: string; width: number; points: [number, number][] };
```
- pointer events (마우스 + 터치 + 펜 모두)
- 단색 검정/빨강/파랑 + 지우개 + 전체 초기화
- 직렬화: stroke array → KV에 그대로
- 종료 시: `canvas.toDataURL('image/png')` → R2

---

## 6. 시퀀스 다이어그램

```
교사                Worker             KV/D1/R2          학생 앱
 │                   │                   │                 │
 │─POST /sessions───►│                   │                 │
 │                   │─D1 INSERT────────►│                 │
 │                   │─KV PUT lvs:state─►│                 │
 │                   │─KV PUT lvs:active►│                 │
 │◄──{id}────────────│                   │                 │
 │                   │                   │                 │
 │                   │                   │◄─GET /active────│ (학생 홈 진입)
 │                   │                   │  → 세션 발견    │
 │                   │                   │                 │
 │─PATCH problem────►│─KV merge─────────►│                 │
 │                   │                   │                 │
 │                   │                   │◄─GET state(s=0)─│ (3s 폴링)
 │                   │                   │─304 or 200─────►│
 │                   │                   │                 │
 │                   │                   │◄─PATCH student──│
 │◄─GET state(s=p)───│                   │                 │
 │   200 (학생 변경) │                   │                 │
 │                   │                   │                 │
 │─POST /end────────►│                   │                 │
 │                   │─R2 PUT PNGs──────►│                 │
 │                   │─D1 UPDATE────────►│                 │
 │                   │─D1 INSERT note───►│                 │
 │                   │─KV DELETE────────►│                 │
 │◄──{id, note_id}───│                   │                 │
 │                   │                   │◄─GET state──────│
 │                   │                   │ 200 status=ended│
 │                   │                   │ → 학생 종료화면 │
```

---

## 7. 보안 / 격리

- 모든 핸들러: `requireAuth` + `academy_id == session.academy_id` 검증
- PATCH state: caller의 user_id와 side 매칭 검증 (교사 토큰으로 student side 조작 불가)
- R2 키에 `academy_id` 프리픽스 → 다른 학원 파일 접근 불가
- KV 키에 session_id (UUID) 사용 → 추측 불가
- 학생 토큰은 세션의 `student_id`와 일치해야 함

---

## 8. 비용 / 성능

- KV: 폴링 3s × 2명 × 세션 30분 = ~1,200 reads/세션 (HIT 무료, MISS도 거의 0)
- D1: 시작 1, 종료 1 + INSERT note 1 = 3 writes/세션
- R2: PUT 3~5회/세션 (저렴)
- Worker CPU: PATCH 시 KV merge 5ms 미만

→ 100 세션/일 = D1 300 writes, KV 120k reads (무료 한도 안)

---

## 9. 마이그레이션 / 빌드 단위 (구현 단계 분해)

### Phase A — 백엔드 기반
1. `migrations/039_live_sessions.sql` 생성
2. `workers/src/routes/live-handler.ts` 신규 (8개 엔드포인트)
3. `workers/src/index.ts` 라우트 등록
4. D1 적용 + 워커 배포

### Phase B — 데스크톱 (교사)
1. `api.ts`: live 메서드 묶음 추가
2. `components/SimpleCanvas.tsx` 신규
3. `pages/LiveSessionPage.tsx` 신규
4. `StudentProfilePage`에 "🔴 라이브 시작" 버튼
5. 라우터 등록 `/student/:id/live`

### Phase C — 학생 앱
1. `apps/student/src/api.ts`: live 메서드 추가
2. `apps/student/src/components/SimpleCanvas.tsx` (복사)
3. `apps/student/src/pages/LiveSessionPage.tsx` 신규
4. `HomePage`: 활성 세션 폴링 → 배너/자동 이동

### Phase D — 종료 통합
1. EndSessionDialog: sentiment + 요약 → `student_teacher_notes` 자동 생성
2. `TeacherNotesPanel`에 "라이브 세션 첨부" 표시 (source='live_session')
3. `student_teacher_notes` source enum에 `live_session` 추가 (마이그레이션 040)

---

## 10. 향후 확장 (v2 후보)

- N:1 (강의 모드): 같은 세션에 여러 학생 KV 키 분리
- 기존 자료 띄우기: 시험지/숙제/단어장에서 직접 push
- WebSocket (Durable Object): 실시간성 필요 시
- 화면 공유 (WebRTC): 교사 데스크톱 화면을 학생에게 미러
- 오답 자동 추출 → 숙제 큐로 이동

---

## 승인 후 다음 단계

`/sc:implement live-problem-session --phase A` 부터 순차 진행.
Phase A만 약 200줄, Phase B+C 약 600줄 예상. 총 4단계로 나눠 배포 가능.
