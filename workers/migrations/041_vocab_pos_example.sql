-- =============================================
-- word-gacha: 학생이 단어 추가 시 품사·예문도 서버 저장
-- Issue #54
-- =============================================

ALTER TABLE vocab_words ADD COLUMN pos TEXT;
ALTER TABLE vocab_words ADD COLUMN example TEXT;
