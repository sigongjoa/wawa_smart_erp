-- =============================================
-- v1.9.0 Timer 시스템 복원 — enrollment + realtime session
-- =============================================
-- 설계 결정:
--   - 한 학생이 월/수/금 각기 다른 시간 수업 가능 → enrollments (학생 1:N)
--   - 실시간 세션은 서버(D1)에 저장 — 탭 닫혀도 유지, 다른 선생님도 봄
--   - 체크아웃 시 attendance_records 로 승격, realtime_sessions 에서는 completed 로 남김
--   - pause_history 는 JSON 문자열 ('[{"pausedAt":"..","resumedAt":"..","reason":".."}]')

-- 1) 수강일정 (학생별 요일/시간/과목)
CREATE TABLE IF NOT EXISTS enrollments (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  day TEXT NOT NULL,            -- '월'|'화'|'수'|'목'|'금'|'토'|'일'
  start_time TEXT NOT NULL,     -- 'HH:mm'
  end_time TEXT NOT NULL,       -- 'HH:mm'
  subject TEXT,                 -- '수학' 등, NULL 허용
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_enrollments_student ON enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_day ON enrollments(day);

-- 2) 실시간 수업 세션 (진행 중 + 완료 후보)
CREATE TABLE IF NOT EXISTS realtime_sessions (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  teacher_id TEXT NOT NULL,         -- 체크인한 선생님 (본인 담당)
  academy_id TEXT NOT NULL,
  date TEXT NOT NULL,                -- 'YYYY-MM-DD' (검색 인덱스용)
  check_in_time TEXT NOT NULL,       -- ISO datetime
  check_out_time TEXT,               -- ISO datetime (체크아웃 전 NULL)
  status TEXT NOT NULL,              -- 'active'|'paused'|'completed'|'overtime'
  scheduled_minutes INTEGER NOT NULL DEFAULT 0,
  added_minutes INTEGER NOT NULL DEFAULT 0,
  scheduled_start_time TEXT,         -- 'HH:mm' (enrollment 에서 복사)
  scheduled_end_time TEXT,           -- 'HH:mm'
  pause_history TEXT NOT NULL DEFAULT '[]',  -- JSON
  subject TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (teacher_id) REFERENCES users(id),
  FOREIGN KEY (academy_id) REFERENCES academies(id)
);

CREATE INDEX IF NOT EXISTS idx_rt_sessions_date ON realtime_sessions(date);
CREATE INDEX IF NOT EXISTS idx_rt_sessions_teacher ON realtime_sessions(teacher_id, date);
CREATE INDEX IF NOT EXISTS idx_rt_sessions_student ON realtime_sessions(student_id, date);
CREATE INDEX IF NOT EXISTS idx_rt_sessions_status ON realtime_sessions(status);

-- 3) 출석 영구 기록 (체크아웃 완료 시 생성)
CREATE TABLE IF NOT EXISTS attendance_records (
  id TEXT PRIMARY KEY,
  session_id TEXT,                    -- 원본 realtime_session 참조 (감사용)
  student_id TEXT NOT NULL,
  teacher_id TEXT NOT NULL,
  academy_id TEXT NOT NULL,
  date TEXT NOT NULL,                  -- 'YYYY-MM-DD'
  check_in_time TEXT NOT NULL,
  check_out_time TEXT NOT NULL,
  scheduled_start_time TEXT,
  scheduled_end_time TEXT,
  scheduled_minutes INTEGER NOT NULL,
  net_minutes INTEGER NOT NULL,        -- 순수 수업시간 (총 - 정지)
  total_paused_minutes INTEGER NOT NULL DEFAULT 0,
  pause_count INTEGER NOT NULL DEFAULT 0,
  pause_history TEXT NOT NULL DEFAULT '[]',
  subject TEXT,
  was_late INTEGER NOT NULL DEFAULT 0,
  was_overtime INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (student_id) REFERENCES students(id),
  FOREIGN KEY (teacher_id) REFERENCES users(id),
  FOREIGN KEY (academy_id) REFERENCES academies(id)
);

CREATE INDEX IF NOT EXISTS idx_att_records_date ON attendance_records(date);
CREATE INDEX IF NOT EXISTS idx_att_records_student ON attendance_records(student_id, date);
CREATE INDEX IF NOT EXISTS idx_att_records_teacher ON attendance_records(teacher_id, date);
