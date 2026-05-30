-- Migration 072: proof_*, med_*, assignment_targets, vocab_grammar_qa, vocab_print_jobs FK rebind
-- gacha_students(id) → students(id)
-- 9개 테이블 모두 recreate (대부분 비어있고 총 70행)

-- ============================================================
-- proof_results
-- ============================================================
CREATE TABLE proof_results_new (
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
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (proof_id) REFERENCES proofs(id) ON DELETE CASCADE
  -- session_id FK는 gacha_sessions가 Phase 5에서 DROP되므로 FK 제거
);
INSERT INTO proof_results_new (id, student_id, proof_id, session_id, mode, score, time_spent, detail_json, box, attempted_at)
SELECT pr.id, COALESCE(m.student_id, pr.student_id), pr.proof_id, pr.session_id, pr.mode, pr.score, pr.time_spent, pr.detail_json, pr.box, pr.attempted_at
FROM proof_results pr LEFT JOIN _gacha_student_map m ON m.gacha_id = pr.student_id;
DROP TABLE proof_results;
ALTER TABLE proof_results_new RENAME TO proof_results;
CREATE INDEX idx_proof_results_student ON proof_results(student_id);
CREATE INDEX idx_proof_results_proof ON proof_results(proof_id);

-- ============================================================
-- proof_assignments
-- ============================================================
CREATE TABLE proof_assignments_new (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  proof_id TEXT NOT NULL,
  assigned_by TEXT NOT NULL,
  assigned_at DATETIME DEFAULT (datetime('now')),
  UNIQUE(student_id, proof_id),
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (proof_id) REFERENCES proofs(id) ON DELETE CASCADE
);
INSERT INTO proof_assignments_new (id, student_id, proof_id, assigned_by, assigned_at)
SELECT pa.id, COALESCE(m.student_id, pa.student_id), pa.proof_id, pa.assigned_by, pa.assigned_at
FROM proof_assignments pa LEFT JOIN _gacha_student_map m ON m.gacha_id = pa.student_id;
DROP TABLE proof_assignments;
ALTER TABLE proof_assignments_new RENAME TO proof_assignments;
CREATE INDEX idx_proof_assignments_student ON proof_assignments(student_id);

-- ============================================================
-- proof_phase_results
-- ============================================================
CREATE TABLE proof_phase_results_new (
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
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (proof_id) REFERENCES proofs(id) ON DELETE CASCADE
);
INSERT INTO proof_phase_results_new (id, student_id, proof_id, phase_no, session_id, submitted_json, verify_status, score, issues_json, time_spent, attempted_at)
SELECT p.id, COALESCE(m.student_id, p.student_id), p.proof_id, p.phase_no, p.session_id, p.submitted_json, p.verify_status, p.score, p.issues_json, p.time_spent, p.attempted_at
FROM proof_phase_results p LEFT JOIN _gacha_student_map m ON m.gacha_id = p.student_id;
DROP TABLE proof_phase_results;
ALTER TABLE proof_phase_results_new RENAME TO proof_phase_results;
CREATE INDEX idx_proof_phase_results_student ON proof_phase_results(student_id);
CREATE INDEX idx_proof_phase_results_proof ON proof_phase_results(proof_id);

-- ============================================================
-- med_student_chapters
-- ============================================================
CREATE TABLE med_student_chapters_new (
  id           TEXT PRIMARY KEY,
  academy_id   TEXT NOT NULL,
  student_id   TEXT NOT NULL,
  chapter_id   TEXT NOT NULL,
  modes_json   TEXT NOT NULL DEFAULT '["meaning"]',
  status       TEXT NOT NULL DEFAULT 'active',
  assigned_by  TEXT,
  assigned_at  DATETIME DEFAULT (datetime('now')),
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (chapter_id) REFERENCES med_chapters(id) ON DELETE CASCADE
);
INSERT INTO med_student_chapters_new (id, academy_id, student_id, chapter_id, modes_json, status, assigned_by, assigned_at)
SELECT msc.id, msc.academy_id, COALESCE(m.student_id, msc.student_id), msc.chapter_id, msc.modes_json, msc.status, msc.assigned_by, msc.assigned_at
FROM med_student_chapters msc LEFT JOIN _gacha_student_map m ON m.gacha_id = msc.student_id;
DROP TABLE med_student_chapters;
ALTER TABLE med_student_chapters_new RENAME TO med_student_chapters;
CREATE INDEX idx_med_stud_chap_acad ON med_student_chapters(academy_id, student_id, status);
CREATE UNIQUE INDEX uq_med_stud_chap ON med_student_chapters(academy_id, student_id, chapter_id);

-- ============================================================
-- med_student_terms
-- ============================================================
CREATE TABLE med_student_terms_new (
  id              TEXT PRIMARY KEY,
  academy_id      TEXT NOT NULL,
  student_id      TEXT NOT NULL,
  term_id         TEXT NOT NULL,
  study_mode      TEXT NOT NULL DEFAULT 'meaning',
  box             INTEGER NOT NULL DEFAULT 1,
  review_count    INTEGER NOT NULL DEFAULT 0,
  wrong_count     INTEGER NOT NULL DEFAULT 0,
  last_reviewed   DATETIME,
  next_review     DATETIME DEFAULT (datetime('now')),
  created_at      DATETIME DEFAULT (datetime('now')),
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (term_id) REFERENCES med_terms(id) ON DELETE CASCADE
);
INSERT INTO med_student_terms_new (id, academy_id, student_id, term_id, study_mode, box, review_count, wrong_count, last_reviewed, next_review, created_at)
SELECT mst.id, mst.academy_id, COALESCE(m.student_id, mst.student_id), mst.term_id, mst.study_mode, mst.box, mst.review_count, mst.wrong_count, mst.last_reviewed, mst.next_review, mst.created_at
FROM med_student_terms mst LEFT JOIN _gacha_student_map m ON m.gacha_id = mst.student_id;
DROP TABLE med_student_terms;
ALTER TABLE med_student_terms_new RENAME TO med_student_terms;
CREATE INDEX idx_med_stud_terms_due ON med_student_terms(academy_id, student_id, next_review);
CREATE INDEX idx_med_stud_terms_box ON med_student_terms(academy_id, student_id, box);
CREATE UNIQUE INDEX uq_med_stud_term_mode ON med_student_terms(student_id, term_id, study_mode);

-- ============================================================
-- med_exam_attempts
-- ============================================================
CREATE TABLE med_exam_attempts_new (
  id            TEXT PRIMARY KEY,
  academy_id    TEXT NOT NULL,
  student_id    TEXT NOT NULL,
  chapter_id    TEXT NOT NULL,
  item_ids_json TEXT NOT NULL,
  pdf_r2_key    TEXT,
  status        TEXT NOT NULL DEFAULT 'created',
  score         INTEGER,
  total         INTEGER,
  correct_cnt   INTEGER,
  created_at    DATETIME DEFAULT (datetime('now')),
  submitted_at  DATETIME,
  graded_at     DATETIME,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (chapter_id) REFERENCES med_chapters(id) ON DELETE CASCADE
);
INSERT INTO med_exam_attempts_new (id, academy_id, student_id, chapter_id, item_ids_json, pdf_r2_key, status, score, total, correct_cnt, created_at, submitted_at, graded_at)
SELECT mea.id, mea.academy_id, COALESCE(m.student_id, mea.student_id), mea.chapter_id, mea.item_ids_json, mea.pdf_r2_key, mea.status, mea.score, mea.total, mea.correct_cnt, mea.created_at, mea.submitted_at, mea.graded_at
FROM med_exam_attempts mea LEFT JOIN _gacha_student_map m ON m.gacha_id = mea.student_id;
DROP TABLE med_exam_attempts;
ALTER TABLE med_exam_attempts_new RENAME TO med_exam_attempts;
CREATE INDEX idx_med_exam_att_acad ON med_exam_attempts(academy_id, student_id, status);

-- ============================================================
-- assignment_targets (FK 명시 없었지만 코멘트에 gacha_students.id 명시 → students로 명시화)
-- ============================================================
CREATE TABLE assignment_targets_new (
  id TEXT PRIMARY KEY,
  assignment_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  academy_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'assigned',
  assigned_at DATETIME DEFAULT (datetime('now')),
  last_submitted_at DATETIME,
  last_reviewed_at DATETIME,
  UNIQUE(assignment_id, student_id),
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);
INSERT INTO assignment_targets_new (id, assignment_id, student_id, academy_id, status, assigned_at, last_submitted_at, last_reviewed_at)
SELECT at.id, at.assignment_id, COALESCE(m.student_id, at.student_id), at.academy_id, at.status, at.assigned_at, at.last_submitted_at, at.last_reviewed_at
FROM assignment_targets at LEFT JOIN _gacha_student_map m ON m.gacha_id = at.student_id;
DROP TABLE assignment_targets;
ALTER TABLE assignment_targets_new RENAME TO assignment_targets;
CREATE INDEX idx_assignment_targets_assignment ON assignment_targets(assignment_id);
CREATE INDEX idx_assignment_targets_student ON assignment_targets(student_id, status);
CREATE INDEX idx_assignment_targets_inbox ON assignment_targets(academy_id, status, last_submitted_at DESC);

-- ============================================================
-- vocab_grammar_qa (student_id NULLABLE, ON DELETE SET NULL)
-- ============================================================
CREATE TABLE vocab_grammar_qa_new (
  id TEXT PRIMARY KEY,
  academy_id TEXT NOT NULL,
  student_id TEXT,
  question TEXT NOT NULL,
  answer TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  answered_by TEXT,
  include_in_print INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT (datetime('now')),
  answered_at DATETIME,
  student_name TEXT,
  grade INTEGER,
  exam_problem TEXT,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL
);
INSERT INTO vocab_grammar_qa_new (id, academy_id, student_id, question, answer, status, answered_by, include_in_print, created_at, answered_at, student_name, grade, exam_problem)
SELECT vg.id, vg.academy_id, COALESCE(m.student_id, vg.student_id), vg.question, vg.answer, vg.status, vg.answered_by, vg.include_in_print, vg.created_at, vg.answered_at, vg.student_name, vg.grade, vg.exam_problem
FROM vocab_grammar_qa vg LEFT JOIN _gacha_student_map m ON m.gacha_id = vg.student_id;
DROP TABLE vocab_grammar_qa;
ALTER TABLE vocab_grammar_qa_new RENAME TO vocab_grammar_qa;
CREATE INDEX idx_vocab_grammar_academy ON vocab_grammar_qa(academy_id, status);

-- ============================================================
-- vocab_print_jobs
-- ============================================================
CREATE TABLE vocab_print_jobs_new (
  id TEXT PRIMARY KEY,
  academy_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  word_ids_json TEXT NOT NULL,
  grammar_ids_json TEXT,
  pdf_r2_key TEXT,
  created_by TEXT,
  created_at DATETIME DEFAULT (datetime('now')),
  status TEXT DEFAULT 'pending',
  started_at TEXT,
  submitted_at TEXT,
  auto_correct INTEGER,
  auto_total INTEGER,
  policy_id TEXT,
  has_writing INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'mywords',
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);
INSERT INTO vocab_print_jobs_new (id, academy_id, student_id, word_ids_json, grammar_ids_json, pdf_r2_key, created_by, created_at, status, started_at, submitted_at, auto_correct, auto_total, policy_id, has_writing, source)
SELECT vpj.id, vpj.academy_id, COALESCE(m.student_id, vpj.student_id), vpj.word_ids_json, vpj.grammar_ids_json, vpj.pdf_r2_key, vpj.created_by, vpj.created_at, COALESCE(vpj.status,'pending'), vpj.started_at, vpj.submitted_at, vpj.auto_correct, vpj.auto_total, vpj.policy_id, vpj.has_writing, vpj.source
FROM vocab_print_jobs vpj LEFT JOIN _gacha_student_map m ON m.gacha_id = vpj.student_id;
DROP TABLE vocab_print_jobs;
ALTER TABLE vocab_print_jobs_new RENAME TO vocab_print_jobs;
CREATE INDEX idx_vocab_print_student ON vocab_print_jobs(student_id, created_at);
CREATE INDEX idx_vocab_print_status_student ON vocab_print_jobs(student_id, status, created_at);
CREATE INDEX idx_print_jobs_student_status ON vocab_print_jobs(student_id, academy_id, status);
