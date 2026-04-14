-- P2: grades FK cascade 추가 + 세션 정리 인덱스

-- grades 테이블 재생성 (ON DELETE CASCADE 추가)
CREATE TABLE IF NOT EXISTS grades_new (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  exam_id TEXT NOT NULL,
  score REAL,
  comments TEXT,
  graded_at DATETIME,
  graded_by TEXT,
  created_at DATETIME DEFAULT (datetime('now')),
  year_month TEXT,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE
);

INSERT OR IGNORE INTO grades_new
  SELECT id, student_id, exam_id, score, comments, graded_at, graded_by, created_at, year_month
  FROM grades;

DROP TABLE grades;
ALTER TABLE grades_new RENAME TO grades;

CREATE INDEX IF NOT EXISTS idx_grades_student ON grades(student_id);
CREATE INDEX IF NOT EXISTS idx_grades_exam ON grades(exam_id);
CREATE INDEX IF NOT EXISTS idx_grades_year_month ON grades(year_month);

-- 만료 세션 정리용 인덱스
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
