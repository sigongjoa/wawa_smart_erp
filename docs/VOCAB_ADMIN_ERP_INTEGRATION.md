# Vocab Admin ERP 통합 설계

> **대상**: `/vocab/admin`, `/vocab/grade`, `/vocab/print` 3개 페이지를 ERP 앱의 네이티브 React 페이지로 옮겨 공통 레이아웃·디자인 패턴을 공유.
>
> **작성**: 2026-04-23

---

## 1. 전략 결정 — **A안: 완전 React 포팅**

### 옵션 비교

| 옵션 | 장점 | 단점 | 판정 |
|-----|------|-----|-----|
| **A. React 포팅** | 사이드바/헤더 자연스럽게 공유, 타입 안전, 라우터 일체화, SPA 네비, 공통 컴포넌트 재사용 | 작업량 큼 (탭 8개 × 로직) | **선택** |
| B. Static HTML에 ERP CSS 주입 | 빠름 | `Layout`의 사이드바는 React 컴포넌트라 주입 불가 → 헤더/색만 칠하는 수준. "디자인 패턴 따른다"의 본질을 못 만족 | X |
| C. iframe으로 감싸기 | 매우 빠름 | 인증 상태 전달 난해, 더블 스크롤바/높이 계산 문제, 클릭 시 주소창 바뀜, 모달/툴팁이 iframe 경계 튕김, 접근성 최악 | X |

**선택 이유**: 사용자가 "기존의 사이드바나 이런거 아무것도 없잖아"라고 지적한 핵심은 `Layout` 컴포넌트(사이드바·헤더·네비게이션)가 공유되지 않는다는 것. B/C는 이걸 반만 해결. A만이 "완전 ERP 페이지"로 만듦.

### 위험 완화
- 한 번에 전부 포팅하지 않고 **탭별로 점진 포팅** (MVP 범위 작게)
- 포팅 완료 전에는 기존 `/vocab/admin.html`도 404 빼지 않고 유지 (롤백 가능)
- 서버 API는 변경 없음 — `apps/desktop/src/api.ts`의 기존 `getVocabWords`/`getVocabGrammar`/... 재사용

---

## 2. 와이어프레임 (데스크탑 1200px 기준)

### 라우트 구조

```
/vocab                            → 대시보드 (기본 탭 = 단어 관리)
/vocab/words                      → 단어 관리
/vocab/student-questions          → 학생 질문
/vocab/wrong                      → 오답 현황
/vocab/grammar                    → 문법 Q&A
/vocab/print                      → 프린트
/vocab/grade                      → 채점
/vocab/students                   → 학생 관리
/vocab/textbooks                  → 교재 데이터
```

단일 `/vocab`로 진입하면 **서브 탭 네비**가 있고, 위 서브 경로는 탭 딥링크. 사이드바 `학습(영단어)` 그룹을 펼치면 하위에 `단어/문법/교재 · 출제·채점 · 프린트 · 학생 관리`가 바로 노출.

### 페이지 레이아웃 (Layout.tsx 안에 편입)

```
┌─ app-sidebar ──────────┬─ app-main ──────────────────────────────────────────┐
│  [WAWA 로고]            │  ┌─ page-header ─────────────────────────────────┐ │
│                         │  │  학습 (영단어)                   [새로고침][+] │ │
│  ▸ 수업                  │  └──────────────────────────────────────────────┘ │
│  ▸ 학생                  │                                                     │
│  ▸ 정기고사              │  ┌─ subnav (ERP의 exam-subtabs 재사용) ───────────┐│
│  ▾ 학습 (영단어)         │  │ 단어 · 학생질문 · 오답 · 문법 · 프린트 · ...  ││
│     · 단어/문법/교재    │  └──────────────────────────────────────────────┘││
│     · 출제·채점          │                                                     │
│     · 프린트             │  ┌─ filter-bar ──────────────────────────────────┐ │
│  ▸ 자료                  │  │ 학생: [전체 ▾]  상태: [전체 ▾] [+단어 추가]   │ │
│  ▸ 학원 일정             │  └──────────────────────────────────────────────┘ │
│                         │                                                     │
│                         │  ┌─ 대기중 카운트 배너 (n>0일때) ──────────────┐  │
│                         │  │ ⏳ 대기중 3건    [대기중만 보기]             │  │
│                         │  └─────────────────────────────────────────────┘  │
│                         │                                                     │
│                         │  ┌─ table-wrap (ERP exam-table 패턴) ────────────┐ │
│                         │  │ 학생 | 영어 | 한글 | 품사 | 예문 | 상태 | 작업│ │
│                         │  │ ─────────────────────────────────────────────│ │
│                         │  │ 홍길동│ apple│ 사과  │ 명사 │ ...  │ 대기 │승인│ │
│                         │  │ ...                                           │ │
│                         │  └──────────────────────────────────────────────┘ │
└─────────────────────────┴─────────────────────────────────────────────────────┘
```

### 단어 추가/편집 모달 (기존 Modal 컴포넌트 재사용)

```
┌─ Modal (ERP Modal 컴포넌트) ─────────┐
│ 단어 추가                      [×]   │
├─────────────────────────────────────│
│ 학생      [전체 ▾]                  │
│ 영어      [__________________]      │
│ 한글      [__________________]      │
│ 품사      [명사 ▾]                  │
│ 예문      [__________________]      │
│ 빈칸      [한글빈칸 ▾]              │
├─────────────────────────────────────│
│                [취소]  [추가]       │
└─────────────────────────────────────┘
```

---

## 3. 컴포넌트 계층

```
App.tsx
└─ <Layout>           (기존 컴포넌트 — app-sidebar + app-main + header/drawer)
   └─ <Outlet>
      └─ <VocabAdminPage>              ← 루트
         ├─ <VocabSubNav active={tab}/> ← ERP exam-subtabs 패턴
         └─ Routes
            ├─ /vocab           →  <VocabWordsTab/>        (기본)
            ├─ /vocab/words     →  <VocabWordsTab/>
            │   ├─ <FilterBar/>
            │   ├─ <PendingBanner/>
            │   ├─ <VocabWordTable/>
            │   └─ <VocabWordModal/>   (추가/편집)
            ├─ /vocab/student-questions → <VocabStudentQuestionsTab/>
            ├─ /vocab/wrong     →  <VocabWrongTab/>
            ├─ /vocab/grammar   →  <VocabGrammarTab/>
            ├─ /vocab/print     →  <VocabPrintTab/>
            ├─ /vocab/grade     →  <VocabGradeTab/>
            ├─ /vocab/students  →  <VocabStudentsTab/>
            └─ /vocab/textbooks →  <VocabTextbooksTab/>
```

- **루트 `VocabAdminPage`**는 공통 헤더(`<h2 class="page-title">학습 (영단어)</h2>`)와 SubNav만 담당. 실제 콘텐츠는 각 탭 컴포넌트.
- 공유 로직은 `hooks/useVocab.ts` (학생 목록 SWR 등).

---

## 4. 기존 ERP 패턴 매핑

| vocab/admin.html 요소 | 재사용할 ERP 자산 |
|-----------------------|-------------------|
| 상단 "📖 Word Gacha — 선생님" 헤더 | `<h2 className="page-title">학습 (영단어)</h2>` + ExamManagementPage의 page-header 구조 |
| 탭 바 `.tabs > .tab` | ExamManagementPage의 `.exam-subtabs / .exam-subtab` (또는 신규 `.vocab-subtabs` — 동일 패턴) |
| 필터 바 `.filter-bar` | 기존 `.filter-bar` CSS 그대로 (globals에 이미 있음) |
| 테이블 `.table-wrap > table` | `.exam-table` 패턴 (그리드·헤더·호버) — 같은 스타일 얹기만 |
| 뱃지 `.badge.pending/approved` | `--warning-surface` / `--success-surface` + 기존 텍스트 색 |
| `Box badge` (box1~box5) | ERP `--warning`, `--success` 등 상태색으로 재맵핑 (포켓몬 톤 배제, ERP 톤) |
| `flash ok/err` 피드백 | `<ToastContainer>` / `toast()` 이미 존재 |
| 인라인 편집 input | ERP `.edit-input` 패턴 없음 → 공통 `.input--inline` 추가 |
| 모달 (단어 추가/편집) | `import Modal from '../components/Modal'` 재사용 |
| 버튼 `.btn .btn-primary/secondary/danger` | 이미 ERP에 정의됨 (`apps/desktop/src/index.css:403`) |
| 대기중 배지/카운트 | 재사용 안 함 — 새로 만든 디자인(`--primary-surface` + 숫자) |

---

## 5. 1단계 MVP 범위

**범위**: `/vocab/words` (단어 관리 탭 1개만) + 서브 탭 네비 + 루트 `VocabAdminPage` 골격 + 사이드바 링크 변경.

**제외**: 나머지 7개 탭은 구버전 static html로 당분간 유지 (링크는 그대로 `/vocab/admin.html`). 사이드바는 **"단어 관리 (NEW)"** 링크와 **"전체 관리 (구버전)"** 링크 둘 다 노출해서 선생님이 필요할 때 구버전도 진입 가능.

**작업 목록 (Phase 1)**:

1. **라우트 추가** (`App.tsx`)
   - `/vocab` → `<VocabAdminPage>` (ProtectedRoute 안)

2. **사이드바 수정** (`Layout.tsx`)
   - `vocab` 그룹 items:
     ```
     { to: '/vocab',               label: '단어 관리' },        // NEW React
     { to: '/vocab/admin.html',    label: '전체 관리 (구)', external: true },
     { to: '/vocab/grade.html',    label: '출제·채점',     external: true },
     ```

3. **루트 페이지** `apps/desktop/src/pages/VocabAdminPage.tsx`
   - `.page-title` + `<VocabSubNav>` (현재 탭 하이라이트)
   - 초기엔 단어 관리 1개 탭만 활성, 나머지는 "준비 중" 플레이스홀더

4. **단어 관리 탭** `VocabWordsTab.tsx`
   - `api.getVocabWords({ status })` 호출
   - 필터 바: 학생 드롭다운 + 상태 드롭다운 + 새로고침 버튼
   - 대기중 카운트 배너 (카운트 > 0일 때만)
   - 테이블: 학생·영어·한글·품사·예문·제출·빈칸·상태·Box·오답수·작업
   - 작업: 승인/거절/저장/삭제
   - 추가 버튼 → `<VocabWordModal>` 열기

5. **모달** `VocabWordModal.tsx`
   - `Modal.Header`, `Modal.Body`, `Modal.Footer` 구조 (기존 ExamManagementPage 패턴)
   - 학생 선택 + 영어/한글/품사/예문/빈칸 타입 + 저장

6. **SubNav** `VocabSubNav.tsx` — `exam-subtabs` 스타일 복사

7. **삭제(단순 클린)**: 현재 사이드바에서 `/vocab/admin.html` 직접 링크는 유지 (구버전 진입). admin.html/grade.html 파일은 그대로.

**Phase 2 이후** (이번 스코프 X):
- 학생 질문 탭 → React 포팅
- 문법 Q&A, 오답, 프린트, 채점, 학생, 교재 순차 포팅
- 구버전 HTML 완전 제거

---

## 6. 확인 사항

MVP 범위 이대로 OK면 `/sc:implement`로 위 7단계 진행.

의견 필요:
- 사이드바에서 "전체 관리 (구)" 링크를 **유지**할지, 아니면 **바로 숨기고** MVP 탭만 노출할지
- `/vocab` vs `/vocab/admin` 라우트명 — 기존 `/vocab/admin.html`과 충돌 없도록 `/vocab`로 제안
