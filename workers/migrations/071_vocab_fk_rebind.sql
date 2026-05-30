-- Migration 071: vocab_words FK rebind (gacha_students → students)
-- 전략: 테이블 recreate (SQLite는 FK 변경을 ALTER로 못 함)
--   1) vocab_words_new 생성 (FK to students)
--   2) student_id를 _gacha_student_map 거쳐 매핑된 값으로 INSERT
--   3) DROP old → RENAME → 인덱스 재생성

CREATE TABLE vocab_words_new (
  id TEXT PRIMARY KEY,
  academy_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  english TEXT NOT NULL,
  korean TEXT NOT NULL,
  box INTEGER NOT NULL DEFAULT 1,
  blank_type TEXT NOT NULL DEFAULT 'korean',
  status TEXT NOT NULL DEFAULT 'approved',
  added_by TEXT NOT NULL DEFAULT 'teacher',
  review_count INTEGER NOT NULL DEFAULT 0,
  wrong_count INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT (datetime('now')),
  updated_at DATETIME,
  pos TEXT,
  example TEXT,
  last_quizzed_at TEXT,
  category TEXT,
  origin_catalog_word_id TEXT,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

INSERT INTO vocab_words_new
  (id, academy_id, student_id, english, korean, box, blank_type, status, added_by,
   review_count, wrong_count, created_at, updated_at, pos, example, last_quizzed_at, category, origin_catalog_word_id)
SELECT
  v.id, v.academy_id,
  COALESCE(m.student_id, v.student_id),
  v.english, v.korean, v.box, v.blank_type, v.status, v.added_by,
  v.review_count, v.wrong_count, v.created_at, v.updated_at,
  v.pos, v.example, v.last_quizzed_at, v.category, v.origin_catalog_word_id
FROM vocab_words v
LEFT JOIN _gacha_student_map m ON m.gacha_id = v.student_id;

DROP TABLE vocab_words;
ALTER TABLE vocab_words_new RENAME TO vocab_words;

CREATE INDEX idx_vocab_words_student ON vocab_words(academy_id, student_id, status);
CREATE INDEX idx_vocab_words_box ON vocab_words(student_id, box);
CREATE INDEX idx_vocab_words_academy_status ON vocab_words(academy_id, status);
CREATE INDEX idx_vocab_words_last_quizzed ON vocab_words(student_id, last_quizzed_at);
CREATE INDEX idx_vocab_words_category ON vocab_words(academy_id, category);
CREATE INDEX idx_vocab_words_origin ON vocab_words(student_id, origin_catalog_word_id);
