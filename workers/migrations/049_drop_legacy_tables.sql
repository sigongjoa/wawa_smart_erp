-- Phase D: 레거시 도메인 테이블 DROP
-- 전제: 048 백필 완료, 핸들러·페이지·API 메서드 모두 제거
-- 대상: study_units, student_study_progress (진도)
--       print_materials (구 교재)
--       material_archives, archive_files, archive_distributions, archive_access_log (구 아카이브)

DROP TABLE IF EXISTS archive_access_log;
DROP TABLE IF EXISTS archive_distributions;
DROP TABLE IF EXISTS archive_files;
DROP TABLE IF EXISTS material_archives;
DROP TABLE IF EXISTS print_materials;
DROP TABLE IF EXISTS student_study_progress;
DROP TABLE IF EXISTS study_units;
