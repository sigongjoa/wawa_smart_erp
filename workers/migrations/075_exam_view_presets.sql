-- Migration 075: 정기고사 페이지 뷰 프리셋 + 페이지별 마지막 화면 자동 저장
-- 설계: docs/preset 설계 (claudedocs 참조)
-- 두 트랙 분리:
--   1. exam_view_presets  — 사용자가 이름 붙여 저장한 명시 프리셋 (private/academy 공유)
--   2. user_page_state    — 페이지별 마지막 화면 자동 저장 (1행/사용자/페이지)

-- ============================================================
-- exam_view_presets — 명시 프리셋
-- ============================================================
CREATE TABLE IF NOT EXISTS exam_view_presets (
  id TEXT PRIMARY KEY,                                  -- pst-...
  academy_id TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  name TEXT NOT NULL,                                   -- 30자 캡 (sanitize)
  month_ref TEXT NOT NULL,                              -- 'prev'|'current'|'next'|'next2' | 'YYYY-MM'
  scope TEXT NOT NULL DEFAULT 'mine',                   -- 'mine'|'all'
  visibility TEXT NOT NULL DEFAULT 'private',           -- 'private'|'academy'
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (academy_id) REFERENCES academies(id) ON DELETE CASCADE,
  FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_evp_owner   ON exam_view_presets(academy_id, owner_user_id);
CREATE INDEX IF NOT EXISTS idx_evp_shared  ON exam_view_presets(academy_id, visibility);

-- ============================================================
-- user_page_state — 페이지별 마지막 화면 자동 저장 (범용)
-- ============================================================
CREATE TABLE IF NOT EXISTS user_page_state (
  academy_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  page_key TEXT NOT NULL,                               -- 'exam-mgmt' 등
  state_json TEXT NOT NULL,                             -- 페이지가 정의하는 임의 JSON (≤2KB sanitize)
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (academy_id, user_id, page_key),
  FOREIGN KEY (academy_id) REFERENCES academies(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
