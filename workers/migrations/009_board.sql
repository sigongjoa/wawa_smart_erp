-- =============================================
-- 학원 공지/액션 보드 (Issue #28)
-- =============================================

-- 1) 공지사항
CREATE TABLE IF NOT EXISTS notices (
  id TEXT PRIMARY KEY,
  academy_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT DEFAULT '',
  category TEXT DEFAULT 'general',
  is_pinned INTEGER DEFAULT 0,
  due_date DATE,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (academy_id) REFERENCES academies(id),
  FOREIGN KEY (author_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_notices_academy ON notices(academy_id);
CREATE INDEX IF NOT EXISTS idx_notices_pinned ON notices(is_pinned);
CREATE INDEX IF NOT EXISTS idx_notices_category ON notices(category);
CREATE INDEX IF NOT EXISTS idx_notices_created ON notices(created_at);

-- 2) 공지 읽음 추적
CREATE TABLE IF NOT EXISTS notice_reads (
  id TEXT PRIMARY KEY,
  notice_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  read_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (notice_id) REFERENCES notices(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE(notice_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_notice_reads_notice ON notice_reads(notice_id);
CREATE INDEX IF NOT EXISTS idx_notice_reads_user ON notice_reads(user_id);

-- 3) 액션 아이템
CREATE TABLE IF NOT EXISTS action_items (
  id TEXT PRIMARY KEY,
  academy_id TEXT NOT NULL,
  notice_id TEXT,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  assigned_to TEXT NOT NULL,
  assigned_by TEXT NOT NULL,
  due_date DATE,
  status TEXT DEFAULT 'pending',
  completed_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (academy_id) REFERENCES academies(id),
  FOREIGN KEY (notice_id) REFERENCES notices(id) ON DELETE SET NULL,
  FOREIGN KEY (assigned_to) REFERENCES users(id),
  FOREIGN KEY (assigned_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_actions_academy ON action_items(academy_id);
CREATE INDEX IF NOT EXISTS idx_actions_assigned_to ON action_items(assigned_to);
CREATE INDEX IF NOT EXISTS idx_actions_status ON action_items(status);
CREATE INDEX IF NOT EXISTS idx_actions_due ON action_items(due_date);
