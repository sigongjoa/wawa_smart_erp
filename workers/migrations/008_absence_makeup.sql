-- =============================================
-- 결석/보강 관리 시스템 (Issue #27)
-- =============================================

-- 1) 수업별 학생 배정 (요일별 시간표)
CREATE TABLE IF NOT EXISTS class_students (
  id TEXT PRIMARY KEY,
  class_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  UNIQUE(class_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_class_students_class ON class_students(class_id);
CREATE INDEX IF NOT EXISTS idx_class_students_student ON class_students(student_id);

-- 2) 결석 기록
CREATE TABLE IF NOT EXISTS absences (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  class_id TEXT NOT NULL,
  absence_date DATE NOT NULL,
  reason TEXT DEFAULT '',
  notified_by TEXT DEFAULT '',
  notified_at TEXT,
  status TEXT DEFAULT 'absent',
  recorded_by TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (student_id) REFERENCES students(id),
  FOREIGN KEY (class_id) REFERENCES classes(id),
  UNIQUE(student_id, class_id, absence_date)
);

CREATE INDEX IF NOT EXISTS idx_absences_student ON absences(student_id);
CREATE INDEX IF NOT EXISTS idx_absences_class ON absences(class_id);
CREATE INDEX IF NOT EXISTS idx_absences_date ON absences(absence_date);
CREATE INDEX IF NOT EXISTS idx_absences_status ON absences(status);

-- 3) 보강 추적
CREATE TABLE IF NOT EXISTS makeups (
  id TEXT PRIMARY KEY,
  absence_id TEXT NOT NULL,
  scheduled_date DATE,
  completed_date DATE,
  status TEXT DEFAULT 'pending',
  notes TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (absence_id) REFERENCES absences(id) ON DELETE CASCADE,
  UNIQUE(absence_id)
);

CREATE INDEX IF NOT EXISTS idx_makeups_absence ON makeups(absence_id);
CREATE INDEX IF NOT EXISTS idx_makeups_status ON makeups(status);
CREATE INDEX IF NOT EXISTS idx_makeups_scheduled ON makeups(scheduled_date);
