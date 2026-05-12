-- =============================================
-- 알림 시스템 — MVP (docs/NOTIFICATION_SYSTEM_DESIGN.md)
--
-- type/payload 다형 구조: 향후 알림 종류 추가 시 스키마 변경 X.
-- broadcast (recipient_user_id NULL + recipient_role) / per-user (recipient_user_id NOT NULL) 둘 다 지원.
-- read 상태는 글로벌 (broadcast 알림은 한 명이 처리하면 모두 read). 사용자별 추적이 필요해지면
-- 별도 notification_reads 테이블로 N:M 확장.
-- =============================================

CREATE TABLE IF NOT EXISTS notifications (
  id                  TEXT PRIMARY KEY,
  academy_id          TEXT NOT NULL,
  recipient_user_id   TEXT REFERENCES users(id) ON DELETE CASCADE,
  recipient_role      TEXT,
  type                TEXT NOT NULL,
  title               TEXT NOT NULL,
  body                TEXT,
  link                TEXT,
  payload             TEXT,
  is_read             INTEGER NOT NULL DEFAULT 0,
  read_at             DATETIME,
  created_at          DATETIME NOT NULL DEFAULT (datetime('now')),
  expires_at          DATETIME
);

-- 본인 직접 수신 (recipient_user_id NOT NULL)
CREATE INDEX IF NOT EXISTS idx_notif_user_unread
  ON notifications(academy_id, recipient_user_id, is_read, created_at DESC);

-- broadcast (recipient_user_id NULL, role 기준)
CREATE INDEX IF NOT EXISTS idx_notif_broadcast
  ON notifications(academy_id, recipient_role, is_read, created_at DESC);

-- 자동 정리용
CREATE INDEX IF NOT EXISTS idx_notif_expires
  ON notifications(expires_at);

-- type 별 payload 검색용 (예: signup request_id로 read 처리)
CREATE INDEX IF NOT EXISTS idx_notif_type_academy
  ON notifications(academy_id, type, is_read);
