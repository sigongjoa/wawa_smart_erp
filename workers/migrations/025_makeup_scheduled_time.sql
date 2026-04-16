-- 025: 보강 시작/종료 시각 커스터마이즈
ALTER TABLE makeups ADD COLUMN scheduled_start_time TEXT;
ALTER TABLE makeups ADD COLUMN scheduled_end_time TEXT;
