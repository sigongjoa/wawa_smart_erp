-- =============================================
-- Concept Gacha + 증명 연습 통합
-- 학원 → 선생님 → 학생 계층 구조
-- =============================================

-- 가차 학생 (PIN 로그인, 선생님별 소속)
CREATE TABLE IF NOT EXISTS gacha_students (
  id TEXT PRIMARY KEY,
  academy_id TEXT NOT NULL,
  teacher_id TEXT NOT NULL,
  name TEXT NOT NULL,
  pin_hash TEXT NOT NULL,
  pin_salt TEXT NOT NULL,
  grade TEXT,
  status TEXT DEFAULT 'active',
  created_at DATETIME DEFAULT (datetime('now')),
  updated_at DATETIME,
  UNIQUE(academy_id, teacher_id, name)
);
CREATE INDEX IF NOT EXISTS idx_gacha_students_academy ON gacha_students(academy_id);
CREATE INDEX IF NOT EXISTS idx_gacha_students_teacher ON gacha_students(academy_id, teacher_id);

-- 가차 카드
CREATE TABLE IF NOT EXISTS gacha_cards (
  id TEXT PRIMARY KEY,
  academy_id TEXT NOT NULL,
  teacher_id TEXT NOT NULL,
  student_id TEXT,
  type TEXT NOT NULL DEFAULT 'text',
  question TEXT,
  question_image TEXT,
  answer TEXT NOT NULL,
  topic TEXT,
  chapter TEXT,
  grade TEXT,
  box INTEGER DEFAULT 1,
  success_count INTEGER DEFAULT 0,
  fail_count INTEGER DEFAULT 0,
  last_review DATETIME,
  created_at DATETIME DEFAULT (datetime('now')),
  FOREIGN KEY (student_id) REFERENCES gacha_students(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_gacha_cards_student ON gacha_cards(student_id);
CREATE INDEX IF NOT EXISTS idx_gacha_cards_teacher ON gacha_cards(academy_id, teacher_id);
CREATE INDEX IF NOT EXISTS idx_gacha_cards_box ON gacha_cards(student_id, box);

-- 증명
CREATE TABLE IF NOT EXISTS proofs (
  id TEXT PRIMARY KEY,
  academy_id TEXT NOT NULL,
  created_by TEXT NOT NULL,
  title TEXT NOT NULL,
  grade TEXT NOT NULL,
  chapter TEXT,
  difficulty INTEGER DEFAULT 1,
  description TEXT,
  description_image TEXT,
  is_shared INTEGER DEFAULT 0,
  share_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT (datetime('now')),
  updated_at DATETIME
);
CREATE INDEX IF NOT EXISTS idx_proofs_academy ON proofs(academy_id);
CREATE INDEX IF NOT EXISTS idx_proofs_creator ON proofs(academy_id, created_by);
CREATE INDEX IF NOT EXISTS idx_proofs_shared ON proofs(is_shared) WHERE is_shared = 1;

-- 증명 단계
CREATE TABLE IF NOT EXISTS proof_steps (
  id TEXT PRIMARY KEY,
  proof_id TEXT NOT NULL,
  step_order INTEGER NOT NULL,
  content TEXT NOT NULL,
  content_image TEXT,
  blanks_json TEXT,
  hint TEXT,
  FOREIGN KEY (proof_id) REFERENCES proofs(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_proof_steps_proof ON proof_steps(proof_id);

-- 증명 공유 기록
CREATE TABLE IF NOT EXISTS proof_shares (
  id TEXT PRIMARY KEY,
  original_proof_id TEXT NOT NULL,
  shared_by TEXT NOT NULL,
  copied_by TEXT,
  copied_academy_id TEXT,
  copied_proof_id TEXT,
  copied_at DATETIME,
  FOREIGN KEY (original_proof_id) REFERENCES proofs(id)
);
CREATE INDEX IF NOT EXISTS idx_proof_shares_original ON proof_shares(original_proof_id);

-- 학습 세션 (가차 + 증명 통합)
CREATE TABLE IF NOT EXISTS gacha_sessions (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  session_date TEXT NOT NULL,
  cards_drawn INTEGER DEFAULT 0,
  cards_target INTEGER DEFAULT 10,
  proofs_done INTEGER DEFAULT 0,
  proofs_target INTEGER DEFAULT 5,
  started_at DATETIME DEFAULT (datetime('now')),
  completed_at DATETIME,
  UNIQUE(student_id, session_date),
  FOREIGN KEY (student_id) REFERENCES gacha_students(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_gacha_sessions_student ON gacha_sessions(student_id);

-- 카드 학습 결과
CREATE TABLE IF NOT EXISTS gacha_card_results (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  card_id TEXT NOT NULL,
  session_id TEXT,
  result TEXT NOT NULL,
  box_before INTEGER,
  box_after INTEGER,
  reviewed_at DATETIME DEFAULT (datetime('now')),
  FOREIGN KEY (student_id) REFERENCES gacha_students(id) ON DELETE CASCADE,
  FOREIGN KEY (card_id) REFERENCES gacha_cards(id) ON DELETE CASCADE,
  FOREIGN KEY (session_id) REFERENCES gacha_sessions(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_gacha_card_results_student ON gacha_card_results(student_id);

-- 증명 학습 결과
CREATE TABLE IF NOT EXISTS proof_results (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  proof_id TEXT NOT NULL,
  session_id TEXT,
  mode TEXT NOT NULL,
  score INTEGER,
  time_spent INTEGER,
  detail_json TEXT,
  box INTEGER DEFAULT 1,
  attempted_at DATETIME DEFAULT (datetime('now')),
  FOREIGN KEY (student_id) REFERENCES gacha_students(id) ON DELETE CASCADE,
  FOREIGN KEY (proof_id) REFERENCES proofs(id) ON DELETE CASCADE,
  FOREIGN KEY (session_id) REFERENCES gacha_sessions(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_proof_results_student ON proof_results(student_id);
CREATE INDEX IF NOT EXISTS idx_proof_results_proof ON proof_results(proof_id);

-- 학생별 증명 배정 (어떤 증명을 어떤 학생에게 배정했는지)
CREATE TABLE IF NOT EXISTS proof_assignments (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  proof_id TEXT NOT NULL,
  assigned_by TEXT NOT NULL,
  assigned_at DATETIME DEFAULT (datetime('now')),
  UNIQUE(student_id, proof_id),
  FOREIGN KEY (student_id) REFERENCES gacha_students(id) ON DELETE CASCADE,
  FOREIGN KEY (proof_id) REFERENCES proofs(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_proof_assignments_student ON proof_assignments(student_id);
