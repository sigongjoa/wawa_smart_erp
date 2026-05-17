-- 교과 선생님이 일상적으로 남기는 학생 상태 메모
-- 담임 대시보드에서 학생별 / 과목별로 종합 조회. 학부모 상담(consultations)과 분리.

CREATE TABLE IF NOT EXISTS student_teacher_notes (
  id              TEXT PRIMARY KEY,
  academy_id      TEXT NOT NULL,
  student_id      TEXT NOT NULL,
  author_id       TEXT NOT NULL,        -- 작성한 교과 선생님 (users.id)
  subject         TEXT NOT NULL,        -- '수학' | '영어' | ... (학원 subjects 어휘)
  category        TEXT NOT NULL,        -- attitude | understanding | homework | exam | etc
  sentiment       TEXT NOT NULL,        -- positive | neutral | concern
  tags            TEXT,                 -- JSON array (예: ["보강필요","집중부족"])
  content         TEXT NOT NULL,        -- 본문 (1~3줄 권장, 최대 1000자)
  source          TEXT NOT NULL DEFAULT 'manual', -- manual | post_class | post_exam | post_assignment
  source_ref_id   TEXT,                 -- exam_id / assignment_id 등 (선택)
  visibility      TEXT NOT NULL DEFAULT 'staff',  -- staff | homeroom_only | parent_share
  period_tag      TEXT NOT NULL,        -- 'YYYY-WW' 또는 'YYYY-MM' (요약 단위 인덱스)
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (academy_id) REFERENCES academies(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (author_id)  REFERENCES users(id)    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_stn_student_time
  ON student_teacher_notes(student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stn_author_time
  ON student_teacher_notes(author_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stn_academy_period
  ON student_teacher_notes(academy_id, period_tag);
CREATE INDEX IF NOT EXISTS idx_stn_subject_time
  ON student_teacher_notes(student_id, subject, created_at DESC);
