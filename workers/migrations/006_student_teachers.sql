-- 학생-선생님 매핑 테이블 (다대다)
-- 한 학생에 여러 선생님, 한 선생님에 여러 학생 가능
CREATE TABLE IF NOT EXISTS student_teachers (
  student_id TEXT NOT NULL,
  teacher_id TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (student_id, teacher_id),
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 선생님별 학생 조회 빠르게
CREATE INDEX IF NOT EXISTS idx_student_teachers_teacher ON student_teachers(teacher_id);
