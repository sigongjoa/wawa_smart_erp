-- 057: PIN 재설정 흐름을 위한 컬럼 추가
-- TEACH-SEC-H3: 임시 PIN의 영구화 방지 + 세션 폐기 트리거 위한 메타데이터
ALTER TABLE users ADD COLUMN password_must_change INTEGER DEFAULT 0;  -- 0=정상, 1=다음 로그인 시 변경 강제
ALTER TABLE users ADD COLUMN password_reset_at DATETIME;              -- 임시 PIN 발급 시각 (만료 계산용)
