-- =============================================
-- Post-migration data integrity checks
-- 마이그레이션 적용 후 또는 정기적으로 실행하여
-- 데이터 일관성 회귀를 자동 발견하는 표준 체크리스트.
--
-- 실행:
--   wrangler d1 execute wawa-smart-erp --env production --remote --file workers/migrations/_post_check.sql
--
-- 결과 row 수가 0이 아니면 즉시 조사 필요. CI에서는 row > 0 시 PR/배포 차단.
-- =============================================

-- ── 1) 동명 학생 (academy 단위 — UI 드롭다운 혼란 방지) ──
SELECT 'duplicate_students' AS issue, academy_id, name, COUNT(*) AS n
  FROM gacha_students
 GROUP BY academy_id, name
HAVING COUNT(*) > 1;

-- ── 2) Orphan FK (student_id가 gacha_students에 없는 행) ──
SELECT 'orphan_vocab_words' AS issue, COUNT(*) AS n
  FROM vocab_words
 WHERE student_id IS NOT NULL
   AND student_id NOT IN (SELECT id FROM gacha_students)
HAVING COUNT(*) > 0;

SELECT 'orphan_gacha_cards' AS issue, COUNT(*) AS n
  FROM gacha_cards
 WHERE student_id IS NOT NULL
   AND student_id NOT IN (SELECT id FROM gacha_students)
HAVING COUNT(*) > 0;

SELECT 'orphan_vocab_print_jobs' AS issue, COUNT(*) AS n
  FROM vocab_print_jobs
 WHERE student_id NOT IN (SELECT id FROM gacha_students)
HAVING COUNT(*) > 0;

SELECT 'orphan_proof_results' AS issue, COUNT(*) AS n
  FROM proof_results
 WHERE student_id NOT IN (SELECT id FROM gacha_students)
HAVING COUNT(*) > 0;

-- ── 3) academy_id 누락 / 빈 값 ──
SELECT 'null_academy_vocab_words' AS issue, COUNT(*) AS n
  FROM vocab_words
 WHERE academy_id IS NULL OR academy_id = ''
HAVING COUNT(*) > 0;

SELECT 'null_academy_gacha_students' AS issue, COUNT(*) AS n
  FROM gacha_students
 WHERE academy_id IS NULL OR academy_id = ''
HAVING COUNT(*) > 0;

-- ── 4) 정책 위반 — box 범위 1~5 ──
SELECT 'invalid_box_range' AS issue, COUNT(*) AS n
  FROM vocab_words
 WHERE box IS NOT NULL AND (box < 1 OR box > 5)
HAVING COUNT(*) > 0;

-- ── 5) 정책 위반 — status enum ──
SELECT 'invalid_vocab_status' AS issue, status, COUNT(*) AS n
  FROM vocab_words
 WHERE status NOT IN ('pending', 'approved')
 GROUP BY status
HAVING COUNT(*) > 0;

SELECT 'invalid_print_job_status' AS issue, status, COUNT(*) AS n
  FROM vocab_print_jobs
 WHERE status NOT IN ('pending', 'in_progress', 'submitted', 'voided')
 GROUP BY status
HAVING COUNT(*) > 0;

-- ── 6) 데이터 풍부도 — 학원 단위 row 수 대시보드 ──
-- (정보용. row 수가 0이어도 정상)
SELECT 'academy_health' AS issue, academy_id,
       (SELECT COUNT(*) FROM gacha_students WHERE academy_id = a.academy_id) AS students,
       (SELECT COUNT(*) FROM vocab_words WHERE academy_id = a.academy_id)    AS vocab_words,
       (SELECT COUNT(*) FROM gacha_cards WHERE academy_id = a.academy_id)    AS gacha_cards
  FROM (SELECT DISTINCT academy_id FROM gacha_students) a;
