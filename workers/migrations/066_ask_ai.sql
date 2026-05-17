-- ═══════════════════════════════════════════════════════════
-- AskAI 시스템 (UC-01 ~ UC-15)
-- 학생 질문 + AI 응답 + 강사 결정 + drill 카드 + SM-2 상태
-- ═══════════════════════════════════════════════════════════

-- UC-01 — 학생 질문 + AI 응답 conversation 단위
CREATE TABLE IF NOT EXISTS askai_conversations (
  id              TEXT PRIMARY KEY,          -- UUID v4
  student_id      TEXT NOT NULL,
  unit_id         TEXT,                       -- "확통 III-1 표본분포"
  message         TEXT NOT NULL,
  response_json   TEXT NOT NULL,              -- AskAIResponseSchema JSON
  confidence      TEXT NOT NULL CHECK (confidence IN ('high', 'medium', 'low')),
  needs_teacher   INTEGER NOT NULL DEFAULT 0, -- bool
  used_tokens     INTEGER,
  duration_ms     INTEGER,
  attached_photos TEXT,                       -- JSON array of R2 keys
  started_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_askai_conv_student ON askai_conversations(student_id, started_at DESC);
CREATE INDEX idx_askai_conv_needs ON askai_conversations(needs_teacher) WHERE needs_teacher = 1;
CREATE INDEX idx_askai_conv_started ON askai_conversations(started_at DESC);

-- UC-09/10 — 강사 결정
CREATE TABLE IF NOT EXISTS askai_decisions (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id TEXT NOT NULL,
  teacher_id      TEXT NOT NULL,
  decision        TEXT NOT NULL CHECK (decision IN ('ok', 'comment', 'ai_wrong')),
  comment         TEXT,
  applied_at      TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (conversation_id) REFERENCES askai_conversations(id) ON DELETE CASCADE
);

CREATE INDEX idx_askai_dec_conv ON askai_decisions(conversation_id);
CREATE INDEX idx_askai_dec_teacher ON askai_decisions(teacher_id, applied_at DESC);

-- UC-02 — 일일 사용량 (questions + photos)
CREATE TABLE IF NOT EXISTS askai_quota (
  student_id      TEXT NOT NULL,
  date            TEXT NOT NULL,              -- YYYY-MM-DD (Asia/Seoul)
  questions_used  INTEGER NOT NULL DEFAULT 0,
  photos_used     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (student_id, date)
);

-- UC-12 — drill 카드
CREATE TABLE IF NOT EXISTS askai_drill_cards (
  id              TEXT PRIMARY KEY,
  student_id      TEXT NOT NULL,
  source          TEXT NOT NULL CHECK (source IN (
    'askai_failed_checkpoint', 'exam_wrong', 'homework_deduction', 'unit_xmark'
  )),
  source_ref      TEXT NOT NULL,              -- conversation_id / exam_id / etc.
  unit            TEXT NOT NULL,
  problem_md      TEXT NOT NULL,
  answer_md       TEXT NOT NULL,
  context_note    TEXT,
  ai_cite         TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (student_id, source, source_ref)     -- dedup
);

CREATE INDEX idx_askai_drill_student ON askai_drill_cards(student_id);

-- UC-13 — SM-2 상태
CREATE TABLE IF NOT EXISTS askai_sm2_state (
  card_id         TEXT PRIMARY KEY,
  ease            REAL NOT NULL DEFAULT 2.5,
  interval_days   INTEGER NOT NULL DEFAULT 1,
  due_date        TEXT NOT NULL,              -- YYYY-MM-DD
  reps            INTEGER NOT NULL DEFAULT 0,
  lapses          INTEGER NOT NULL DEFAULT 0,
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (card_id) REFERENCES askai_drill_cards(id) ON DELETE CASCADE
);

CREATE INDEX idx_askai_sm2_due ON askai_sm2_state(due_date);

-- UC-11 — 알림 로그 (rate limit 추적)
CREATE TABLE IF NOT EXISTS askai_notifications (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id      TEXT NOT NULL,
  kind            TEXT NOT NULL CHECK (kind IN ('comment', 'ai_wrong')),
  conversation_id TEXT,
  payload_json    TEXT NOT NULL,
  read_at         TEXT,                       -- 학생이 확인한 시간
  sent_at         TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (conversation_id) REFERENCES askai_conversations(id) ON DELETE SET NULL
);

CREATE INDEX idx_askai_notif_student ON askai_notifications(student_id, sent_at DESC);

-- UC-03 — 사진 메타 (R2 객체 추적, 7일 후 cron으로 삭제)
CREATE TABLE IF NOT EXISTS askai_photos (
  r2_key          TEXT PRIMARY KEY,
  student_id      TEXT NOT NULL,
  conversation_id TEXT,
  size_bytes      INTEGER NOT NULL,
  mime            TEXT NOT NULL,
  uploaded_at     TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at      TEXT NOT NULL,              -- YYYY-MM-DD (uploaded + 7d)
  FOREIGN KEY (conversation_id) REFERENCES askai_conversations(id) ON DELETE SET NULL
);

CREATE INDEX idx_askai_photo_expires ON askai_photos(expires_at);
CREATE INDEX idx_askai_photo_student ON askai_photos(student_id, uploaded_at DESC);
