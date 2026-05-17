-- =============================================
-- 진행 중 세션 연장(+N분)을 attendance_records에도 영구 기록
-- realtime_sessions.added_minutes 는 012에서 이미 존재.
-- 체크아웃 시 attendance_records 로 승격할 때 값이 사라지지 않도록 컬럼 추가.
-- =============================================

ALTER TABLE attendance_records ADD COLUMN added_minutes INTEGER NOT NULL DEFAULT 0;
