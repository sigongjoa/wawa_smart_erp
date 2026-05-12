-- =============================================
-- 학생 가입 요청에 "담당 선생님 지정" 추가
--
-- 학생이 SignupRequestPage 에서 학원의 교사 목록(admin+instructor)에서
-- 본인이 등록되길 원하는 선생님을 선택하면 그 user id 를 저장한다.
-- 교사 desktop 승인 카드에서 "지정 선생님: 김OO" 으로 노출.
--
-- 무결성: users 가 삭제되면 해당 선생님 지정은 NULL 로 리셋 (요청 자체는 유지).
-- =============================================

ALTER TABLE student_signup_requests
  ADD COLUMN requested_teacher_id TEXT REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ssr_requested_teacher
  ON student_signup_requests(requested_teacher_id);
