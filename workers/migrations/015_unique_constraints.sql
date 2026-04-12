-- 학생-교사 중복 할당 방지 + 누락 인덱스 추가
CREATE UNIQUE INDEX IF NOT EXISTS idx_student_teachers_unique ON student_teachers(student_id, teacher_id);
CREATE INDEX IF NOT EXISTS idx_grades_student_exam ON grades(student_id, exam_id);
CREATE INDEX IF NOT EXISTS idx_attendance_student_date ON attendance(student_id, date);
