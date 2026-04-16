-- 028: 분할 보강 (1 보강 → N 회차)
-- 기존 makeups는 총량 컨테이너, makeup_sessions가 개별 회차

-- 1) makeups 확장: 필요/누적 시간
ALTER TABLE makeups ADD COLUMN required_minutes INTEGER DEFAULT 0;
ALTER TABLE makeups ADD COLUMN completed_minutes INTEGER DEFAULT 0;

-- 2) 회차 테이블 신규
CREATE TABLE IF NOT EXISTS makeup_sessions (
  id TEXT PRIMARY KEY,
  makeup_id TEXT NOT NULL,
  session_index INTEGER NOT NULL,
  scheduled_date DATE NOT NULL,
  scheduled_start_time TEXT NOT NULL,
  scheduled_end_time TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL,
  status TEXT DEFAULT 'scheduled',
  completed_at TEXT,
  notes TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (makeup_id) REFERENCES makeups(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_makeup_sessions_makeup ON makeup_sessions(makeup_id);
CREATE INDEX IF NOT EXISTS idx_makeup_sessions_date ON makeup_sessions(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_makeup_sessions_status ON makeup_sessions(status);
-- session_index 경합 방지 (같은 makeup 내에서 중복 금지)
CREATE UNIQUE INDEX IF NOT EXISTS idx_makeup_sessions_makeup_idx
  ON makeup_sessions(makeup_id, session_index);

-- 3) 기존 단일 보강을 session 1건으로 백필
INSERT INTO makeup_sessions (id, makeup_id, session_index, scheduled_date,
                              scheduled_start_time, scheduled_end_time,
                              duration_minutes, status, completed_at, notes)
SELECT
  'msess_' || substr(hex(randomblob(8)), 1, 16),
  id,
  1,
  scheduled_date,
  COALESCE(scheduled_start_time, '00:00'),
  COALESCE(scheduled_end_time, '01:00'),
  60,
  CASE WHEN status = 'completed' THEN 'completed' ELSE 'scheduled' END,
  CASE WHEN status = 'completed' AND completed_date IS NOT NULL
       THEN completed_date || ' 00:00:00' ELSE NULL END,
  COALESCE(notes, '')
FROM makeups
WHERE scheduled_date IS NOT NULL;

-- 4) 기본 필요시간 60분 / 완료된 건은 60분 누적
UPDATE makeups SET required_minutes = 60 WHERE required_minutes = 0;
UPDATE makeups SET completed_minutes = 60 WHERE status = 'completed';

-- 5) 타이머 → 세션 연결
ALTER TABLE realtime_sessions ADD COLUMN makeup_session_id TEXT;
CREATE INDEX IF NOT EXISTS idx_realtime_sessions_makeup_session
  ON realtime_sessions(makeup_session_id);
