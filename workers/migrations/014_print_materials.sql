-- 교재/프린트물 관리 테이블
CREATE TABLE IF NOT EXISTS print_materials (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  title TEXT NOT NULL,
  memo TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'todo',  -- 'todo' | 'done'
  file_url TEXT DEFAULT '',
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  FOREIGN KEY (student_id) REFERENCES students(id)
);

CREATE INDEX IF NOT EXISTS idx_print_materials_student ON print_materials(student_id);
CREATE INDEX IF NOT EXISTS idx_print_materials_status ON print_materials(status);
CREATE INDEX IF NOT EXISTS idx_print_materials_created_by ON print_materials(created_by);
