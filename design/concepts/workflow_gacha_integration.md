# Workflow: Concept Gacha + 증명 연습 ERP 통합

> 생성: 2026-04-14
> 상태: PLANNED
> 대상 프로젝트: wawa_smart_erp (Cloudflare Workers + D1 + React)

---

## 전체 구현 순서 (6 Phase)

```
Phase 1: DB + API 기반     ──→  Phase 2: 관리자 페이지  ──→  Phase 3: 학생 앱 (가차)
   (1주)                          (1주)                        (1주)
                                                                  │
Phase 4: 증명 연습 모드   ←──  Phase 5: 공유 마켓       ←──────┘
   (1주)                          (3일)
                                    │
                              Phase 6: 마이그레이션 + 배포
                                  (2일)
```

---

## Phase 1: DB 스키마 + Workers API 기반

### 의존성: 없음 (첫 단계)
### 체크포인트: `wrangler d1 migrations apply` 성공 + API 헬스체크 통과

### 1.1 D1 마이그레이션 파일 생성

**파일**: `workers/migrations/019_concept_gacha.sql`

```sql
-- 학생 (PIN 로그인, 학원별 + 선생님별)
CREATE TABLE IF NOT EXISTS gacha_students (
  id TEXT PRIMARY KEY,
  academy_id TEXT NOT NULL,
  teacher_id TEXT NOT NULL,
  name TEXT NOT NULL,
  pin_hash TEXT NOT NULL,
  pin_salt TEXT NOT NULL,
  grade TEXT,
  status TEXT DEFAULT 'active',
  created_at DATETIME DEFAULT (datetime('now')),
  UNIQUE(academy_id, teacher_id, name)
);
CREATE INDEX idx_gacha_students_academy ON gacha_students(academy_id);
CREATE INDEX idx_gacha_students_teacher ON gacha_students(academy_id, teacher_id);

-- 가차 카드
CREATE TABLE IF NOT EXISTS gacha_cards (
  id TEXT PRIMARY KEY,
  academy_id TEXT NOT NULL,
  teacher_id TEXT NOT NULL,
  student_id TEXT,
  type TEXT NOT NULL DEFAULT 'text',
  question TEXT,
  question_image TEXT,
  answer TEXT NOT NULL,
  topic TEXT,
  chapter TEXT,
  grade TEXT,
  box INTEGER DEFAULT 1,
  success_count INTEGER DEFAULT 0,
  fail_count INTEGER DEFAULT 0,
  last_review DATETIME,
  created_at DATETIME DEFAULT (datetime('now'))
);
CREATE INDEX idx_gacha_cards_student ON gacha_cards(student_id);
CREATE INDEX idx_gacha_cards_teacher ON gacha_cards(academy_id, teacher_id);

-- 증명
CREATE TABLE IF NOT EXISTS proofs (
  id TEXT PRIMARY KEY,
  academy_id TEXT NOT NULL,
  created_by TEXT NOT NULL,
  title TEXT NOT NULL,
  grade TEXT NOT NULL,
  chapter TEXT,
  difficulty INTEGER DEFAULT 1,
  description TEXT,
  description_image TEXT,
  is_shared INTEGER DEFAULT 0,
  share_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT (datetime('now')),
  updated_at DATETIME
);
CREATE INDEX idx_proofs_academy ON proofs(academy_id);
CREATE INDEX idx_proofs_shared ON proofs(is_shared) WHERE is_shared = 1;

-- 증명 단계
CREATE TABLE IF NOT EXISTS proof_steps (
  id TEXT PRIMARY KEY,
  proof_id TEXT NOT NULL,
  step_order INTEGER NOT NULL,
  content TEXT NOT NULL,
  content_image TEXT,
  blanks_json TEXT,
  hint TEXT,
  FOREIGN KEY (proof_id) REFERENCES proofs(id) ON DELETE CASCADE
);
CREATE INDEX idx_proof_steps_proof ON proof_steps(proof_id);

-- 증명 공유
CREATE TABLE IF NOT EXISTS proof_shares (
  id TEXT PRIMARY KEY,
  original_proof_id TEXT NOT NULL,
  shared_by TEXT NOT NULL,
  copied_by TEXT,
  copied_academy_id TEXT,
  copied_proof_id TEXT,
  copied_at DATETIME,
  FOREIGN KEY (original_proof_id) REFERENCES proofs(id)
);

-- 학습 세션
CREATE TABLE IF NOT EXISTS gacha_sessions (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  session_date TEXT NOT NULL,
  cards_drawn INTEGER DEFAULT 0,
  cards_target INTEGER DEFAULT 10,
  proofs_done INTEGER DEFAULT 0,
  proofs_target INTEGER DEFAULT 5,
  started_at DATETIME DEFAULT (datetime('now')),
  completed_at DATETIME,
  UNIQUE(student_id, session_date)
);

-- 카드 학습 결과
CREATE TABLE IF NOT EXISTS gacha_card_results (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  card_id TEXT NOT NULL,
  session_id TEXT,
  result TEXT NOT NULL,
  box_before INTEGER,
  box_after INTEGER,
  reviewed_at DATETIME DEFAULT (datetime('now'))
);

-- 증명 학습 결과
CREATE TABLE IF NOT EXISTS proof_results (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  proof_id TEXT NOT NULL,
  session_id TEXT,
  mode TEXT NOT NULL,
  score INTEGER,
  time_spent INTEGER,
  detail_json TEXT,
  box INTEGER DEFAULT 1,
  attempted_at DATETIME DEFAULT (datetime('now'))
);
CREATE INDEX idx_proof_results_student ON proof_results(student_id);
```

### 1.2 Workers 핸들러: gacha-student-handler.ts

**파일**: `workers/src/routes/gacha-student-handler.ts`

| Endpoint | Method | Auth | 설명 |
|---|---|---|---|
| `/api/gacha/students` | GET | teacher JWT | 내 학생 목록 |
| `/api/gacha/students` | POST | teacher JWT | 학생 추가 (이름 + PIN) |
| `/api/gacha/students/:id` | GET | teacher JWT | 학생 상세 |
| `/api/gacha/students/:id` | PUT | teacher JWT | 학생 수정 |
| `/api/gacha/students/:id` | DELETE | teacher JWT | 학생 삭제 |
| `/api/gacha/students/:id/reset-pin` | POST | teacher JWT | PIN 초기화 |

**핵심 로직**:
- PIN 해싱: PBKDF2-SHA256 (기존 concept_gacha 방식 그대로)
- 모든 쿼리에 `academy_id` + `teacher_id` 필터
- generatePrefixedId('gstudent') 사용

### 1.3 Workers 핸들러: gacha-card-handler.ts

**파일**: `workers/src/routes/gacha-card-handler.ts`

| Endpoint | Method | Auth | 설명 |
|---|---|---|---|
| `/api/gacha/cards` | GET | teacher JWT | 카드 목록 (필터: student_id, topic) |
| `/api/gacha/cards` | POST | teacher JWT | 카드 생성 |
| `/api/gacha/cards/:id` | PUT | teacher JWT | 카드 수정 |
| `/api/gacha/cards/:id` | DELETE | teacher JWT | 카드 삭제 |
| `/api/gacha/cards/upload-image` | POST | teacher JWT | 이미지 → R2 |

**이미지 업로드 로직**:
```
POST /api/gacha/cards/upload-image
→ multipart/form-data 파싱
→ R2.put(`card-images/${academyId}/${studentId}/${timestamp}-${random}.ext`)
→ return { key: "card-images/..." }
```

### 1.4 Workers 핸들러: proof-handler.ts

**파일**: `workers/src/routes/proof-handler.ts`

| Endpoint | Method | Auth | 설명 |
|---|---|---|---|
| `/api/proof` | GET | teacher JWT | 증명 목록 |
| `/api/proof` | POST | teacher JWT | 증명 생성 (단계 포함) |
| `/api/proof/:id` | GET | teacher JWT | 증명 상세 + 단계 |
| `/api/proof/:id` | PUT | teacher JWT | 증명 수정 |
| `/api/proof/:id` | DELETE | teacher JWT | 증명 삭제 (CASCADE) |
| `/api/proof/:id/steps` | PUT | teacher JWT | 단계 일괄 수정 |
| `/api/proof/upload-image` | POST | teacher JWT | 이미지 → R2 |
| `/api/proof/shared` | GET | teacher JWT | 공유 마켓 목록 |
| `/api/proof/:id/share` | POST | teacher JWT | 공유 마켓에 공개 |
| `/api/proof/:id/copy` | POST | teacher JWT | 내 학원에 복사 |

### 1.5 Workers 핸들러: gacha-play-handler.ts (학생용 - PIN 인증)

**파일**: `workers/src/routes/gacha-play-handler.ts`

| Endpoint | Method | Auth | 설명 |
|---|---|---|---|
| `/api/play/login` | POST | none | PIN 로그인 → 세션 토큰 |
| `/api/play/session` | GET | PIN token | 오늘 세션 |
| `/api/play/random-card` | GET | PIN token | 가중치 랜덤 카드 |
| `/api/play/card/:id/feedback` | POST | PIN token | 카드 결과 (Leitner) |
| `/api/play/proofs` | GET | PIN token | 배정된 증명 목록 |
| `/api/play/proof/:id/ordering` | GET | PIN token | 순서배치 문제 (셔플) |
| `/api/play/proof/:id/fillblank` | GET | PIN token | 빈칸채우기 문제 |
| `/api/play/proof/:id/submit` | POST | PIN token | 증명 결과 제출 |

**PIN 토큰 방식**: 
- 로그인 시 KV에 `play:{token}` → `{studentId, academyId}` 저장 (TTL 24h)
- 이후 요청에 `Authorization: Bearer {token}` 헤더

### 1.6 index.ts 라우트 등록

**파일**: `workers/src/index.ts` — 기존 패턴에 추가

```typescript
// 학생 앱 (PIN 인증 - JWT 미들웨어 스킵)
if (pathname.startsWith('/api/play/')) {
  return addCorsHeaders(await handleGachaPlay(method, pathname, request, context), env, origin);
}

// 관리자 (JWT 인증 후)
if (pathname.startsWith('/api/gacha/')) {
  return addCorsHeaders(await handleGachaStudent(method, pathname, request, context), env, origin);
}
if (pathname.startsWith('/api/proof')) {
  return addCorsHeaders(await handleProof(method, pathname, request, context), env, origin);
}
```

**중요**: `/api/play/*` 라우트는 JWT 인증 블록 **위에** 배치 (PIN 인증 사용)

### 검증
- [ ] `wrangler d1 migrations apply --local` 성공
- [ ] 각 핸들러 import 에러 없음
- [ ] `/api/play/login` PIN 인증 플로우 동작
- [ ] R2 이미지 업로드/조회 동작

---

## Phase 2: ERP 관리자 페이지 (React)

### 의존성: Phase 1 (API 완성)
### 체크포인트: 관리자가 학생 추가 → 카드 생성 → 증명 작성까지 가능

### 2.1 GachaStudentPage.tsx — 학생 관리

**파일**: `apps/desktop/src/pages/GachaStudentPage.tsx`

```
┌──────────────────────────────────────────────┐
│  학습 학생 관리                [+ 학생 추가]   │
│                                              │
│  검색: [________]   학년: [전체 ▾]            │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │ 김민수  중2  카드 34장  증명 5개        │  │
│  │ Box분포: ■■■□□  정답률: 72%            │  │
│  │ [카드관리] [증명배정] [PIN초기화] [삭제] │  │
│  ├────────────────────────────────────────┤  │
│  │ 이서연  중3  카드 28장  증명 8개        │  │
│  │ Box분포: ■■■■□  정답률: 85%            │  │
│  └────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘
```

### 2.2 GachaCardPage.tsx — 카드 관리

**파일**: `apps/desktop/src/pages/GachaCardPage.tsx`

```
┌──────────────────────────────────────────────┐
│  가차 카드 관리                [+ 카드 추가]   │
│                                              │
│  학생: [김민수 ▾]  주제: [전체 ▾]             │
│                                              │
│  ┌──────────────────────────────────────┐    │
│  │ Q: 0.333...을 분수로?               │    │
│  │ A: 1/3         Box: 3  성공: 5 실패: 2│    │
│  │ [편집] [삭제]                         │    │
│  ├──────────────────────────────────────┤    │
│  │ Q: [이미지]    ← 이미지 카드          │    │
│  │ A: 2√3        Box: 1  성공: 0 실패: 3│    │
│  └──────────────────────────────────────┘    │
│                                              │
│  카드 추가 모달:                              │
│  ┌──────────────────────────────────────┐    │
│  │ 유형: (●) 텍스트  (○) 이미지          │    │
│  │ 문제: [________________]              │    │
│  │  또는: [이미지 업로드 📎]              │    │
│  │ 정답: [________________]              │    │
│  │ 주제: [________________]              │    │
│  │ 학년: [중2 ▾]  단원: [___________]    │    │
│  │           [취소] [저장]               │    │
│  └──────────────────────────────────────┘    │
└──────────────────────────────────────────────┘
```

### 2.3 ProofEditorPage.tsx — 증명 편집기

**파일**: `apps/desktop/src/pages/ProofEditorPage.tsx`

```
┌──────────────────────────────────────────────┐
│  증명 연습 관리              [+ 새 증명 만들기]│
│                                              │
│  학년: [전체 ▾]  난이도: [전체 ▾]  검색: [__] │
│                                              │
│  ┌──────────────────────────────────────┐    │
│  │ 순환소수 → 분수 변환                  │    │
│  │ 중1 · 4단계 · ★★☆☆☆ · 공유됨        │    │
│  │ [편집] [미리보기] [공유] [삭제]        │    │
│  └──────────────────────────────────────┘    │
│                                              │
│  ── 증명 편집 모드 (인라인 or 모달) ──        │
│  ┌──────────────────────────────────────┐    │
│  │ 제목: [피타고라스 정리 증명        ]   │    │
│  │ 학년: [중2 ▾]  단원: [삼각형      ]   │    │
│  │ 난이도: ★★★☆☆                        │    │
│  │ 설명 이미지: [업로드 📎] [미리보기]    │    │
│  │                                      │    │
│  │ ── 단계 편집 (드래그로 순서 변경) ──   │    │
│  │ ☰ Step 1: [△ABC에서 ∠C=90°     ]    │    │
│  │   [이미지 📎] 빈칸: □없음 ■있음       │    │
│  │     빈칸값: [90°]                     │    │
│  │ ☰ Step 2: [BC²+AC²=AB²         ]    │    │
│  │   [이미지 📎] 빈칸: □없음 ■있음       │    │
│  │     빈칸값: [AB²]                     │    │
│  │ ☰ Step 3: [____________________]     │    │
│  │                                      │    │
│  │ [+ 단계 추가]                         │    │
│  │                                      │    │
│  │       [미리보기]  [저장]              │    │
│  └──────────────────────────────────────┘    │
└──────────────────────────────────────────────┘
```

**핵심 UX**:
- 단계 순서 변경: 드래그 핸들(☰) 또는 위/아래 버튼
- KaTeX 실시간 미리보기 (입력 시 수식 렌더링)
- 빈칸 지정: 체크박스 토글 → 빈칸으로 만들 텍스트 입력
- 이미지: 단계별 개별 업로드 (기하 도형 등)

### 2.4 GachaDashboardPage.tsx — 학습 현황

**파일**: `apps/desktop/src/pages/GachaDashboardPage.tsx`

```
┌──────────────────────────────────────────────┐
│  학습 현황                                    │
│                                              │
│  ┌─ 전체 요약 ──────────────────────────┐    │
│  │ 학생 12명 · 카드 342장 · 증명 28개    │    │
│  │ 오늘 활동: 8명 · 평균 정답률 74%      │    │
│  └──────────────────────────────────────┘    │
│                                              │
│  ┌─ 학생별 진도 ────────────────────────┐    │
│  │ 이름    카드   증명   정답률  최근활동  │    │
│  │ 김민수  34장   5/8    72%    오늘     │    │
│  │ 이서연  28장   8/8    85%    어제     │    │
│  │ 박지호  15장   2/8    45%    3일전 ⚠  │    │
│  └──────────────────────────────────────┘    │
│                                              │
│  ┌─ 많이 틀리는 증명 TOP 5 ─────────────┐    │
│  │ 1. 귀류법 기본 (평균 32점)            │    │
│  │ 2. 이항정리 증명 (평균 45점)          │    │
│  └──────────────────────────────────────┘    │
└──────────────────────────────────────────────┘
```

### 2.5 App.tsx + Layout.tsx 수정

**App.tsx** — 라우트 추가:
```tsx
const GachaStudentPage = lazy(() => import('./pages/GachaStudentPage'));
const GachaCardPage = lazy(() => import('./pages/GachaCardPage'));
const ProofEditorPage = lazy(() => import('./pages/ProofEditorPage'));
const GachaDashboardPage = lazy(() => import('./pages/GachaDashboardPage'));

// ProtectedRoute 내부에 추가:
<Route path="/gacha/students" element={<GachaStudentPage />} />
<Route path="/gacha/cards" element={<GachaCardPage />} />
<Route path="/gacha/proofs" element={<ProofEditorPage />} />
<Route path="/gacha/dashboard" element={<GachaDashboardPage />} />
```

**Layout.tsx** — NAV_ITEMS에 추가:
```tsx
{ to: '/gacha/students', label: '학습', iconClass: 'nav-icon--gacha' },
```
→ 클릭하면 학습 관련 서브메뉴 (학생, 카드, 증명, 현황) 노출

### 2.6 api.ts 확장

**파일**: `apps/desktop/src/api.ts` — 기존 패턴대로 메서드 추가

```typescript
// 가차 학생
getGachaStudents: () => request<GachaStudent[]>('GET', '/gacha/students'),
createGachaStudent: (data) => request('POST', '/gacha/students', data),
updateGachaStudent: (id, data) => request('PUT', `/gacha/students/${id}`, data),
deleteGachaStudent: (id) => request('DELETE', `/gacha/students/${id}`),

// 가차 카드
getGachaCards: (params) => request<GachaCard[]>('GET', '/gacha/cards', null, params),
createGachaCard: (data) => request('POST', '/gacha/cards', data),
uploadCardImage: (formData) => requestFile('POST', '/gacha/cards/upload-image', formData),

// 증명
getProofs: (params) => request<Proof[]>('GET', '/proof', null, params),
createProof: (data) => request('POST', '/proof', data),
updateProof: (id, data) => request('PUT', `/proof/${id}`, data),
deleteProof: (id) => request('DELETE', `/proof/${id}`),
uploadProofImage: (formData) => requestFile('POST', '/proof/upload-image', formData),
getSharedProofs: (params) => request<Proof[]>('GET', '/proof/shared', null, params),
copyProof: (id) => request('POST', `/proof/${id}/copy`),
```

### 검증
- [ ] 학생 추가 → 카드 생성 → 카드 목록에 표시
- [ ] 증명 생성 → 단계 추가 → 빈칸 지정 → 저장 → 미리보기
- [ ] 이미지 업로드 후 표시
- [ ] 학습 현황 데이터 표시

---

## Phase 3: 학생 앱 — 가차 모드 (독립 도메인)

### 의존성: Phase 1 (API), Phase 2의 학생/카드 데이터
### 체크포인트: 학생이 PIN 로그인 → 가차 MCQ 10장 → 세션 완료

### 3.1 학생 앱 프로젝트 셋업

**위치**: `apps/student/` (모노레포 내 새 앱)

```
apps/student/
├── package.json          # React 18 + Vite + TypeScript
├── vite.config.ts        # 별도 포트 (5175)
├── index.html
├── src/
│   ├── App.tsx           # 라우터 (HashRouter)
│   ├── api.ts            # Workers API 클라이언트 (PIN 토큰)
│   ├── store.ts          # Zustand (학생 인증 상태)
│   ├── index.css          
│   ├── pages/
│   │   ├── LoginPage.tsx
│   │   ├── HomePage.tsx
│   │   ├── GachaPage.tsx
│   │   ├── ProofOrderingPage.tsx
│   │   ├── ProofFillBlankPage.tsx
│   │   └── ResultPage.tsx
│   └── components/
│       ├── KaTeX.tsx         # 수식 렌더링
│       ├── CardDisplay.tsx   # 카드 표시
│       ├── MCQChoices.tsx    # 객관식 선택지
│       ├── DragList.tsx      # 드래그앤드롭 순서배치
│       ├── BlankInput.tsx    # 빈칸 입력
│       └── SessionProgress.tsx
└── wrangler.toml          # Cloudflare Pages 배포 (독립 도메인)
```

### 3.2 pnpm-workspace.yaml 수정

```yaml
packages:
  - 'apps/*'
  - 'workers'
```
→ `apps/student` 자동 포함

### 3.3 학생 앱 주요 페이지

**LoginPage.tsx**:
- 학원 슬러그 입력 (또는 URL에서 추출: `learn.wawa.app/academy-slug`)
- 이름 + 4자리 PIN
- POST `/api/play/login` → 토큰 저장

**HomePage.tsx**:
```
┌──────────────────────────────┐
│  안녕, 김민수!                │
│  오늘의 학습  3/10 완료       │
│  ████████░░░░░░ 30%          │
│                              │
│  ┌──────┐ ┌──────┐ ┌──────┐ │
│  │ 가차  │ │ 순서  │ │ 빈칸 │ │
│  │ 카드  │ │ 배치  │ │ 채우기│ │
│  │ 4장   │ │ 2개   │ │ 1개  │ │
│  └──────┘ └──────┘ └──────┘ │
│                              │
│  최근 기록                    │
│  · 순환소수 증명 - 80점 ✓    │
│  · 제곱근 카드 - 정답 ✓      │
└──────────────────────────────┘
```

**GachaPage.tsx** — concept_gacha 핵심 로직 포팅:
- `GET /api/play/random-card` → 가중치 랜덤 (6 - box)
- MCQ 선택지 생성 (problem-generators + distractor-generators 포팅)
- 카드 표시 → 답 입력/선택 → 채점 → `POST /api/play/card/:id/feedback`
- Leitner 이동: 정답 → box+1, 오답 → box=1
- 10장 완료 시 세션 종료

### 3.4 problem-generators 포팅

**파일**: `apps/student/src/lib/problem-generators.ts`

- 기존 `public/js/problem-generators.js` (1,078줄) → TypeScript로 변환
- 기존 `public/js/distractor-generators.js` (377줄) → TypeScript로 변환
- ES module export 방식으로 리팩터링
- KaTeX 렌더링은 React 컴포넌트로 분리

### 3.5 답안 검증 로직 포팅

기존 concept_gacha의 검증 로직:
- 분수 비교 (`checkFractionAnswer`)
- 단위 정규화 (`checkUnitAnswer`)
- 대수식 비교 (계수 매칭)

→ `apps/student/src/lib/answer-checker.ts`로 포팅

### 3.6 Cloudflare Pages 배포 설정

**파일**: `apps/student/wrangler.toml` (또는 Pages 프로젝트 설정)

```toml
name = "wawa-learn"
compatibility_date = "2025-04-08"

[build]
command = "pnpm --filter student build"
output_directory = "apps/student/dist"
```

**도메인**: `learn.wawa.app` (Cloudflare Pages custom domain)

### 검증
- [ ] PIN 로그인 → 토큰 발급 → 페이지 진입
- [ ] 가차 카드 랜덤 선택 + MCQ 표시
- [ ] 답안 제출 → Leitner box 이동
- [ ] 10장 세션 완료 → 결과 표시
- [ ] `learn.wawa.app` 접속 가능

---

## Phase 4: 증명 연습 모드 (학생 앱)

### 의존성: Phase 3 (학생 앱 셋업), Phase 2 (증명 데이터)
### 체크포인트: 학생이 순서배치 + 빈칸채우기 모두 완료 가능

### 4.1 ProofOrderingPage.tsx — 순서배치

```
┌──────────────────────────────┐
│  순서배치  피타고라스 정리     │
│  난이도 ★★★  6단계            │
│                              │
│  [설명 이미지/텍스트 영역]    │
│                              │
│  올바른 순서로 배치하세요:     │
│                              │
│  ┌─ 드래그 리스트 ─────────┐ │
│  │ ☰ BC² + AC² = AB²     │ │  ← 드래그 가능
│  │ ☰ x = 1/3             │ │
│  │ ☰ △ABC에서 ∠C = 90°   │ │
│  │ ☰ [이미지: 도형]       │ │  ← 이미지 단계
│  │ ☰ 10x - x = 3         │ │
│  │ ☰ 10x = 3.333...      │ │
│  └─────────────────────────┘ │
│                              │
│  [힌트 보기 💡]    [확인]    │
│                              │
│  ── 채점 후 ──               │
│  ✓ Step 1 정답              │
│  ✓ Step 2 정답              │
│  ✗ Step 3 ← 올바른 위치: 5  │
│  ...                         │
│  점수: 67점 (4/6)            │
│                              │
│  [다시 풀기] [다음 증명 →]   │
└──────────────────────────────┘
```

**구현 핵심**:
- 드래그앤드롭: `@dnd-kit/core` + `@dnd-kit/sortable` (React용 경량 DnD)
- 셔플 알고리즘: Fisher-Yates (정답 순서와 겹치지 않도록 검증)
- 채점: 각 단계가 올바른 인덱스에 있는지 비교
- 부분 점수: `(정답 위치 수 / 전체 단계 수) * 100`
- 이미지 단계: `content_image`가 있으면 텍스트 대신 이미지 표시

### 4.2 ProofFillBlankPage.tsx — 빈칸채우기

```
┌──────────────────────────────┐
│  빈칸채우기  순환소수 변환    │
│  난이도 ★★  4단계             │
│                              │
│  [설명 이미지/텍스트 영역]    │
│                              │
│  Step 1: x = 0.333...       │
│                              │
│  Step 2: [____]x = 3.333... │  ← 빈칸 (정답: 10)
│                              │
│  Step 3: 10x − x = [____]   │  ← 빈칸 (정답: 3)
│                              │
│  Step 4: x = [____]         │  ← 빈칸 (정답: 1/3)
│                              │
│  [힌트 보기 💡]    [확인]    │
│                              │
│  ── 채점 후 ──               │
│  Step 2: 10 ✓               │
│  Step 3: 3 ✓                │
│  Step 4: 2/6 → 1/3 ✓ (동치) │
│  점수: 100점                 │
└──────────────────────────────┘
```

**구현 핵심**:
- `blanks_json` 파싱: `[{"position": 0, "length": 2, "answer": "10"}]`
  - position: content 문자열 내 시작 인덱스
  - length: 빈칸 처리할 문자 수
  - answer: 정답 텍스트
- 빈칸 렌더링: content를 파싱해서 빈칸 부분을 `<input>` 또는 `<BlankInput>`으로 교체
- 답안 검증: 기존 answer-checker 재활용 (분수 동치, 수식 비교)
- KaTeX와 빈칸 혼합 렌더링: `\\frac{[___]}{9}` 같은 경우 처리 필요
- Leitner 연동: proof_results.box 기반으로 빈칸 수 조절
  - Box 1: 빈칸 1개 (가장 핵심만)
  - Box 3: 빈칸 50%
  - Box 5: 전체 빈칸

### 4.3 컴포넌트 구현

**DragList.tsx** — 순서배치 핵심:
```tsx
// @dnd-kit/sortable 기반
// props: items, onReorder, disabled
// 각 아이템: KaTeX 텍스트 or 이미지
// 모바일 터치 지원 필수
```

**BlankInput.tsx** — 빈칸 입력:
```tsx
// props: expectedAnswer, onSubmit, mode ('text' | 'katex')
// 분수 입력 지원: 1/3 형태
// 수식 입력 시 실시간 KaTeX 미리보기
```

**KaTeX.tsx** — 수식 렌더링:
```tsx
// props: content (raw string with LaTeX)
// $...$ 패턴 감지 → KaTeX.renderToString
// 에러 시 원본 텍스트 폴백
```

### 검증
- [ ] 순서배치: 6단계 증명 셔플 → 드래그로 정렬 → 채점
- [ ] 빈칸채우기: 빈칸 3개 → 입력 → 분수 동치 검증
- [ ] 이미지 단계 표시
- [ ] 모바일 터치 드래그 동작
- [ ] Leitner 연동 (반복 시 난이도 증가)

---

## Phase 5: 증명 공유 마켓

### 의존성: Phase 2 (증명 CRUD)
### 체크포인트: A학원 선생님이 공유한 증명을 B학원 선생님이 복사 가능

### 5.1 공유 마켓 UI (ProofEditorPage 내 탭)

```
┌──────────────────────────────────────────────┐
│  증명 연습 관리                               │
│                                              │
│  [내 증명]  [공유 마켓]  ← 탭 전환            │
│                                              │
│  ── 공유 마켓 ──                              │
│  검색: [피타고라스   ]  학년: [전체 ▾]        │
│                                              │
│  ┌──────────────────────────────────────┐    │
│  │ 피타고라스 정리 증명                   │    │
│  │ by 선생님A · 중2 · ★★★ · 6단계        │    │
│  │ 복사 12회                             │    │
│  │ [미리보기]  [내 학원에 복사]            │    │
│  ├──────────────────────────────────────┤    │
│  │ 귀류법: √2의 무리수 증명               │    │
│  │ by 선생님C · 중3 · ★★★★ · 8단계       │    │
│  │ 복사 7회                              │    │
│  └──────────────────────────────────────┘    │
└──────────────────────────────────────────────┘
```

### 5.2 API 로직

**공유 (share)**:
- `POST /api/proof/:id/share` → `proofs.is_shared = 1`로 업데이트
- 공유된 증명은 모든 학원에서 조회 가능

**복사 (copy)**:
- `POST /api/proof/:id/copy`
- 트랜잭션:
  1. `proofs` 레코드 복사 (새 id, 요청자의 academy_id + teacher_id)
  2. `proof_steps` 전체 복사
  3. 이미지 R2 키: 원본 참조 유지 (복사 비용 절약) 또는 R2 copy
  4. `proof_shares` 기록 (원본 추적)
  5. 원본 `share_count += 1`

### 5.3 공유 취소 / 수정 규칙

- 공유 후 원본 수정 → 이미 복사된 건 영향 없음 (deep copy)
- 공유 취소(`is_shared = 0`) → 마켓에서 제거, 기존 복사본은 유지

### 검증
- [ ] 증명 공유 → 마켓에 노출
- [ ] 다른 학원 선생님이 검색 → 미리보기 → 복사
- [ ] 복사본 독립 편집 가능
- [ ] 공유 취소 시 마켓에서 사라짐

---

## Phase 6: 데이터 마이그레이션 + 배포

### 의존성: Phase 1~5 전체
### 체크포인트: 기존 concept_gacha 데이터가 D1에 정상 이전 + 프로덕션 배포

### 6.1 마이그레이션 스크립트

**파일**: `scripts/migrate-supabase-to-d1.ts`

```
Supabase (PostgreSQL)          →     Cloudflare D1 (SQLite)
─────────────────────────────────────────────────────────
students                       →     gacha_students
  + teacher_id 매핑 필요              (academy_id + teacher_id 추가)
cards                          →     gacha_cards
  + question_image R2 이전            (Supabase Storage → R2)
daily_sessions                 →     gacha_sessions
session_cards                  →     gacha_card_results
teacher_settings               →     (ERP users 테이블 사용)
```

**실행 순서**:
1. Supabase에서 전체 데이터 JSON export
2. 학원/선생님 매핑 테이블 수동 작성 (1회)
3. 학생 데이터 변환 + D1 INSERT
4. 카드 데이터 변환 + 이미지 R2 복사
5. 세션/결과 데이터 변환
6. 검증: 카운트 비교, 샘플 데이터 확인

### 6.2 Cloudflare 배포 체크리스트

```
[ ] D1 마이그레이션 apply (프로덕션)
[ ] Workers 배포 (wrangler deploy)
[ ] ERP Pages 빌드 + 배포 (기존 CI/CD)
[ ] 학생 앱 Pages 프로젝트 생성 (learn.wawa.app)
[ ] 학생 앱 Pages 빌드 + 배포
[ ] R2 버킷 퍼블릭 액세스 설정 (이미지 도메인)
[ ] CORS 설정: learn.wawa.app → Workers API 허용
[ ] KV 네임스페이스에 play 토큰 TTL 설정
[ ] DNS: learn.wawa.app → Cloudflare Pages
[ ] 기존 concept_gacha GitHub Pages에 리다이렉트 공지
```

### 6.3 CORS 업데이트

**workers/wrangler.toml** 또는 CORS 미들웨어:
```
허용 origin:
  - https://wawa.app (ERP)
  - https://learn.wawa.app (학생 앱)
  - http://localhost:5174 (ERP dev)
  - http://localhost:5175 (학생 앱 dev)
```

---

## 실행 순서 요약

```
Week 1:
  ├── Phase 1: DB + API (3일)
  │     Day 1: 마이그레이션 SQL + gacha-student-handler
  │     Day 2: gacha-card-handler + proof-handler  
  │     Day 3: gacha-play-handler + index.ts 등록 + 테스트
  │
  └── Phase 2: 관리자 페이지 (4일)
        Day 4: GachaStudentPage + api.ts
        Day 5: GachaCardPage + 이미지 업로드
        Day 6-7: ProofEditorPage (단계 편집기 + 빈칸 지정)

Week 2:
  ├── Phase 3: 학생 앱 - 가차 (3일)
  │     Day 8: 프로젝트 셋업 + LoginPage + HomePage
  │     Day 9: GachaPage + problem-generators 포팅
  │     Day 10: 답안 검증 + 세션 완료 플로우
  │
  └── Phase 4: 증명 연습 모드 (4일)
        Day 11: ProofOrderingPage + DragList
        Day 12: ProofFillBlankPage + BlankInput
        Day 13: KaTeX 혼합 렌더링 + Leitner 연동
        Day 14: 모바일 터치 + 종합 테스트

Week 3:
  ├── Phase 5: 공유 마켓 (2일)
  │     Day 15: 공유/복사 API + UI
  │     Day 16: 검색 + 미리보기
  │
  └── Phase 6: 마이그레이션 + 배포 (2일)
        Day 17: Supabase → D1 마이그레이션 스크립트
        Day 18: 프로덕션 배포 + DNS + CORS
```

---

## 위험 요소

| 위험 | 영향 | 대응 |
|---|---|---|
| D1 SQLite 제한 (행 크기, 쿼리 복잡도) | 대량 카드 조회 느림 | 페이지네이션 필수, 인덱스 최적화 |
| 드래그앤드롭 모바일 호환성 | 터치 UX 불량 | @dnd-kit 터치 센서 + 폴백 버튼 |
| KaTeX + 빈칸 혼합 렌더링 | 수식 안의 빈칸 깨짐 | 커스텀 파서 필요, Phase 4에 버퍼 |
| R2 이미지 CORS | 학생 앱에서 이미지 안 보임 | R2 custom domain 설정 |
| Supabase → D1 PIN 해시 호환 | 기존 학생 로그인 불가 | 동일 PBKDF2 파라미터 사용 확인 |

---

> **다음 단계**: `/sc:implement` Phase 1부터 실행
