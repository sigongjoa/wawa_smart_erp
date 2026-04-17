-- =============================================
-- 029: 시험 결시/날짜변경 + 임시 수업
-- =============================================

-- 1) exam_assignments에 시험상태/날짜 관련 컬럼 추가
ALTER TABLE exam_assignments ADD COLUMN exam_date TEXT;
ALTER TABLE exam_assignments ADD COLUMN exam_status TEXT DEFAULT 'scheduled';
ALTER TABLE exam_assignments ADD COLUMN absence_reason TEXT;
ALTER TABLE exam_assignments ADD COLUMN rescheduled_date TEXT;
ALTER TABLE exam_assignments ADD COLUMN rescheduled_memo TEXT;

CREATE INDEX IF NOT EXISTS idx_exam_assign_status ON exam_assignments(exam_status);
CREATE INDEX IF NOT EXISTS idx_exam_assign_date ON exam_assignments(exam_date);

-- 2) 임시(1회성) 수업 일정
CREATE TABLE IF NOT EXISTS adhoc_sessions (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  teacher_id TEXT NOT NULL,
  academy_id TEXT NOT NULL,
  date TEXT NOT NULL,              -- 'YYYY-MM-DD'
  start_time TEXT NOT NULL,        -- 'HH:mm'
  end_time TEXT NOT NULL,          -- 'HH:mm'
  subject TEXT,
  reason TEXT,                     -- '시간표변경','보충수업','시험대비','대타','기타'
  status TEXT DEFAULT 'scheduled', -- 'scheduled'|'completed'|'cancelled'
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (teacher_id) REFERENCES users(id),
  FOREIGN KEY (academy_id) REFERENCES academies(id)
);

CREATE INDEX IF NOT EXISTS idx_adhoc_date ON adhoc_sessions(date);
CREATE INDEX IF NOT EXISTS idx_adhoc_teacher_date ON adhoc_sessions(teacher_id, date);
CREATE INDEX IF NOT EXISTS idx_adhoc_student_date ON adhoc_sessions(student_id, date);
