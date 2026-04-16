-- 024: realtime_sessions에 makeup_id 연결 (보강 체크인 추적)
ALTER TABLE realtime_sessions ADD COLUMN makeup_id TEXT;
CREATE INDEX IF NOT EXISTS idx_realtime_sessions_makeup ON realtime_sessions(makeup_id);
CREATE INDEX IF NOT EXISTS idx_makeups_scheduled_date ON makeups(scheduled_date);
