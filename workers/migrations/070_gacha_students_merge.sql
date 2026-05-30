-- Migration 070: gacha_students → students 데이터 머지
-- 정책:
--   1) (academy_id, name) 1:1 매칭 → students 행 우선, PIN/teacher_id만 backfill
--   2) 동명이인 충돌 → status='active' 행에 매칭 (휴리스틱: active에 학교 정보 보유)
--   3) 매칭 없음 → students에 신규 INSERT (gacha_students.id 그대로 사용)
--   4) 매핑 결과는 _gacha_student_map에 기록 (Phase 3 FK rebind에서 사용)
-- 사전 검증: PK 충돌 7건 모두 (academy_id, name) 일치 → 충돌 없음

-- ===== 매핑 임시 테이블 =====
DROP TABLE IF EXISTS _gacha_student_map;
CREATE TABLE _gacha_student_map (
  gacha_id   TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  action     TEXT NOT NULL  -- 'merged_active' | 'merged_inactive' | 'created'
);

-- ===== Step 1: active 매칭 우선 =====
INSERT INTO _gacha_student_map (gacha_id, student_id, action)
SELECT gs.id, MIN(s.id), 'merged_active'
FROM gacha_students gs
JOIN students s
  ON s.academy_id = gs.academy_id
 AND s.name       = gs.name
 AND s.status     = 'active'
GROUP BY gs.id;

-- ===== Step 2: active 매칭 없는 것만 inactive와 매칭 =====
INSERT INTO _gacha_student_map (gacha_id, student_id, action)
SELECT gs.id, MIN(s.id), 'merged_inactive'
FROM gacha_students gs
JOIN students s
  ON s.academy_id = gs.academy_id
 AND s.name       = gs.name
 AND (s.status IS NULL OR s.status <> 'active')
WHERE gs.id NOT IN (SELECT gacha_id FROM _gacha_student_map)
GROUP BY gs.id;

-- ===== Step 3: 매칭 없는 gacha_students → students에 신규 INSERT =====
INSERT INTO students (id, academy_id, name, grade, status, created_at, updated_at, pin_hash, pin_salt, teacher_id, subjects)
SELECT
  gs.id,
  gs.academy_id,
  gs.name,
  gs.grade,
  COALESCE(gs.status, 'active'),
  COALESCE(gs.created_at, datetime('now')),
  COALESCE(gs.updated_at, datetime('now')),
  gs.pin_hash,
  COALESCE(gs.pin_salt, ''),
  gs.teacher_id,
  '[]'
FROM gacha_students gs
WHERE gs.id NOT IN (SELECT gacha_id FROM _gacha_student_map);

-- ===== Step 4: 신규 생성 매핑 기록 =====
INSERT INTO _gacha_student_map (gacha_id, student_id, action)
SELECT gs.id, gs.id, 'created'
FROM gacha_students gs
WHERE gs.id NOT IN (SELECT gacha_id FROM _gacha_student_map);

-- ===== Step 5: merged 케이스에 PIN/teacher_id backfill =====
-- students 행 우선 — pin_hash/pin_salt만 덮어쓰기, teacher_id는 기존 NULL일 때만
UPDATE students
SET
  pin_hash = (
    SELECT gs.pin_hash FROM gacha_students gs
    JOIN _gacha_student_map m ON m.gacha_id = gs.id
    WHERE m.student_id = students.id
    LIMIT 1
  ),
  pin_salt = COALESCE(
    (SELECT gs.pin_salt FROM gacha_students gs
     JOIN _gacha_student_map m ON m.gacha_id = gs.id
     WHERE m.student_id = students.id
     LIMIT 1),
    ''
  ),
  teacher_id = COALESCE(
    students.teacher_id,
    (SELECT gs.teacher_id FROM gacha_students gs
     JOIN _gacha_student_map m ON m.gacha_id = gs.id
     WHERE m.student_id = students.id
     LIMIT 1)
  )
WHERE id IN (
  SELECT student_id FROM _gacha_student_map WHERE action LIKE 'merged_%'
);
