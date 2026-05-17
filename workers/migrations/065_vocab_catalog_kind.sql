-- =============================================
-- 065: vocab_catalogs.kind 도입 — vocab vs medterm 분리
-- 문제: medical-* catalog 가 vocab_catalogs 에 섞여 있어 일반 단어시험에 누설
-- 해결: kind 컬럼으로 분류 + 모든 vocab 쿼리에 kind='vocab' 필터
-- =============================================

-- 1) kind 컬럼 추가 (기본 'vocab' — 안전한 default)
ALTER TABLE vocab_catalogs ADD COLUMN kind TEXT NOT NULL DEFAULT 'vocab';

-- 2) medical-* 분류 변경 — vocab 시험에서 자동 제외됨
UPDATE vocab_catalogs SET kind = 'medterm' WHERE id LIKE 'medical-%';

-- 3) 빠른 필터용 인덱스
CREATE INDEX IF NOT EXISTS idx_vocab_catalogs_kind ON vocab_catalogs(kind);
