# MedTerm Study System — Use Cases

별도 도메인으로 운영되는 의학용어 학습 시스템의 유즈케이스 정의.
파생 설계: `docs/MEDTERM_DESIGN.md` (없을 시 본 문서가 일차 레퍼런스).
스키마: `workers/migrations/059_medterm_system.sql`.
시드 도구: `medterm_preprocess/seed_chapter01.py`.

## 액터

| 코드 | 액터 | 설명 |
|------|------|------|
| **A** | Admin | 학원 운영자, 교재·챕터 등록 |
| **T** | Teacher | 강사, 콘텐츠 작성·할당·모니터링 |
| **S** | Student | 학생 (예: 학생A·학생B) |
| **SYS** | 시스템 | 자동 채점, Leitner 갱신, 통계 |

UC 코드 규칙: `UC-M{역할}-{번호}` (M = MedTerm)

---

## A. 콘텐츠 관리 — Admin / Teacher

### UC-MA-01 — 교재 등록
- **Actor**: Admin
- **Endpoint**: `POST /api/medterm/books`
- **Pre**: 인증된 admin
- **Main**: 교재 정보 입력 → `med_books` INSERT
- **Example**: `'med-basic'` = 보건의료인을 위한 기초 의학용어

### UC-MT-01 — 챕터 등록
- **Actor**: Teacher
- **Endpoint**: `POST /api/medterm/chapters`
- **Pre**: 교재 등록됨
- **Main**: 챕터 번호·제목·페이지 범위·학습목표 입력 → `med_chapters` INSERT
- **Alt**: 챕터 번호 중복 시 `UNIQUE` 제약 위반
- **Example**: Ch.01 단어의 요소와 단어 구성의 이해, p.1~15

### UC-MT-02 — 챕터 일괄 시드 ⭐
- **Actor**: Teacher
- **Endpoint**: `POST /api/medterm/chapters/:id/seed`
- **Pre**: 챕터 등록됨, 전처리 JSON 보유
- **Body**: `{ parts: [...], terms: [...], exam_items: [...] }`
- **Main**:
  1. 챕터 존재 검증
  2. body 검증 (Zod) + sanitize 모든 텍스트
  3. `db.batch()` 로 INSERT OR IGNORE — 부분 실패 시 전체 롤백
  4. 생성/스킵 카운트 반환
- **멱등**: 동일 페이로드 두 번 보내도 안전
- **Example**: Ch.01 시드 → parts 66, terms 7, term_parts 21, exam_items 30, figures 4, labels 10

### UC-MT-03 — 그림 업로드 + 라벨
- **Actor**: Teacher
- **Endpoint**: `POST /api/medterm/figures` (R2 + DB), `POST /api/medterm/figures/:id/labels`
- **Pre**: 챕터 등록됨
- **Main**:
  1. 그림 R2 업로드 → `medterm/{academy_id}/figs/{figure_id}.{ext}` (academy 격리)
  2. mime deny + ext sanitize (CLAUDE.md 9번)
  3. `med_figures` INSERT
  4. 라벨 좌표 클릭 → `med_figure_labels` INSERT (x_ratio, y_ratio, part_id)
- **Example**: 그림 1-3 인체 해부도 + 10개 결합형 라벨

### UC-MT-04 — 단어 요소 / 의학용어 / 출제 문항 CRUD
- 강사 화면 인라인 편집
- 의학용어 삭제 시 `med_term_parts` cascade, `med_student_terms`은 RESTRICT (학습 중인 데이터 보호)

### UC-MT-05 — 학생에게 챕터 할당
- **Actor**: Teacher
- **Endpoint**: `POST /api/medterm/chapters/:id/assign`
- **Body**: `{ student_ids: [...], modes: ['meaning', 'decompose'] }`
- **Main**:
  1. 학생들이 본 학원 소속인지 사전 검증 (CLAUDE.md 1번)
  2. 챕터의 모든 용어 조회
  3. 학생 × 모드 × 용어 조합으로 `med_student_terms` 생성 (box=1, next_review=now)
  4. `med_student_chapters` 생성
- **멱등**: `INSERT OR IGNORE` + UNIQUE 인덱스
- **Example**: 학생A·학생B → Ch.01 + meaning + decompose 두 모드 → 학생당 7 terms × 2 modes = 14 카드

### UC-MT-06 — 학생 진척 모니터링
- **Actor**: Teacher
- **Endpoint**: `GET /api/medterm/progress?student_id=...&chapter_id=...`
- **Returns**: box 분포 (모드별), 약점 용어 Top 10 (wrong_count 기준)

### UC-MT-07 — 단원평가 PDF 빌드 + 인쇄
- **Pre**: 챕터 시드됨, exam_items ≥ N
- **Main**:
  1. `med_exam_items`에서 sample → `med_exam_attempts` 생성 (status=created)
  2. PDF 빌드 (medterm_preprocess/build_pdf.py 로직 통합)
  3. R2 캐시 (UC-MX-03)
  4. `/print` 학원 프린터 전송

### UC-MT-08 — 단원평가 채점 결과 확인
- **Pre**: 학생 응시 완료 (status=submitted)
- **Main**:
  1. UC-MX-02 자동 채점 → `med_exam_responses.correct` 갱신
  2. `med_exam_attempts.score` 계산
  3. 강사 화면에 표시

---

## B. 학습 — Student

### UC-MS-01 — 오늘의 학습 카드
- **Actor**: Student (PIN 토큰)
- **Endpoint**: `GET /api/play/medterm/today?chapter_id=...&limit=20`
- **Main**:
  - `med_student_terms`에서 `next_review <= NOW` AND box별 가중치 (낮은 box 우선) sample

### UC-MS-02 — 의미 학습 (meaning)
- **Endpoint**: `POST /api/play/medterm/answer`
- **Body**: `{ student_term_id: '...', response: '심장학' }`
- **채점**: 느슨 매칭 (공백·구두점·대소문자 무시)
- **Post**: Leitner 갱신 (UC-MX-01)

### UC-MS-03 — 단어 분해 (decompose) ⭐
- **Body**: `{ response: [{role:'r',value:'cardi'}, {role:'cv',value:'o'}, {role:'s',value:'-logy'}] }`
  또는 문자열 `'cardi/o/logy'`
- **채점**: 순서·value 일치 (role은 옵셔널)
- **Server**: `med_term_parts` JOIN으로 정답 parts 조립

### UC-MS-04 — 단어 만들기 (compose)
- **Body**: `{ response: 'encephalitis' }`
- **채점**: 단답형 (느슨 매칭)

### UC-MS-05 — 복수형 변환 (plural)
- **Body**: `{ response: 'vertebrae' }`
- **채점**: 정확 매칭
- **Pre**: term의 plural_form != NULL

### UC-MS-06 — 그림 라벨링 (figure)
- 별도 핸들러 (좌표 비교) — MVP3 예정
- `med_figure_labels.x_ratio/y_ratio` 와 거리 ≤ 임계값으로 채점

### UC-MS-07 — 단원평가 응시
- **Endpoint**: `POST /api/play/medterm/exam-attempts/:id/responses`, `POST /api/play/medterm/exam-attempts/:id/submit`
- **Pre**: 강사가 attempt 출제 (UC-MT-07)
- **Main**: 응답 자동 저장 → 제출 → 자동 채점 (UC-MX-02)
- **멱등**: `WHERE status='created'` 가드

### UC-MS-08 — 결과 확인 + 오답 학습
- 점수·오답 목록 표시
- "오답 카드만 다시 학습" 버튼 → 해당 term들의 box를 1로 강등

### UC-MS-09 — 학습 진척 대시보드
- 챕터별·모드별 box 분포, 약점 용어 Top 10

---

## C. 시스템 자동 처리 — SYS

### UC-MX-01 — Leitner 5-box 갱신
- **Trigger**: 학습 카드 응답
- **Logic**: O → `box = MIN(box+1, 5)` + `next_review = NOW + interval(box)`, X → `box = 1` + `next_review = NOW + 4h`
- **간격**: box1 1h / box2 1d / box3 3d / box4 7d / box5 14d
- **구현**: `workers/src/utils/medterm-validate.ts:nextLeitner()`

### UC-MX-02 — 단원평가 자동 채점
- **Trigger**: `med_exam_attempts.status` 가 'submitted' 로 전이
- **Logic**: 모든 response 순회 → 유형별 채점 → `correct` 갱신 → `score`
- **멱등**: `WHERE status='submitted'` 가드 — 두 번 채점 방지
- **구현**: `medterm-validate.ts:gradeItem()`

### UC-MX-03 — PDF 캐시 (R2)
- 동일 attempt + 동일 item set → R2 hit, 재빌드 skip

### UC-MX-04 — 진척 통계 집계 (선택)
- 야간 cron 또는 on-demand
- 학원·학생·챕터별 집계 → 강사 대시보드 캐시

---

## D. End-to-End 시나리오 — 학생A·학생B

### Scenario-1: 강사 콘텐츠 준비 (1회성)
```
UC-MA-01    교재 'med-basic' 등록
UC-MT-01    Ch.01 등록
UC-MT-02    seed_chapter01.py 출력 → /seed 호출 → parts 66·terms 7·exam_items 30
UC-MT-03    그림 4장 업로드 + 그림 1-3 라벨 10개
UC-MT-05    학생A·학생B에게 Ch.01 할당, modes=[meaning, decompose, figure]
```

### Scenario-2: 학생 일일 학습 (10~15분/일)
```
UC-MS-01    오늘의 카드 14장 수령
UC-MS-02    cardiology → "심장학" → O → box 1→2
UC-MS-03    musculoskeletal 분해 → muscul/o/skelet/al → O
UC-MS-03    epidermis 분해 → 오답 → 해설 + box=1
UC-MS-09    오늘 정답률 75%, 약점 Top: epidermis
```

### Scenario-3: 단원평가 (주말)
```
UC-MT-07    30문항 attempt 생성 → PDF 빌드 → /print 학원 프린터
UC-MS-07    학생A 30문항 응답 → 제출
UC-MX-02    자동 채점 → 27/30 (90%)
UC-MS-08    오답 3개 → 해설 + 오답 카드 다시 학습 → box=1 강등
UC-MT-08    학생A 90%, 학생B 83% — 공통 오답 보강
```

---

## E. 횡단 관심사

| | 내용 |
|--|------|
| **보안** | academy_id 격리, 학생 학원 사전 검증, sanitize+길이 캡, isValidId, R2 academy 격리 prefix |
| **성능** | `Promise.all`, `db.batch()`, IN 절로 N+1 제거 |
| **멱등** | INSERT OR IGNORE, UNIQUE, status 가드, 멱등 UPSERT |
| **PDF 캐시** | R2 hit-or-build |
| **백업** | 마이그레이션 적용 직전·직후 D1 export → Drive `erpbackup` (CLAUDE.md 변경 시 백업 정책) |

---

## F. UC ↔ 데이터 매트릭스

| UC | 읽기 | 쓰기 |
|----|------|------|
| UC-MT-02 | seed JSON | med_word_parts, med_terms, med_term_parts, med_exam_items |
| UC-MT-05 | gacha_students, med_chapters, med_terms | med_student_chapters, med_student_terms |
| UC-MS-01 | med_student_terms WHERE next_review <= NOW | — |
| UC-MS-02~05 | med_terms, med_term_parts | med_student_terms (box, last_reviewed, next_review) |
| UC-MS-07 | med_exam_items | med_exam_attempts (created), med_exam_responses |
| UC-MX-02 | med_exam_responses, med_exam_items | med_exam_responses.correct, med_exam_attempts.score |

---

## G. MVP 우선순위

| 단계 | UC | 산출물 |
|------|----|--------|
| **MVP1** ✅ | MA-01, MT-01, MT-02, MT-05, MS-01, MS-02, MS-03, MX-01 | 강사 시드 + 학생 meaning/decompose 일일학습 |
| **MVP2** | MT-03, MS-06, MT-06 | 그림 업로드·라벨링·진척 모니터링 |
| **MVP3** | MT-07, MS-07, MS-08, MX-02 | 단원평가 PDF + 응시 + 자동 채점 |
| **확장** | MS-09, MX-04 | 학생 대시보드, 진척 통계 |

## H. 구현 산출물 (이미 생성된 파일)

- `workers/migrations/059_medterm_system.sql` — 12개 테이블
- `workers/src/utils/medterm-validate.ts` — 채점 함수 + Leitner
- `workers/src/routes/medterm-handler.ts` — 강사용 (UC-MA-01, MT-01, MT-02, MT-05, MT-06)
- `workers/src/routes/medterm-play-handler.ts` — 학생용 (UC-MS-01, MS-02~05)
- `workers/src/index.ts` — 라우터 등록
- `medterm_preprocess/seed_chapter01.py` — JSON → SQL INSERT (오프라인 시드)
- `medterm_preprocess/output/059_seed_chapter01.sql` — 적용 가능 SQL (133 INSERT)
- `medterm_preprocess/output/exam_30q.json` — 단원평가 30문항
- `medterm_preprocess/output/pages_1_to_20.json` — 책 본문 추출
- `medterm_preprocess/output/의학용어_Ch01_문제지.pdf` / `정답해설.pdf` — 인쇄 가능 PDF
