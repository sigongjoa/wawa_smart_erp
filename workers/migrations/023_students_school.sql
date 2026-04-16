-- students 테이블에 학교명 컬럼 추가 (정기고사는 전체 학원 학생 기준)
ALTER TABLE students ADD COLUMN school TEXT;
CREATE INDEX IF NOT EXISTS idx_students_school ON students(school);
