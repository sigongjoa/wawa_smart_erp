-- ============================================================
-- 079_contracts — 학생×과목 수강계약 (educo /erp/order 구조 대응)
--   grain: 과목당 1행 = educo 주문(oCode) 1건. (한 학생이 국/영/수/과 = 4행)
--   회차(계약 시수)는 여기 session_count, 실제 진행분은 attendance_records에서 집계.
--   결제·수납 이력은 여기 없음 — 별도 결제 신청 페이지 소관.
-- ============================================================

CREATE TABLE IF NOT EXISTS contracts (
  id            TEXT PRIMARY KEY,                      -- "ct-…"
  academy_id    TEXT NOT NULL,
  student_id    TEXT NOT NULL,
  subject       TEXT NOT NULL,                         -- '수학'|'영어'… (enrollments.subject와 동일 표기)
  product_name  TEXT,                                  -- '와와중등B' (educo pName)
  unit_price    INTEGER NOT NULL DEFAULT 0,            -- 시수당 단가 (educo pPrice)
  session_count INTEGER NOT NULL DEFAULT 0,            -- 계약 주당 시수 (educo pCount)
  in_date       TEXT,                                  -- 입회일 'YYYY-MM-DD' (educo inDate)
  out_date      TEXT,                                  -- 퇴회일 (educo outDate, 재원중이면 NULL)
  collect_day   INTEGER,                               -- 매월 수납일 1~31 (educo collectMoneyDay)
  status        TEXT NOT NULL DEFAULT 'active',        -- active|suspended|ended  (educo B|C|E)
  note          TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (academy_id) REFERENCES academies(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  UNIQUE(student_id, subject)
);
CREATE INDEX IF NOT EXISTS idx_contracts_acad ON contracts(academy_id, status);
CREATE INDEX IF NOT EXISTS idx_contracts_student ON contracts(student_id);
