-- =============================================
-- 045: 어휘 시험 셀프-서브 모델 — 정책 + 영작 + 쿨다운
-- 설계: 교사는 정책만, 학생이 트리거하면 자동 출제·채점
-- =============================================

-- 1) 정책 테이블 (학원/교사/학생 단위 오버라이드)
CREATE TABLE IF NOT EXISTS vocab_exam_policy (
  id TEXT PRIMARY KEY,
  academy_id TEXT NOT NULL,
  scope TEXT NOT NULL,                -- 'academy' | 'teacher' | 'student'
  scope_id TEXT,                      -- teacher_id / student_id (academy면 NULL)

  -- 풀 구성
  vocab_count INTEGER NOT NULL DEFAULT 10,
  context_count INTEGER NOT NULL DEFAULT 0,    -- 어휘 맥락 4지선다 (Phase 2)
  grammar_count INTEGER NOT NULL DEFAULT 0,    -- 문법 4지선다 (Phase 2)
  writing_enabled INTEGER NOT NULL DEFAULT 0,  -- 영작 포함 여부
  writing_type TEXT,                  -- sentence_completion | word_arrangement | summary_writing | free_writing | NULL=학생선택

  -- 출제 규칙
  box_filter TEXT NOT NULL DEFAULT '1,2,3,4',  -- CSV: 어떤 box에서 뽑을지 (5 제외 권장)
  source TEXT NOT NULL DEFAULT 'student_pool', -- student_pool | textbook | mixed
  textbook_id TEXT,                            -- source가 textbook일 때

  -- 응시 제약
  time_limit_sec INTEGER NOT NULL DEFAULT 600, -- 0 = 무제한
  cooldown_min INTEGER NOT NULL DEFAULT 60,    -- 마지막 응시 후 N분 잠금
  daily_limit INTEGER NOT NULL DEFAULT 3,      -- 0 = 무제한
  active_from TEXT,                            -- 'HH:MM' (NULL=24시간)
  active_to TEXT,                              -- 'HH:MM'
  word_cooldown_min INTEGER NOT NULL DEFAULT 30, -- 같은 단어 재출제 금지 분

  -- 영작 채점
  ai_grading INTEGER NOT NULL DEFAULT 1,

  enabled INTEGER NOT NULL DEFAULT 1,
  created_by TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT,

  UNIQUE (academy_id, scope, scope_id)
);

CREATE INDEX IF NOT EXISTS idx_vocab_policy_resolve
  ON vocab_exam_policy (academy_id, scope, scope_id, enabled);

-- 2) 영작 응답 (단어 시험과 같은 vocab_print_jobs 위에 얹음 — exam_id 1:1)
CREATE TABLE IF NOT EXISTS vocab_writing_responses (
  exam_id TEXT PRIMARY KEY,
  problem_type TEXT NOT NULL,                  -- sentence_completion | word_arrangement | summary_writing | free_writing
  problem TEXT NOT NULL,                       -- JSON
  target_words TEXT NOT NULL,                  -- JSON: [{id,english,korean}]
  student_answer TEXT,
  grade TEXT,                                  -- JSON: Gemini 채점 결과
  graded_at TEXT,
  FOREIGN KEY (exam_id) REFERENCES vocab_print_jobs(id) ON DELETE CASCADE
);

-- 3) 단어 재출제 쿨다운: 동일 단어 너무 자주 출제되지 않게
ALTER TABLE vocab_words ADD COLUMN last_quizzed_at TEXT;
CREATE INDEX IF NOT EXISTS idx_vocab_words_last_quizzed
  ON vocab_words (student_id, last_quizzed_at);

-- 4) print_jobs에 정책 추적 + 영작 플래그
ALTER TABLE vocab_print_jobs ADD COLUMN policy_id TEXT;
ALTER TABLE vocab_print_jobs ADD COLUMN has_writing INTEGER NOT NULL DEFAULT 0;

-- 5) grammar_qa에 Supabase 호환 컬럼 (이관용)
ALTER TABLE vocab_grammar_qa ADD COLUMN student_name TEXT;
ALTER TABLE vocab_grammar_qa ADD COLUMN grade INTEGER;          -- 1|2|3 학년
ALTER TABLE vocab_grammar_qa ADD COLUMN exam_problem TEXT;      -- JSON

-- 6) 학원 기본 정책 시드 (acad-1) — 정책 미설정 학원도 즉시 동작
INSERT INTO vocab_exam_policy
  (id, academy_id, scope, scope_id, vocab_count, cooldown_min, daily_limit, box_filter, enabled, created_at)
VALUES
  ('vep-default-acad-1', 'acad-1', 'academy', NULL, 10, 60, 3, '1,2,3,4', 1, datetime('now'))
ON CONFLICT(academy_id, scope, scope_id) DO NOTHING;
