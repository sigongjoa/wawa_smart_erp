-- word-gacha 학생 게임 상태 (profile·quizHistory·badges·seen·creature를 하나의 JSON blob으로)
-- 학생별·학원별 고유. state_json은 클라가 보내는 그대로 저장.
CREATE TABLE IF NOT EXISTS student_play_state (
  student_id TEXT NOT NULL,
  academy_id TEXT NOT NULL,
  state_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (student_id, academy_id)
);

CREATE INDEX IF NOT EXISTS idx_play_state_academy ON student_play_state(academy_id);
