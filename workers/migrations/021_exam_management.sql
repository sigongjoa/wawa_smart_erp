-- 정기고사 관리 시스템
-- 시험 기간 → 시험지 → 학생 배정 (제작/프린트/검토 추적)

-- 시험 기간
CREATE TABLE IF NOT EXISTS exam_periods (
  id TEXT PRIMARY KEY,
  academy_id TEXT NOT NULL,
  title TEXT NOT NULL,
  period_month TEXT NOT NULL,
  status TEXT DEFAULT 'preparing',
  created_by TEXT NOT NULL,
  created_at DATETIME DEFAULT (datetime('now')),
  updated_at DATETIME DEFAULT (datetime('now')),
  UNIQUE(academy_id, period_month)
);

-- 시험지
CREATE TABLE IF NOT EXISTS exam_papers (
  id TEXT PRIMARY KEY,
  exam_period_id TEXT NOT NULL,
  academy_id TEXT NOT NULL,
  title TEXT NOT NULL,
  grade_filter TEXT,
  is_custom INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT (datetime('now')),
  FOREIGN KEY (exam_period_id) REFERENCES exam_periods(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_exam_papers_period ON exam_papers(exam_period_id);

-- 학생-시험지 배정
CREATE TABLE IF NOT EXISTS exam_assignments (
  id TEXT PRIMARY KEY,
  exam_period_id TEXT NOT NULL,
  exam_paper_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  academy_id TEXT NOT NULL,
  created_check INTEGER DEFAULT 0,
  printed INTEGER DEFAULT 0,
  reviewed INTEGER DEFAULT 0,
  drive_link TEXT,
  score REAL,
  memo TEXT,
  created_at DATETIME DEFAULT (datetime('now')),
  UNIQUE(exam_period_id, student_id),
  FOREIGN KEY (exam_period_id) REFERENCES exam_periods(id) ON DELETE CASCADE,
  FOREIGN KEY (exam_paper_id) REFERENCES exam_papers(id),
  FOREIGN KEY (student_id) REFERENCES gacha_students(id)
);
CREATE INDEX IF NOT EXISTS idx_exam_assignments_period ON exam_assignments(exam_period_id);
CREATE INDEX IF NOT EXISTS idx_exam_assignments_student ON exam_assignments(student_id);
