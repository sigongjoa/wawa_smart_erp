-- 학생-선생님 매핑 데이터 (Notion 기준 2026-04-10)
-- 선생님: 서재용 개발자(user-57ppx9v61), 김상현(user-i170bjn6w), 남현욱(user-d8nru3xco), 지혜영 원장(user-1fk6dqck6)

-- 김광민 → 서재용
INSERT OR IGNORE INTO student_teachers (student_id, teacher_id) VALUES ('student-b8tu5sggp', 'user-57ppx9v61');
-- 류하진 → 서재용
INSERT OR IGNORE INTO student_teachers (student_id, teacher_id) VALUES ('student-ue92sdab0', 'user-57ppx9v61');
-- 송하선 → 서재용
INSERT OR IGNORE INTO student_teachers (student_id, teacher_id) VALUES ('student-7gioy6c0x', 'user-57ppx9v61');
-- 윤승환 → 서재용
INSERT OR IGNORE INTO student_teachers (student_id, teacher_id) VALUES ('student-vosetxjdm', 'user-57ppx9v61');
-- 하진서 → 서재용
INSERT OR IGNORE INTO student_teachers (student_id, teacher_id) VALUES ('student-mtoq5wqb6', 'user-57ppx9v61');
-- 박동진 → 서재용
INSERT OR IGNORE INTO student_teachers (student_id, teacher_id) VALUES ('student-s54ihowlx', 'user-57ppx9v61');
-- 최고은 → 서재용
INSERT OR IGNORE INTO student_teachers (student_id, teacher_id) VALUES ('student-9bsetl4ct', 'user-57ppx9v61');
-- 정윤재 → 서재용
INSERT OR IGNORE INTO student_teachers (student_id, teacher_id) VALUES ('student-6cxbm886s', 'user-57ppx9v61');
-- 손동민 → 서재용
INSERT OR IGNORE INTO student_teachers (student_id, teacher_id) VALUES ('student-t1xikskhy', 'user-57ppx9v61');
-- 김성준 → 서재용
INSERT OR IGNORE INTO student_teachers (student_id, teacher_id) VALUES ('student-0mc8orloi', 'user-57ppx9v61');
-- 강은서 → 서재용
INSERT OR IGNORE INTO student_teachers (student_id, teacher_id) VALUES ('student-5645a3fs4', 'user-57ppx9v61');
-- 최예지 → 서재용
INSERT OR IGNORE INTO student_teachers (student_id, teacher_id) VALUES ('student-p3kgxnsyw', 'user-57ppx9v61');
-- 김태영 → 서재용
INSERT OR IGNORE INTO student_teachers (student_id, teacher_id) VALUES ('student-r558f899h', 'user-57ppx9v61');
-- 김지후 → 서재용
INSERT OR IGNORE INTO student_teachers (student_id, teacher_id) VALUES ('student-q5ecu8748', 'user-57ppx9v61');
-- 김시우 → 서재용
INSERT OR IGNORE INTO student_teachers (student_id, teacher_id) VALUES ('student-ggf2bon55', 'user-57ppx9v61');
-- 김은지 → 서재용
INSERT OR IGNORE INTO student_teachers (student_id, teacher_id) VALUES ('student-ni7f87smv', 'user-57ppx9v61');

-- 이서윤 → 남현욱
INSERT OR IGNORE INTO student_teachers (student_id, teacher_id) VALUES ('student-0spi35f7j', 'user-d8nru3xco');

-- 윤지후 → 지혜영, 김상현, 서재용
INSERT OR IGNORE INTO student_teachers (student_id, teacher_id) VALUES ('student-fbcy3xfzp', 'user-1fk6dqck6');
INSERT OR IGNORE INTO student_teachers (student_id, teacher_id) VALUES ('student-fbcy3xfzp', 'user-i170bjn6w');
INSERT OR IGNORE INTO student_teachers (student_id, teacher_id) VALUES ('student-fbcy3xfzp', 'user-57ppx9v61');

-- 정지효 → 지혜영, 서재용
INSERT OR IGNORE INTO student_teachers (student_id, teacher_id) VALUES ('student-a7wi0zma6', 'user-1fk6dqck6');
INSERT OR IGNORE INTO student_teachers (student_id, teacher_id) VALUES ('student-a7wi0zma6', 'user-57ppx9v61');

-- 박예원 → 김상현, 남현욱
INSERT OR IGNORE INTO student_teachers (student_id, teacher_id) VALUES ('student-y1ov7jvh5', 'user-i170bjn6w');
INSERT OR IGNORE INTO student_teachers (student_id, teacher_id) VALUES ('student-y1ov7jvh5', 'user-d8nru3xco');

-- 이루다 → 서재용, 지혜영, 김상현, 남현욱
INSERT OR IGNORE INTO student_teachers (student_id, teacher_id) VALUES ('student-nb8y8m656', 'user-57ppx9v61');
INSERT OR IGNORE INTO student_teachers (student_id, teacher_id) VALUES ('student-nb8y8m656', 'user-1fk6dqck6');
INSERT OR IGNORE INTO student_teachers (student_id, teacher_id) VALUES ('student-nb8y8m656', 'user-i170bjn6w');
INSERT OR IGNORE INTO student_teachers (student_id, teacher_id) VALUES ('student-nb8y8m656', 'user-d8nru3xco');

-- 라우림 → 김상현
INSERT OR IGNORE INTO student_teachers (student_id, teacher_id) VALUES ('student-7hpm0v6zp', 'user-i170bjn6w');

-- 박예지 → 김상현, 남현욱
INSERT OR IGNORE INTO student_teachers (student_id, teacher_id) VALUES ('student-yxu4r4ae9', 'user-i170bjn6w');
INSERT OR IGNORE INTO student_teachers (student_id, teacher_id) VALUES ('student-yxu4r4ae9', 'user-d8nru3xco');

-- 김하진 → 김상현, 서재용, 남현욱
INSERT OR IGNORE INTO student_teachers (student_id, teacher_id) VALUES ('student-rks9au7mm', 'user-i170bjn6w');
INSERT OR IGNORE INTO student_teachers (student_id, teacher_id) VALUES ('student-rks9au7mm', 'user-57ppx9v61');
INSERT OR IGNORE INTO student_teachers (student_id, teacher_id) VALUES ('student-rks9au7mm', 'user-d8nru3xco');

-- 장혜연 → 김상현, 지혜영
INSERT OR IGNORE INTO student_teachers (student_id, teacher_id) VALUES ('student-tx3blu2og', 'user-i170bjn6w');
INSERT OR IGNORE INTO student_teachers (student_id, teacher_id) VALUES ('student-tx3blu2og', 'user-1fk6dqck6');

-- 장혜정 → 김상현, 지혜영
INSERT OR IGNORE INTO student_teachers (student_id, teacher_id) VALUES ('student-3mzmc3kin', 'user-i170bjn6w');
INSERT OR IGNORE INTO student_teachers (student_id, teacher_id) VALUES ('student-3mzmc3kin', 'user-1fk6dqck6');

-- test → 지혜영, 김상현, 서재용
INSERT OR IGNORE INTO student_teachers (student_id, teacher_id) VALUES ('student-wfade2mly', 'user-1fk6dqck6');
INSERT OR IGNORE INTO student_teachers (student_id, teacher_id) VALUES ('student-wfade2mly', 'user-i170bjn6w');
INSERT OR IGNORE INTO student_teachers (student_id, teacher_id) VALUES ('student-wfade2mly', 'user-57ppx9v61');
