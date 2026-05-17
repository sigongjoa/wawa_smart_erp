-- =============================================
-- 034: users status/subjects/last_login_at 컬럼 추가
-- AcademyPage에서 선생님 CRUD를 지원하기 위함
-- =============================================

ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active';
ALTER TABLE users ADD COLUMN subjects TEXT;           -- JSON array: ["수학","물리"]
ALTER TABLE users ADD COLUMN last_login_at DATETIME;

-- 기존 유저는 전부 active 처리 (NULL 방어)
UPDATE users SET status = 'active' WHERE status IS NULL;

CREATE INDEX IF NOT EXISTS idx_users_status ON users(academy_id, status);
