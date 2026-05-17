-- =============================================
-- 046: 문제 유형(category) 태그 — 교사 자기점검 대시보드용
-- 학생×유형 히트맵 집계의 분류 축
-- =============================================

-- 1) 객관식 시험 문제에 유형 태그
ALTER TABLE exam_questions ADD COLUMN category TEXT;
CREATE INDEX IF NOT EXISTS idx_exam_questions_category
  ON exam_questions(category);

-- 2) 어휘 단어에 유형 태그 (기초/숙어/파생어 등 자유 분류)
ALTER TABLE vocab_words ADD COLUMN category TEXT;
CREATE INDEX IF NOT EXISTS idx_vocab_words_category
  ON vocab_words(academy_id, category);

-- study_units 는 kind='type' 이 이미 유형 축으로 사용 가능하여 추가 컬럼 없음.
