-- =============================================
-- 증명 그림(SVG) + 기하 자동검증 메타
-- =============================================

CREATE TABLE IF NOT EXISTS proof_figures (
  id TEXT PRIMARY KEY,
  proof_id TEXT NOT NULL,
  phase_id TEXT,
  svg_content TEXT NOT NULL,
  coords_json TEXT NOT NULL,
  verify_meta_json TEXT,
  verify_result_json TEXT,
  highlight_keys TEXT,
  alt_text TEXT NOT NULL,
  review_status TEXT DEFAULT 'pending',
  created_at DATETIME DEFAULT (datetime('now')),
  FOREIGN KEY (proof_id) REFERENCES proofs(id) ON DELETE CASCADE,
  FOREIGN KEY (phase_id) REFERENCES proof_phases(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_proof_figures_proof ON proof_figures(proof_id);
CREATE INDEX IF NOT EXISTS idx_proof_figures_status ON proof_figures(review_status);
