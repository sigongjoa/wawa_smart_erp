-- 학습자료 아카이브 (교재 제작/배포/열람 이력)
-- 목적: 강사/관리자가 제작한 교재를 아카이빙하고 학생/학부모에게 배포·열람하도록 함
-- 범위: material_archives (교재 메타) / archive_files (첨부 파일, 역할별)
--       archive_distributions (배포 대상: student|class|academy) / archive_access_log

CREATE TABLE IF NOT EXISTS material_archives (
  id TEXT PRIMARY KEY,
  academy_id TEXT NOT NULL,
  title TEXT NOT NULL,
  subject TEXT,                        -- '수학' | '영어' | ...
  grade TEXT,                          -- '중2' | '고1' | ...
  topic TEXT,                          -- '이차함수' | '관계대명사' | ...
  purpose TEXT NOT NULL,               -- '중간고사 대비' | '오답 보강' | '심화' | ...
  description TEXT,
  tags TEXT,                           -- JSON array (예: ["시험대비","2026-1"])
  created_by TEXT NOT NULL,            -- users.id
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  archived_at TEXT,                    -- NULL이면 활성, 값이 있으면 숨김
  FOREIGN KEY (academy_id) REFERENCES academies(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_marchives_academy ON material_archives(academy_id, archived_at);
CREATE INDEX IF NOT EXISTS idx_marchives_subject ON material_archives(academy_id, subject, grade);
CREATE INDEX IF NOT EXISTS idx_marchives_created ON material_archives(academy_id, created_at DESC);

CREATE TABLE IF NOT EXISTS archive_files (
  id TEXT PRIMARY KEY,
  archive_id TEXT NOT NULL,
  r2_key TEXT NOT NULL,                -- R2 저장 key
  file_name TEXT NOT NULL,             -- 원본 파일명
  file_role TEXT NOT NULL,             -- 'main' | 'answer' | 'solution' | 'extra'
  mime_type TEXT,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 1,
  uploaded_by TEXT NOT NULL,
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (archive_id) REFERENCES material_archives(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_afiles_archive ON archive_files(archive_id);

CREATE TABLE IF NOT EXISTS archive_distributions (
  id TEXT PRIMARY KEY,
  archive_id TEXT NOT NULL,
  academy_id TEXT NOT NULL,            -- denormalized for tenancy filter
  scope TEXT NOT NULL,                 -- 'student' | 'class' | 'academy'
  scope_id TEXT,                       -- studentId / classId / NULL(academy)
  can_download INTEGER NOT NULL DEFAULT 1,
  distributed_by TEXT NOT NULL,
  distributed_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT,                     -- NULL = 무기한
  FOREIGN KEY (archive_id) REFERENCES material_archives(id) ON DELETE CASCADE,
  FOREIGN KEY (academy_id) REFERENCES academies(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_adist_archive ON archive_distributions(archive_id);
CREATE INDEX IF NOT EXISTS idx_adist_lookup ON archive_distributions(academy_id, scope, scope_id);

CREATE TABLE IF NOT EXISTS archive_access_log (
  id TEXT PRIMARY KEY,
  archive_id TEXT NOT NULL,
  file_id TEXT,                        -- NULL = 목록 열람
  accessor_type TEXT NOT NULL,         -- 'student' | 'parent' | 'staff'
  accessor_id TEXT,                    -- studentId / userId / parent token hash
  action TEXT NOT NULL,                -- 'view' | 'download'
  accessed_at TEXT NOT NULL DEFAULT (datetime('now')),
  ip_hash TEXT,
  FOREIGN KEY (archive_id) REFERENCES material_archives(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_alog_archive ON archive_access_log(archive_id, accessed_at DESC);
