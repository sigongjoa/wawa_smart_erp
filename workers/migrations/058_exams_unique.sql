-- 058: exams 중복 INSERT 방지를 위한 UNIQUE INDEX
-- SEC-SET-M2: ensureExamsForAllSubjects의 TOCTOU 경합으로 같은 (학원, 시험유형, 시험월, 이름)의
-- 시험이 두 번 INSERT 되던 위험을 차단. 핸들러는 INSERT OR IGNORE 패턴과 함께 사용.
--
-- 주의: 이 인덱스 생성 전에 이미 중복 row가 있으면 CREATE UNIQUE INDEX가 실패한다.
-- 운영 적용 시:
--   1) `SELECT academy_id, exam_type, exam_month, name, COUNT(*) c
--       FROM exams GROUP BY 1,2,3,4 HAVING c > 1;` 로 중복 확인
--   2) FK(레퍼런스)로 안전한 가장 오래된 row만 남기고 정리
--   3) 본 마이그레이션 적용
CREATE UNIQUE INDEX IF NOT EXISTS idx_exams_dedupe
  ON exams(academy_id, exam_type, exam_month, name);
