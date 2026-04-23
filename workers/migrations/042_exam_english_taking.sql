-- =============================================
-- 042: 학생 앱 영어 시험 응시 (MVP)
-- 설계: docs/STUDENT_EXAM_TAKE_DESIGN.md
-- 5지선다 객관식만. 서답형/이미지는 v2.
-- =============================================

-- 1) 시험지 과목 구분 (영어 전용 스코프 핸들링용)
ALTER TABLE exam_papers ADD COLUMN subject TEXT;
ALTER TABLE exam_papers ADD COLUMN duration_minutes INTEGER DEFAULT 50;

-- 2) 문제 — (시험지 × 문항번호)
CREATE TABLE IF NOT EXISTS exam_questions (
  id TEXT PRIMARY KEY,
  exam_paper_id TEXT NOT NULL,
  question_no INTEGER NOT NULL,
  prompt TEXT NOT NULL,
  choices TEXT NOT NULL,             -- JSON: ["a","b","c","d","e"]
  correct_choice INTEGER NOT NULL,   -- 1..5
  points REAL DEFAULT 1,
  created_at DATETIME DEFAULT (datetime('now')),
  UNIQUE (exam_paper_id, question_no),
  FOREIGN KEY (exam_paper_id) REFERENCES exam_papers(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_exam_questions_paper ON exam_questions(exam_paper_id);

-- 3) 학생 답안 — (응시건 × 문항번호)
CREATE TABLE IF NOT EXISTS exam_answers (
  attempt_id TEXT NOT NULL,
  question_no INTEGER NOT NULL,
  selected_choice INTEGER,
  saved_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (attempt_id, question_no),
  FOREIGN KEY (attempt_id) REFERENCES exam_attempts(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_exam_answers_attempt ON exam_answers(attempt_id);

-- 4) 자동 채점 결과 캐시
ALTER TABLE exam_attempts ADD COLUMN auto_score   REAL;
ALTER TABLE exam_attempts ADD COLUMN auto_correct INTEGER;
ALTER TABLE exam_attempts ADD COLUMN auto_total   INTEGER;
