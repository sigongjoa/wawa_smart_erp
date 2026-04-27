-- =============================================
-- 반복 응시 가능한 시험 플래그
-- is_repeatable=1 인 exam_assignment 는 submitted 후에도 재응시 가능
-- 의학용어 시험처럼 반복 학습 목적의 시험에 적용
-- =============================================

ALTER TABLE exam_assignments ADD COLUMN is_repeatable INTEGER NOT NULL DEFAULT 0;
