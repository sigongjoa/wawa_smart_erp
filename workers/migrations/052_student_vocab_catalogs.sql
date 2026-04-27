-- =============================================
-- 학생-카탈로그 매핑 (가시성/권한 게이팅)
-- csat-megastudy-2025 는 레거시 기본 → 매핑 없이 모두에게 노출 (기존 동작 유지)
-- 신규 카탈로그(medical-* 등)는 명시 배정된 학생에게만 노출
-- =============================================

CREATE TABLE IF NOT EXISTS student_vocab_catalogs (
  student_id  TEXT NOT NULL,
  catalog_id  TEXT NOT NULL,
  assigned_at DATETIME DEFAULT (datetime('now')),
  PRIMARY KEY (student_id, catalog_id),
  FOREIGN KEY (catalog_id) REFERENCES vocab_catalogs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_svc_student ON student_vocab_catalogs(student_id);
CREATE INDEX IF NOT EXISTS idx_svc_catalog ON student_vocab_catalogs(catalog_id);
