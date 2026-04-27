-- =============================================
-- 의학용어 카탈로그 (보건고 학생용)
-- 단어 데이터는 별도 임포트 스크립트로 시드 (CH01~ PDF 파싱 결과)
-- =============================================

INSERT OR IGNORE INTO vocab_catalogs (id, title, source, license, word_count)
VALUES (
  'medical-health-vocational-2026',
  '보건계열 의학용어 (보건고)',
  'health-vocational-school-2026',
  'academy-internal',
  0
);

-- 두 학생에게 즉시 배정 (장혜연, 장혜정)
-- ID는 gacha_students.id 사용 (PlayAuth.studentId 가 이 테이블 기준)
-- prod: gstu-*, sandbox: gst-sb-* — 두 환경 모두 매핑
INSERT OR IGNORE INTO student_vocab_catalogs (student_id, catalog_id) VALUES
  ('gstu-7404d02d',         'medical-health-vocational-2026'),  -- 장혜연 (prod)
  ('gstu-c4b35596',         'medical-health-vocational-2026'),  -- 장혜정 (prod)
  ('gst-sb-ac7eba08-fd8',   'medical-health-vocational-2026'),  -- 장혜연 (sandbox)
  ('gst-sb-b0f307ef-c30',   'medical-health-vocational-2026');  -- 장혜정 (sandbox)
