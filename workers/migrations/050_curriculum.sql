-- 커리큘럼: 학원 단위 카탈로그(마스터) + 학생 lesson_item에 source/curriculum_item_id 추가
-- 카탈로그 = 학기/학년/과목별로 묶인 유형(또는 단원) 목록
-- 학생 인스턴스는 student_lesson_items에 복사됨 (apply-curriculum API)

CREATE TABLE IF NOT EXISTS curricula (
  id              TEXT PRIMARY KEY,
  academy_id      TEXT NOT NULL,
  term            TEXT NOT NULL,        -- '2026-1' | '2026-여름' | '2026-2'
  grade           TEXT NOT NULL,        -- '중1' | '중2' | '고1' ...
  subject         TEXT NOT NULL,        -- '수학' | '영어' ...
  title           TEXT NOT NULL,        -- '2026-1 중1 수학'
  description     TEXT,
  created_by      TEXT NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  archived_at     TEXT,
  FOREIGN KEY (academy_id) REFERENCES academies(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_curricula_lookup
  ON curricula(academy_id, term, grade, subject, archived_at);

CREATE TABLE IF NOT EXISTS curriculum_items (
  id              TEXT PRIMARY KEY,
  curriculum_id   TEXT NOT NULL,
  textbook        TEXT,
  unit_name       TEXT NOT NULL,
  kind            TEXT NOT NULL DEFAULT 'type',  -- 'unit' | 'type'
  order_idx       INTEGER NOT NULL DEFAULT 0,
  description     TEXT,
  default_purpose TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (curriculum_id) REFERENCES curricula(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_curr_items_parent
  ON curriculum_items(curriculum_id, order_idx);

-- student_lesson_items에 source / curriculum_item_id 컬럼 추가
-- source: 'manual' | 'curriculum' | 'exam_prep' | 'coverage_prescription'
ALTER TABLE student_lesson_items ADD COLUMN curriculum_item_id TEXT
  REFERENCES curriculum_items(id) ON DELETE SET NULL;
ALTER TABLE student_lesson_items ADD COLUMN source TEXT NOT NULL DEFAULT 'manual';

CREATE INDEX IF NOT EXISTS idx_sli_source
  ON student_lesson_items(student_id, source, archived_at);
CREATE INDEX IF NOT EXISTS idx_sli_curriculum
  ON student_lesson_items(curriculum_item_id);

-- 기존 24개 lesson_items는 모두 source='manual' (기본값으로 채워짐)
-- 백필된 sli-arch-* 도 'manual' (자료) — 의미상 OK
