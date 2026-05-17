-- =============================================
-- 033: exam_attempts — 시험 결시 학생 개별 타이머 시스템
-- 설계 문서: docs/EXAM_MAKEUP_TIMER_DESIGN.md §2.1
-- 학생은 정규 수업 입실(realtime_session) 중에 시험 응시 → 별도 lifecycle 보유
-- =============================================

CREATE TABLE IF NOT EXISTS exam_attempts (
  id TEXT PRIMARY KEY,
  exam_assignment_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  academy_id TEXT NOT NULL,
  realtime_session_id TEXT,                    -- 어떤 수업 입실 중에 친 시험인지 (회고 분석용)

  duration_minutes INTEGER NOT NULL,           -- 이 시험의 총 제한시간 (분)

  status TEXT NOT NULL DEFAULT 'ready',
    -- ready    : 배정만 됨, 미시작
    -- running  : 진행 중
    -- paused   : 일시정지
    -- submitted: 학생 제출
    -- expired  : 시간 종료 (자동)
    -- voided   : 무효 처리

  started_at TEXT,                             -- ISO8601 (running/이후)
  ended_at TEXT,                               -- 종료 시각 (submitted/expired/voided)

  pause_history TEXT DEFAULT '[]',             -- JSON: [{pausedAt, resumedAt, reason, byUserId}]
  total_paused_seconds INTEGER DEFAULT 0,     -- 누적 정지 시간

  proctor_user_id TEXT,                        -- 시작 처리한 감독 교사 (audit)
  submit_note TEXT,                            -- 제출 시 비고 (옵션)

  created_at DATETIME DEFAULT (datetime('now')),
  updated_at DATETIME DEFAULT (datetime('now')),

  FOREIGN KEY (exam_assignment_id) REFERENCES exam_assignments(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id),
  FOREIGN KEY (academy_id) REFERENCES academies(id)
);

CREATE INDEX IF NOT EXISTS idx_exam_attempts_assignment ON exam_attempts(exam_assignment_id);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_status_acad ON exam_attempts(academy_id, status);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_student ON exam_attempts(student_id);

-- 한 배정에 attempt 1개만 (재시도 정책 결정 전까지)
CREATE UNIQUE INDEX IF NOT EXISTS uq_attempt_per_assignment ON exam_attempts(exam_assignment_id);
