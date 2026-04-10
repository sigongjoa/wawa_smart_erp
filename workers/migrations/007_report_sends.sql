-- 리포트 전송 기록 테이블
-- 학생별/월별 전송 여부 및 공유 URL 관리
CREATE TABLE IF NOT EXISTS report_sends (
  id TEXT PRIMARY KEY,
  academy_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  year_month TEXT NOT NULL,
  share_url TEXT NOT NULL,
  image_path TEXT NOT NULL,
  sent_by TEXT NOT NULL,
  sent_at TEXT NOT NULL,
  UNIQUE(academy_id, student_id, year_month)
);

CREATE INDEX IF NOT EXISTS idx_report_sends_month
  ON report_sends(academy_id, year_month);
