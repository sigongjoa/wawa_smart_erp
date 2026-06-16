-- =============================================
-- 중1 증명 워크북 시드 (5개 파일럿)
-- academy_id='SEED', created_by='system' 으로 공유 컨텐츠 등록
-- =============================================

-- ────────────────────────────────────────────
-- 1. 삼각형 내각의 합 = 180° (중1 기하)
-- ────────────────────────────────────────────
INSERT INTO proofs (id, academy_id, created_by, title, grade, chapter, subject, difficulty, description, theorem_statement, source_path, is_shared)
VALUES ('prf_m1_tri_angle_sum', 'SEED', 'system', '삼각형 내각의 합', '중1', '평면도형', 'geometry', 2,
  '꼭짓점을 지나고 대변에 평행한 직선을 그어 엇각·동위각으로 증명',
  '삼각형 ABC에서 ∠A + ∠B + ∠C = 180°',
  'middle/05_중1_기하/triangle_angle_sum.typ', 1);

INSERT INTO proof_givens (id, proof_id, kind, label, content, order_idx) VALUES
('g_tas_1', 'prf_m1_tri_angle_sum', 'definition', '평행선의 엇각', '두 직선이 평행하면 엇각의 크기가 같다.', 0),
('g_tas_2', 'prf_m1_tri_angle_sum', 'definition', '평각', '한 직선 위의 각의 합은 180°이다.', 1),
('g_tas_3', 'prf_m1_tri_angle_sum', 'assumption', '전제', '삼각형 ABC가 주어져 있다.', 2);

INSERT INTO proof_phases (id, proof_id, phase_no, phase_type, prompt, model_answer) VALUES
('ph_tas_1', 'prf_m1_tri_angle_sum', 1, 'order', '증명 단계 A~D를 올바른 순서로 배열하시오.', 'B,D,A,C'),
('ph_tas_2', 'prf_m1_tri_angle_sum', 2, 'blank', '빈칸을 채워 증명을 완성하시오.', NULL),
('ph_tas_3', 'prf_m1_tri_angle_sum', 3, 'blank_paper', '꼭짓점 A를 지나고 BC에 평행한 직선을 이용하여 ∠A+∠B+∠C=180°임을 증명하시오.', '보조선 ℓ∥BC를 A에 긋고, 엇각으로 ∠B=∠DAB, ∠C=∠EAC, 평각으로 ∠DAB+∠BAC+∠CAE=180°, 대입하면 ∠A+∠B+∠C=180°.');

INSERT INTO proof_phase_items (id, phase_id, item_key, content, correct_answer, order_idx) VALUES
('it_tas_1a', 'ph_tas_1', 'A', '꼭짓점 A에서 ℓ 위의 세 각을 보면 ∠DAB + ∠BAC + ∠CAE = 180° (평각).', '3', 0),
('it_tas_1b', 'ph_tas_1', 'B', '꼭짓점 A를 지나고 BC에 평행한 직선 ℓ을 긋는다.', '1', 1),
('it_tas_1c', 'ph_tas_1', 'C', '엇각 대입: ∠ABC + ∠BAC + ∠BCA = 180°. 증명 완료.', '4', 2),
('it_tas_1d', 'ph_tas_1', 'D', 'ℓ∥BC이므로 엇각에 의해 ∠ABC=∠DAB, ∠ACB=∠EAC.', '2', 3),
('it_tas_2_1', 'ph_tas_2', 'blank_1', '꼭짓점 A를 지나고 BC에 ( ? )한 직선 ℓ을 긋는다.', '평행', 0),
('it_tas_2_2', 'ph_tas_2', 'blank_2', 'ℓ∥BC이므로 ( ? )에 의해 ∠B=∠DAB, ∠C=∠EAC.', '엇각', 1),
('it_tas_2_3', 'ph_tas_2', 'blank_3', 'A에서의 평각: ∠DAB + ∠BAC + ∠CAE = ( ? )°.', '180', 2),
('it_tas_2_4', 'ph_tas_2', 'blank_4', '따라서 ∠A + ∠B + ∠C = ( ? )°.', '180', 3);

-- ────────────────────────────────────────────
-- 2. 맞꼭지각은 같다 (중1 기하)
-- ────────────────────────────────────────────
INSERT INTO proofs (id, academy_id, created_by, title, grade, chapter, subject, difficulty, description, theorem_statement, source_path, is_shared)
VALUES ('prf_m1_vertical', 'SEED', 'system', '맞꼭지각의 크기는 같다', '중1', '평면도형', 'geometry', 1,
  '두 직선이 한 점에서 만날 때 마주보는 두 각의 크기는 같음을 평각의 성질로 증명',
  '두 직선이 교차할 때 ∠1 = ∠3 (맞꼭지각)',
  'middle/05_중1_기하/vertical_angles.typ', 1);

INSERT INTO proof_givens (id, proof_id, kind, label, content, order_idx) VALUES
('g_va_1', 'prf_m1_vertical', 'definition', '평각', '일직선 위의 두 각의 합은 180°이다.', 0),
('g_va_2', 'prf_m1_vertical', 'assumption', '전제', '두 직선이 한 점에서 만나 네 각 ∠1, ∠2, ∠3, ∠4가 생긴다 (∠1과 ∠3이 맞꼭지각).', 1);

INSERT INTO proof_phases (id, proof_id, phase_no, phase_type, prompt, model_answer) VALUES
('ph_va_1', 'prf_m1_vertical', 1, 'order', '단계 A~C를 순서대로 배열하시오.', 'B,A,C'),
('ph_va_2', 'prf_m1_vertical', 2, 'blank', '빈칸을 채우시오.', NULL),
('ph_va_3', 'prf_m1_vertical', 3, 'blank_paper', '두 직선의 교점에서 생기는 맞꼭지각 ∠1=∠3을 증명하시오.', '∠1+∠2=180°(평각), ∠2+∠3=180°(평각). 두 식에서 ∠1=180°−∠2=∠3.');

INSERT INTO proof_phase_items (id, phase_id, item_key, content, correct_answer, order_idx) VALUES
('it_va_1a', 'ph_va_1', 'A', '∠2+∠3=180°도 평각이므로 성립한다.', '2', 0),
('it_va_1b', 'ph_va_1', 'B', '∠1과 ∠2는 일직선 위의 각이므로 ∠1+∠2=180°.', '1', 1),
('it_va_1c', 'ph_va_1', 'C', '두 식에서 ∠1 = 180°−∠2 = ∠3.', '3', 2),
('it_va_2_1', 'ph_va_2', 'blank_1', '∠1+∠2=( ? )° (평각).', '180', 0),
('it_va_2_2', 'ph_va_2', 'blank_2', '∠2+∠3=( ? )° (평각).', '180', 1),
('it_va_2_3', 'ph_va_2', 'blank_3', '∠1 = 180°−∠2 = ( ? ).', '∠3', 2);

-- ────────────────────────────────────────────
-- 3. 지수법칙 ① aᵐ × aⁿ = aᵐ⁺ⁿ (중1 문자와식)
-- ────────────────────────────────────────────
INSERT INTO proofs (id, academy_id, created_by, title, grade, chapter, subject, difficulty, description, theorem_statement, source_path, is_shared)
VALUES ('prf_m1_exp_mul', 'SEED', 'system', '지수법칙 ① 곱셈', '중1', '문자와 식', 'algebra', 2,
  '거듭제곱의 정의로부터 a의 m번 곱과 n번 곱을 이어 붙이면 (m+n)번 곱이 된다',
  '양의 정수 m, n에 대하여 aᵐ × aⁿ = aᵐ⁺ⁿ',
  'middle/02_중1_문자와식/이시은_exp_rule1_곱셈.typ', 1);

INSERT INTO proof_givens (id, proof_id, kind, label, content, order_idx) VALUES
('g_em_1', 'prf_m1_exp_mul', 'definition', '거듭제곱의 정의', 'aⁿ = a를 n번 곱한 것.', 0),
('g_em_2', 'prf_m1_exp_mul', 'assumption', '전제', 'a는 실수, m과 n은 양의 정수.', 1);

INSERT INTO proof_phases (id, proof_id, phase_no, phase_type, prompt, model_answer) VALUES
('ph_em_1', 'prf_m1_exp_mul', 1, 'order', '단계 A~C를 순서대로 배열하시오.', 'A,B,C'),
('ph_em_2', 'prf_m1_exp_mul', 2, 'blank', '빈칸을 채우시오.', NULL),
('ph_em_3', 'prf_m1_exp_mul', 3, 'blank_paper', 'aᵐ × aⁿ = aᵐ⁺ⁿ을 거듭제곱의 정의로부터 증명하시오.', 'aᵐ×aⁿ = (a×...×a, m개)×(a×...×a, n개) = a×...×a, (m+n)개 = aᵐ⁺ⁿ.');

INSERT INTO proof_phase_items (id, phase_id, item_key, content, correct_answer, order_idx) VALUES
('it_em_1a', 'ph_em_1', 'A', 'aᵐ × aⁿ = (a를 m번 곱한 것) × (a를 n번 곱한 것).', '1', 0),
('it_em_1b', 'ph_em_1', 'B', '= a를 (m+n)번 곱한 것.', '2', 1),
('it_em_1c', 'ph_em_1', 'C', '= aᵐ⁺ⁿ. 증명 완료.', '3', 2),
('it_em_2_1', 'ph_em_2', 'blank_1', 'aᵐ = a를 ( ? )번 곱한 것.', 'm', 0),
('it_em_2_2', 'ph_em_2', 'blank_2', 'aᵐ × aⁿ = a를 ( ? )번 곱한 것.', 'm+n', 1),
('it_em_2_3', 'ph_em_2', 'blank_3', '따라서 aᵐ × aⁿ = a^( ? ).', 'm+n', 2),
('it_em_2_check', 'ph_em_2', 'check', '검증: 2³ × 2² = 8 × 4 = ( ? ), 2⁵ = ( ? ).', '32,32', 3);

-- ────────────────────────────────────────────
-- 4. 등식의 성질 (중1 방정식)
-- ────────────────────────────────────────────
INSERT INTO proofs (id, academy_id, created_by, title, grade, chapter, subject, difficulty, description, theorem_statement, source_path, is_shared)
VALUES ('prf_m1_eq_props', 'SEED', 'system', '등식의 성질 (이항 원리)', '중1', '방정식', 'algebra', 1,
  '등식의 양변에 같은 수를 더해도(빼도/곱해도/나눠도) 등식이 성립한다',
  'a=b이면 a+c=b+c, a−c=b−c, ac=bc, a/c=b/c (c≠0)',
  'middle/03_중1_방정식/equality_properties.typ', 1);

INSERT INTO proof_givens (id, proof_id, kind, label, content, order_idx) VALUES
('g_ep_1', 'prf_m1_eq_props', 'definition', '등호의 정의', 'a=b는 a와 b가 같은 수임을 의미한다.', 0),
('g_ep_2', 'prf_m1_eq_props', 'definition', '연산의 일관성', '같은 수에 같은 연산을 하면 결과도 같다.', 1);

INSERT INTO proof_phases (id, proof_id, phase_no, phase_type, prompt, model_answer) VALUES
('ph_ep_1', 'prf_m1_eq_props', 1, 'order', '이항 과정을 순서대로 배열하시오: x+3=7 풀기.', 'B,A,C'),
('ph_ep_2', 'prf_m1_eq_props', 2, 'blank', '빈칸을 채우시오.', NULL),
('ph_ep_3', 'prf_m1_eq_props', 3, 'blank_paper', '등식의 성질을 이용해 2x+5=13을 풀고 각 단계의 근거를 쓰시오.', '2x+5=13 → (양변에서 5를 뺌) 2x=8 → (양변을 2로 나눔) x=4.');

INSERT INTO proof_phase_items (id, phase_id, item_key, content, correct_answer, order_idx) VALUES
('it_ep_1a', 'ph_ep_1', 'A', 'x+3−3 = 7−3 (양변에서 3을 뺀다).', '2', 0),
('it_ep_1b', 'ph_ep_1', 'B', 'x+3=7 (주어진 등식).', '1', 1),
('it_ep_1c', 'ph_ep_1', 'C', 'x=4.', '3', 2),
('it_ep_2_1', 'ph_ep_2', 'blank_1', 'a=b이면 a+c = ( ? ).', 'b+c', 0),
('it_ep_2_2', 'ph_ep_2', 'blank_2', 'a=b, c≠0이면 a/c = ( ? ).', 'b/c', 1),
('it_ep_2_3', 'ph_ep_2', 'blank_3', '2x+5=13의 양변에서 ( ? )를 빼면 2x=8.', '5', 2);

-- ────────────────────────────────────────────
-- 5. 소인수분해의 유일성 (중1 수와 연산) — 간이 버전
-- ────────────────────────────────────────────
INSERT INTO proofs (id, academy_id, created_by, title, grade, chapter, subject, difficulty, description, theorem_statement, source_path, is_shared)
VALUES ('prf_m1_prime_fact', 'SEED', 'system', '소인수분해의 유일성 (개요)', '중1', '수와 연산', 'number', 3,
  '1보다 큰 자연수는 소수들의 곱으로 유일하게 표현됨(순서 제외)을 예시로 이해',
  '1보다 큰 자연수 n은 n = p₁ × p₂ × ... × pₖ (pᵢ는 소수)로 유일하게 표현된다.',
  'middle/01_중1_수와연산/prime_factorization.typ', 1);

INSERT INTO proof_givens (id, proof_id, kind, label, content, order_idx) VALUES
('g_pf_1', 'prf_m1_prime_fact', 'definition', '소수', '1과 자기 자신만을 약수로 가지는 1보다 큰 자연수.', 0),
('g_pf_2', 'prf_m1_prime_fact', 'definition', '합성수', '소수가 아닌 1보다 큰 자연수는 두 자연수의 곱으로 표현됨.', 1);

INSERT INTO proof_phases (id, proof_id, phase_no, phase_type, prompt, model_answer) VALUES
('ph_pf_1', 'prf_m1_prime_fact', 1, 'order', '60의 소인수분해 과정을 순서대로 배열하시오.', 'A,B,C,D'),
('ph_pf_2', 'prf_m1_prime_fact', 2, 'blank', '빈칸을 채우시오.', NULL),
('ph_pf_3', 'prf_m1_prime_fact', 3, 'blank_paper', '84를 소인수분해하고, 60과 84의 최대공약수를 구하시오.', '84=2²×3×7. 60=2²×3×5. 공통 소인수 최소 지수: 2²×3=12. 따라서 GCD=12.');

INSERT INTO proof_phase_items (id, phase_id, item_key, content, correct_answer, order_idx) VALUES
('it_pf_1a', 'ph_pf_1', 'A', '60 = 2 × 30.', '1', 0),
('it_pf_1b', 'ph_pf_1', 'B', '30 = 2 × 15이므로 60 = 2 × 2 × 15.', '2', 1),
('it_pf_1c', 'ph_pf_1', 'C', '15 = 3 × 5이므로 60 = 2 × 2 × 3 × 5.', '3', 2),
('it_pf_1d', 'ph_pf_1', 'D', '∴ 60 = 2² × 3 × 5 (모두 소수).', '4', 3),
('it_pf_2_1', 'ph_pf_2', 'blank_1', '12 = 2² × ( ? ).', '3', 0),
('it_pf_2_2', 'ph_pf_2', 'blank_2', '45 = ( ? ) × 5.', '3²', 1),
('it_pf_2_3', 'ph_pf_2', 'blank_3', '100 = 2² × ( ? ).', '5²', 2),
('it_pf_2_check', 'ph_pf_2', 'check', '검증: 2²×3×5 = ( ? ).', '60', 3);
