/**
 * UC-12 — drill 카드 자동 생성기 테스트
 *
 * 4가지 신호 → DrillCard | null 변환 (순수 함수).
 * 비즈니스 룰:
 *   - askai_failed_checkpoint: fail_count >= 3 일 때만 카드화 (그보다 적으면 노이즈)
 *   - exam_wrong: 무조건 즉시 카드화 (가장 강한 신호)
 *   - homework_deduction: deduction_points >= 2 일 때만
 *   - unit_xmark: 무조건 카드화
 *   - 중복 방지: 같은 source_ref가 existing에 이미 있으면 null
 *   - context_note: 출처별로 다른 격려 메시지 ("너 그때 멈춘 자리...")
 */

import { describe, it, expect } from 'vitest';
import { generateDrillCard, signalToSourceRef } from './drill-generator';
import type { Signal, DrillCard } from '@/schemas/ask-ai';

const TODAY = '2026-05-15';
const STUDENT_ID = 'iruda-001';
const FIXED_UUID = '00000000-0000-0000-0000-000000000001';
const uuidFn = () => FIXED_UUID;

const baseOpts = {
  student_id: STUDENT_ID,
  existing: [] as Array<{ id: string; source: DrillCard['source']; source_ref: string }>,
  today: TODAY,
  uuidFn,
};

describe('generateDrillCard — UC-12', () => {
  describe('askai_failed_checkpoint', () => {
    const baseSignal: Signal = {
      kind: 'askai_failed_checkpoint',
      conversation_id: '11111111-1111-1111-1111-111111111111',
      step_id: 'step-3',
      fail_count: 3,
      problem_md: '표본평균 분산이 왜 σ²/n인가요?',
      answer_md: '$V(\\bar X) = \\sigma^2/n$',
      unit: '확통 III-1 표본분포',
      ai_cite: '4일 전 너 여기서 막혔어',
    };

    it('fail_count >= 3 → 카드 생성', () => {
      const card = generateDrillCard({ ...baseOpts, signal: baseSignal });
      expect(card).not.toBeNull();
      expect(card!.source).toBe('askai_failed_checkpoint');
      expect(card!.unit).toBe('확통 III-1 표본분포');
      expect(card!.problem_md).toBe(baseSignal.problem_md);
    });

    it('fail_count < 3 → null (아직 노이즈)', () => {
      const signal = { ...baseSignal, fail_count: 2 };
      const card = generateDrillCard({ ...baseOpts, signal });
      expect(card).toBeNull();
    });

    it('fail_count = 0 → null', () => {
      const signal = { ...baseSignal, fail_count: 0 };
      const card = generateDrillCard({ ...baseOpts, signal });
      expect(card).toBeNull();
    });

    it('source_ref = conversation_id', () => {
      const card = generateDrillCard({ ...baseOpts, signal: baseSignal });
      expect(card!.source_ref).toBe(baseSignal.conversation_id);
    });

    it('ai_cite 그대로 보존', () => {
      const card = generateDrillCard({ ...baseOpts, signal: baseSignal });
      expect(card!.ai_cite).toBe('4일 전 너 여기서 막혔어');
    });

    it('context_note는 "너 그때 멈춘 자리..." 형태', () => {
      const card = generateDrillCard({ ...baseOpts, signal: baseSignal });
      expect(card!.context_note).toMatch(/멈춘 자리|막혔던/);
    });
  });

  describe('exam_wrong (가장 강한 신호)', () => {
    const baseSignal: Signal = {
      kind: 'exam_wrong',
      exam_id: 'sigong-2026-1-mid',
      problem_md: '다음 함수의 극값을 구하시오.',
      answer_md: '$x=2$에서 극대 $f(2)=4$',
      unit: '수II 미분 응용',
      school: '시지고',
    };

    it('1번 오답이라도 즉시 카드 생성 (시그널 강도 최상)', () => {
      const card = generateDrillCard({ ...baseOpts, signal: baseSignal });
      expect(card).not.toBeNull();
      expect(card!.source).toBe('exam_wrong');
    });

    it('source_ref = exam_id', () => {
      const card = generateDrillCard({ ...baseOpts, signal: baseSignal });
      expect(card!.source_ref).toBe('sigong-2026-1-mid');
    });

    it('context_note는 "시험에서" 또는 학교명 포함', () => {
      const card = generateDrillCard({ ...baseOpts, signal: baseSignal });
      expect(card!.context_note).toMatch(/시험|시지고/);
    });
  });

  describe('homework_deduction', () => {
    const baseSignal: Signal = {
      kind: 'homework_deduction',
      homework_id: 'hw-2026-05-13',
      problem_md: '인수분해하시오.',
      answer_md: '$(x+1)(x+2)$',
      unit: '대수 인수분해',
      deduction_points: 3,
    };

    it('deduction_points >= 2 → 카드 생성', () => {
      const card = generateDrillCard({ ...baseOpts, signal: baseSignal });
      expect(card).not.toBeNull();
      expect(card!.source).toBe('homework_deduction');
    });

    it('1점 감점은 무시 (사소한 실수)', () => {
      const signal = { ...baseSignal, deduction_points: 1 };
      const card = generateDrillCard({ ...baseOpts, signal });
      expect(card).toBeNull();
    });

    it('5점 감점은 카드화', () => {
      const signal = { ...baseSignal, deduction_points: 5 };
      const card = generateDrillCard({ ...baseOpts, signal });
      expect(card).not.toBeNull();
    });
  });

  describe('unit_xmark (단원지 X 표시)', () => {
    const baseSignal: Signal = {
      kind: 'unit_xmark',
      unit_problem_id: 'unit-confunc-3-12',
      problem_md: '경우의 수를 구하시오.',
      answer_md: '120',
      unit: '확통 I-1 경우의 수',
    };

    it('X 표시 시 카드 생성', () => {
      const card = generateDrillCard({ ...baseOpts, signal: baseSignal });
      expect(card).not.toBeNull();
      expect(card!.source).toBe('unit_xmark');
    });

    it('source_ref = unit_problem_id', () => {
      const card = generateDrillCard({ ...baseOpts, signal: baseSignal });
      expect(card!.source_ref).toBe('unit-confunc-3-12');
    });
  });

  describe('중복 방지 (dedup)', () => {
    const baseSignal: Signal = {
      kind: 'exam_wrong',
      exam_id: 'sigong-2026-1-mid',
      problem_md: 'x',
      answer_md: 'y',
      unit: '수II',
    };

    it('같은 source_ref가 existing에 있으면 null', () => {
      const existing = [{
        id: 'existing-card-id',
        source: 'exam_wrong' as const,
        source_ref: 'sigong-2026-1-mid',
      }];
      const card = generateDrillCard({ ...baseOpts, signal: baseSignal, existing });
      expect(card).toBeNull();
    });

    it('다른 source 같은 ref는 별개로 인정 (출처 다름)', () => {
      const existing = [{
        id: 'existing-card-id',
        source: 'unit_xmark' as const,
        source_ref: 'sigong-2026-1-mid',
      }];
      const card = generateDrillCard({ ...baseOpts, signal: baseSignal, existing });
      expect(card).not.toBeNull();
    });
  });

  describe('공통 필드', () => {
    const signal: Signal = {
      kind: 'unit_xmark',
      unit_problem_id: 'p-1',
      problem_md: 'x',
      answer_md: 'y',
      unit: '수I',
    };

    it('id = uuidFn() 결과', () => {
      const card = generateDrillCard({ ...baseOpts, signal });
      expect(card!.id).toBe(FIXED_UUID);
    });

    it('student_id = opts.student_id', () => {
      const card = generateDrillCard({ ...baseOpts, signal });
      expect(card!.student_id).toBe(STUDENT_ID);
    });

    it('created_at은 ISO datetime + today 날짜', () => {
      const card = generateDrillCard({ ...baseOpts, signal });
      expect(card!.created_at).toMatch(/^2026-05-15T/);
    });
  });
});

describe('signalToSourceRef — UC-12 dedup 키 추출', () => {
  it('askai_failed_checkpoint → conversation_id', () => {
    const ref = signalToSourceRef({
      kind: 'askai_failed_checkpoint',
      conversation_id: 'abc',
      step_id: 's',
      fail_count: 3,
      problem_md: 'x',
      answer_md: 'y',
      unit: 'u',
    });
    expect(ref).toBe('abc');
  });

  it('exam_wrong → exam_id', () => {
    const ref = signalToSourceRef({
      kind: 'exam_wrong',
      exam_id: 'sigong-mid',
      problem_md: 'x',
      answer_md: 'y',
      unit: 'u',
    });
    expect(ref).toBe('sigong-mid');
  });

  it('homework_deduction → homework_id', () => {
    const ref = signalToSourceRef({
      kind: 'homework_deduction',
      homework_id: 'hw-1',
      problem_md: 'x',
      answer_md: 'y',
      unit: 'u',
      deduction_points: 2,
    });
    expect(ref).toBe('hw-1');
  });

  it('unit_xmark → unit_problem_id', () => {
    const ref = signalToSourceRef({
      kind: 'unit_xmark',
      unit_problem_id: 'p-x',
      problem_md: 'x',
      answer_md: 'y',
      unit: 'u',
    });
    expect(ref).toBe('p-x');
  });
});
