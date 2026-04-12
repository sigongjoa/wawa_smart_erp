-- 010_exam_review_mode.sql
-- 정기고사(중간/기말) 리포트 모드 추가
--
-- 설계 결정:
--   - `reports` 테이블은 현재 쓰기 경로가 없으므로 건드리지 않는다
--     (리포트는 exams + grades 에서 on-the-fly 조합)
--   - `exams` 에 exam_type + term 컬럼을 추가하여 한 테이블로 월말/중간/기말 모두 표현
--   - 정기고사 활성 설정은 `exam_settings` 와 독립적인 `exam_review_settings`
--   - 전송 기록은 기존 `report_sends` (월말 UNIQUE 제약 때문에 year_month 키)와 분리된
--     `exam_review_sends` 테이블에 저장

-- ────────────────────────────────────────────────────────────
-- 1) exams 테이블 확장
-- ────────────────────────────────────────────────────────────
ALTER TABLE exams ADD COLUMN exam_type TEXT NOT NULL DEFAULT 'monthly';
ALTER TABLE exams ADD COLUMN term TEXT;  -- '2026-1' (정기고사일 때만)

CREATE INDEX IF NOT EXISTS idx_exams_type_term
  ON exams(academy_id, exam_type, term);

-- ────────────────────────────────────────────────────────────
-- 2) 활성 정기고사 설정 (학기 + 시험유형)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS exam_review_settings (
  id TEXT PRIMARY KEY,
  academy_id TEXT NOT NULL,
  active_term TEXT NOT NULL,          -- '2026-1'
  active_exam_type TEXT NOT NULL,     -- 'midterm' | 'final'
  updated_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (academy_id) REFERENCES academies(id),
  UNIQUE(academy_id)
);

CREATE INDEX IF NOT EXISTS idx_exam_review_settings_academy
  ON exam_review_settings(academy_id);

-- ────────────────────────────────────────────────────────────
-- 3) 정기고사 리포트 전송 기록
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS exam_review_sends (
  id TEXT PRIMARY KEY,
  academy_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  term TEXT NOT NULL,
  exam_type TEXT NOT NULL,
  share_url TEXT NOT NULL,
  image_path TEXT NOT NULL,
  sent_by TEXT NOT NULL,
  sent_at TEXT NOT NULL,
  UNIQUE(academy_id, student_id, term, exam_type)
);

CREATE INDEX IF NOT EXISTS idx_exam_review_sends_lookup
  ON exam_review_sends(academy_id, term, exam_type);
