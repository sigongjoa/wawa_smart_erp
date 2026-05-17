/**
 * UC-13 — SM-2 (SuperMemo 2) 알고리즘 + "모름" 즉시 재진입 분기
 *
 * 학생 자가평가 (easy/ok/hard/dunno) → 다음 due date 계산.
 *
 * 표준 SM-2 (Wozniak 1990)와 차이점:
 * - 5단계가 아니라 4단계 (학원 톤에 맞춤)
 * - "모름" → interval = 0 → 즉시 재진입 (UC-14)
 * - 첫 review 간격은 ease와 무관하게 1/3/7일 고정 (학생 부담 감소)
 *
 * 입력은 순수, side effect 없음 — 단위 테스트 100% 가능.
 */

import type { Rating, SM2State } from '@/schemas/ask-ai';

const MIN_EASE = 1.3;
const MAX_EASE = 2.5;
const DEFAULT_EASE = 2.5;

export interface SM2NextResult {
  next_state: SM2State;
  /** UC-14 — true면 학생을 즉시 mobile-chat으로 보내야 함 */
  re_enter_chat: boolean;
}

/**
 * 자가평가 → 다음 SM-2 상태 계산
 *
 * @param current  현재 SM-2 상태
 * @param rating   학생 자가평가
 * @param today    오늘 날짜 (YYYY-MM-DD, 테스트 가능성 위해 외부 주입)
 */
export function nextSM2(
  current: SM2State,
  rating: Rating,
  today: string
): SM2NextResult {
  const reps = current.reps + 1;
  let ease = current.ease;
  let interval_days: number;
  let lapses = current.lapses;
  let re_enter_chat = false;

  switch (rating) {
    case 'easy':
      // 쉬움: ease ↑, interval ×1.3 또는 첫 review 7일
      ease = clampEase(ease + 0.15);
      interval_days = current.reps === 0 ? 7 : Math.round(current.interval_days * 1.3);
      break;

    case 'ok':
      // 적당: ease 유지, 표준 SM-2 backbone
      // 첫 1회: 1일, 2회: 3일, 그 이후 ease 곱
      if (current.reps === 0) interval_days = 1;
      else if (current.reps === 1) interval_days = 3;
      else interval_days = Math.round(current.interval_days * ease);
      break;

    case 'hard':
      // 어려움: ease ↓, interval ×1.0 (반복은 누적되지만 간격 안 늘어남)
      ease = clampEase(ease - 0.15);
      interval_days = Math.max(1, current.interval_days);
      break;

    case 'dunno':
      // UC-14 — 모름: interval = 0, 즉시 재진입
      ease = clampEase(ease - 0.20);
      interval_days = 0;
      lapses = current.lapses + 1;
      re_enter_chat = true;
      break;
  }

  return {
    next_state: {
      card_id: current.card_id,
      ease,
      interval_days,
      due_date: addDays(today, interval_days),
      reps,
      lapses,
    },
    re_enter_chat,
  };
}

export function initialSM2State(card_id: string, today: string): SM2State {
  return {
    card_id,
    ease: DEFAULT_EASE,
    interval_days: 1,
    due_date: addDays(today, 1),
    reps: 0,
    lapses: 0,
  };
}

/* ─────────── helpers ─────────── */

function clampEase(v: number): number {
  return Math.max(MIN_EASE, Math.min(MAX_EASE, Number(v.toFixed(2))));
}

function addDays(yyyymmdd: string, days: number): string {
  const [y, m, d] = yyyymmdd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}
