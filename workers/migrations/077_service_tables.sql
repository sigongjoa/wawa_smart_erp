-- ============================================================
-- 077_service_tables — gacha / jingdari / ssaem 서비스 상태 테이블
--   설계: vine-flywheel/docs/design/cloudflare-integration.md §1·§4
--   원칙: 모든 행은 academy_id 보유 + students.id FK (멀티테넌트 격리).
--   서비스 상태는 여기, 학습신호는 signals(076)로 emit. 둘은 분리.
-- ============================================================

-- ── concept-gacha (Supabase→공유 D1 이전 타깃) ──
CREATE TABLE IF NOT EXISTS gacha_cards (
  id          TEXT PRIMARY KEY,                          -- gc-...
  academy_id  TEXT NOT NULL,
  concept     TEXT NOT NULL,                             -- 개념명 (학습신호 concept)
  front       TEXT,
  back        TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (academy_id) REFERENCES academies(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_gacha_cards_acad ON gacha_cards(academy_id, concept);

CREATE TABLE IF NOT EXISTS gacha_sessions (
  id             TEXT PRIMARY KEY,                       -- gs-...
  academy_id     TEXT NOT NULL,
  erp_student_id TEXT NOT NULL,
  started_at     TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (academy_id) REFERENCES academies(id) ON DELETE CASCADE,
  FOREIGN KEY (erp_student_id) REFERENCES students(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_gacha_sessions_student ON gacha_sessions(academy_id, erp_student_id);

CREATE TABLE IF NOT EXISTS gacha_session_cards (
  id          TEXT PRIMARY KEY,                          -- gsc-...
  academy_id  TEXT NOT NULL,
  session_id  TEXT NOT NULL,
  card_id     TEXT NOT NULL,
  result      TEXT NOT NULL,                             -- 'pass'|'fail' (Leitner)
  box_from    INTEGER NOT NULL DEFAULT 1,
  box_to      INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (academy_id) REFERENCES academies(id) ON DELETE CASCADE,
  FOREIGN KEY (session_id) REFERENCES gacha_sessions(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_gacha_sc_session ON gacha_session_cards(session_id);

-- ── 징검다리 (백엔드 0→1, localStorage 폐기) ──
CREATE TABLE IF NOT EXISTS jingdari_items (
  kid         TEXT PRIMARY KEY,                          -- 문항 고유키(학습신호 kid)
  academy_id  TEXT NOT NULL,
  type        TEXT NOT NULL,                             -- 문항 유형
  lv          TEXT NOT NULL,                             -- 난이도
  unit        TEXT NOT NULL,                             -- 단원
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (academy_id) REFERENCES academies(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_jd_items_acad ON jingdari_items(academy_id, unit);

CREATE TABLE IF NOT EXISTS jingdari_attempts (
  id             TEXT PRIMARY KEY,                       -- ja-...
  academy_id     TEXT NOT NULL,
  erp_student_id TEXT NOT NULL,
  item_kid       TEXT NOT NULL,
  correct        INTEGER NOT NULL,                       -- 0|1
  n              INTEGER NOT NULL DEFAULT 1,             -- 시도 횟수
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (academy_id) REFERENCES academies(id) ON DELETE CASCADE,
  FOREIGN KEY (erp_student_id) REFERENCES students(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_jd_attempts_student ON jingdari_attempts(academy_id, erp_student_id, created_at);

-- ── ssaemkeeper (Pages Fn+샤드 D1 → 공유 D1 통합) ──
CREATE TABLE IF NOT EXISTS ssaem_concepts (
  id          TEXT PRIMARY KEY,                          -- sc-...
  academy_id  TEXT NOT NULL,
  name        TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (academy_id) REFERENCES academies(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_ssaem_concepts_acad ON ssaem_concepts(academy_id);

CREATE TABLE IF NOT EXISTS ssaem_activities (
  id             TEXT PRIMARY KEY,                       -- sa-...
  academy_id     TEXT NOT NULL,
  erp_student_id TEXT NOT NULL,
  kind           TEXT NOT NULL,                          -- 활동 유형
  subject        TEXT NOT NULL,
  topic          TEXT,
  grade          INTEGER,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (academy_id) REFERENCES academies(id) ON DELETE CASCADE,
  FOREIGN KEY (erp_student_id) REFERENCES students(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_ssaem_act_student ON ssaem_activities(academy_id, erp_student_id, created_at);

CREATE TABLE IF NOT EXISTS ssaem_activity_tags (
  id           TEXT PRIMARY KEY,                         -- st-...
  academy_id   TEXT NOT NULL,
  activity_id  TEXT NOT NULL,
  tag          TEXT NOT NULL,
  FOREIGN KEY (academy_id) REFERENCES academies(id) ON DELETE CASCADE,
  FOREIGN KEY (activity_id) REFERENCES ssaem_activities(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_ssaem_tags_act ON ssaem_activity_tags(activity_id);
