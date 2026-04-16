-- 시험지(중간/기말/수행평가) 유인물 관리 (021의 exam_papers와 별도)
CREATE TABLE IF NOT EXISTS paper_handouts (
  id TEXT PRIMARY KEY,
  academy_id TEXT NOT NULL,
  title TEXT NOT NULL,
  exam_type TEXT NOT NULL,         -- 'midterm' | 'final' | 'performance'
  subject TEXT,
  school TEXT,
  grade TEXT,
  exam_year INTEGER,
  semester INTEGER,                -- 1 | 2
  file_key TEXT,
  file_name TEXT,
  file_size INTEGER,
  content_type TEXT,
  memo TEXT DEFAULT '',
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_paper_handouts_academy ON paper_handouts(academy_id);
CREATE INDEX IF NOT EXISTS idx_paper_handouts_match ON paper_handouts(academy_id, school, grade);
CREATE INDEX IF NOT EXISTS idx_paper_handouts_type ON paper_handouts(academy_id, exam_type);

CREATE TABLE IF NOT EXISTS paper_handout_distributions (
  id TEXT PRIMARY KEY,
  paper_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  academy_id TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'auto',
  distributed_at TEXT NOT NULL DEFAULT (datetime('now')),
  viewed_at TEXT,
  UNIQUE(paper_id, student_id),
  FOREIGN KEY (paper_id) REFERENCES paper_handouts(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_phd_paper ON paper_handout_distributions(paper_id);
CREATE INDEX IF NOT EXISTS idx_phd_student ON paper_handout_distributions(student_id, academy_id);
