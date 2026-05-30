-- Migration 069: gacha_students → students 통합 준비
-- students 테이블에 PIN 로그인 + 강사 매핑 컬럼 추가
-- pin_salt는 NOT NULL DEFAULT '' (NULL 사용 시 prod 500 회귀 — d1 메모리 [gacha_students.pin_salt NOT NULL] 참조)
-- UNIQUE(academy_id, name) 제약은 추가하지 않음 (현재 5쌍 중복 잔존, 머지 후 별도 정리)

ALTER TABLE students ADD COLUMN pin_hash TEXT;
ALTER TABLE students ADD COLUMN pin_salt TEXT NOT NULL DEFAULT '';
ALTER TABLE students ADD COLUMN teacher_id TEXT;

CREATE INDEX IF NOT EXISTS idx_students_pin_lookup ON students(academy_id, name);
CREATE INDEX IF NOT EXISTS idx_students_teacher ON students(teacher_id);
