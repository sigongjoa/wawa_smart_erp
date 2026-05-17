-- 담임제 / 학부모 상담 / 외부 일정
-- 합의서 4-5 (담임 배정), 4-1 (학부모 상담), 4-2 (타과목/타학원 시간표)

-- 4-5. 담임 플래그: student_teachers에 is_homeroom 추가
ALTER TABLE student_teachers ADD COLUMN is_homeroom INTEGER NOT NULL DEFAULT 0;

-- 학생당 담임은 1명만 (is_homeroom=1 중복 방지)
CREATE UNIQUE INDEX IF NOT EXISTS idx_student_teachers_homeroom_unique
  ON student_teachers(student_id) WHERE is_homeroom = 1;

-- 4-1. 학부모 상담 로그 (학생 담당 선생님 전원이 공유)
CREATE TABLE IF NOT EXISTS consultations (
  id TEXT PRIMARY KEY,
  academy_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  author_id TEXT NOT NULL,          -- 작성 선생님
  channel TEXT NOT NULL,            -- phone | sms | kakao | in_person | other
  category TEXT NOT NULL DEFAULT 'monthly', -- monthly | pre_exam | post_exam | ad_hoc
  consulted_at TEXT NOT NULL,       -- 실제 상담 일시 (ISO)
  subjects TEXT,                    -- JSON array, 다과목 상담 시 과목 태그
  summary TEXT NOT NULL,            -- 상담 요약 (공유 대상 본문)
  parent_sentiment TEXT,            -- positive | neutral | concerned | null
  follow_up TEXT,                   -- 다음 액션/후속 상담 메모
  follow_up_due TEXT,               -- YYYY-MM-DD, 후속 일정
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (academy_id) REFERENCES academies(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_consultations_student_time
  ON consultations(student_id, consulted_at DESC);
CREATE INDEX IF NOT EXISTS idx_consultations_academy
  ON consultations(academy_id, consulted_at DESC);

-- 4-2. 타과목/타학원/시험일정 공유 (학생 소속 담당 선생님 전원 공유)
CREATE TABLE IF NOT EXISTS student_external_schedules (
  id TEXT PRIMARY KEY,
  academy_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
  kind TEXT NOT NULL,               -- other_subject | other_academy | exam | event
  title TEXT NOT NULL,              -- 예: "수학 1:1 (화목 7시)", "중간고사 수학"
  starts_at TEXT,                   -- ISO 또는 YYYY-MM-DD (시험/이벤트용)
  ends_at TEXT,
  recurrence TEXT,                  -- weekly | once | null (자유 표기)
  location TEXT,                    -- 타학원명 등
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (academy_id) REFERENCES academies(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ext_schedule_student
  ON student_external_schedules(student_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_ext_schedule_academy
  ON student_external_schedules(academy_id, starts_at);
