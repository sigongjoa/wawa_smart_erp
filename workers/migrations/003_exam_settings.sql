-- 시험 월 설정 테이블
CREATE TABLE IF NOT EXISTS exam_settings (
  id TEXT PRIMARY KEY,
  academy_id TEXT NOT NULL,
  active_exam_month TEXT NOT NULL,  -- YYYY-MM 형식
  updated_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (academy_id) REFERENCES academies(id),
  UNIQUE(academy_id)
);

CREATE INDEX IF NOT EXISTS idx_exam_settings_academy_id
  ON exam_settings(academy_id);
