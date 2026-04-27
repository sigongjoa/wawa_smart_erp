-- =============================================
-- gacha_students: UNIQUE 키를 (academy_id, name)으로 변경
--
-- 배경: 기존 UNIQUE(academy_id, teacher_id, name) 가 강사 단위라
--       한 학원에 같은 이름의 학생이 두 강사 아래 별개 row로 존재 가능했음.
--       #93 ghost 17쌍이 정확히 이 케이스 (sb-* user-i170bjn6w + 04-14 일괄등록 user-57ppx9v61).
-- 목적: 학원 단위 동명 학생 등록 자체를 DB 레벨에서 차단.
--
-- 주의: SQLite는 UNIQUE 제약 ALTER 미지원 → 테이블 재생성 필요.
--       이 마이그레이션은 #93 정리 SQL 적용 후에만 실행해야 함 (동명 학생 0건 전제).
-- =============================================

-- 사전 검증: 동명 학생이 남아 있으면 마이그레이션 실패해야 함.
-- (운영 적용 전에 _post_check.sql 의 duplicate_students 결과가 0건인지 확인)

-- 1) 새 스키마로 임시 테이블 생성
CREATE TABLE IF NOT EXISTS gacha_students_new (
  id          TEXT PRIMARY KEY,
  academy_id  TEXT NOT NULL,
  teacher_id  TEXT NOT NULL,
  name        TEXT NOT NULL,
  pin_hash    TEXT NOT NULL,
  pin_salt    TEXT NOT NULL,
  grade       TEXT,
  status      TEXT DEFAULT 'active',
  created_at  DATETIME DEFAULT (datetime('now')),
  updated_at  DATETIME,
  UNIQUE(academy_id, name)  -- ★ 학원 단위로 강화
);

-- 2) 데이터 복사
INSERT INTO gacha_students_new (id, academy_id, teacher_id, name, pin_hash, pin_salt, grade, status, created_at, updated_at)
SELECT id, academy_id, teacher_id, name, pin_hash, pin_salt, grade, status, created_at, updated_at
  FROM gacha_students;

-- 3) 원본 drop + rename
-- 주의: 외래키(gacha_cards 등)는 SQLite에서 테이블 이름 기반이라
-- DROP/RENAME 시 FK가 자동으로 새 테이블을 가리킴 (deferred FK 처리됨).
-- 그러나 안전을 위해 PRAGMA foreign_keys=OFF 후 진행 권장 (D1 remote는 PRAGMA 미지원이라
-- 운영 적용 시 1회 short downtime 가능성 있음 — 메인 사용 시간대 피해서 적용).
DROP TABLE gacha_students;
ALTER TABLE gacha_students_new RENAME TO gacha_students;

-- 4) 인덱스 재생성
CREATE INDEX IF NOT EXISTS idx_gacha_students_academy ON gacha_students(academy_id);
CREATE INDEX IF NOT EXISTS idx_gacha_students_teacher ON gacha_students(academy_id, teacher_id);
