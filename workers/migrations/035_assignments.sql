-- =============================================
-- 035: 과제 회수·첨삭 도메인
-- 선생님이 학생에게 수행평가/시험지/일반과제를 발행하고
-- 학생이 사진을 업로드하면 선생님이 보고 회신하는 양방향 흐름
-- target은 gacha_students (PIN 인증 보유) — 추후 students 통합 가능
-- =============================================

CREATE TABLE IF NOT EXISTS assignments (
  id TEXT PRIMARY KEY,
  academy_id TEXT NOT NULL,
  created_by TEXT NOT NULL,                    -- users.id (teacher/admin)
  title TEXT NOT NULL,
  instructions TEXT,
  kind TEXT NOT NULL DEFAULT 'general',        -- 'perf_eval' | 'exam_paper' | 'general'
  due_at DATETIME,
  attached_file_key TEXT,                      -- R2 key (선생님 첨부; 양식·시험지 등)
  attached_file_name TEXT,
  status TEXT NOT NULL DEFAULT 'published',    -- 'published' | 'closed'
  created_at DATETIME DEFAULT (datetime('now')),
  updated_at DATETIME DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_assignments_academy ON assignments(academy_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_assignments_created_by ON assignments(academy_id, created_by, status);

CREATE TABLE IF NOT EXISTS assignment_targets (
  id TEXT PRIMARY KEY,
  assignment_id TEXT NOT NULL,
  student_id TEXT NOT NULL,                    -- gacha_students.id
  academy_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'assigned',     -- 'assigned'|'submitted'|'reviewed'|'needs_resubmit'|'completed'
  assigned_at DATETIME DEFAULT (datetime('now')),
  last_submitted_at DATETIME,
  last_reviewed_at DATETIME,
  UNIQUE(assignment_id, student_id)
);
CREATE INDEX IF NOT EXISTS idx_assignment_targets_assignment ON assignment_targets(assignment_id);
CREATE INDEX IF NOT EXISTS idx_assignment_targets_student ON assignment_targets(student_id, status);
CREATE INDEX IF NOT EXISTS idx_assignment_targets_inbox ON assignment_targets(academy_id, status, last_submitted_at DESC);

CREATE TABLE IF NOT EXISTS assignment_submissions (
  id TEXT PRIMARY KEY,
  target_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  academy_id TEXT NOT NULL,
  note TEXT,
  files TEXT NOT NULL DEFAULT '[]',            -- JSON: [{key, name, size, mime}]
  submitted_at DATETIME DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_assignment_submissions_target ON assignment_submissions(target_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_assignment_submissions_student ON assignment_submissions(academy_id, student_id, submitted_at DESC);

CREATE TABLE IF NOT EXISTS assignment_responses (
  id TEXT PRIMARY KEY,
  target_id TEXT NOT NULL,
  submission_id TEXT,                          -- nullable: 특정 제출 미연결도 가능
  teacher_id TEXT NOT NULL,                    -- users.id
  academy_id TEXT NOT NULL,
  comment TEXT,
  file_key TEXT,                               -- R2 key (첨삭본 PDF 등; nullable)
  file_name TEXT,
  action TEXT NOT NULL DEFAULT 'accept',       -- 'accept'|'needs_resubmit'
  created_at DATETIME DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_assignment_responses_target ON assignment_responses(target_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_assignment_responses_teacher ON assignment_responses(academy_id, teacher_id, created_at DESC);
