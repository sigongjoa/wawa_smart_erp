-- =============================================
-- MedTerm Study System — 의학용어 학습 (vocab_*과 분리된 별도 도메인)
--
-- 컨텐츠 (academy 무관 공유): med_books, med_chapters, med_word_parts,
--   med_terms, med_term_parts, med_figures, med_figure_labels, med_exam_items
-- 학생 진척 (academy_id 격리): med_student_chapters, med_student_terms,
--   med_exam_attempts, med_exam_responses
--
-- 백업 정책: 본 마이그레이션 적용 직전·직후 D1 export → Drive `erpbackup`.
-- =============================================

-- ① 교재 (academy 무관 공유)
CREATE TABLE IF NOT EXISTS med_books (
  id           TEXT PRIMARY KEY,
  title        TEXT NOT NULL,
  publisher    TEXT,
  edition      TEXT,
  field        TEXT,                        -- '간호'|'보건'|'의예'
  total_pages  INTEGER,
  created_at   DATETIME DEFAULT (datetime('now'))
);

-- ② 챕터
CREATE TABLE IF NOT EXISTS med_chapters (
  id            TEXT PRIMARY KEY,
  book_id       TEXT NOT NULL,
  chapter_no    INTEGER NOT NULL,
  title         TEXT NOT NULL,
  page_start    INTEGER,
  page_end      INTEGER,
  objectives    TEXT,
  created_at    DATETIME DEFAULT (datetime('now')),
  FOREIGN KEY (book_id) REFERENCES med_books(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_med_chapters_book ON med_chapters(book_id, chapter_no);
CREATE UNIQUE INDEX IF NOT EXISTS uq_med_chapters_book_no ON med_chapters(book_id, chapter_no);

-- ③ 단어 요소 (접두사·어근·결합형·접미사)
CREATE TABLE IF NOT EXISTS med_word_parts (
  id           TEXT PRIMARY KEY,
  chapter_id   TEXT NOT NULL,
  role         TEXT NOT NULL,               -- 'p'|'r'|'cv'|'s'
  value        TEXT NOT NULL,               -- 'cardi/o' | 'anti-' | '-itis'
  meaning_ko   TEXT NOT NULL,
  meaning_en   TEXT,
  origin       TEXT,                        -- '그리스어'|'라틴어'
  origin_word  TEXT,                        -- 'lithos'
  notes        TEXT,
  FOREIGN KEY (chapter_id) REFERENCES med_chapters(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_med_parts_chapter ON med_word_parts(chapter_id, role);
CREATE UNIQUE INDEX IF NOT EXISTS uq_med_parts_value ON med_word_parts(chapter_id, role, value);

-- ④ 의학용어
CREATE TABLE IF NOT EXISTS med_terms (
  id              TEXT PRIMARY KEY,
  chapter_id      TEXT NOT NULL,
  term            TEXT NOT NULL,
  pronunciation   TEXT,
  meaning_ko      TEXT NOT NULL,
  meaning_long    TEXT,
  category        TEXT,                     -- '해부'|'증상'|'질환'|'시술'|'약어'
  is_constructed  INTEGER NOT NULL DEFAULT 1, -- 0=비조합어, 1=조합어
  plural_form     TEXT,
  plural_rule     TEXT,                     -- 'a→ae'|'is→es'|'itis→itides'|'on/um→a'
  FOREIGN KEY (chapter_id) REFERENCES med_chapters(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_med_terms_chapter ON med_terms(chapter_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_med_terms_term ON med_terms(term);

-- ⑤ 용어 ↔ 단어 요소 합성 (cardiology = cardi + o + logy)
CREATE TABLE IF NOT EXISTS med_term_parts (
  id          TEXT PRIMARY KEY,
  term_id     TEXT NOT NULL,
  part_id     TEXT NOT NULL,
  position    INTEGER NOT NULL,
  FOREIGN KEY (term_id) REFERENCES med_terms(id) ON DELETE CASCADE,
  FOREIGN KEY (part_id) REFERENCES med_word_parts(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_med_term_parts_term ON med_term_parts(term_id, position);
CREATE UNIQUE INDEX IF NOT EXISTS uq_med_term_parts_pos ON med_term_parts(term_id, position);

-- ⑥ 그림 (R2 키에 academy_id 포함 — 학원 격리)
CREATE TABLE IF NOT EXISTS med_figures (
  id           TEXT PRIMARY KEY,
  chapter_id   TEXT NOT NULL,
  label        TEXT NOT NULL,                -- '그림 1-3'
  caption      TEXT,
  fig_type     TEXT NOT NULL,                -- 'anatomy'|'diagram'|'etymology'|'illustration'
  r2_key       TEXT NOT NULL,                -- medterm/{academy_id}/figs/{figure_id}.{ext}
  width        INTEGER,
  height       INTEGER,
  created_at   DATETIME DEFAULT (datetime('now')),
  FOREIGN KEY (chapter_id) REFERENCES med_chapters(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_med_figs_chapter ON med_figures(chapter_id);

-- 그림 라벨 (인체 해부도 부위별 라벨)
CREATE TABLE IF NOT EXISTS med_figure_labels (
  id           TEXT PRIMARY KEY,
  figure_id    TEXT NOT NULL,
  part_id      TEXT,                        -- 결합형 part 와 연결
  x_ratio      REAL NOT NULL,               -- 0.0~1.0
  y_ratio      REAL NOT NULL,
  text         TEXT NOT NULL,
  FOREIGN KEY (figure_id) REFERENCES med_figures(id) ON DELETE CASCADE,
  FOREIGN KEY (part_id) REFERENCES med_word_parts(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_med_fig_labels_fig ON med_figure_labels(figure_id);

-- ⑦ 출제 문항
CREATE TABLE IF NOT EXISTS med_exam_items (
  id            TEXT PRIMARY KEY,
  chapter_id    TEXT NOT NULL,
  no            INTEGER NOT NULL,
  type          TEXT NOT NULL,              -- '객관식'|'단답형'|'매칭'|'빈칸'|'용어분해'|'OX'
  topic         TEXT,
  difficulty    TEXT NOT NULL,              -- '하'|'중'|'상'
  question      TEXT NOT NULL,
  body_json     TEXT NOT NULL,              -- choices/items/options/parts 페이로드
  answer_json   TEXT NOT NULL,
  explanation   TEXT,
  figure_id     TEXT,
  FOREIGN KEY (chapter_id) REFERENCES med_chapters(id) ON DELETE CASCADE,
  FOREIGN KEY (figure_id) REFERENCES med_figures(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_med_exam_chapter ON med_exam_items(chapter_id, no);
CREATE UNIQUE INDEX IF NOT EXISTS uq_med_exam_no ON med_exam_items(chapter_id, no);

-- =============================================
-- 학생 측 (academy_id 격리 필수)
-- =============================================

-- ⑧ 학생-챕터 할당
CREATE TABLE IF NOT EXISTS med_student_chapters (
  id           TEXT PRIMARY KEY,
  academy_id   TEXT NOT NULL,
  student_id   TEXT NOT NULL,
  chapter_id   TEXT NOT NULL,
  modes_json   TEXT NOT NULL DEFAULT '["meaning"]',  -- ['meaning','decompose',...]
  status       TEXT NOT NULL DEFAULT 'active',       -- active|done|paused
  assigned_by  TEXT,
  assigned_at  DATETIME DEFAULT (datetime('now')),
  FOREIGN KEY (student_id) REFERENCES gacha_students(id) ON DELETE CASCADE,
  FOREIGN KEY (chapter_id) REFERENCES med_chapters(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_med_stud_chap_acad
  ON med_student_chapters(academy_id, student_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_med_stud_chap
  ON med_student_chapters(academy_id, student_id, chapter_id);

-- ⑨ 학생별 용어 진척 (5-box Leitner)
CREATE TABLE IF NOT EXISTS med_student_terms (
  id              TEXT PRIMARY KEY,
  academy_id      TEXT NOT NULL,
  student_id      TEXT NOT NULL,
  term_id         TEXT NOT NULL,
  study_mode      TEXT NOT NULL DEFAULT 'meaning',
                  -- 'meaning'|'decompose'|'compose'|'plural'|'figure'
  box             INTEGER NOT NULL DEFAULT 1,        -- 1..5
  review_count    INTEGER NOT NULL DEFAULT 0,
  wrong_count     INTEGER NOT NULL DEFAULT 0,
  last_reviewed   DATETIME,
  next_review     DATETIME DEFAULT (datetime('now')),
  created_at      DATETIME DEFAULT (datetime('now')),
  FOREIGN KEY (student_id) REFERENCES gacha_students(id) ON DELETE CASCADE,
  FOREIGN KEY (term_id) REFERENCES med_terms(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_med_stud_terms_due
  ON med_student_terms(academy_id, student_id, next_review);
CREATE INDEX IF NOT EXISTS idx_med_stud_terms_box
  ON med_student_terms(academy_id, student_id, box);
CREATE UNIQUE INDEX IF NOT EXISTS uq_med_stud_term_mode
  ON med_student_terms(student_id, term_id, study_mode);

-- ⑩ 단원평가 응시 + 응답
CREATE TABLE IF NOT EXISTS med_exam_attempts (
  id            TEXT PRIMARY KEY,
  academy_id    TEXT NOT NULL,
  student_id    TEXT NOT NULL,
  chapter_id    TEXT NOT NULL,
  item_ids_json TEXT NOT NULL,
  pdf_r2_key    TEXT,
  status        TEXT NOT NULL DEFAULT 'created',  -- created|submitted|graded
  score         INTEGER,                          -- 0~100
  total         INTEGER,
  correct_cnt   INTEGER,
  created_at    DATETIME DEFAULT (datetime('now')),
  submitted_at  DATETIME,
  graded_at     DATETIME,
  FOREIGN KEY (student_id) REFERENCES gacha_students(id) ON DELETE CASCADE,
  FOREIGN KEY (chapter_id) REFERENCES med_chapters(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_med_exam_att_acad
  ON med_exam_attempts(academy_id, student_id, status);

CREATE TABLE IF NOT EXISTS med_exam_responses (
  id            TEXT PRIMARY KEY,
  attempt_id    TEXT NOT NULL,
  item_id       TEXT NOT NULL,
  response_json TEXT,
  correct       INTEGER,                         -- 0|1|NULL
  graded_at     DATETIME,
  FOREIGN KEY (attempt_id) REFERENCES med_exam_attempts(id) ON DELETE CASCADE,
  FOREIGN KEY (item_id) REFERENCES med_exam_items(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_med_exam_resp_att ON med_exam_responses(attempt_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_med_exam_resp_item
  ON med_exam_responses(attempt_id, item_id);
