-- =============================================
-- 증명 워크북 3-Phase 구조 확장
-- proof-workbook (.typ) → D1 임포트용 스키마
-- =============================================

ALTER TABLE proofs ADD COLUMN theorem_statement TEXT;
ALTER TABLE proofs ADD COLUMN subject TEXT;
ALTER TABLE proofs ADD COLUMN source_path TEXT;

-- GIVEN 박스 (전제/정의/선행정리)
CREATE TABLE IF NOT EXISTS proof_givens (
  id TEXT PRIMARY KEY,
  proof_id TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'definition',
  label TEXT,
  content TEXT NOT NULL,
  order_idx INTEGER DEFAULT 0,
  FOREIGN KEY (proof_id) REFERENCES proofs(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_proof_givens_proof ON proof_givens(proof_id);

-- Phase 컨테이너 (1=순서, 2=빈칸, 3=백지)
CREATE TABLE IF NOT EXISTS proof_phases (
  id TEXT PRIMARY KEY,
  proof_id TEXT NOT NULL,
  phase_no INTEGER NOT NULL,
  phase_type TEXT NOT NULL,
  prompt TEXT NOT NULL,
  model_answer TEXT,
  UNIQUE(proof_id, phase_no),
  FOREIGN KEY (proof_id) REFERENCES proofs(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_proof_phases_proof ON proof_phases(proof_id);

-- Phase별 아이템 (step-card / blank / check)
CREATE TABLE IF NOT EXISTS proof_phase_items (
  id TEXT PRIMARY KEY,
  phase_id TEXT NOT NULL,
  item_key TEXT NOT NULL,
  content TEXT NOT NULL,
  correct_answer TEXT,
  meta_json TEXT,
  order_idx INTEGER DEFAULT 0,
  FOREIGN KEY (phase_id) REFERENCES proof_phases(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_proof_phase_items_phase ON proof_phase_items(phase_id);

-- Phase별 학생 결과
CREATE TABLE IF NOT EXISTS proof_phase_results (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  proof_id TEXT NOT NULL,
  phase_no INTEGER NOT NULL,
  session_id TEXT,
  submitted_json TEXT NOT NULL,
  verify_status TEXT,
  score INTEGER,
  issues_json TEXT,
  time_spent INTEGER,
  attempted_at DATETIME DEFAULT (datetime('now')),
  FOREIGN KEY (student_id) REFERENCES gacha_students(id) ON DELETE CASCADE,
  FOREIGN KEY (proof_id) REFERENCES proofs(id) ON DELETE CASCADE,
  FOREIGN KEY (session_id) REFERENCES gacha_sessions(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_proof_phase_results_student ON proof_phase_results(student_id);
CREATE INDEX IF NOT EXISTS idx_proof_phase_results_proof ON proof_phase_results(proof_id);
