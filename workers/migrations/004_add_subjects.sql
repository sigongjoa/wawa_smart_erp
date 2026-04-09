-- 학생 수강과목 정보 추가
-- Notion 마이그레이션: 학생의 수강과목을 JSON 배열로 저장

-- students 테이블에 subjects 컬럼 추가
ALTER TABLE students ADD COLUMN subjects TEXT DEFAULT '[]';

-- 성적 데이터 테이블 개선 (기존 grades 테이블은 유지)
-- 성적 조회를 위한 뷰 또는 추가 정보는 이 마이그레이션으로 준비됨
CREATE TABLE IF NOT EXISTS student_subjects (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  subject TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  UNIQUE(student_id, subject)
);

CREATE INDEX IF NOT EXISTS idx_student_subjects_student_id ON student_subjects(student_id);
CREATE INDEX IF NOT EXISTS idx_student_subjects_subject ON student_subjects(subject);
