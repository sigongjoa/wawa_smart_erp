-- 학생별 학습 기록 (진도 + 자료 + 학부모 노출 통합)
-- 흡수 대상:
--   study_units, student_study_progress, print_materials,
--   material_archives, archive_files, archive_distributions(scope=student)
-- Phase 1: 신규 테이블만 생성 (구 테이블 그대로 유지)

CREATE TABLE IF NOT EXISTS student_lesson_items (
  id              TEXT PRIMARY KEY,
  academy_id      TEXT NOT NULL,
  student_id      TEXT NOT NULL,

  -- 진도 좌표
  textbook        TEXT,
  unit_name       TEXT,
  kind            TEXT NOT NULL DEFAULT 'unit',  -- 'unit' | 'type' | 'free'
  order_idx       INTEGER NOT NULL DEFAULT 0,

  -- 이해도/상태
  understanding   INTEGER,                       -- 0..100, NULL=미평가
  status          TEXT NOT NULL DEFAULT 'todo',  -- 'todo' | 'in_progress' | 'done'
  note            TEXT,

  -- 자료 메타
  title           TEXT,
  purpose         TEXT,
  topic           TEXT,
  description     TEXT,
  tags            TEXT,                          -- JSON array
  coverage_category TEXT,

  -- 학부모 노출 (scope=student 1종만 사용 → 불리언)
  visible_to_parent     INTEGER NOT NULL DEFAULT 0,
  parent_can_download   INTEGER NOT NULL DEFAULT 1,

  created_by      TEXT NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by      TEXT,
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  archived_at     TEXT,

  FOREIGN KEY (academy_id) REFERENCES academies(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id)  ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id)     ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_sli_student
  ON student_lesson_items(student_id, archived_at, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_sli_academy
  ON student_lesson_items(academy_id, archived_at);
CREATE INDEX IF NOT EXISTS idx_sli_textbook
  ON student_lesson_items(student_id, textbook, kind, order_idx);
CREATE INDEX IF NOT EXISTS idx_sli_parent_visible
  ON student_lesson_items(student_id, visible_to_parent, archived_at);


CREATE TABLE IF NOT EXISTS lesson_item_files (
  id              TEXT PRIMARY KEY,
  lesson_item_id  TEXT NOT NULL,
  r2_key          TEXT NOT NULL,
  file_name       TEXT NOT NULL,
  file_role       TEXT NOT NULL DEFAULT 'main',  -- 'main' | 'answer' | 'solution' | 'extra'
  mime_type       TEXT,
  size_bytes      INTEGER NOT NULL DEFAULT 0,
  version         INTEGER NOT NULL DEFAULT 1,
  uploaded_by     TEXT NOT NULL,
  uploaded_at     TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (lesson_item_id) REFERENCES student_lesson_items(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by)    REFERENCES users(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_lif_item ON lesson_item_files(lesson_item_id);
