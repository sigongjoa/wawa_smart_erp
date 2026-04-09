-- 시험 월 설정 및 활성화 컬럼 추가
ALTER TABLE exams ADD COLUMN exam_month TEXT;  -- YYYY-MM 형식
ALTER TABLE exams ADD COLUMN is_active BOOLEAN DEFAULT 0;
ALTER TABLE exams ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP;

-- exam_month 인덱스
CREATE INDEX IF NOT EXISTS idx_exams_exam_month ON exams(academy_id, exam_month);
CREATE INDEX IF NOT EXISTS idx_exams_is_active ON exams(academy_id, is_active);

-- 성적 테이블에 year_month 컬럼 추가 (성적 입력 월 기록)
ALTER TABLE grades ADD COLUMN year_month TEXT;  -- YYYY-MM 형식

-- year_month 인덱스
CREATE INDEX IF NOT EXISTS idx_grades_year_month ON grades(year_month);

-- 리포트 전송 설정 테이블
CREATE TABLE IF NOT EXISTS report_send_configs (
  id TEXT PRIMARY KEY,
  academy_id TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (academy_id) REFERENCES academies(id),
  UNIQUE(academy_id)
);

CREATE INDEX IF NOT EXISTS idx_report_send_configs_academy_id
  ON report_send_configs(academy_id);
