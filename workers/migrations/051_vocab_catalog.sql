-- =============================================
-- Vocab Catalog — 학원 공유 단어 카탈로그 (수능 영단어 등)
-- 학생 vocab_words 와 분리: 카탈로그는 academy 무관 공유 자산.
-- 시험 시작 시 카탈로그 단어를 학생 vocab_words 에 시드하여 기존 흐름 재사용.
-- =============================================

-- 카탈로그 마스터
CREATE TABLE IF NOT EXISTS vocab_catalogs (
  id          TEXT PRIMARY KEY,                  -- 'csat-megastudy-2025'
  title       TEXT NOT NULL,
  source      TEXT NOT NULL,                     -- 'megastudy-2025-pdf'
  license     TEXT,
  word_count  INTEGER NOT NULL DEFAULT 0,
  created_at  DATETIME DEFAULT (datetime('now'))
);

-- 카탈로그 단어 (academy 무관 공유)
CREATE TABLE IF NOT EXISTS vocab_catalog_words (
  id          TEXT PRIMARY KEY,                  -- 'cw-csat-0001'
  catalog_id  TEXT NOT NULL,
  english     TEXT NOT NULL,
  korean      TEXT NOT NULL,
  pos         TEXT,                              -- noun|verb|adj|adv|prep|conj
  rank        INTEGER NOT NULL,                  -- 빈도 순위
  tier        INTEGER NOT NULL,                  -- 1|2|3
  example     TEXT,
  FOREIGN KEY (catalog_id) REFERENCES vocab_catalogs(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_catalog_words_tier ON vocab_catalog_words(catalog_id, tier);
CREATE UNIQUE INDEX IF NOT EXISTS uq_catalog_word ON vocab_catalog_words(catalog_id, english);

-- 학생 vocab_words → 카탈로그 추적용 (어떤 카탈로그 단어에서 시드됐는지)
ALTER TABLE vocab_words ADD COLUMN origin_catalog_word_id TEXT;
CREATE INDEX IF NOT EXISTS idx_vocab_words_origin
  ON vocab_words(student_id, origin_catalog_word_id);

-- print_job 에 출처 표시 (mywords | csat-tier1 | csat-tier2 | csat-tier3 | csat-mixed)
ALTER TABLE vocab_print_jobs ADD COLUMN source TEXT NOT NULL DEFAULT 'mywords';
