-- Fix exams table: make class_id nullable to support academy-wide exams
-- SQLite limitation: cannot directly alter column to remove NOT NULL
-- Solution: recreate table with updated schema

-- Create new exams table with nullable class_id
CREATE TABLE IF NOT EXISTS exams_new (
  id TEXT PRIMARY KEY,
  academy_id TEXT NOT NULL,
  class_id TEXT,
  name TEXT NOT NULL,
  exam_month TEXT,
  date DATE NOT NULL,
  total_score REAL,
  is_active BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME,
  FOREIGN KEY (academy_id) REFERENCES academies(id),
  FOREIGN KEY (class_id) REFERENCES classes(id)
);

-- Copy data from old table
INSERT INTO exams_new SELECT id, academy_id, class_id, name, exam_month, date, total_score, is_active, created_at, updated_at FROM exams;

-- Drop old table and rename
DROP TABLE exams;
ALTER TABLE exams_new RENAME TO exams;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_exams_academy_id ON exams(academy_id);
CREATE INDEX IF NOT EXISTS idx_exams_class_id ON exams(class_id);
CREATE INDEX IF NOT EXISTS idx_exams_exam_month ON exams(academy_id, exam_month);
CREATE INDEX IF NOT EXISTS idx_exams_is_active ON exams(academy_id, is_active);
