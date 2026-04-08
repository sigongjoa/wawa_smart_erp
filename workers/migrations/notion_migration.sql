-- Notion 데이터 마이그레이션 (2026-04-08T10:11:37.317Z)
-- 생성된 SQL: 285개

-- 테이블 생성
CREATE TABLE IF NOT EXISTS teachers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  pin INTEGER DEFAULT 0,
  isAdmin INTEGER DEFAULT 0,
  subjects TEXT,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS students (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  grade TEXT DEFAULT '0',
  class TEXT DEFAULT '1',
  phone TEXT,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS scores (
  id TEXT PRIMARY KEY,
  student_name TEXT,
  subject TEXT,
  points INTEGER DEFAULT 0,
  exam TEXT,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS exam_schedule (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  date TEXT,
  subject TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS enrollment (
  id TEXT PRIMARY KEY,
  student_name TEXT,
  class_name TEXT DEFAULT '1',
  enroll_date TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS makeup (
  id TEXT PRIMARY KEY,
  student_name TEXT,
  classes_needed TEXT,
  due_date TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  sender TEXT,
  recipient TEXT,
  content TEXT,
  created_at TEXT
);

-- 데이터 삽입
INSERT INTO teachers (id, name, pin, isAdmin, subjects, created_at, updated_at) VALUES ('teacher-1', '김상현', 1234, 1, '영어', '2026-01-31T12:47:00.000Z', '2026-02-09T08:09:00.000Z');
INSERT INTO teachers (id, name, pin, isAdmin, subjects, created_at, updated_at) VALUES ('teacher-2', '지혜영 원장', 8520, 1, '국어,사회', '2026-01-31T08:32:00.000Z', '2026-02-09T07:25:00.000Z');
INSERT INTO teachers (id, name, pin, isAdmin, subjects, created_at, updated_at) VALUES ('teacher-3', '서재용 개발자', 1141, 1, '수학', '2026-01-31T08:34:00.000Z', '2026-02-05T04:26:00.000Z');
INSERT INTO teachers (id, name, pin, isAdmin, subjects, created_at, updated_at) VALUES ('teacher-4', '남현욱', 1312, 0, '과학,수학,화학,생물', '2026-01-31T08:34:00.000Z', '2026-03-12T06:37:00.000Z');
INSERT INTO teachers (id, name, pin, isAdmin, subjects, created_at, updated_at) VALUES ('teacher-5', '김지연', 9150, 0, '수학', '2026-02-02T09:14:00.000Z', '2026-02-05T04:25:00.000Z');
INSERT INTO students (id, name, grade, class, phone, created_at, updated_at) VALUES ('student-1', 'Student 1', '고2', '1', '', '2026-02-04T09:05:00.000Z', '2026-02-04T09:05:00.000Z');
INSERT INTO students (id, name, grade, class, phone, created_at, updated_at) VALUES ('student-2', 'Student 2', '중3', '1', '', '2026-02-04T09:05:00.000Z', '2026-02-04T09:05:00.000Z');
INSERT INTO students (id, name, grade, class, phone, created_at, updated_at) VALUES ('student-3', 'Student 3', '초등학생', '1', '', '2026-02-04T09:05:00.000Z', '2026-02-04T09:05:00.000Z');
INSERT INTO students (id, name, grade, class, phone, created_at, updated_at) VALUES ('student-4', 'Student 4', '중2', '1', '', '2026-02-04T09:05:00.000Z', '2026-02-04T09:05:00.000Z');
INSERT INTO students (id, name, grade, class, phone, created_at, updated_at) VALUES ('student-5', 'Student 5', '중1', '1', '', '2026-02-04T09:05:00.000Z', '2026-03-05T02:25:00.000Z');
INSERT INTO students (id, name, grade, class, phone, created_at, updated_at) VALUES ('student-6', 'Student 6', '고2', '1', '', '2026-02-04T09:05:00.000Z', '2026-03-12T06:40:00.000Z');
INSERT INTO students (id, name, grade, class, phone, created_at, updated_at) VALUES ('student-7', 'Student 7', '고2', '1', '', '2026-02-04T09:05:00.000Z', '2026-02-04T09:05:00.000Z');
INSERT INTO students (id, name, grade, class, phone, created_at, updated_at) VALUES ('student-8', 'Student 8', '중3', '1', '', '2026-02-04T09:05:00.000Z', '2026-04-07T05:55:00.000Z');
INSERT INTO students (id, name, grade, class, phone, created_at, updated_at) VALUES ('student-9', 'Student 9', '고3', '1', '', '2026-02-04T09:05:00.000Z', '2026-04-04T04:06:00.000Z');
INSERT INTO students (id, name, grade, class, phone, created_at, updated_at) VALUES ('student-10', 'Student 10', '초등학생', '1', '', '2026-02-04T09:05:00.000Z', '2026-02-04T09:05:00.000Z');
INSERT INTO students (id, name, grade, class, phone, created_at, updated_at) VALUES ('student-11', 'Student 11', '중3', '1', '', '2026-02-04T09:05:00.000Z', '2026-02-04T09:05:00.000Z');
INSERT INTO students (id, name, grade, class, phone, created_at, updated_at) VALUES ('student-12', 'Student 12', '고2', '1', '', '2026-02-04T09:05:00.000Z', '2026-04-07T04:34:00.000Z');
INSERT INTO students (id, name, grade, class, phone, created_at, updated_at) VALUES ('student-13', 'Student 13', '중3', '1', '', '2026-02-04T09:05:00.000Z', '2026-02-04T09:05:00.000Z');
INSERT INTO students (id, name, grade, class, phone, created_at, updated_at) VALUES ('student-14', 'Student 14', '초등학생', '1', '', '2026-02-04T09:05:00.000Z', '2026-03-13T09:21:00.000Z');
INSERT INTO students (id, name, grade, class, phone, created_at, updated_at) VALUES ('student-15', 'Student 15', '중2', '1', '', '2026-02-04T09:06:00.000Z', '2026-02-04T09:06:00.000Z');
INSERT INTO students (id, name, grade, class, phone, created_at, updated_at) VALUES ('student-16', 'Student 16', '중3', '1', '', '2026-02-04T09:05:00.000Z', '2026-03-24T14:00:00.000Z');
INSERT INTO students (id, name, grade, class, phone, created_at, updated_at) VALUES ('student-17', 'Student 17', '중1', '1', '', '2026-02-04T09:05:00.000Z', '2026-03-24T08:00:00.000Z');
INSERT INTO students (id, name, grade, class, phone, created_at, updated_at) VALUES ('student-18', 'Student 18', '중2', '1', '', '2026-02-04T09:05:00.000Z', '2026-02-04T09:05:00.000Z');
INSERT INTO students (id, name, grade, class, phone, created_at, updated_at) VALUES ('student-19', 'Student 19', '고3', '1', '', '2026-02-04T09:05:00.000Z', '2026-02-04T09:05:00.000Z');
INSERT INTO students (id, name, grade, class, phone, created_at, updated_at) VALUES ('student-20', 'Student 20', '고3', '1', '', '2026-02-04T09:05:00.000Z', '2026-03-28T07:52:00.000Z');
INSERT INTO students (id, name, grade, class, phone, created_at, updated_at) VALUES ('student-21', 'Student 21', '고2', '1', '', '2026-02-04T09:05:00.000Z', '2026-02-04T09:05:00.000Z');
INSERT INTO students (id, name, grade, class, phone, created_at, updated_at) VALUES ('student-22', 'Student 22', '중3', '1', '', '2026-02-04T09:05:00.000Z', '2026-04-04T03:14:00.000Z');
INSERT INTO students (id, name, grade, class, phone, created_at, updated_at) VALUES ('student-23', 'Student 23', '중3', '1', '', '2026-02-04T09:05:00.000Z', '2026-02-04T09:05:00.000Z');
INSERT INTO students (id, name, grade, class, phone, created_at, updated_at) VALUES ('student-24', 'Student 24', '중2', '1', '', '2026-02-04T09:05:00.000Z', '2026-03-24T14:02:00.000Z');
INSERT INTO students (id, name, grade, class, phone, created_at, updated_at) VALUES ('student-25', 'Student 25', '중2', '1', '', '2026-02-04T09:05:00.000Z', '2026-03-05T07:22:00.000Z');
INSERT INTO students (id, name, grade, class, phone, created_at, updated_at) VALUES ('student-26', 'Student 26', '고1', '1', '', '2026-02-04T09:05:00.000Z', '2026-03-30T07:44:00.000Z');
INSERT INTO students (id, name, grade, class, phone, created_at, updated_at) VALUES ('student-27', 'Student 27', '고1', '1', '', '2026-02-04T09:05:00.000Z', '2026-04-02T08:54:00.000Z');
INSERT INTO students (id, name, grade, class, phone, created_at, updated_at) VALUES ('student-28', 'Student 28', '고3', '1', '', '2026-02-04T09:05:00.000Z', '2026-03-28T07:34:00.000Z');
INSERT INTO students (id, name, grade, class, phone, created_at, updated_at) VALUES ('student-29', 'Student 29', '고1', '1', '', '2026-02-04T09:05:00.000Z', '2026-03-05T02:24:00.000Z');
INSERT INTO students (id, name, grade, class, phone, created_at, updated_at) VALUES ('student-30', 'Student 30', '중1', '1', '', '2026-02-04T09:05:00.000Z', '2026-04-04T03:13:00.000Z');
INSERT INTO students (id, name, grade, class, phone, created_at, updated_at) VALUES ('student-31', 'Student 31', '고3', '1', '', '2026-02-04T09:05:00.000Z', '2026-03-26T12:34:00.000Z');
INSERT INTO students (id, name, grade, class, phone, created_at, updated_at) VALUES ('student-32', 'Student 32', '고1', '1', '', '2026-02-04T09:05:00.000Z', '2026-04-07T04:32:00.000Z');
INSERT INTO students (id, name, grade, class, phone, created_at, updated_at) VALUES ('student-33', 'Student 33', '고2', '1', '', '2026-02-04T09:05:00.000Z', '2026-04-04T04:08:00.000Z');
INSERT INTO students (id, name, grade, class, phone, created_at, updated_at) VALUES ('student-34', 'Student 34', '고2', '1', '', '2026-02-04T09:05:00.000Z', '2026-02-04T09:05:00.000Z');
INSERT INTO students (id, name, grade, class, phone, created_at, updated_at) VALUES ('student-35', 'Student 35', '중2', '1', '', '2026-02-04T09:05:00.000Z', '2026-03-10T06:35:00.000Z');
INSERT INTO students (id, name, grade, class, phone, created_at, updated_at) VALUES ('student-36', 'Student 36', '중2', '1', '', '2026-02-04T09:05:00.000Z', '2026-02-04T09:05:00.000Z');
INSERT INTO students (id, name, grade, class, phone, created_at, updated_at) VALUES ('student-37', 'Student 37', '중3', '1', '', '2026-02-09T07:17:00.000Z', '2026-02-09T08:07:00.000Z');
INSERT INTO students (id, name, grade, class, phone, created_at, updated_at) VALUES ('student-38', 'Student 38', '고2', '1', '', '2026-03-03T05:57:00.000Z', '2026-03-21T07:05:00.000Z');
INSERT INTO students (id, name, grade, class, phone, created_at, updated_at) VALUES ('student-39', 'Student 39', '중2', '1', '', '2026-03-05T04:39:00.000Z', '2026-04-07T04:32:00.000Z');
INSERT INTO students (id, name, grade, class, phone, created_at, updated_at) VALUES ('student-40', 'Student 40', '고2', '1', '', '2026-03-05T04:32:00.000Z', '2026-03-05T04:37:00.000Z');
INSERT INTO students (id, name, grade, class, phone, created_at, updated_at) VALUES ('student-41', 'Student 41', '고1', '1', '', '2026-03-05T04:44:00.000Z', '2026-04-08T05:20:00.000Z');
INSERT INTO students (id, name, grade, class, phone, created_at, updated_at) VALUES ('student-42', 'Student 42', '중2', '1', '', '2026-03-10T08:25:00.000Z', '2026-04-07T06:02:00.000Z');
INSERT INTO students (id, name, grade, class, phone, created_at, updated_at) VALUES ('student-43', 'Student 43', '중2', '1', '', '2026-03-30T04:52:00.000Z', '2026-04-07T04:31:00.000Z');
INSERT INTO students (id, name, grade, class, phone, created_at, updated_at) VALUES ('student-44', 'Student 44', '고1', '1', '', '2026-04-03T12:57:00.000Z', '2026-04-03T12:58:00.000Z');
INSERT INTO students (id, name, grade, class, phone, created_at, updated_at) VALUES ('student-45', 'Student 45', '고1', '1', '', '2026-04-03T12:58:00.000Z', '2026-04-03T12:58:00.000Z');
INSERT INTO students (id, name, grade, class, phone, created_at, updated_at) VALUES ('student-46', 'Student 46', '고2', '1', '', '2026-04-04T03:44:00.000Z', '2026-04-04T03:44:00.000Z');
INSERT INTO students (id, name, grade, class, phone, created_at, updated_at) VALUES ('student-47', 'Student 47', 0, '1', '', '2026-04-07T04:31:00.000Z', '2026-04-07T04:31:00.000Z');
INSERT INTO students (id, name, grade, class, phone, created_at, updated_at) VALUES ('student-48', 'Student 48', '중1', '1', '', '2026-04-08T05:34:00.000Z', '2026-04-08T05:54:00.000Z');
INSERT INTO scores (id, student_name, subject, points, exam, created_at, updated_at) VALUES ('score-1', '', '수학', 73, '', '2026-03-21T04:24:00.000Z', '2026-04-07T04:51:00.000Z');
INSERT INTO scores (id, student_name, subject, points, exam, created_at, updated_at) VALUES ('score-2', '', '수학', 34, '', '2026-03-21T04:24:00.000Z', '2026-04-03T10:00:00.000Z');
INSERT INTO scores (id, student_name, subject, points, exam, created_at, updated_at) VALUES ('score-3', '', '수학', 79, '', '2026-03-21T05:00:00.000Z', '2026-04-08T05:11:00.000Z');
INSERT INTO scores (id, student_name, subject, points, exam, created_at, updated_at) VALUES ('score-4', '', '수학', 45, '', '2026-03-21T04:57:00.000Z', '2026-04-07T06:40:00.000Z');
INSERT INTO scores (id, student_name, subject, points, exam, created_at, updated_at) VALUES ('score-5', '', '수학', 60, '', '2026-03-21T06:50:00.000Z', '2026-04-07T06:19:00.000Z');
INSERT INTO scores (id, student_name, subject, points, exam, created_at, updated_at) VALUES ('score-6', '', '수학', 44, '', '2026-03-21T05:25:00.000Z', '2026-04-07T05:50:00.000Z');
INSERT INTO scores (id, student_name, subject, points, exam, created_at, updated_at) VALUES ('score-7', '', '수학', 71, '', '2026-03-21T07:13:00.000Z', '2026-03-21T07:17:00.000Z');
INSERT INTO scores (id, student_name, subject, points, exam, created_at, updated_at) VALUES ('score-8', '', '수학', 33, '', '2026-03-24T13:50:00.000Z', '2026-04-07T06:41:00.000Z');
INSERT INTO scores (id, student_name, subject, points, exam, created_at, updated_at) VALUES ('score-9', '', '국어', 86, '', '2026-03-26T06:08:00.000Z', '2026-04-07T05:50:00.000Z');
INSERT INTO scores (id, student_name, subject, points, exam, created_at, updated_at) VALUES ('score-10', '', '영어', 67, '', '2026-04-03T12:45:00.000Z', '2026-04-03T12:45:00.000Z');
INSERT INTO scores (id, student_name, subject, points, exam, created_at, updated_at) VALUES ('score-11', '', '영어', 80, '', '2026-04-03T12:44:00.000Z', '2026-04-07T05:42:00.000Z');
INSERT INTO scores (id, student_name, subject, points, exam, created_at, updated_at) VALUES ('score-12', '', '영어', 60, '', '2026-04-03T12:43:00.000Z', '2026-04-07T06:08:00.000Z');
INSERT INTO scores (id, student_name, subject, points, exam, created_at, updated_at) VALUES ('score-13', '', '수학', 7, '', '2026-04-03T10:35:00.000Z', '2026-04-07T04:56:00.000Z');
INSERT INTO scores (id, student_name, subject, points, exam, created_at, updated_at) VALUES ('score-14', '', '영어', 13, '', '2026-04-03T12:46:00.000Z', '2026-04-07T05:50:00.000Z');
INSERT INTO scores (id, student_name, subject, points, exam, created_at, updated_at) VALUES ('score-15', '', '수학', 27, '', '2026-04-03T10:35:00.000Z', '2026-04-07T06:08:00.000Z');
INSERT INTO scores (id, student_name, subject, points, exam, created_at, updated_at) VALUES ('score-16', '', '수학', 20, '', '2026-04-03T10:36:00.000Z', '2026-04-07T05:05:00.000Z');
INSERT INTO scores (id, student_name, subject, points, exam, created_at, updated_at) VALUES ('score-17', '', '영어', 47, '', '2026-04-03T12:47:00.000Z', '2026-04-03T12:47:00.000Z');
INSERT INTO scores (id, student_name, subject, points, exam, created_at, updated_at) VALUES ('score-18', '', '영어', 67, '', '2026-04-03T12:41:00.000Z', '2026-04-07T07:07:00.000Z');
INSERT INTO scores (id, student_name, subject, points, exam, created_at, updated_at) VALUES ('score-19', '', '수학', 16, '', '2026-04-03T10:35:00.000Z', '2026-04-07T04:47:00.000Z');
INSERT INTO scores (id, student_name, subject, points, exam, created_at, updated_at) VALUES ('score-20', '', '영어', 53, '', '2026-04-03T12:40:00.000Z', '2026-04-07T04:51:00.000Z');
INSERT INTO scores (id, student_name, subject, points, exam, created_at, updated_at) VALUES ('score-21', '', '영어', 33, '', '2026-04-03T12:40:00.000Z', '2026-04-07T11:41:00.000Z');
INSERT INTO scores (id, student_name, subject, points, exam, created_at, updated_at) VALUES ('score-22', '', '국어', 77, '', '2026-04-03T12:38:00.000Z', '2026-04-08T08:02:00.000Z');
INSERT INTO scores (id, student_name, subject, points, exam, created_at, updated_at) VALUES ('score-23', '', '수학', 34, '', '2026-04-03T10:35:00.000Z', '2026-04-07T11:41:00.000Z');
INSERT INTO scores (id, student_name, subject, points, exam, created_at, updated_at) VALUES ('score-24', '', '영어', 80, '', '2026-04-03T12:45:00.000Z', '2026-04-03T12:45:00.000Z');
INSERT INTO scores (id, student_name, subject, points, exam, created_at, updated_at) VALUES ('score-25', '', '영어', 20, '', '2026-04-03T12:42:00.000Z', '2026-04-03T12:42:00.000Z');
INSERT INTO scores (id, student_name, subject, points, exam, created_at, updated_at) VALUES ('score-26', '', '영어', 20, '', '2026-04-03T12:42:00.000Z', '2026-04-03T12:42:00.000Z');
INSERT INTO scores (id, student_name, subject, points, exam, created_at, updated_at) VALUES ('score-27', '', '영어', 73, '', '2026-04-03T12:37:00.000Z', '2026-04-03T12:37:00.000Z');
INSERT INTO scores (id, student_name, subject, points, exam, created_at, updated_at) VALUES ('score-28', '', '영어', 60, '', '2026-04-03T12:39:00.000Z', '2026-04-03T12:39:00.000Z');
INSERT INTO scores (id, student_name, subject, points, exam, created_at, updated_at) VALUES ('score-29', '', '수학', 80, '', '2026-04-03T10:36:00.000Z', '2026-04-08T06:42:00.000Z');
INSERT INTO scores (id, student_name, subject, points, exam, created_at, updated_at) VALUES ('score-30', '', '수학', 41, '', '2026-04-03T10:34:00.000Z', '2026-04-07T05:51:00.000Z');
INSERT INTO scores (id, student_name, subject, points, exam, created_at, updated_at) VALUES ('score-31', '', '영어', 20, '', '2026-04-03T12:39:00.000Z', '2026-04-03T12:39:00.000Z');
INSERT INTO scores (id, student_name, subject, points, exam, created_at, updated_at) VALUES ('score-32', '', '수학', 16, '', '2026-04-03T10:33:00.000Z', '2026-04-07T04:36:00.000Z');
INSERT INTO scores (id, student_name, subject, points, exam, created_at, updated_at) VALUES ('score-33', '', '영어', 40, '', '2026-04-03T12:38:00.000Z', '2026-04-03T12:38:00.000Z');
INSERT INTO scores (id, student_name, subject, points, exam, created_at, updated_at) VALUES ('score-34', '', '수학', 54, '', '2026-04-03T10:35:00.000Z', '2026-04-07T06:32:00.000Z');
INSERT INTO scores (id, student_name, subject, points, exam, created_at, updated_at) VALUES ('score-35', '', '영어', 53, '', '2026-04-03T12:44:00.000Z', '2026-04-07T06:26:00.000Z');
INSERT INTO scores (id, student_name, subject, points, exam, created_at, updated_at) VALUES ('score-36', '', '영어', 73, '', '2026-04-03T12:45:00.000Z', '2026-04-03T12:45:00.000Z');
INSERT INTO scores (id, student_name, subject, points, exam, created_at, updated_at) VALUES ('score-37', '', '수학', 47, '', '2026-04-03T10:33:00.000Z', '2026-04-08T05:19:00.000Z');
INSERT INTO scores (id, student_name, subject, points, exam, created_at, updated_at) VALUES ('score-38', '', '영어', 40, '', '2026-04-03T12:43:00.000Z', '2026-04-07T05:51:00.000Z');
INSERT INTO scores (id, student_name, subject, points, exam, created_at, updated_at) VALUES ('score-39', '', '수학', 34, '', '2026-04-03T10:34:00.000Z', '2026-04-07T04:59:00.000Z');
INSERT INTO scores (id, student_name, subject, points, exam, created_at, updated_at) VALUES ('score-40', '', '영어', 87, '', '2026-04-03T12:42:00.000Z', '2026-04-07T06:12:00.000Z');
INSERT INTO scores (id, student_name, subject, points, exam, created_at, updated_at) VALUES ('score-41', '', '영어', 27, '', '2026-04-03T12:40:00.000Z', '2026-04-03T12:40:00.000Z');
INSERT INTO scores (id, student_name, subject, points, exam, created_at, updated_at) VALUES ('score-42', '', '영어', 27, '', '2026-04-03T12:44:00.000Z', '2026-04-07T06:32:00.000Z');
INSERT INTO scores (id, student_name, subject, points, exam, created_at, updated_at) VALUES ('score-43', '', '수학', 21, '', '2026-04-03T10:34:00.000Z', '2026-04-08T05:23:00.000Z');
INSERT INTO scores (id, student_name, subject, points, exam, created_at, updated_at) VALUES ('score-44', '', '과학', 73, '', '2026-04-06T05:21:00.000Z', '2026-04-06T05:22:00.000Z');
INSERT INTO scores (id, student_name, subject, points, exam, created_at, updated_at) VALUES ('score-45', '', '과학', 27, '', '2026-04-06T05:34:00.000Z', '2026-04-06T05:34:00.000Z');
INSERT INTO scores (id, student_name, subject, points, exam, created_at, updated_at) VALUES ('score-46', '', '과학', 60, '', '2026-04-06T05:46:00.000Z', '2026-04-07T04:51:00.000Z');
INSERT INTO scores (id, student_name, subject, points, exam, created_at, updated_at) VALUES ('score-47', '', '수학', 87, '', '2026-04-06T11:36:00.000Z', '2026-04-07T07:07:00.000Z');
INSERT INTO scores (id, student_name, subject, points, exam, created_at, updated_at) VALUES ('score-48', '', '과학', 80, '', '2026-04-06T05:19:00.000Z', '2026-04-07T06:01:00.000Z');
INSERT INTO scores (id, student_name, subject, points, exam, created_at, updated_at) VALUES ('score-49', '', '과학', 27, '', '2026-04-06T05:31:00.000Z', '2026-04-06T05:32:00.000Z');
INSERT INTO scores (id, student_name, subject, points, exam, created_at, updated_at) VALUES ('score-50', '', '과학', 73, '', '2026-04-06T05:20:00.000Z', '2026-04-07T06:40:00.000Z');
INSERT INTO scores (id, student_name, subject, points, exam, created_at, updated_at) VALUES ('score-51', '', '과학', 53, '', '2026-04-06T05:54:00.000Z', '2026-04-06T05:55:00.000Z');
INSERT INTO scores (id, student_name, subject, points, exam, created_at, updated_at) VALUES ('score-52', '', '과학', 93, '', '2026-04-06T05:20:00.000Z', '2026-04-06T05:20:00.000Z');
INSERT INTO scores (id, student_name, subject, points, exam, created_at, updated_at) VALUES ('score-53', '', '수학', 73, '', '2026-04-06T10:33:00.000Z', '2026-04-06T10:33:00.000Z');
INSERT INTO scores (id, student_name, subject, points, exam, created_at, updated_at) VALUES ('score-54', '', '과학', 53, '', '2026-04-06T07:09:00.000Z', '2026-04-06T07:10:00.000Z');
INSERT INTO scores (id, student_name, subject, points, exam, created_at, updated_at) VALUES ('score-55', '', '과학', 40, '', '2026-04-06T05:56:00.000Z', '2026-04-06T05:56:00.000Z');
INSERT INTO scores (id, student_name, subject, points, exam, created_at, updated_at) VALUES ('score-56', '', '과학', 87, '', '2026-04-06T10:03:00.000Z', '2026-04-06T10:26:00.000Z');
INSERT INTO scores (id, student_name, subject, points, exam, created_at, updated_at) VALUES ('score-57', '', '과학', 53, '', '2026-04-06T05:24:00.000Z', '2026-04-07T05:45:00.000Z');
INSERT INTO scores (id, student_name, subject, points, exam, created_at, updated_at) VALUES ('score-58', '', '과학', 33, '', '2026-04-06T05:31:00.000Z', '2026-04-06T05:33:00.000Z');
INSERT INTO scores (id, student_name, subject, points, exam, created_at, updated_at) VALUES ('score-59', '', '과학', 20, '', '2026-04-06T05:31:00.000Z', '2026-04-06T05:31:00.000Z');
INSERT INTO scores (id, student_name, subject, points, exam, created_at, updated_at) VALUES ('score-60', '', '수학', 33, '', '2026-04-06T10:33:00.000Z', '2026-04-06T10:33:00.000Z');
INSERT INTO scores (id, student_name, subject, points, exam, created_at, updated_at) VALUES ('score-61', '', '화학', 40, '', '2026-04-06T10:28:00.000Z', '2026-04-06T10:28:00.000Z');
INSERT INTO scores (id, student_name, subject, points, exam, created_at, updated_at) VALUES ('score-62', '', '과학', 73, '', '2026-04-06T05:19:00.000Z', '2026-04-07T07:07:00.000Z');
INSERT INTO scores (id, student_name, subject, points, exam, created_at, updated_at) VALUES ('score-63', '', '과학', 93, '', '2026-04-06T10:01:00.000Z', '2026-04-07T06:26:00.000Z');
INSERT INTO scores (id, student_name, subject, points, exam, created_at, updated_at) VALUES ('score-64', '', '과학', 60, '', '2026-04-06T05:20:00.000Z', '2026-04-07T05:50:00.000Z');
INSERT INTO scores (id, student_name, subject, points, exam, created_at, updated_at) VALUES ('score-65', '', '수학', 87, '', '2026-04-06T10:01:00.000Z', '2026-04-07T06:26:00.000Z');
INSERT INTO scores (id, student_name, subject, points, exam, created_at, updated_at) VALUES ('score-66', '', '생물', 80, '', '2026-04-06T10:29:00.000Z', '2026-04-06T10:29:00.000Z');
INSERT INTO scores (id, student_name, subject, points, exam, created_at, updated_at) VALUES ('score-67', '', '', 0, '', '2026-04-07T06:06:00.000Z', '2026-04-07T06:06:00.000Z');
INSERT INTO scores (id, student_name, subject, points, exam, created_at, updated_at) VALUES ('score-68', '', '', 0, '', '2026-04-07T06:11:00.000Z', '2026-04-07T06:12:00.000Z');
INSERT INTO scores (id, student_name, subject, points, exam, created_at, updated_at) VALUES ('score-69', '', '국어', 93, '', '2026-04-07T06:49:00.000Z', '2026-04-07T07:07:00.000Z');
INSERT INTO scores (id, student_name, subject, points, exam, created_at, updated_at) VALUES ('score-70', '', '', 0, '', '2026-04-07T06:00:00.000Z', '2026-04-07T06:01:00.000Z');
INSERT INTO scores (id, student_name, subject, points, exam, created_at, updated_at) VALUES ('score-71', '', '영어', 60, '', '2026-04-07T05:08:00.000Z', '2026-04-08T05:11:00.000Z');
INSERT INTO scores (id, student_name, subject, points, exam, created_at, updated_at) VALUES ('score-72', '', '', 0, '', '2026-04-07T05:41:00.000Z', '2026-04-08T06:52:00.000Z');
INSERT INTO scores (id, student_name, subject, points, exam, created_at, updated_at) VALUES ('score-73', '', '', 0, '', '2026-04-07T05:27:00.000Z', '2026-04-07T05:53:00.000Z');
INSERT INTO scores (id, student_name, subject, points, exam, created_at, updated_at) VALUES ('score-74', '', '', 0, '', '2026-04-07T06:08:00.000Z', '2026-04-07T06:08:00.000Z');
INSERT INTO scores (id, student_name, subject, points, exam, created_at, updated_at) VALUES ('score-75', '', '', 0, '', '2026-04-07T06:31:00.000Z', '2026-04-07T06:32:00.000Z');
INSERT INTO scores (id, student_name, subject, points, exam, created_at, updated_at) VALUES ('score-76', '', '역사', 53, '', '2026-04-07T06:37:00.000Z', '2026-04-07T06:40:00.000Z');
INSERT INTO scores (id, student_name, subject, points, exam, created_at, updated_at) VALUES ('score-77', '', '국어', 73, '', '2026-04-07T06:05:00.000Z', '2026-04-07T06:06:00.000Z');
INSERT INTO scores (id, student_name, subject, points, exam, created_at, updated_at) VALUES ('score-78', '', '', 0, '', '2026-04-07T06:41:00.000Z', '2026-04-07T06:41:00.000Z');
INSERT INTO scores (id, student_name, subject, points, exam, created_at, updated_at) VALUES ('score-79', '', '', 0, '', '2026-04-07T06:39:00.000Z', '2026-04-07T06:40:00.000Z');
INSERT INTO scores (id, student_name, subject, points, exam, created_at, updated_at) VALUES ('score-80', '', '국어', 45, '', '2026-04-07T04:30:00.000Z', '2026-04-08T05:19:00.000Z');
INSERT INTO scores (id, student_name, subject, points, exam, created_at, updated_at) VALUES ('score-81', '', '영어', 60, '', '2026-04-07T05:08:00.000Z', '2026-04-07T05:08:00.000Z');
INSERT INTO scores (id, student_name, subject, points, exam, created_at, updated_at) VALUES ('score-82', '', '', 0, '', '2026-04-07T05:44:00.000Z', '2026-04-07T05:45:00.000Z');
INSERT INTO scores (id, student_name, subject, points, exam, created_at, updated_at) VALUES ('score-83', '', '', 0, '', '2026-04-07T05:51:00.000Z', '2026-04-07T05:51:00.000Z');
INSERT INTO scores (id, student_name, subject, points, exam, created_at, updated_at) VALUES ('score-84', '', '국어', 73, '', '2026-04-07T06:00:00.000Z', '2026-04-07T06:01:00.000Z');
INSERT INTO scores (id, student_name, subject, points, exam, created_at, updated_at) VALUES ('score-85', '', '', 0, '', '2026-04-07T05:39:00.000Z', '2026-04-08T05:31:00.000Z');
INSERT INTO scores (id, student_name, subject, points, exam, created_at, updated_at) VALUES ('score-86', '', '국어', 86, '', '2026-04-07T06:10:00.000Z', '2026-04-07T06:12:00.000Z');
INSERT INTO scores (id, student_name, subject, points, exam, created_at, updated_at) VALUES ('score-87', '', '국어', 54, '', '2026-04-07T06:30:00.000Z', '2026-04-07T06:32:00.000Z');
INSERT INTO scores (id, student_name, subject, points, exam, created_at, updated_at) VALUES ('score-88', '', '국어', 60, '', '2026-04-07T06:36:00.000Z', '2026-04-07T06:40:00.000Z');
INSERT INTO scores (id, student_name, subject, points, exam, created_at, updated_at) VALUES ('score-89', '', '역사', 60, '', '2026-04-07T06:50:00.000Z', '2026-04-07T07:07:00.000Z');
INSERT INTO scores (id, student_name, subject, points, exam, created_at, updated_at) VALUES ('score-90', '', '국어', 100, '', '2026-04-07T06:23:00.000Z', '2026-04-07T06:26:00.000Z');
INSERT INTO scores (id, student_name, subject, points, exam, created_at, updated_at) VALUES ('score-91', '', '', 0, '', '2026-04-07T11:40:00.000Z', '2026-04-07T11:41:00.000Z');
INSERT INTO scores (id, student_name, subject, points, exam, created_at, updated_at) VALUES ('score-92', '', '', 0, '', '2026-04-07T06:56:00.000Z', '2026-04-07T07:07:00.000Z');
INSERT INTO scores (id, student_name, subject, points, exam, created_at, updated_at) VALUES ('score-93', '', '', 0, '', '2026-04-07T06:18:00.000Z', '2026-04-07T06:19:00.000Z');
INSERT INTO scores (id, student_name, subject, points, exam, created_at, updated_at) VALUES ('score-94', '', '', 0, '', '2026-04-07T05:48:00.000Z', '2026-04-07T05:50:00.000Z');
INSERT INTO scores (id, student_name, subject, points, exam, created_at, updated_at) VALUES ('score-95', '', '역사', 80, '', '2026-04-07T05:57:00.000Z', '2026-04-07T06:01:00.000Z');
INSERT INTO scores (id, student_name, subject, points, exam, created_at, updated_at) VALUES ('score-96', '', '국어', 67, '', '2026-04-07T04:37:00.000Z', '2026-04-07T05:45:00.000Z');
INSERT INTO scores (id, student_name, subject, points, exam, created_at, updated_at) VALUES ('score-97', '', '영어', 33, '', '2026-04-07T05:09:00.000Z', '2026-04-07T05:09:00.000Z');
INSERT INTO scores (id, student_name, subject, points, exam, created_at, updated_at) VALUES ('score-98', '', '국어', 50, '', '2026-04-07T07:10:00.000Z', '2026-04-07T11:41:00.000Z');
INSERT INTO scores (id, student_name, subject, points, exam, created_at, updated_at) VALUES ('score-99', '', '', 0, '', '2026-04-07T06:25:00.000Z', '2026-04-07T06:26:00.000Z');
INSERT INTO scores (id, student_name, subject, points, exam, created_at, updated_at) VALUES ('score-100', '', '국어', 45, '', '2026-04-08T08:09:00.000Z', '2026-04-08T08:37:00.000Z');
INSERT INTO exam_schedule (id, name, date, subject, created_at) VALUES ('exam-1', 'Exam 1', '2026-02-20', '', '2026-02-02T13:37:00.000Z');
INSERT INTO exam_schedule (id, name, date, subject, created_at) VALUES ('exam-2', 'Exam 2', '2026-02-20', '', '2026-02-02T13:37:00.000Z');
INSERT INTO exam_schedule (id, name, date, subject, created_at) VALUES ('exam-3', 'Exam 3', '2026-02-20', '', '2026-02-02T13:37:00.000Z');
INSERT INTO exam_schedule (id, name, date, subject, created_at) VALUES ('exam-4', 'Exam 4', '2026-02-20', '', '2026-02-02T13:37:00.000Z');
INSERT INTO enrollment (id, student_name, class_name, enroll_date, created_at) VALUES ('enrollment-1', '', '1', '2026-04-08', '2026-02-03T07:27:00.000Z');
INSERT INTO enrollment (id, student_name, class_name, enroll_date, created_at) VALUES ('enrollment-2', '', '1', '2026-04-08', '2026-02-03T07:27:00.000Z');
INSERT INTO enrollment (id, student_name, class_name, enroll_date, created_at) VALUES ('enrollment-3', '', '1', '2026-04-08', '2026-02-03T07:27:00.000Z');
INSERT INTO enrollment (id, student_name, class_name, enroll_date, created_at) VALUES ('enrollment-4', '', '1', '2026-04-08', '2026-02-03T07:27:00.000Z');
INSERT INTO enrollment (id, student_name, class_name, enroll_date, created_at) VALUES ('enrollment-5', '', '1', '2026-04-08', '2026-02-03T07:27:00.000Z');
INSERT INTO enrollment (id, student_name, class_name, enroll_date, created_at) VALUES ('enrollment-6', '', '1', '2026-04-08', '2026-02-03T07:27:00.000Z');
INSERT INTO enrollment (id, student_name, class_name, enroll_date, created_at) VALUES ('enrollment-7', '', '1', '2026-04-08', '2026-02-03T07:27:00.000Z');
INSERT INTO enrollment (id, student_name, class_name, enroll_date, created_at) VALUES ('enrollment-8', '', '1', '2026-04-08', '2026-02-03T07:27:00.000Z');
INSERT INTO enrollment (id, student_name, class_name, enroll_date, created_at) VALUES ('enrollment-9', '', '1', '2026-04-08', '2026-02-06T14:38:00.000Z');
INSERT INTO enrollment (id, student_name, class_name, enroll_date, created_at) VALUES ('enrollment-10', '', '1', '2026-04-08', '2026-02-06T14:39:00.000Z');
INSERT INTO enrollment (id, student_name, class_name, enroll_date, created_at) VALUES ('enrollment-11', '', '1', '2026-04-08', '2026-02-06T14:38:00.000Z');
INSERT INTO enrollment (id, student_name, class_name, enroll_date, created_at) VALUES ('enrollment-12', '', '1', '2026-04-08', '2026-02-06T14:38:00.000Z');
INSERT INTO enrollment (id, student_name, class_name, enroll_date, created_at) VALUES ('enrollment-13', '', '1', '2026-04-08', '2026-02-06T14:39:00.000Z');
INSERT INTO enrollment (id, student_name, class_name, enroll_date, created_at) VALUES ('enrollment-14', '', '1', '2026-04-08', '2026-02-06T14:39:00.000Z');
INSERT INTO enrollment (id, student_name, class_name, enroll_date, created_at) VALUES ('enrollment-15', '', '1', '2026-04-08', '2026-02-06T14:39:00.000Z');
INSERT INTO enrollment (id, student_name, class_name, enroll_date, created_at) VALUES ('enrollment-16', '', '1', '2026-04-08', '2026-02-06T14:39:00.000Z');
INSERT INTO enrollment (id, student_name, class_name, enroll_date, created_at) VALUES ('enrollment-17', '', '1', '2026-04-08', '2026-02-06T14:39:00.000Z');
INSERT INTO enrollment (id, student_name, class_name, enroll_date, created_at) VALUES ('enrollment-18', '', '1', '2026-04-08', '2026-02-06T14:38:00.000Z');
INSERT INTO enrollment (id, student_name, class_name, enroll_date, created_at) VALUES ('enrollment-19', '', '1', '2026-04-08', '2026-02-06T14:38:00.000Z');
INSERT INTO enrollment (id, student_name, class_name, enroll_date, created_at) VALUES ('enrollment-20', '', '1', '2026-04-08', '2026-02-06T14:39:00.000Z');
INSERT INTO enrollment (id, student_name, class_name, enroll_date, created_at) VALUES ('enrollment-21', '', '1', '2026-04-08', '2026-02-06T14:38:00.000Z');
INSERT INTO enrollment (id, student_name, class_name, enroll_date, created_at) VALUES ('enrollment-22', '', '1', '2026-04-08', '2026-02-09T08:07:00.000Z');
INSERT INTO enrollment (id, student_name, class_name, enroll_date, created_at) VALUES ('enrollment-23', '', '1', '2026-04-08', '2026-02-09T07:26:00.000Z');
INSERT INTO enrollment (id, student_name, class_name, enroll_date, created_at) VALUES ('enrollment-24', '', '1', '2026-04-08', '2026-02-09T07:17:00.000Z');
INSERT INTO enrollment (id, student_name, class_name, enroll_date, created_at) VALUES ('enrollment-25', '', '1', '2026-04-08', '2026-02-09T07:17:00.000Z');
INSERT INTO enrollment (id, student_name, class_name, enroll_date, created_at) VALUES ('enrollment-26', '', '1', '2026-04-08', '2026-02-09T07:27:00.000Z');
INSERT INTO enrollment (id, student_name, class_name, enroll_date, created_at) VALUES ('enrollment-27', '', '1', '2026-04-08', '2026-02-09T07:27:00.000Z');
INSERT INTO enrollment (id, student_name, class_name, enroll_date, created_at) VALUES ('enrollment-28', '', '1', '2026-04-08', '2026-02-09T08:07:00.000Z');
INSERT INTO enrollment (id, student_name, class_name, enroll_date, created_at) VALUES ('enrollment-29', '', '1', '2026-04-08', '2026-02-09T07:17:00.000Z');
INSERT INTO enrollment (id, student_name, class_name, enroll_date, created_at) VALUES ('enrollment-30', '', '1', '2026-04-08', '2026-02-09T07:25:00.000Z');
INSERT INTO enrollment (id, student_name, class_name, enroll_date, created_at) VALUES ('enrollment-31', '', '1', '2026-04-08', '2026-02-09T07:29:00.000Z');
INSERT INTO enrollment (id, student_name, class_name, enroll_date, created_at) VALUES ('enrollment-32', '', '1', '2026-04-08', '2026-02-09T07:27:00.000Z');
INSERT INTO enrollment (id, student_name, class_name, enroll_date, created_at) VALUES ('enrollment-33', '', '1', '2026-04-08', '2026-02-09T07:25:00.000Z');
INSERT INTO enrollment (id, student_name, class_name, enroll_date, created_at) VALUES ('enrollment-34', '', '1', '2026-04-08', '2026-02-09T07:25:00.000Z');
INSERT INTO enrollment (id, student_name, class_name, enroll_date, created_at) VALUES ('enrollment-35', '', '1', '2026-04-08', '2026-02-09T07:17:00.000Z');
INSERT INTO enrollment (id, student_name, class_name, enroll_date, created_at) VALUES ('enrollment-36', '', '1', '2026-04-08', '2026-02-09T07:17:00.000Z');
INSERT INTO enrollment (id, student_name, class_name, enroll_date, created_at) VALUES ('enrollment-37', '', '1', '2026-04-08', '2026-02-09T07:29:00.000Z');
INSERT INTO enrollment (id, student_name, class_name, enroll_date, created_at) VALUES ('enrollment-38', '', '1', '2026-04-08', '2026-02-10T05:20:00.000Z');
INSERT INTO enrollment (id, student_name, class_name, enroll_date, created_at) VALUES ('enrollment-39', '', '1', '2026-04-08', '2026-02-10T05:18:00.000Z');
INSERT INTO enrollment (id, student_name, class_name, enroll_date, created_at) VALUES ('enrollment-40', '', '1', '2026-04-08', '2026-02-10T05:20:00.000Z');
INSERT INTO enrollment (id, student_name, class_name, enroll_date, created_at) VALUES ('enrollment-41', '', '1', '2026-04-08', '2026-03-03T05:57:00.000Z');
INSERT INTO enrollment (id, student_name, class_name, enroll_date, created_at) VALUES ('enrollment-42', '', '1', '2026-04-08', '2026-03-03T05:57:00.000Z');
INSERT INTO enrollment (id, student_name, class_name, enroll_date, created_at) VALUES ('enrollment-43', '', '1', '2026-04-08', '2026-03-03T05:57:00.000Z');
INSERT INTO enrollment (id, student_name, class_name, enroll_date, created_at) VALUES ('enrollment-44', '', '1', '2026-04-08', '2026-03-03T05:55:00.000Z');
INSERT INTO enrollment (id, student_name, class_name, enroll_date, created_at) VALUES ('enrollment-45', '', '1', '2026-04-08', '2026-03-03T05:55:00.000Z');
INSERT INTO enrollment (id, student_name, class_name, enroll_date, created_at) VALUES ('enrollment-46', '', '1', '2026-04-08', '2026-03-05T04:32:00.000Z');
INSERT INTO enrollment (id, student_name, class_name, enroll_date, created_at) VALUES ('enrollment-47', '', '1', '2026-04-08', '2026-03-05T06:32:00.000Z');
INSERT INTO enrollment (id, student_name, class_name, enroll_date, created_at) VALUES ('enrollment-48', '', '1', '2026-04-08', '2026-03-05T04:32:00.000Z');
INSERT INTO enrollment (id, student_name, class_name, enroll_date, created_at) VALUES ('enrollment-49', '', '1', '2026-04-08', '2026-03-05T05:20:00.000Z');
INSERT INTO enrollment (id, student_name, class_name, enroll_date, created_at) VALUES ('enrollment-50', '', '1', '2026-04-08', '2026-03-07T01:57:00.000Z');
INSERT INTO enrollment (id, student_name, class_name, enroll_date, created_at) VALUES ('enrollment-51', '', '1', '2026-04-08', '2026-03-10T07:41:00.000Z');
INSERT INTO enrollment (id, student_name, class_name, enroll_date, created_at) VALUES ('enrollment-52', '', '1', '2026-04-08', '2026-03-10T08:25:00.000Z');
INSERT INTO enrollment (id, student_name, class_name, enroll_date, created_at) VALUES ('enrollment-53', '', '1', '2026-04-08', '2026-03-10T08:25:00.000Z');
INSERT INTO enrollment (id, student_name, class_name, enroll_date, created_at) VALUES ('enrollment-54', '', '1', '2026-04-08', '2026-03-10T07:41:00.000Z');
INSERT INTO enrollment (id, student_name, class_name, enroll_date, created_at) VALUES ('enrollment-55', '', '1', '2026-04-08', '2026-03-12T06:34:00.000Z');
INSERT INTO enrollment (id, student_name, class_name, enroll_date, created_at) VALUES ('enrollment-56', '', '1', '2026-04-08', '2026-03-12T06:34:00.000Z');
INSERT INTO enrollment (id, student_name, class_name, enroll_date, created_at) VALUES ('enrollment-57', '', '1', '2026-04-08', '2026-03-20T08:03:00.000Z');
INSERT INTO enrollment (id, student_name, class_name, enroll_date, created_at) VALUES ('enrollment-58', '', '1', '2026-04-08', '2026-03-24T14:01:00.000Z');
INSERT INTO enrollment (id, student_name, class_name, enroll_date, created_at) VALUES ('enrollment-59', '', '1', '2026-04-08', '2026-03-24T07:11:00.000Z');
INSERT INTO enrollment (id, student_name, class_name, enroll_date, created_at) VALUES ('enrollment-60', '', '1', '2026-04-08', '2026-03-24T14:02:00.000Z');
INSERT INTO enrollment (id, student_name, class_name, enroll_date, created_at) VALUES ('enrollment-61', '', '1', '2026-04-08', '2026-03-24T14:02:00.000Z');
INSERT INTO enrollment (id, student_name, class_name, enroll_date, created_at) VALUES ('enrollment-62', '', '1', '2026-04-08', '2026-03-24T08:00:00.000Z');
INSERT INTO enrollment (id, student_name, class_name, enroll_date, created_at) VALUES ('enrollment-63', '', '1', '2026-04-08', '2026-03-24T14:01:00.000Z');
INSERT INTO enrollment (id, student_name, class_name, enroll_date, created_at) VALUES ('enrollment-64', '', '1', '2026-04-08', '2026-03-24T14:00:00.000Z');
INSERT INTO enrollment (id, student_name, class_name, enroll_date, created_at) VALUES ('enrollment-65', '', '1', '2026-04-08', '2026-03-24T07:11:00.000Z');
INSERT INTO enrollment (id, student_name, class_name, enroll_date, created_at) VALUES ('enrollment-66', '', '1', '2026-04-08', '2026-03-24T14:00:00.000Z');
INSERT INTO enrollment (id, student_name, class_name, enroll_date, created_at) VALUES ('enrollment-67', '', '1', '2026-04-08', '2026-03-26T10:34:00.000Z');
INSERT INTO enrollment (id, student_name, class_name, enroll_date, created_at) VALUES ('enrollment-68', '', '1', '2026-04-08', '2026-03-26T12:34:00.000Z');
INSERT INTO enrollment (id, student_name, class_name, enroll_date, created_at) VALUES ('enrollment-69', '', '1', '2026-04-08', '2026-03-26T12:34:00.000Z');
INSERT INTO enrollment (id, student_name, class_name, enroll_date, created_at) VALUES ('enrollment-70', '', '1', '2026-04-08', '2026-03-26T05:11:00.000Z');
INSERT INTO enrollment (id, student_name, class_name, enroll_date, created_at) VALUES ('enrollment-71', '', '1', '2026-04-08', '2026-03-26T12:32:00.000Z');
INSERT INTO enrollment (id, student_name, class_name, enroll_date, created_at) VALUES ('enrollment-72', '', '1', '2026-04-08', '2026-03-28T07:34:00.000Z');
INSERT INTO enrollment (id, student_name, class_name, enroll_date, created_at) VALUES ('enrollment-73', '', '1', '2026-04-08', '2026-03-28T07:34:00.000Z');
INSERT INTO enrollment (id, student_name, class_name, enroll_date, created_at) VALUES ('enrollment-74', '', '1', '2026-04-08', '2026-03-28T03:02:00.000Z');
INSERT INTO enrollment (id, student_name, class_name, enroll_date, created_at) VALUES ('enrollment-75', '', '1', '2026-04-08', '2026-03-28T03:15:00.000Z');
INSERT INTO enrollment (id, student_name, class_name, enroll_date, created_at) VALUES ('enrollment-76', '', '1', '2026-04-08', '2026-03-28T07:52:00.000Z');
INSERT INTO enrollment (id, student_name, class_name, enroll_date, created_at) VALUES ('enrollment-77', '', '1', '2026-04-08', '2026-03-30T04:52:00.000Z');
INSERT INTO enrollment (id, student_name, class_name, enroll_date, created_at) VALUES ('enrollment-78', '', '1', '2026-04-08', '2026-03-30T07:44:00.000Z');
INSERT INTO enrollment (id, student_name, class_name, enroll_date, created_at) VALUES ('enrollment-79', '', '1', '2026-04-08', '2026-03-30T04:52:00.000Z');
INSERT INTO enrollment (id, student_name, class_name, enroll_date, created_at) VALUES ('enrollment-80', '', '1', '2026-04-08', '2026-03-30T07:44:00.000Z');
INSERT INTO enrollment (id, student_name, class_name, enroll_date, created_at) VALUES ('enrollment-81', '', '1', '2026-04-08', '2026-03-31T07:57:00.000Z');
INSERT INTO enrollment (id, student_name, class_name, enroll_date, created_at) VALUES ('enrollment-82', '', '1', '2026-04-08', '2026-04-02T08:54:00.000Z');
INSERT INTO enrollment (id, student_name, class_name, enroll_date, created_at) VALUES ('enrollment-83', '', '1', '2026-04-08', '2026-04-02T10:26:00.000Z');
INSERT INTO enrollment (id, student_name, class_name, enroll_date, created_at) VALUES ('enrollment-84', '', '1', '2026-04-08', '2026-04-02T10:26:00.000Z');
INSERT INTO enrollment (id, student_name, class_name, enroll_date, created_at) VALUES ('enrollment-85', '', '1', '2026-04-08', '2026-04-04T03:44:00.000Z');
INSERT INTO enrollment (id, student_name, class_name, enroll_date, created_at) VALUES ('enrollment-86', '', '1', '2026-04-08', '2026-04-04T03:44:00.000Z');
INSERT INTO enrollment (id, student_name, class_name, enroll_date, created_at) VALUES ('enrollment-87', '', '1', '2026-04-08', '2026-04-04T04:08:00.000Z');
INSERT INTO enrollment (id, student_name, class_name, enroll_date, created_at) VALUES ('enrollment-88', '', '1', '2026-04-08', '2026-04-04T03:44:00.000Z');
INSERT INTO makeup (id, student_name, classes_needed, due_date, created_at) VALUES ('makeup-1', '', '', '', '2026-02-11T13:24:00.000Z');
INSERT INTO messages (id, sender, recipient, content, created_at) VALUES ('message-1', '', '', '', '2026-02-07T07:10:00.000Z');
INSERT INTO messages (id, sender, recipient, content, created_at) VALUES ('message-2', '', '', '', '2026-02-07T07:10:00.000Z');
INSERT INTO messages (id, sender, recipient, content, created_at) VALUES ('message-3', '', '', '', '2026-02-07T11:17:00.000Z');
INSERT INTO messages (id, sender, recipient, content, created_at) VALUES ('message-4', '', '', '', '2026-02-07T16:23:00.000Z');
INSERT INTO messages (id, sender, recipient, content, created_at) VALUES ('message-5', '', '', '', '2026-02-07T16:26:00.000Z');
INSERT INTO messages (id, sender, recipient, content, created_at) VALUES ('message-6', '', '', '', '2026-02-07T11:31:00.000Z');
INSERT INTO messages (id, sender, recipient, content, created_at) VALUES ('message-7', '', '', '', '2026-02-07T11:20:00.000Z');
INSERT INTO messages (id, sender, recipient, content, created_at) VALUES ('message-8', '', '', '', '2026-02-07T11:15:00.000Z');
INSERT INTO messages (id, sender, recipient, content, created_at) VALUES ('message-9', '', '', '', '2026-02-07T11:14:00.000Z');
INSERT INTO messages (id, sender, recipient, content, created_at) VALUES ('message-10', '', '', '', '2026-02-07T11:21:00.000Z');
INSERT INTO messages (id, sender, recipient, content, created_at) VALUES ('message-11', '', '', '', '2026-02-07T11:31:00.000Z');
INSERT INTO messages (id, sender, recipient, content, created_at) VALUES ('message-12', '', '', '', '2026-02-07T11:12:00.000Z');
INSERT INTO messages (id, sender, recipient, content, created_at) VALUES ('message-13', '', '', '', '2026-02-08T06:46:00.000Z');
INSERT INTO messages (id, sender, recipient, content, created_at) VALUES ('message-14', '', '', '', '2026-02-08T06:58:00.000Z');
INSERT INTO messages (id, sender, recipient, content, created_at) VALUES ('message-15', '', '', '', '2026-02-08T07:15:00.000Z');
INSERT INTO messages (id, sender, recipient, content, created_at) VALUES ('message-16', '', '', '', '2026-02-08T07:00:00.000Z');
INSERT INTO messages (id, sender, recipient, content, created_at) VALUES ('message-17', '', '', '', '2026-02-08T06:51:00.000Z');
INSERT INTO messages (id, sender, recipient, content, created_at) VALUES ('message-18', '', '', '', '2026-02-08T06:54:00.000Z');
INSERT INTO messages (id, sender, recipient, content, created_at) VALUES ('message-19', '', '', '', '2026-02-08T07:12:00.000Z');
INSERT INTO messages (id, sender, recipient, content, created_at) VALUES ('message-20', '', '', '', '2026-02-08T07:02:00.000Z');
INSERT INTO messages (id, sender, recipient, content, created_at) VALUES ('message-21', '', '', '', '2026-02-09T09:38:00.000Z');
INSERT INTO messages (id, sender, recipient, content, created_at) VALUES ('message-22', '', '', '', '2026-02-09T09:44:00.000Z');
INSERT INTO messages (id, sender, recipient, content, created_at) VALUES ('message-23', '', '', '', '2026-02-09T13:10:00.000Z');
INSERT INTO messages (id, sender, recipient, content, created_at) VALUES ('message-24', '', '', '', '2026-02-09T13:32:00.000Z');
INSERT INTO messages (id, sender, recipient, content, created_at) VALUES ('message-25', '', '', '', '2026-02-09T13:29:00.000Z');
INSERT INTO messages (id, sender, recipient, content, created_at) VALUES ('message-26', '', '', '', '2026-02-09T13:29:00.000Z');
INSERT INTO messages (id, sender, recipient, content, created_at) VALUES ('message-27', '', '', '', '2026-02-09T13:06:00.000Z');
INSERT INTO messages (id, sender, recipient, content, created_at) VALUES ('message-28', '', '', '', '2026-02-09T13:20:00.000Z');
INSERT INTO messages (id, sender, recipient, content, created_at) VALUES ('message-29', '', '', '', '2026-02-09T13:23:00.000Z');
INSERT INTO messages (id, sender, recipient, content, created_at) VALUES ('message-30', '', '', '', '2026-02-11T13:09:00.000Z');
INSERT INTO messages (id, sender, recipient, content, created_at) VALUES ('message-31', '', '', '', '2026-03-05T04:48:00.000Z');
INSERT INTO messages (id, sender, recipient, content, created_at) VALUES ('message-32', '', '', '', '2026-03-05T04:39:00.000Z');
INSERT INTO messages (id, sender, recipient, content, created_at) VALUES ('message-33', '', '', '', '2026-03-05T04:39:00.000Z');
INSERT INTO messages (id, sender, recipient, content, created_at) VALUES ('message-34', '', '', '', '2026-03-05T04:34:00.000Z');
INSERT INTO messages (id, sender, recipient, content, created_at) VALUES ('message-35', '', '', '', '2026-03-05T04:39:00.000Z');
INSERT INTO messages (id, sender, recipient, content, created_at) VALUES ('message-36', '', '', '', '2026-03-05T04:47:00.000Z');
INSERT INTO messages (id, sender, recipient, content, created_at) VALUES ('message-37', '', '', '', '2026-03-05T04:34:00.000Z');
INSERT INTO messages (id, sender, recipient, content, created_at) VALUES ('message-38', '', '', '', '2026-03-09T06:20:00.000Z');
INSERT INTO messages (id, sender, recipient, content, created_at) VALUES ('message-39', '', '', '', '2026-03-26T06:09:00.000Z');
