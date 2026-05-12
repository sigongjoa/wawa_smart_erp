-- =============================================
-- 학생 자가 가입 요청 (Self-Signup) — 교사 승인 대기 큐
--
-- 흐름:
--   1) 학생이 LoginPage → SignupRequestPage 에서 학원·이름·학년·PIN 제출
--   2) status='pending' 으로 INSERT
--   3) 교사 desktop에서 승인 → gacha_students 로 promote 후 row 삭제
--      또는 거절 → status='rejected' 로 변경 (재시도 차단)
--
-- 보안:
--   - PIN은 가입 요청 시점부터 해시(pbkdf2 100k)로 저장. 평문 저장 X.
--   - 학원 단위 UNIQUE(name) — 거절 row가 있으면 동일 이름 재신청 차단.
--   - teacher_id는 가입 요청 시점에 미정. 승인 시 교사가 본인 id로 promote.
-- =============================================

CREATE TABLE IF NOT EXISTS student_signup_requests (
  id              TEXT PRIMARY KEY,
  academy_id      TEXT NOT NULL,
  name            TEXT NOT NULL,
  grade           TEXT,
  pin_hash        TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'rejected'
  memo            TEXT,                              -- 학생 자유 입력 (담당 교사명 등)
  submitted_at    DATETIME DEFAULT (datetime('now')),
  reviewed_at     DATETIME,
  reviewed_by     TEXT,                              -- 승인/거절한 교사 id
  reject_reason   TEXT,
  UNIQUE(academy_id, name)
);

CREATE INDEX IF NOT EXISTS idx_ssr_pending
  ON student_signup_requests(academy_id, status, submitted_at);
