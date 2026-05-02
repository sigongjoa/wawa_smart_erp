# 정기고사 관리 시스템 설계

## 1. 개요

### 현재 문제
- 학생 23명, 시험지 7종(학년별 5 + 개인 2)인데 **매핑이 없음**
- 프린트/배부 추적 불가
- 매 정기고사마다 처음부터 수작업

### 목표
학생별 시험지 자동 매핑 + 프린트/배부 체크리스트 + 시험 기간 관리를 ERP에 통합

### 기존 시스템 활용
- `print_materials` 테이블 → 교재/프린트 CRUD 패턴 참고
- `gacha` 서브메뉴 패턴 → 사이드바 통합 방식 참고
- `students` 테이블 → 학생 마스터 (학년 정보 보유)
- R2 Storage → PDF 업로드/다운로드

---

## 2. 데이터 모델

### 2.1 exam_periods (시험 기간)
```sql
CREATE TABLE exam_periods (
  id TEXT PRIMARY KEY,              -- 'ep-xxxxxxxx'
  academy_id TEXT NOT NULL,
  title TEXT NOT NULL,              -- '2026년 4월 정기고사'
  period_month TEXT NOT NULL,       -- '2026-04'
  status TEXT DEFAULT 'preparing',  -- 'preparing' | 'active' | 'completed'
  created_by TEXT NOT NULL,
  created_at DATETIME DEFAULT (datetime('now')),
  updated_at DATETIME DEFAULT (datetime('now')),
  UNIQUE(academy_id, period_month)
);
```

### 2.2 exam_papers (시험지)
```sql
CREATE TABLE exam_papers (
  id TEXT PRIMARY KEY,              -- 'epaper-xxxxxxxx'
  exam_period_id TEXT NOT NULL,
  academy_id TEXT NOT NULL,
  title TEXT NOT NULL,              -- '중1 정기고사', '송하선 적분미분최적화'
  grade_filter TEXT,                -- '중1', '중2', '고1' 등 (NULL = 개인별)
  file_key TEXT,                    -- R2 storage key (시험지 PDF)
  answer_file_key TEXT,             -- R2 storage key (정답지 PDF)
  is_custom INTEGER DEFAULT 0,     -- 1 = 개인별 커스텀 시험지
  created_at DATETIME DEFAULT (datetime('now')),
  FOREIGN KEY (exam_period_id) REFERENCES exam_periods(id) ON DELETE CASCADE
);
CREATE INDEX idx_exam_papers_period ON exam_papers(exam_period_id);
```

### 2.3 exam_assignments (학생-시험지 배정)
```sql
CREATE TABLE exam_assignments (
  id TEXT PRIMARY KEY,              -- 'eassign-xxxxxxxx'
  exam_period_id TEXT NOT NULL,
  exam_paper_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  academy_id TEXT NOT NULL,
  printed INTEGER DEFAULT 0,       -- 프린트 완료 여부
  distributed INTEGER DEFAULT 0,   -- 배부 완료 여부
  score REAL,                      -- 채점 점수 (optional)
  graded INTEGER DEFAULT 0,        -- 채점 완료 여부
  printed_at DATETIME,
  distributed_at DATETIME,
  graded_at DATETIME,
  created_at DATETIME DEFAULT (datetime('now')),
  UNIQUE(exam_period_id, student_id),
  FOREIGN KEY (exam_period_id) REFERENCES exam_periods(id) ON DELETE CASCADE,
  FOREIGN KEY (exam_paper_id) REFERENCES exam_papers(id),
  FOREIGN KEY (student_id) REFERENCES students(id)
);
CREATE INDEX idx_exam_assignments_period ON exam_assignments(exam_period_id);
CREATE INDEX idx_exam_assignments_student ON exam_assignments(student_id);
```

### 관계도
```
exam_periods (시험 기간)
  └── exam_papers (시험지 N개)
        └── exam_assignments (학생-시험지 매핑)
              └── students (학생 마스터)
```

---

## 3. API 설계

### 3.1 시험 기간 (Exam Periods)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/exam-mgmt` | 시험 기간 목록 |
| POST | `/api/exam-mgmt` | 시험 기간 생성 |
| PATCH | `/api/exam-mgmt/:id` | 상태 변경 |
| DELETE | `/api/exam-mgmt/:id` | 시험 기간 삭제 (CASCADE) |

### 3.2 시험지 (Exam Papers)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/exam-mgmt/:periodId/papers` | 시험지 목록 |
| POST | `/api/exam-mgmt/:periodId/papers` | 시험지 등록 (+ PDF 업로드) |
| DELETE | `/api/exam-mgmt/:periodId/papers/:id` | 시험지 삭제 |

### 3.3 배정 (Assignments)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/exam-mgmt/:periodId/assignments` | 배정 현황 (체크리스트) |
| POST | `/api/exam-mgmt/:periodId/auto-assign` | **학년 기반 자동 배정** |
| POST | `/api/exam-mgmt/:periodId/assign` | 수동 배정 (개인 시험지) |
| PATCH | `/api/exam-mgmt/:periodId/assignments/:id` | 체크 업데이트 (printed/distributed/score) |
| POST | `/api/exam-mgmt/:periodId/bulk-check` | 일괄 체크 (전원 프린트 완료 등) |

### 3.4 자동 배정 로직 (`POST /auto-assign`)
```
1. 해당 기간의 모든 exam_papers를 가져옴
2. 학원의 모든 students를 가져옴 (grade 필드 사용)
3. 각 학생의 grade ↔ exam_papers.grade_filter 매칭
   - grade_filter='중1' → students WHERE grade LIKE '%중1%'
   - is_custom=1 인 시험지는 건너뜀 (수동 배정)
4. 이미 배정된 학생은 SKIP (UNIQUE 제약)
5. INSERT exam_assignments (매칭된 학생-시험지 쌍)
```

---

## 4. 프론트엔드 설계

### 4.1 사이드바 통합

```typescript
// Layout.tsx — 기존 NAV_ITEMS '평가' 아래 또는 별도 그룹
const EXAM_SUB_ITEMS = [
  { to: '/exams', label: '시험 관리', exact: true },
  { to: '/exams/checklist', label: '체크리스트' },
];
```

### 4.2 페이지 구조

#### ExamManagementPage (`/exams`)
```
┌─────────────────────────────────────────────────┐
│  시험 기간 선택   [2026-04 정기고사 ▼] [+ 새 기간] │
├─────────────────────────────────────────────────┤
│  시험지 목록                                      │
│  ┌──────────────┬──────┬──────┬────────────┐    │
│  │    시험지     │ 학년 │ 유형 │    파일    │    │
│  ├──────────────┼──────┼──────┼────────────┤    │
│  │ 중1 정기고사  │  중1  │ 공통 │ 📄 업로드  │    │
│  │ 중2 정기고사  │  중2  │ 공통 │ 📄 ✅      │    │
│  │ 송하선 적분   │  -   │ 개인 │ 📄 ✅      │    │
│  └──────────────┴──────┴──────┴────────────┘    │
│                                                  │
│  [자동 배정] [시험지 추가]                         │
└─────────────────────────────────────────────────┘
```

#### ExamChecklistPage (`/exams/checklist`)
```
┌─────────────────────────────────────────────────────────┐
│  [2026-04 ▼]  전체 23명  프린트: 15/23  배부: 10/23     │
├─────────────────────────────────────────────────────────┤
│  ☑ 전체 프린트  ☑ 전체 배부                              │
├───────┬────────────┬─────┬──────┬──────┬──────┬────────┤
│  이름  │   시험지    │학년 │프린트│ 배부 │ 점수 │  상태  │
├───────┼────────────┼─────┼──────┼──────┼──────┼────────┤
│이루다 │중1 정기고사 │ 중1 │  ☑   │  ☐   │  -   │ 배부전 │ → 학년 불일치!
│이루다 │고2 정기고사 │ 고2 │  ☑   │  ☑   │  85  │ 완료  │
│송하선 │송하선_적분  │ 고3 │  ☑   │  ☑   │  92  │ 완료  │
│김광민 │김광민_수학2 │ 고2 │  ☐   │  ☐   │  -   │ 미인쇄│
│박도윤 │고2 정기고사 │ 고2 │  ☐   │  ☐   │  -   │ 미인쇄│
│...    │            │     │      │      │      │       │
└───────┴────────────┴─────┴──────┴──────┴──────┴────────┘
```

**핵심 인터랙션:**
- 체크박스 클릭 → 즉시 PATCH API 호출 (optimistic update)
- 점수 셀 클릭 → 인라인 숫자 입력
- 헤더 체크박스 → 일괄 업데이트 (bulk-check API)
- 상태 뱃지: `미인쇄` → `배부전` → `완료` 자동 계산
- 필터: 상태별, 학년별

---

## 5. 구현 계획

### Phase 1: DB + API (Backend)
1. `021_exam_management.sql` 마이그레이션 생성
2. `exam-mgmt-handler.ts` 핸들러 구현
3. `index.ts`에 라우트 등록
4. 마이그레이션 적용 (local + remote)

### Phase 2: Frontend
1. `api.ts`에 exam-mgmt API 함수 추가
2. `ExamManagementPage.tsx` — 시험 기간 + 시험지 관리
3. `ExamChecklistPage.tsx` — 체크리스트 UI
4. `Layout.tsx` 사이드바에 메뉴 추가
5. `App.tsx` 라우트 등록

### Phase 3: PDF 업로드 + 자동배정
1. R2 업로드 엔드포인트 (기존 file-handler 패턴 활용)
2. 자동 배정 로직 (학년 매칭)
3. PDF 미리보기/다운로드

### Phase 4: 테스트 + 배포
1. E2E 테스트 (API + 브라우저)
2. Workers 재배포
3. Frontend 빌드 + Pages 배포

---

## 6. 기존 시스템과의 차이점

| 항목 | print_materials (기존) | exam_management (신규) |
|------|----------------------|----------------------|
| 단위 | 개별 교재 1건 | 시험 기간 → 시험지 → 배정 (3계층) |
| 매핑 | 1학생:1교재 수동 | 학년 자동 매칭 + 개인 커스텀 |
| 추적 | todo/done 2단계 | printed → distributed → graded 3단계 |
| 파일 | URL 링크만 | R2에 PDF 직접 업로드/다운로드 |
| 반복 | 매번 새로 생성 | 기간별 관리, 이전 기간 아카이브 |

---

## 7. 파일 목록 (생성/수정 예정)

### 신규 생성
```
workers/migrations/021_exam_management.sql
workers/src/routes/exam-mgmt-handler.ts
apps/desktop/src/pages/ExamManagementPage.tsx
apps/desktop/src/pages/ExamChecklistPage.tsx
```

### 수정
```
workers/src/index.ts                    — 라우트 추가
apps/desktop/src/App.tsx                — 라우트 등록
apps/desktop/src/components/Layout.tsx  — 사이드바 메뉴
apps/desktop/src/api.ts                 — API 함수 추가
```
