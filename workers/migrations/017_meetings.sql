-- 회의 녹음 및 AI 요약
CREATE TABLE IF NOT EXISTS meetings (
  id TEXT PRIMARY KEY,
  academy_id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '회의',
  audio_url TEXT,
  transcript TEXT,
  summary TEXT,
  key_decisions TEXT,        -- JSON array
  status TEXT NOT NULL DEFAULT 'recording',  -- recording | transcribing | summarizing | done | error
  error_message TEXT,
  duration_seconds INTEGER,
  participants TEXT,          -- JSON array of names
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (academy_id) REFERENCES academies(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- 회의에서 추출된 액션 아이템
CREATE TABLE IF NOT EXISTS meeting_actions (
  id TEXT PRIMARY KEY,
  meeting_id TEXT NOT NULL,
  title TEXT NOT NULL,
  assignee_name TEXT,
  due_date TEXT,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending | done
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_meetings_academy ON meetings(academy_id);
CREATE INDEX IF NOT EXISTS idx_meetings_created_at ON meetings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_meeting_actions_meeting ON meeting_actions(meeting_id);
