-- Migration 076: vine-flywheel 기반 — 신원·신호·작업큐·산출물 + 컴플라이언스 레이어
-- 설계: /mnt/g/vine-flywheel/docs/design/architecture.md (v3) + research_pipa_guidelines_20260623.md
-- 성격: 추가전용(기존 테이블 미변경). 전 테이블 academy_id 격리.
-- ⚠ 적용 전후 백업 필수(CLAUDE.md Ⅱ.8): wrangler d1 export <db> --env production
--
-- 핵심 설계 원칙:
--   • signals = append-only(업무상 UPDATE/DELETE 금지). PII성 payload는 student_keys로 암호화.
--   • 삭제권/동의철회 = student_keys.shredded_at 설정(키 폐기) → 복호 불가(crypto-shred). 행은 보존.
--   • 미성년(만14세 미만) = consents.guardian_consent 게이트 통과 전 처리 차단(API 레이어).
--   • access_log = PII 접근 감사, 보관 2년(고유식별/민감정보 처리 → 안전성 확보조치 기준).

-- ============================================================
-- student_keys — crypto-shred용 학생별 데이터키 (삭제권 양립)
-- ============================================================
CREATE TABLE IF NOT EXISTS student_keys (
  erp_student_id TEXT PRIMARY KEY,                       -- = students.id
  academy_id     TEXT NOT NULL,
  key_wrapped    TEXT NOT NULL,                          -- envelope-encrypted DEK (KMS/마스터키로 래핑)
  shredded_at    TEXT,                                   -- 설정 시 키 폐기 = 사실상 삭제
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (academy_id) REFERENCES academies(id) ON DELETE CASCADE,
  FOREIGN KEY (erp_student_id) REFERENCES students(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_skeys_academy ON student_keys(academy_id);

-- ============================================================
-- student_links — 위성 학생키(5색) → 정본 erp_student_id 크로스워크
-- ============================================================
CREATE TABLE IF NOT EXISTS student_links (
  source         TEXT NOT NULL,                          -- 'gacha'|'jingdari'|'assessment'|'ssaemkeeper'|'edu-arch'
  external_id    TEXT NOT NULL,                          -- gacha UUID / ssaem INTEGER / 'name@school'
  academy_id     TEXT NOT NULL,
  erp_student_id TEXT NOT NULL,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (source, external_id, academy_id),
  FOREIGN KEY (academy_id) REFERENCES academies(id) ON DELETE CASCADE,
  FOREIGN KEY (erp_student_id) REFERENCES students(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_slinks_student ON student_links(academy_id, erp_student_id);

-- ============================================================
-- consents — 미성년 동의 게이트 (보호법 제22조의2)
-- ============================================================
CREATE TABLE IF NOT EXISTS consents (
  academy_id       TEXT NOT NULL,
  erp_student_id   TEXT NOT NULL,
  age_band         TEXT NOT NULL DEFAULT 'unknown',      -- 'under14'|'14plus'|'unknown'
  guardian_consent INTEGER NOT NULL DEFAULT 0,           -- 0/1 (under14 처리 전제)
  consent_method   TEXT,                                 -- 'sms'|'auth'|'card'|'paper'
  scope_json       TEXT NOT NULL DEFAULT '{}',           -- 항목별 동의(수집/이용/국외이전/가명학습)
  consented_at     TEXT,
  withdrawn_at     TEXT,                                 -- 동의철회 시각
  updated_at       TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (academy_id, erp_student_id),
  FOREIGN KEY (academy_id) REFERENCES academies(id) ON DELETE CASCADE,
  FOREIGN KEY (erp_student_id) REFERENCES students(id) ON DELETE CASCADE
);

-- ============================================================
-- signals — 학습 신호 (append-only). payload는 student_keys로 암호화.
-- ============================================================
CREATE TABLE IF NOT EXISTS signals (
  id             TEXT PRIMARY KEY,                       -- sig-...
  academy_id     TEXT NOT NULL,
  erp_student_id TEXT NOT NULL,
  source         TEXT NOT NULL,                          -- 'gacha'|'jingdari'|'edu-arch'|'assessment'|'ssaemkeeper'|'erp'
  kind           TEXT NOT NULL,                          -- 'review'|'wrong_answer'|'result'|'submission'|'activity'|'attendance'|'grade'|'consult'|'mastery'
  payload_enc    TEXT NOT NULL,                          -- kind별 학습값 JSON, student key로 암호화(평문 PII 금지)
  trust          TEXT NOT NULL DEFAULT 'server',         -- 'server'(신뢰)|'client'(저신뢰, 학습 제외)
  ts             TEXT NOT NULL,                          -- 이벤트 발생 시각(ISO)
  ingest_id      TEXT NOT NULL,                          -- 멱등 키
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (academy_id) REFERENCES academies(id) ON DELETE CASCADE,
  FOREIGN KEY (erp_student_id) REFERENCES students(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_signals_ingest  ON signals(academy_id, ingest_id);
CREATE INDEX IF NOT EXISTS idx_signals_student ON signals(academy_id, erp_student_id, ts);
CREATE INDEX IF NOT EXISTS idx_signals_kind    ON signals(academy_id, kind, ts);

-- ============================================================
-- jobs — 작업 큐 + 상태머신 (큐 = 서빙↔생성 계약)
--   queued→claimed→running→produced→review→published / fail·cancel
-- ============================================================
CREATE TABLE IF NOT EXISTS jobs (
  id              TEXT PRIMARY KEY,                      -- job-...
  academy_id      TEXT NOT NULL,
  type            TEXT NOT NULL,                         -- 'edu-arch'|'assessment'|'recommend-train'|'recommend-infer'|'cardnews'|'report'
  status          TEXT NOT NULL DEFAULT 'queued',        -- queued|claimed|running|produced|review|published|failed|canceled
  priority        INTEGER NOT NULL DEFAULT 100,          -- 낮을수록 먼저
  payload         TEXT NOT NULL DEFAULT '{}',
  erp_student_id  TEXT,
  result_ref      TEXT,                                  -- artifacts.id
  requested_by    TEXT,                                  -- users.id (트리거 주체)
  reviewed_by     TEXT,
  idempotency_key TEXT,                                  -- 중복 요청 차단
  worker_id       TEXT,
  attempts        INTEGER NOT NULL DEFAULT 0,
  heartbeat_at    TEXT,
  error           TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  claimed_at      TEXT,
  produced_at     TEXT,
  reviewed_at     TEXT,
  published_at    TEXT,
  FOREIGN KEY (academy_id) REFERENCES academies(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_jobs_idem  ON jobs(academy_id, idempotency_key);
CREATE INDEX IF NOT EXISTS idx_jobs_claim  ON jobs(status, type, priority, created_at);  -- claim 폴링용
CREATE INDEX IF NOT EXISTS idx_jobs_review ON jobs(academy_id, status);                  -- 검수 큐
CREATE INDEX IF NOT EXISTS idx_jobs_stale  ON jobs(status, heartbeat_at);                -- 스위퍼

-- ============================================================
-- artifacts — 생성 산출물 메타 (실파일은 R2)
-- ============================================================
CREATE TABLE IF NOT EXISTS artifacts (
  id             TEXT PRIMARY KEY,                       -- art-...
  job_id         TEXT NOT NULL,
  academy_id     TEXT NOT NULL,
  erp_student_id TEXT,
  type           TEXT NOT NULL,
  r2_key         TEXT NOT NULL,                          -- {academy_id}/{type}/{erp_student_id}/{job_id}.pdf
  kind           TEXT,
  pages          INTEGER,
  meta           TEXT NOT NULL DEFAULT '{}',
  status         TEXT NOT NULL DEFAULT 'review',         -- review|published
  generated_at   TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (academy_id) REFERENCES academies(id) ON DELETE CASCADE,
  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_artifacts_student ON artifacts(academy_id, erp_student_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_status  ON artifacts(academy_id, status);

-- ============================================================
-- reviews — 강사 검수 기록 (검수 before→after = 학습신호)
-- ============================================================
CREATE TABLE IF NOT EXISTS reviews (
  id           TEXT PRIMARY KEY,                         -- rev-...
  job_id       TEXT NOT NULL,
  academy_id   TEXT NOT NULL,
  reviewer_id  TEXT NOT NULL,                            -- users.id
  decision     TEXT NOT NULL,                            -- 'approve'|'reject'
  comment      TEXT,
  edited       INTEGER NOT NULL DEFAULT 0,               -- 강사가 수정했는지
  diff_summary TEXT,                                     -- AI초안 vs 수정 요약(학습신호)
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (academy_id) REFERENCES academies(id) ON DELETE CASCADE,
  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_reviews_job ON reviews(academy_id, job_id);

-- ============================================================
-- recommendations — precompute된 학생별 추천 (서빙은 읽기만)
-- ============================================================
CREATE TABLE IF NOT EXISTS recommendations (
  academy_id     TEXT NOT NULL,
  erp_student_id TEXT NOT NULL,
  items          TEXT NOT NULL DEFAULT '[]',             -- 랭킹 [{ref,source,reason,score}]
  model_version  TEXT,
  generated_at   TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (academy_id, erp_student_id),
  FOREIGN KEY (academy_id) REFERENCES academies(id) ON DELETE CASCADE,
  FOREIGN KEY (erp_student_id) REFERENCES students(id) ON DELETE CASCADE
);

-- ============================================================
-- usage_ledger — 테넌트별 생성 비용 (토큰 실비% 청구 근거)
-- ============================================================
CREATE TABLE IF NOT EXISTS usage_ledger (
  id            TEXT PRIMARY KEY,                        -- use-...
  academy_id    TEXT NOT NULL,
  job_id        TEXT,
  type          TEXT NOT NULL,
  tokens        INTEGER NOT NULL DEFAULT 0,
  api_cost_cents INTEGER NOT NULL DEFAULT 0,             -- 외부 API 원가(센트)
  ts            TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (academy_id) REFERENCES academies(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_usage_academy ON usage_ledger(academy_id, ts);

-- ============================================================
-- access_log — PII 접근 감사 (안전성 확보조치, 보관 2년)
--   학생 삭제와 무관하게 감사 보존 → erp_student_id FK 미설정(문자열 보관)
-- ============================================================
CREATE TABLE IF NOT EXISTS access_log (
  id             TEXT PRIMARY KEY,                       -- acl-...
  academy_id     TEXT NOT NULL,
  actor_id       TEXT NOT NULL,                          -- 접근 주체(users.id / 'worker:xxx' / 'parent-token')
  erp_student_id TEXT,                                   -- 대상 학생(문자열, FK 없음 — 감사 보존)
  action         TEXT NOT NULL,                          -- 'read'|'export'|'erase'|'artifact_view'|'review'
  detail         TEXT,
  ts             TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (academy_id) REFERENCES academies(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_acclog_academy ON access_log(academy_id, ts);
CREATE INDEX IF NOT EXISTS idx_acclog_student ON access_log(academy_id, erp_student_id, ts);
