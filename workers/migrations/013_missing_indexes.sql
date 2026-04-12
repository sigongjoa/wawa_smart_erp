-- Migration 013: Add missing indexes on foreign key columns used in JOINs/WHERE.
-- Eliminates full-table scans on high-query columns.

-- grades: exam lookup + student lookup
CREATE INDEX IF NOT EXISTS idx_grades_exam ON grades(exam_id);
CREATE INDEX IF NOT EXISTS idx_grades_student ON grades(student_id);

-- students: academy + status filter (compound)
CREATE INDEX IF NOT EXISTS idx_students_academy_status ON students(academy_id, status);
CREATE INDEX IF NOT EXISTS idx_students_class ON students(class_id);

-- absences: student + date range queries
CREATE INDEX IF NOT EXISTS idx_absences_student_date ON absences(student_id, absence_date);

-- messages: sender/recipient lookups
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages(recipient_id);

-- notice_reads: EXISTS subquery in board-handler
CREATE INDEX IF NOT EXISTS idx_notice_reads_user ON notice_reads(user_id);
CREATE INDEX IF NOT EXISTS idx_notice_reads_notice ON notice_reads(notice_id);

-- classes: instructor filter
CREATE INDEX IF NOT EXISTS idx_classes_instructor ON classes(instructor_id);

-- sessions: user_id for cleanup/lookup
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
