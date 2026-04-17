-- =============================================
-- 030: 정기고사 배정과 재시험 adhoc_sessions 링크
-- =============================================
-- rescheduled 상태로 바뀔 때 생성/갱신한 adhoc_sessions id 저장
-- (재시험 날짜/시간 변경 시 기존 adhoc 갱신, 상태 취소 시 cancelled 처리)

ALTER TABLE exam_assignments ADD COLUMN adhoc_session_id TEXT;

CREATE INDEX IF NOT EXISTS idx_exam_assign_adhoc ON exam_assignments(adhoc_session_id);

-- adhoc_sessions에 재시험 시작/종료 시간 입력을 위한 기본 reason
-- ('시험재시험' — 시험 대비 수업과 구분)
