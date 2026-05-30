-- 068: student_teachers에 subjects 컬럼 추가
-- (학생, 선생님) 페어별로 가르치는 과목을 JSON 배열로 저장
-- 예: 강은서-김상현 = ["수학"], 다른학생-김상현 = ["영어"]
-- 정기고사 리포트 전송 시 과목 매칭 필터링에 사용

ALTER TABLE student_teachers ADD COLUMN subjects TEXT NOT NULL DEFAULT '[]';
