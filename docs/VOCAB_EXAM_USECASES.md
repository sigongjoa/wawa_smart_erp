# 유즈케이스 — 상위권 어휘풀 + 자동 채점 시험

> **관련**: `docs/VOCAB_EXAM_INTEGRATION_DESIGN.md`, wawa_smart_erp#56, word-gacha#8
> **액터**: 원장(Admin), 강사(Teacher), 학생(Student), 학부모(Parent), 시스템(System)

---

## 액터 개요

| 액터 | 설명 | 접근 앱 |
|---|---|---|
| Admin | 원장. 어휘풀 시드·태그 카테고리 관리 | desktop |
| Teacher | 강사. 학생 배정·시험 생성·리뷰 | desktop |
| Student | 상위권 학생. 일일 학습 + 시험 응시 | student (word-gacha) |
| Parent | 학부모. 리포트 수신 | 카톡/PDF |
| System | Workers 채점엔진/배치 | - |

---

## UC-01. 원장이 전공 어휘 시드를 업로드한다

- **액터**: Admin
- **선결조건**: desktop 로그인, `admin` 권한
- **성공 시나리오**
  1. `/vocab/pool` 페이지 진입
  2. "CSV 업로드" 버튼 → `medical_500.csv` 선택 (컬럼: english,korean,cefr,tier,tags)
  3. 프리뷰에서 500행 확인, tier=`major`, tag=`의예` 자동 감지
  4. "업로드" 클릭
  5. 시스템: `vocab_pool` INSERT + `vocab_pool_tags` 연결, 중복 `english`는 스킵 리포트
- **결과**: 학원의 `major` 어휘풀에 의예 500어 편입
- **대체 흐름**
  - 3a. 중복 행 50개 발견 → "업데이트 / 건너뛰기 / 취소" 선택 모달

---

## UC-02. 강사가 학생의 지망학과를 설정한다

- **액터**: Teacher
- **선결조건**: 학생 계정 존재
- **성공 시나리오**
  1. 학생 상세 페이지 → "어휘 프로필" 탭
  2. `target_tier = advanced`, `target_tags = [의예, SAT]`, `daily_quota = 30` 저장
  3. 시스템: `student_vocab_profile` UPSERT
- **결과**: 해당 학생의 일일 자동 출제가 advanced+의예+SAT 교집합/합집합에서 추출
- **예외**: 태그에 해당하는 어휘가 30개 미만 → 경고 + basic에서 부족분 보충 옵션

---

## UC-03. 학생의 일일 암기 큐가 자동 생성된다 (시스템)

- **액터**: System (크론 or 첫 로그인 트리거)
- **성공 시나리오**
  1. 매일 06:00, 학원별 `student_vocab_profile` 순회
  2. 학생별로:
     - Leitner box 1~3 단어 중 review 예정분 추출 (우선순위 A)
     - 부족분은 `vocab_pool` tier+tag 매칭 + 미학습 단어 랜덤 추출 (우선순위 B)
     - 합계 = `daily_quota`
  3. `vocab_words`에 pool 기반 단어를 `box=1`로 삽입 (누락분만)
- **결과**: 학생 앱 홈에 "오늘 단어 30개" 노출

---

## UC-04. 학생이 일일 학습을 수행한다

- **액터**: Student
- **선결조건**: 큐 생성됨
- **성공 시나리오**
  1. 학생 앱 → "오늘 단어" 진입
  2. 카드 형식: 앞면 영단어 + 품사, 뒤면 한글뜻 + 예문 + 어원 + 동의어
  3. "외웠어요 / 애매 / 몰라요" 3단 버튼
  4. 시스템: 응답에 따라 `box` 조정, `review_count++`
- **결과**: 학습 완료 시 홈 진도 바 100%

---

## UC-05. 강사가 자동 시험지를 생성한다

- **액터**: Teacher
- **선결조건**: 어휘풀 충분 (>= 요청 문항 수)
- **성공 시나리오**
  1. `/vocab/exams/new` 페이지
  2. 조건 입력:
     - tier: `advanced`
     - tag: `의예`
     - 문항 수: 30
     - 유형 비율: MCQ 40% / spell 40% / cloze 20%
     - 제한시간: 15분
     - 채점 정책: typo_tolerance=1, partial=ON
  3. "프리뷰" → 시스템이 30문항 샘플링 + 문항 렌더링
  4. "확정 & 저장" → `vocab_exams` + `vocab_exam_items` 스냅샷 생성
- **결과**: 시험 `ve_xxx` 생성 (아직 배포 전 — `published_at=NULL`)
- **대체 흐름**
  - 3a. 특정 문항 교체: "다시 뽑기" 버튼 → 해당 seq만 재샘플링
  - 3b. 문항 수동 편집: prompt/answer_alts 수정 가능

---

## UC-06. 강사가 학생에게 시험을 배포한다

- **액터**: Teacher
- **선결조건**: UC-05 완료
- **성공 시나리오**
  1. 시험 상세 → "배포" 버튼
  2. 대상 선택: 반 전체 / 개별 선택 / 상위권 태그 필터
  3. `due_at`, `retry_allowed` 설정
  4. "확정" → `vocab_exam_assignments` 벌크 생성, `published_at` 기록
  5. (옵션) 카카오톡 알림 발송
- **결과**: 대상 학생들의 student 앱 시험 목록에 노출

---

## UC-07. 학생이 시험을 응시한다

- **액터**: Student
- **선결조건**: assignment 수신, `status=assigned`
- **성공 시나리오**
  1. student 앱 → "시험" 탭 → 할당 목록
  2. "응시 시작" 클릭 → 풀스크린 전환 안내 모달 ("이탈 시 경고 기록")
  3. 확인 → 시스템: `vocab_exam_attempts` 생성, 타이머 시작
  4. 문항 30개 순차 풀이
  5. "제출" 또는 타이머 만료 시 자동 제출
  6. 시스템: 채점 엔진 실행 → 즉시 결과 화면
- **결과**: 학생이 점수 + 문항별 O/X + 오답 해설 확인
- **대체 흐름**
  - 4a. 탭 전환 → blur 이벤트 로깅, 3회째 경고 팝업
  - 4b. 네트워크 단절 → 로컬 캐시로 풀이 지속, 재연결 시 이벤트 flush
  - 5a. 타이머 만료 → 미응답 문항 `given=NULL`로 제출, correct=0 처리
- **예외**
  - 재응시 시도 + `retry_allowed=0` → 거부, "이미 응시했습니다"

---

## UC-08. 시스템이 자동 채점한다

- **액터**: System
- **트리거**: UC-07 제출
- **성공 시나리오**
  1. `gradeItem()` 순수 함수로 문항별 채점
     - MCQ: 정확 비교
     - spell: normalize → Levenshtein ≤ `typo_tolerance`
     - cloze: spell 로직 + `answer_alts` 순회
     - def_match: 동의어 사전 매칭
  2. `vocab_exam_responses` 벌크 INSERT
  3. `vocab_exam_attempts`에 `score_raw`, `score_weighted` 반영
  4. 오답 단어 → `vocab_words.box` 감소 / 없으면 신규 삽입 (`added_by='exam'`)
  5. `assignment.status = 'graded'`
- **결과**: 채점 완료, 학습 루프에 오답 자동 편입

---

## UC-09. 강사가 반 리포트를 확인한다

- **액터**: Teacher
- **선결조건**: 최소 1명 응시 완료
- **성공 시나리오**
  1. 시험 상세 → "리포트" 탭
  2. 표시 항목:
     - 응시율 / 평균 / 분포 히스토그램
     - 문항별 정답률 (변별도 낮은 문항 하이라이트)
     - 학생별 오답 Top 5 히트맵
     - 부정행위 플래그된 응시(`flagged=1`) 리스트
  3. "PDF 다운로드" / "CSV 내보내기"
- **결과**: 수업 피드백 자료 확보

---

## UC-10. 강사가 부정행위 응시를 리뷰한다

- **액터**: Teacher
- **선결조건**: `attempts.flagged=1`
- **성공 시나리오**
  1. 리포트 → 플래그 리스트 → 학생 클릭
  2. `cheat_events_json` 타임라인 확인 (blur 7회, hidden 4회)
  3. 판단:
     - **무효** → `attempt.voided=1`, `assignment.status='assigned'` 리셋
     - **부분 인정** → 교사가 수동 점수 조정
     - **정상** → 플래그 해제
- **결과**: 공정성 확보

---

## UC-11. 학부모가 주간 리포트를 수신한다

- **액터**: Parent, System
- **성공 시나리오**
  1. 매주 일요일 21:00 배치
  2. 학생별 집계:
     - 이번 주 암기 단어 수
     - 전공어 커버리지 % (지망태그 pool 대비)
     - 시험 점수 평균 / 최고
     - 오답 Top 10
  3. PDF 생성 → R2 저장 → 카톡 링크 발송
- **결과**: 학부모가 학습 진행도 파악

---

## UC-12. 학생이 오답 복습만 따로 한다

- **액터**: Student
- **성공 시나리오**
  1. 학생 앱 홈 → "오답 노트" 배지 (미복습 N개)
  2. 클릭 → 최근 시험 오답 + Leitner box 1 단어 우선
  3. 복습 세션 완료 시 box 상승 가능
- **결과**: 오답 집중 훈련 루프 형성

---

## UC-13. 상위권 학생이 자율 어휘풀을 탐색한다

- **액터**: Student
- **성공 시나리오**
  1. 학생 앱 → "어휘 도감"
  2. 지망태그 기반 전체 pool 탐색 (잠금/해제 뱃지 포함)
  3. 원하는 단어를 "내 단어장에 추가" → `vocab_words` INSERT (`added_by='student'`)
- **결과**: 학습 자율성 강화, 상위권 이탈 방지

---

## UC-14. 원장이 어휘풀 커버리지를 감사한다

- **액터**: Admin
- **성공 시나리오**
  1. `/vocab/audit` 대시보드
  2. 지표:
     - tier별 pool 크기
     - 태그별 pool 크기 + 부족 경고 (지망 학생 수 > pool 크기 시)
     - 시드 마지막 업데이트일
  3. 부족 태그 → UC-01로 이어짐
- **결과**: 컨텐츠 공백 사전 탐지

---

## 유즈케이스 맵

```
Admin ──┬── UC-01 어휘 시드 업로드
        └── UC-14 커버리지 감사

Teacher ┬── UC-02 지망학과 설정
        ├── UC-05 시험지 생성
        ├── UC-06 시험 배포
        ├── UC-09 반 리포트
        └── UC-10 부정행위 리뷰

Student ┬── UC-04 일일 학습
        ├── UC-07 시험 응시
        ├── UC-12 오답 복습
        └── UC-13 도감 탐색

System  ┬── UC-03 일일 큐 생성
        ├── UC-08 자동 채점
        └── UC-11 주간 리포트

Parent  └── UC-11 리포트 수신
```

---

## 우선순위 매트릭스

| UC | 가치 | 난이도 | 스프린트 |
|---|---|---|---|
| UC-01 | High | Low | P1 |
| UC-02 | High | Low | P1 |
| UC-03 | High | Mid | P2 |
| UC-04 | High | Low | P2 (기존 재활용) |
| UC-05 | High | Mid | P3 |
| UC-06 | High | Low | P3 |
| UC-07 | Critical | High | P4 |
| UC-08 | Critical | High | P5 |
| UC-09 | High | Mid | P6 |
| UC-10 | Mid | Low | P6 |
| UC-11 | Mid | Mid | P7 (후속) |
| UC-12 | Mid | Low | P5 |
| UC-13 | Mid | Mid | P7 |
| UC-14 | Low | Low | P7 |
