-- 학생 학교명 컬럼 추가
ALTER TABLE gacha_students ADD COLUMN school TEXT;
CREATE INDEX IF NOT EXISTS idx_gacha_students_school ON gacha_students(school);
