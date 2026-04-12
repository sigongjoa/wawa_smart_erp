-- 011_default_class.sql
-- 시간표에서 "반" 개념 제거 — TimerPage가 선생님 담당 학생을 직접 보여주도록 전환
--
-- 설계 결정:
--   - classes 테이블은 남겨둠 (다른 관리자 페이지·기존 데이터 호환)
--   - academy별 "전체"라는 가상 default class를 하나 보장
--   - 출석 기록이 attendance.class_id NOT NULL 제약을 만족하도록
--     프론트가 모든 출석에 default_class_id를 사용
--   - academies.default_class_id 컬럼을 추가하여 로그인 시 프론트로 전달

-- ────────────────────────────────────────────────────────────
-- 1) academies 에 default_class_id 컬럼 추가
-- ────────────────────────────────────────────────────────────
ALTER TABLE academies ADD COLUMN default_class_id TEXT;

-- ────────────────────────────────────────────────────────────
-- 2) 각 academy 에 "전체" 가상 클래스 보장 (idempotent)
--    이미 같은 id가 있으면 skip
-- ────────────────────────────────────────────────────────────
INSERT OR IGNORE INTO classes (
  id, academy_id, name, grade, day_of_week,
  start_time, end_time, instructor_id, capacity,
  created_at, updated_at
)
SELECT
  'class-default-' || id,   -- id
  id,                        -- academy_id
  '전체',                    -- name
  NULL,                      -- grade
  NULL,                      -- day_of_week
  NULL,                      -- start_time
  NULL,                      -- end_time
  NULL,                      -- instructor_id
  NULL,                      -- capacity
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM academies;

-- ────────────────────────────────────────────────────────────
-- 3) academies.default_class_id 값 채움
-- ────────────────────────────────────────────────────────────
UPDATE academies
SET default_class_id = 'class-default-' || id
WHERE default_class_id IS NULL;
