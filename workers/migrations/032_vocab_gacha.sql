-- =============================================
-- Vocab Gacha — 영단어 학습 (Word_Gacha 마이그레이션)
-- 학원 → 선생님 → 학생 계층 (gacha_students 재사용)
-- =============================================

-- 단어장 (학생별 누적, 5-box Leitner)
CREATE TABLE IF NOT EXISTS vocab_words (
  id TEXT PRIMARY KEY,
  academy_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  english TEXT NOT NULL,
  korean TEXT NOT NULL,
  box INTEGER NOT NULL DEFAULT 1,          -- 1..5
  blank_type TEXT NOT NULL DEFAULT 'korean', -- korean|english|both
  status TEXT NOT NULL DEFAULT 'approved', -- pending|approved
  added_by TEXT NOT NULL DEFAULT 'teacher',-- teacher|student
  review_count INTEGER NOT NULL DEFAULT 0,
  wrong_count INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT (datetime('now')),
  updated_at DATETIME,
  FOREIGN KEY (student_id) REFERENCES gacha_students(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_vocab_words_student ON vocab_words(academy_id, student_id, status);
CREATE INDEX IF NOT EXISTS idx_vocab_words_box ON vocab_words(student_id, box);

-- 문법 Q&A (학생 질문 + 교사/AI 답변)
CREATE TABLE IF NOT EXISTS vocab_grammar_qa (
  id TEXT PRIMARY KEY,
  academy_id TEXT NOT NULL,
  student_id TEXT,                          -- NULL = 교사가 직접 작성
  question TEXT NOT NULL,
  answer TEXT,
  status TEXT NOT NULL DEFAULT 'pending',   -- pending|answered
  answered_by TEXT,                         -- teacher|ai
  include_in_print INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT (datetime('now')),
  answered_at DATETIME,
  FOREIGN KEY (student_id) REFERENCES gacha_students(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_vocab_grammar_academy ON vocab_grammar_qa(academy_id, status);

-- 교과서 (학원별 입력, 공통 시드 없음)
CREATE TABLE IF NOT EXISTS vocab_textbooks (
  id TEXT PRIMARY KEY,
  academy_id TEXT NOT NULL,
  school TEXT,
  grade TEXT,
  semester TEXT,
  title TEXT NOT NULL,
  created_by TEXT,
  created_at DATETIME DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_vocab_textbooks_academy ON vocab_textbooks(academy_id);

CREATE TABLE IF NOT EXISTS vocab_textbook_words (
  id TEXT PRIMARY KEY,
  textbook_id TEXT NOT NULL,
  unit TEXT,
  english TEXT NOT NULL,
  korean TEXT NOT NULL,
  sentence TEXT,
  FOREIGN KEY (textbook_id) REFERENCES vocab_textbooks(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_vocab_textbook_words_book ON vocab_textbook_words(textbook_id);

-- 출제 기록 (가중치 인쇄 → 채점 연결)
CREATE TABLE IF NOT EXISTS vocab_print_jobs (
  id TEXT PRIMARY KEY,
  academy_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  word_ids_json TEXT NOT NULL,              -- 출제된 vocab_words.id 배열
  grammar_ids_json TEXT,                    -- 포함된 문법 Q&A id 배열
  pdf_r2_key TEXT,                          -- (선택) 캐시된 PDF
  created_by TEXT,
  created_at DATETIME DEFAULT (datetime('now')),
  FOREIGN KEY (student_id) REFERENCES gacha_students(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_vocab_print_student ON vocab_print_jobs(student_id, created_at);

-- 채점 결과 (O/X → box 갱신 트리거)
CREATE TABLE IF NOT EXISTS vocab_grade_results (
  id TEXT PRIMARY KEY,
  print_job_id TEXT NOT NULL,
  word_id TEXT NOT NULL,
  correct INTEGER NOT NULL,                 -- 0|1
  box_before INTEGER,
  box_after INTEGER,
  graded_at DATETIME DEFAULT (datetime('now')),
  FOREIGN KEY (print_job_id) REFERENCES vocab_print_jobs(id) ON DELETE CASCADE,
  FOREIGN KEY (word_id) REFERENCES vocab_words(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_vocab_grade_job ON vocab_grade_results(print_job_id);
