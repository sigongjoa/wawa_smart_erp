-- Phase 1 (순서 맞추기) 아이템을 proof_steps에 백필
-- 기존 student UI (ProofOrderingPage/ProofFillBlankPage)가 읽을 수 있도록

-- ── 1. 삼각형 내각의 합 (정답 순서: B,D,A,C)
INSERT INTO proof_steps (id, proof_id, step_order, content, blanks_json) VALUES
('step_tas_1', 'prf_m1_tri_angle_sum', 1, '꼭짓점 A를 지나고 BC에 평행한 직선 ℓ을 긋는다.', NULL),
('step_tas_2', 'prf_m1_tri_angle_sum', 2, 'ℓ∥BC이므로 엇각에 의해 ∠ABC=∠DAB, ∠ACB=∠EAC.', NULL),
('step_tas_3', 'prf_m1_tri_angle_sum', 3, '꼭짓점 A에서 ℓ 위의 세 각을 보면 ∠DAB + ∠BAC + ∠CAE = 180° (평각).', NULL),
('step_tas_4', 'prf_m1_tri_angle_sum', 4, '엇각 대입: ∠ABC + ∠BAC + ∠BCA = 180°. 증명 완료.',
  '[{"placeholder":"평행","answer":"평행"},{"placeholder":"엇각","answer":"엇각"},{"placeholder":"180","answer":"180"}]');

-- ── 2. 맞꼭지각 (정답 순서: B,A,C)
INSERT INTO proof_steps (id, proof_id, step_order, content, blanks_json) VALUES
('step_va_1', 'prf_m1_vertical', 1, '∠1과 ∠2는 일직선 위의 각이므로 ∠1+∠2=180°.', NULL),
('step_va_2', 'prf_m1_vertical', 2, '∠2+∠3=180°도 평각이므로 성립한다.', NULL),
('step_va_3', 'prf_m1_vertical', 3, '두 식에서 ∠1 = 180°−∠2 = ∠3.',
  '[{"placeholder":"180","answer":"180"},{"placeholder":"∠3","answer":"∠3"}]');

-- ── 3. 지수법칙 ① 곱셈
INSERT INTO proof_steps (id, proof_id, step_order, content, blanks_json) VALUES
('step_em_1', 'prf_m1_exp_mul', 1, 'aᵐ × aⁿ = (a를 m번 곱한 것) × (a를 n번 곱한 것).', NULL),
('step_em_2', 'prf_m1_exp_mul', 2, '= a를 (m+n)번 곱한 것.', NULL),
('step_em_3', 'prf_m1_exp_mul', 3, '= aᵐ⁺ⁿ. 증명 완료.',
  '[{"placeholder":"m","answer":"m"},{"placeholder":"m+n","answer":"m+n"},{"placeholder":"m+n","answer":"m+n"}]');

-- ── 4. 등식의 성질 (정답 순서: B,A,C — x+3=7 풀이)
INSERT INTO proof_steps (id, proof_id, step_order, content, blanks_json) VALUES
('step_ep_1', 'prf_m1_eq_props', 1, 'x+3=7 (주어진 등식).', NULL),
('step_ep_2', 'prf_m1_eq_props', 2, 'x+3−3 = 7−3 (양변에서 3을 뺀다).', NULL),
('step_ep_3', 'prf_m1_eq_props', 3, 'x=4.',
  '[{"placeholder":"b+c","answer":"b+c"},{"placeholder":"b/c","answer":"b/c"},{"placeholder":"5","answer":"5"}]');

-- ── 5. 소인수분해 유일성 (60의 소인수분해)
INSERT INTO proof_steps (id, proof_id, step_order, content, blanks_json) VALUES
('step_pf_1', 'prf_m1_prime_fact', 1, '60 = 2 × 30.', NULL),
('step_pf_2', 'prf_m1_prime_fact', 2, '30 = 2 × 15이므로 60 = 2 × 2 × 15.', NULL),
('step_pf_3', 'prf_m1_prime_fact', 3, '15 = 3 × 5이므로 60 = 2 × 2 × 3 × 5.', NULL),
('step_pf_4', 'prf_m1_prime_fact', 4, '∴ 60 = 2² × 3 × 5 (모두 소수).',
  '[{"placeholder":"3","answer":"3"},{"placeholder":"3²","answer":"3²"},{"placeholder":"5²","answer":"5²"}]');
