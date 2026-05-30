-- Migration 074: gacha_* 테이블 완전 제거
-- 순서: card_results → cards/sessions → students → 매핑 임시 테이블
-- 사전 조건: 모든 FK 참조가 students(id)로 redirect 완료 (Phase 3a/3b)

DROP TABLE IF EXISTS gacha_card_results;
DROP TABLE IF EXISTS gacha_cards;
DROP TABLE IF EXISTS gacha_sessions;
DROP TABLE IF EXISTS gacha_students;
DROP TABLE IF EXISTS _gacha_student_map;
