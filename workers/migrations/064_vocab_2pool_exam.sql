-- =============================================
-- 064: 2-Pool 영단어 시험 — 학생 pool + 공통어휘 통합
-- 설계: docs (issue #131 연관) / sc:design 결과
--
-- 변경:
--   1. vocab_print_job_items 신규 테이블 — 문항 단위 (source/source_word_id snapshot)
--   2. vocab_exam_policy 컬럼 추가 — textbook_filters_json, mix_ratio_common
-- =============================================

-- 1) 문항 단위 테이블 (정규화)
-- 두 pool (vocab_words / vocab_textbook_words) 를 하나의 시험지에서 통합 관리.
-- 단어 수정·삭제돼도 시험 이력 안정 → english/korean/unit_label/textbook_title snapshot.
CREATE TABLE IF NOT EXISTS vocab_print_job_items (
  id              TEXT PRIMARY KEY,
  print_job_id    TEXT NOT NULL,
  academy_id      TEXT NOT NULL,           -- 격리용 redundant
  item_index      INTEGER NOT NULL,        -- 0..N-1 표시 순서

  -- pool 식별
  source          TEXT NOT NULL,           -- 'student' | 'textbook'
  source_word_id  TEXT NOT NULL,           -- vocab_words.id  OR  vocab_textbook_words.id

  -- 출제 시점 snapshot
  english         TEXT NOT NULL,
  korean          TEXT NOT NULL,
  unit_label      TEXT,                    -- textbook 일 때 "Unit 03 외모"
  textbook_title  TEXT,                    -- textbook 일 때 "어휘끝 고교기본"

  -- 4지선다
  choices_json    TEXT NOT NULL,           -- JSON 배열 ["A","B","C","D"]
  correct_index   INTEGER NOT NULL,        -- 0..3

  -- 응답·채점
  selected_index  INTEGER,                 -- 학생 선택, 미응답=NULL
  is_correct      INTEGER,                 -- 0|1, 미채점=NULL
  graded_at       TEXT,

  created_at      TEXT DEFAULT (datetime('now')),

  FOREIGN KEY (print_job_id) REFERENCES vocab_print_jobs(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_vpji_job ON vocab_print_job_items(print_job_id, item_index);
CREATE INDEX IF NOT EXISTS idx_vpji_source ON vocab_print_job_items(source, source_word_id);
CREATE INDEX IF NOT EXISTS idx_vpji_academy ON vocab_print_job_items(academy_id, created_at);

-- 2) vocab_exam_policy 확장
-- textbook_filters_json: 복수 책 + unit 범위 지원
-- 예: [{"textbook_id":"vtb_xxx","unit_from":"Unit 01","unit_to":"Unit 10"}]
-- NULL/빈배열이면 textbook_id 단일 사용 (구버전 호환)
ALTER TABLE vocab_exam_policy ADD COLUMN textbook_filters_json TEXT;

-- mix_ratio_common: source='mixed' 일 때 공통어휘 비율 (0~100)
-- 학생 pool = 100 - mix_ratio_common. source='student_pool'/'textbook' 일 때 무시.
ALTER TABLE vocab_exam_policy ADD COLUMN mix_ratio_common INTEGER NOT NULL DEFAULT 50;
