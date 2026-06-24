-- flywheel 단독 워커용 부모 테이블 스키마만 (데이터 0). prod/test 공통.
-- 적용 순서: 이 파일 → 076 → 077. (prod엔 더미 시드 절대 적용 안 함)
CREATE TABLE IF NOT EXISTS academies (id TEXT PRIMARY KEY, name TEXT);
CREATE TABLE IF NOT EXISTS students (id TEXT PRIMARY KEY, academy_id TEXT,
  FOREIGN KEY (academy_id) REFERENCES academies(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY);
