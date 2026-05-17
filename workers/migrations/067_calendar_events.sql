-- 067_calendar_events.sql
-- 학생-강사 공유 캘린더. 5종 카테고리, 날짜 단위, soft delete, 학생 read/완료 체크.
-- 작성 권한:
--   owner_type='academy' → 강사가 학원 공통 일정 등록 (owner_id = academy_id, created_by = user_id)
--   owner_type='student' → 학생이 본인 일정 등록 (owner_id = student_id, created_by = student_id)
-- 가시성:
--   학생: 학원 공통(owner_type=academy) + 본인 일정(owner_id = 본인)
--   강사: academy_id 일치 + (학원 공통 OR student_teachers 매핑으로 담당 학생 일정)

CREATE TABLE IF NOT EXISTS calendar_events (
  id TEXT PRIMARY KEY,
  academy_id TEXT NOT NULL,
  owner_type TEXT NOT NULL CHECK (owner_type IN ('academy','student')),
  owner_id TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('performance','school_exam','external_exam','academy','personal')),
  title TEXT NOT NULL,
  memo TEXT,
  link TEXT,
  start_date TEXT NOT NULL,        -- 'YYYY-MM-DD'
  end_date TEXT,                   -- nullable. NULL이면 단일일 이벤트
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER               -- soft delete
);

CREATE INDEX IF NOT EXISTS idx_cal_events_academy_date
  ON calendar_events(academy_id, start_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cal_events_owner
  ON calendar_events(academy_id, owner_type, owner_id) WHERE deleted_at IS NULL;

-- 학생별 확인/완료 상태 (학원 공통 이벤트에 대해서만 의미 있음)
CREATE TABLE IF NOT EXISTS calendar_event_acks (
  event_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  read_at INTEGER NOT NULL,
  completed_at INTEGER,            -- NULL=미완료, 값=완료
  PRIMARY KEY (event_id, student_id),
  FOREIGN KEY (event_id) REFERENCES calendar_events(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_cal_acks_student ON calendar_event_acks(student_id);
