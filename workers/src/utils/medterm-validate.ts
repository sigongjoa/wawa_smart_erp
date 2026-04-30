/**
 * MedTerm 채점 함수 — 유형별 정답 비교 로직.
 *
 * 모든 함수는 (정답 페이로드, 학생 응답) → boolean 반환.
 * 입력은 이미 sanitize 거친 상태로 들어온다고 가정.
 *
 * 유형 (med_exam_items.type):
 *   '객관식' | '단답형' | '매칭' | '빈칸' | '용어분해' | 'OX'
 */

/** 공백·구두점·대소문자 정규화 — 단답 비교용 */
function normalizeTerm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\s\-_/().]+/g, '')
    .trim();
}

/** 객관식: answer는 'A'~'E', response는 같은 문자 */
export function checkChoice(answer: unknown, response: unknown): boolean {
  if (typeof answer !== 'string' || typeof response !== 'string') return false;
  return answer.toUpperCase() === response.toUpperCase();
}

/** OX: answer 'O'|'X', response 동일 */
export function checkOX(answer: unknown, response: unknown): boolean {
  if (typeof answer !== 'string' || typeof response !== 'string') return false;
  return answer.toUpperCase().trim() === response.toUpperCase().trim();
}

/** 단답형: 정답 문자열 ↔ 학생 입력 (느슨 매칭) */
export function checkShortAnswer(answer: unknown, response: unknown): boolean {
  if (typeof answer !== 'string' || typeof response !== 'string') return false;
  return normalizeTerm(answer) === normalizeTerm(response);
}

/**
 * 매칭: answer는 { "1": "b", "2": "d", ... }, response 동일 형태.
 * 키 집합과 값이 모두 일치하면 정답. 부분 정답은 false (전체 일치 요구).
 */
export function checkMatch(answer: unknown, response: unknown): boolean {
  if (
    !answer || typeof answer !== 'object' ||
    !response || typeof response !== 'object'
  ) return false;
  const a = answer as Record<string, string>;
  const r = response as Record<string, string>;
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(r).length) return false;
  return keys.every((k) =>
    typeof a[k] === 'string' &&
    typeof r[k] === 'string' &&
    a[k].toLowerCase() === r[k].toLowerCase()
  );
}

/** 매칭 부분 점수 — N개 중 맞은 개수 / 전체 (Leitner 입장에서 다른 채점에 사용 가능) */
export function scoreMatchPartial(answer: unknown, response: unknown): { correct: number; total: number } {
  if (
    !answer || typeof answer !== 'object' ||
    !response || typeof response !== 'object'
  ) return { correct: 0, total: 0 };
  const a = answer as Record<string, string>;
  const r = response as Record<string, string>;
  const keys = Object.keys(a);
  const correct = keys.reduce((acc, k) => {
    if (typeof a[k] === 'string' && typeof r[k] === 'string' &&
        a[k].toLowerCase() === r[k].toLowerCase()) return acc + 1;
    return acc;
  }, 0);
  return { correct, total: keys.length };
}

/**
 * 빈칸: answer는 { "①": "...", "②": "..." } 또는 ["...", "..."], response 동일.
 */
export function checkBlank(answer: unknown, response: unknown): boolean {
  // dict 형
  if (answer && typeof answer === 'object' && !Array.isArray(answer)) {
    return checkMatch(answer, response);
  }
  // array 형
  if (Array.isArray(answer) && Array.isArray(response)) {
    if (answer.length !== response.length) return false;
    return answer.every((v, i) =>
      typeof v === 'string' && typeof response[i] === 'string' &&
      normalizeTerm(v) === normalizeTerm(response[i] as string)
    );
  }
  return false;
}

/**
 * 용어분해: answer는 'cardi/o/logy' 같은 정답 문자열,
 * 또는 parts: [{role, value}, ...] 배열도 허용.
 * response는 학생이 적은 부분 배열 [{role?, value}, ...] 또는 'cardi/o/logy' 문자열.
 */
export interface DecomposePart {
  role?: 'p' | 'r' | 'cv' | 's';
  value: string;
}

export function checkDecompose(
  answer: unknown,
  response: unknown,
  options: { strictRole?: boolean } = {}
): boolean {
  // answer 정규화
  const ansParts = parseDecompose(answer);
  const resParts = parseDecompose(response);
  if (!ansParts || !resParts) return false;
  if (ansParts.length !== resParts.length) return false;
  return ansParts.every((ap, i) => {
    const rp = resParts[i];
    if (normalizeTerm(ap.value) !== normalizeTerm(rp.value)) return false;
    if (options.strictRole && ap.role && rp.role && ap.role !== rp.role) return false;
    return true;
  });
}

function parseDecompose(input: unknown): DecomposePart[] | null {
  // 'cardi/o/logy' 형
  if (typeof input === 'string') {
    return input.split('/').map((v) => ({ value: v.trim() })).filter((p) => p.value);
  }
  // [{role, value}, ...] 형
  if (Array.isArray(input)) {
    return input
      .filter((p) => p && typeof p === 'object' && typeof (p as DecomposePart).value === 'string')
      .map((p) => p as DecomposePart);
  }
  return null;
}

/**
 * 통합 채점 — 유형 문자열로 분기.
 * 반환: 'correct'(O), 'wrong'(X), 'partial' 셋 중 하나 + 옵셔널 score(0-1)
 */
export type GradeResult = {
  correct: 0 | 1;
  partial?: { right: number; total: number };
};

export function gradeItem(type: string, answer: unknown, response: unknown): GradeResult {
  switch (type) {
    case '객관식':
      return { correct: checkChoice(answer, response) ? 1 : 0 };
    case 'OX':
      return { correct: checkOX(answer, response) ? 1 : 0 };
    case '단답형':
      return { correct: checkShortAnswer(answer, response) ? 1 : 0 };
    case '매칭': {
      const { correct, total } = scoreMatchPartial(answer, response);
      return {
        correct: correct === total && total > 0 ? 1 : 0,
        partial: { right: correct, total },
      };
    }
    case '빈칸':
      return { correct: checkBlank(answer, response) ? 1 : 0 };
    case '용어분해':
      return { correct: checkDecompose(answer, response, { strictRole: false }) ? 1 : 0 };
    default:
      return { correct: 0 };
  }
}

/**
 * Leitner 5-box 갱신 — 정답 시 box+1, 오답 시 box=1.
 * 다음 리뷰 시각도 같이 계산.
 */
export const LEITNER_INTERVALS_HOURS: Record<number, number> = {
  1: 1,    // 1h
  2: 24,   // 1d
  3: 72,   // 3d
  4: 168,  // 7d
  5: 336,  // 14d
};

export function nextLeitner(
  currentBox: number,
  isCorrect: boolean,
  now: Date = new Date()
): { box: number; nextReview: Date } {
  const box = isCorrect ? Math.min(currentBox + 1, 5) : 1;
  const intervalHours = isCorrect ? LEITNER_INTERVALS_HOURS[box] : 4; // 오답은 4h 후 재등장
  const nextReview = new Date(now.getTime() + intervalHours * 3600 * 1000);
  return { box, nextReview };
}
