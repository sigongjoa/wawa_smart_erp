-- 스트레스 HTTP 트랙 전용 최소 부트스트랩 (로컬 D1). 전체 001~075 체인 우회.
-- /api/signal 워커키 경로만 띄우면 되므로 인증/유저 테이블 불필요 — 부모표 3개 + 시드.
-- 적용 순서: 이 파일 → 076 → 077.
CREATE TABLE IF NOT EXISTS academies (id TEXT PRIMARY KEY, name TEXT);
CREATE TABLE IF NOT EXISTS students (id TEXT PRIMARY KEY, academy_id TEXT,
  FOREIGN KEY (academy_id) REFERENCES academies(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY);

INSERT OR IGNORE INTO academies (id, name) VALUES ('ac-stress', '부하학원');
INSERT OR IGNORE INTO students (id, academy_id) VALUES ('st-stress', 'ac-stress');
