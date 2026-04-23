-- Vocab print 성능 + 동시성 개선
-- 1) 제출 시점 vocab_print_answers를 print_job_id로 스캔 → 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_print_answers_job_word
  ON vocab_print_answers (print_job_id, word_id);

-- 2) vocab_print_jobs 학생·상태 조회 빈발 → 복합 인덱스
CREATE INDEX IF NOT EXISTS idx_print_jobs_student_status
  ON vocab_print_jobs (student_id, academy_id, status);

-- 3) vocab_words 학원 + 승인 상태 풀 조회 → 인덱스
CREATE INDEX IF NOT EXISTS idx_vocab_words_academy_status
  ON vocab_words (academy_id, status);
