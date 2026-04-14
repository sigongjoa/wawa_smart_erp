-- ============================================
-- 016: 멀티테넌트 지원
-- 다중 센터/선생님이 사용할 수 있도록 확장
-- ============================================

-- 학원 테이블 확장 (가입/플랜 정보)
ALTER TABLE academies ADD COLUMN slug TEXT;
ALTER TABLE academies ADD COLUMN owner_id TEXT;
ALTER TABLE academies ADD COLUMN plan TEXT DEFAULT 'free';
ALTER TABLE academies ADD COLUMN max_students INTEGER DEFAULT 30;
ALTER TABLE academies ADD COLUMN max_teachers INTEGER DEFAULT 3;
ALTER TABLE academies ADD COLUMN is_active INTEGER DEFAULT 1;
ALTER TABLE academies ADD COLUMN logo_url TEXT;
ALTER TABLE academies ADD COLUMN expires_at DATETIME;

-- 기존 학원에 slug 부여
UPDATE academies SET slug = 'wawa', plan = 'pro', max_students = 9999, max_teachers = 9999
WHERE id = 'acad-1';

-- 기존 학원의 owner_id 설정 (첫 번째 admin)
UPDATE academies SET owner_id = (
  SELECT id FROM users WHERE academy_id = 'acad-1' AND role = 'admin' LIMIT 1
) WHERE id = 'acad-1';

-- 인덱스
CREATE UNIQUE INDEX IF NOT EXISTS idx_academies_slug ON academies(slug);
CREATE INDEX IF NOT EXISTS idx_academies_owner_id ON academies(owner_id);

-- 학원 가입 초대 코드
CREATE TABLE IF NOT EXISTS invitations (
  id TEXT PRIMARY KEY,
  academy_id TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  role TEXT DEFAULT 'instructor',
  created_by TEXT NOT NULL,
  used_by TEXT,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (academy_id) REFERENCES academies(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_invitations_code ON invitations(code);
CREATE INDEX IF NOT EXISTS idx_invitations_academy_id ON invitations(academy_id);
