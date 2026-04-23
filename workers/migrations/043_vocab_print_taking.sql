-- =============================================
-- 043: 단어 시험지 학생 셀프-응시 루프 (Phase 3b)
-- 설계: docs/VOCAB_EXAM_STUDENT_TAKE_DESIGN.md
-- 이슈: #58
-- =============================================

-- 1) 시험지 상태 lifecycle
ALTER TABLE vocab_print_jobs ADD COLUMN status TEXT DEFAULT 'pending';
  -- 'pending' | 'in_progress' | 'submitted' | 'voided'
ALTER TABLE vocab_print_jobs ADD COLUMN started_at   TEXT;
ALTER TABLE vocab_print_jobs ADD COLUMN submitted_at TEXT;
ALTER TABLE vocab_print_jobs ADD COLUMN auto_correct INTEGER;
ALTER TABLE vocab_print_jobs ADD COLUMN auto_total   INTEGER;

CREATE INDEX IF NOT EXISTS idx_vocab_print_status_student
  ON vocab_print_jobs(student_id, status, created_at);

-- 2) 학생 답안 snapshot (choices 고정 + 선택)
CREATE TABLE IF NOT EXISTS vocab_print_answers (
  print_job_id   TEXT NOT NULL,
  word_id        TEXT NOT NULL,
  selected_index INTEGER,         -- 0..3 or NULL
  correct_index  INTEGER NOT NULL,
  choices_json   TEXT NOT NULL,   -- JSON: ["...","...","...","..."]
  saved_at       TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (print_job_id, word_id),
  FOREIGN KEY (print_job_id) REFERENCES vocab_print_jobs(id) ON DELETE CASCADE,
  FOREIGN KEY (word_id) REFERENCES vocab_words(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_vocab_print_answers_job
  ON vocab_print_answers(print_job_id);
