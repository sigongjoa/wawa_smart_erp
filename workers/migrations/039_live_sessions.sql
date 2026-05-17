-- 라이브 문제 세션: 교사 데스크톱과 학생 디바이스 1:1 풀이 세션
CREATE TABLE IF NOT EXISTS live_sessions (
  id              TEXT PRIMARY KEY,
  academy_id      TEXT NOT NULL,
  teacher_id      TEXT NOT NULL,
  student_id      TEXT NOT NULL,
  subject         TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'active', -- active | ended | abandoned
  started_at      TEXT NOT NULL DEFAULT (datetime('now')),
  ended_at        TEXT,
  duration_sec    INTEGER,
  problem_text    TEXT,
  problem_r2_key  TEXT,
  teacher_solution_text   TEXT,
  teacher_solution_r2_key TEXT,
  student_answer_text     TEXT,
  student_answer_r2_key   TEXT,
  note_id         TEXT,
  FOREIGN KEY (academy_id) REFERENCES academies(id) ON DELETE CASCADE,
  FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_lvs_student_time ON live_sessions(student_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_lvs_teacher_time ON live_sessions(teacher_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_lvs_active ON live_sessions(status, academy_id);
