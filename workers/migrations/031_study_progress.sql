-- 학생 진도/이해도 관리
-- 교재는 별도 엔티티 없이 study_units.textbook 문자열로 그룹
-- kind: 'unit'(단원) | 'type'(문제 유형)

CREATE TABLE IF NOT EXISTS study_units (
  id TEXT PRIMARY KEY,
  academy_id TEXT NOT NULL,
  textbook TEXT NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'unit',
  order_idx INTEGER NOT NULL DEFAULT 0,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_study_units_book
  ON study_units(academy_id, textbook, kind, order_idx);

CREATE TABLE IF NOT EXISTS student_study_progress (
  id TEXT PRIMARY KEY,
  academy_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  unit_id TEXT NOT NULL,
  understanding INTEGER,
  status TEXT NOT NULL DEFAULT 'not_started',
  note TEXT,
  updated_by TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(student_id, unit_id),
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (unit_id) REFERENCES study_units(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ssp_student
  ON student_study_progress(student_id);
CREATE INDEX IF NOT EXISTS idx_ssp_unit
  ON student_study_progress(unit_id);
