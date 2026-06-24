-- ============================================================
-- 078_rs_items — 2계층 RS(오늘의 길) 표면용 랭크드 추천 아이템 + 학원별 가중치
--   설계: vine-flywheel/docs/specs/rs-api-contract.md (SSOT) · rs-two-layer-design.md §2
--   성격: 추가전용. 076 recommendations(요약/freshness) 보존 — 여기는 per-item override·분석용 분리 테이블.
--   원칙: 모든 행 academy_id 격리 + students.id FK (멀티테넌트).
-- ============================================================

-- ── recommendation_items — 학생당 N행(랭크드 멀티아이템 + 승인상태) ──
CREATE TABLE IF NOT EXISTS recommendation_items (
  id             TEXT PRIMARY KEY,                       -- "ri-…"
  academy_id     TEXT NOT NULL,
  erp_student_id TEXT NOT NULL,
  rank           INTEGER NOT NULL,                       -- 1 = 최상위
  action_type    TEXT NOT NULL,                          -- gacha_deck|jingdari_set|proof|assignment|review|exam
  action_ref     TEXT,                                   -- 개념/타깃 id (브릿지 resolver가 채움)
  target_path    TEXT NOT NULL,                          -- FE 내비("/gacha?concept=…","/drill?concept=…")
  reason         TEXT,                                   -- "최근 3번 틀린 곳"(자동) / 강사 수정 가능
  urgency        TEXT NOT NULL DEFAULT 'medium',         -- critical|high|medium|low
  score_total    REAL,
  score_gap      REAL,
  score_habit    REAL,
  score_ret      REAL,
  status         TEXT NOT NULL DEFAULT 'auto_served',    -- auto_served|teacher_pending|teacher_approved|teacher_rejected|teacher_boosted
  teacher_note   TEXT,
  model_version  TEXT,
  generated_at   TEXT NOT NULL,
  acted_at       TEXT,
  FOREIGN KEY (academy_id) REFERENCES academies(id) ON DELETE CASCADE,
  FOREIGN KEY (erp_student_id) REFERENCES students(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_recitems_student ON recommendation_items(academy_id, erp_student_id, rank);
CREATE INDEX IF NOT EXISTS idx_recitems_status  ON recommendation_items(academy_id, status);

-- ── rs_config — 학원별 목표함수 가중치(약점=북극성, 습관·리텐션=가드레일) ──
CREATE TABLE IF NOT EXISTS rs_config (
  academy_id    TEXT PRIMARY KEY,
  w_gap         REAL NOT NULL DEFAULT 0.6,               -- 약점=북극성(지배 가중)
  w_habit       REAL NOT NULL DEFAULT 0.2,               -- 습관=가드레일
  w_ret         REAL NOT NULL DEFAULT 0.2,               -- 리텐션=가드레일
  daily_cap     INTEGER NOT NULL DEFAULT 5,
  model_version TEXT NOT NULL DEFAULT 'rs-v1',
  FOREIGN KEY (academy_id) REFERENCES academies(id) ON DELETE CASCADE
);

-- 기존 학원에 기본 가중치 시드 (없으면 read-time DEFAULT로도 동작하지만 명시적 시드로 일관성 확보)
INSERT OR IGNORE INTO rs_config (academy_id)
  SELECT id FROM academies;
