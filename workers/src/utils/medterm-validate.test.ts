/**
 * UC-MX-01 (Leitner) + UC-MS-02~05 (채점) 단위 테스트
 *
 * 실행: cd workers && npx vitest run src/utils/medterm-validate.test.ts
 */
import { describe, it, expect } from 'vitest';
import {
  checkChoice, checkOX, checkShortAnswer, checkMatch,
  checkBlank, checkDecompose, gradeItem, nextLeitner,
  scoreMatchPartial,
} from './medterm-validate';

describe('UC-MS-02 객관식 채점', () => {
  it('대소문자 무관 정답', () => {
    expect(checkChoice('B', 'b')).toBe(true);
    expect(checkChoice('B', 'B')).toBe(true);
  });
  it('오답', () => {
    expect(checkChoice('A', 'B')).toBe(false);
  });
  it('비-string은 false', () => {
    expect(checkChoice('A', 1)).toBe(false);
    expect(checkChoice(null, 'A')).toBe(false);
  });
});

describe('UC-MS OX 채점', () => {
  it('O 정답', () => expect(checkOX('O', 'o')).toBe(true));
  it('X 정답', () => expect(checkOX('X', 'X')).toBe(true));
  it('공백 무시', () => expect(checkOX('O', ' o ')).toBe(true));
  it('오답', () => expect(checkOX('O', 'X')).toBe(false));
});

describe('UC-MS-02 단답형 채점 (느슨 매칭)', () => {
  it('정확 일치', () => expect(checkShortAnswer('cardiology', 'cardiology')).toBe(true));
  it('대소문자 무시', () => expect(checkShortAnswer('Cardiology', 'cardiology')).toBe(true));
  it('공백·구두점·하이픈 무시', () => {
    expect(checkShortAnswer('cardio-logy', 'cardiology')).toBe(true);
    expect(checkShortAnswer(' cardiology ', 'cardiology')).toBe(true);
    expect(checkShortAnswer('cardi/o/logy', 'cardiology')).toBe(true);
  });
  it('한글 의미 매칭', () => expect(checkShortAnswer('심장학', '심장학')).toBe(true));
  it('오답', () => expect(checkShortAnswer('cardiology', 'cardiogram')).toBe(false));
});

describe('UC-MS 매칭 채점', () => {
  const ans = { '1': 'b', '2': 'd', '3': 'a', '4': 'e', '5': 'c' };
  it('전체 일치 시 정답', () => {
    expect(checkMatch(ans, { '1': 'b', '2': 'd', '3': 'a', '4': 'e', '5': 'c' })).toBe(true);
  });
  it('한 칸 틀려도 false', () => {
    expect(checkMatch(ans, { '1': 'b', '2': 'd', '3': 'a', '4': 'e', '5': 'a' })).toBe(false);
  });
  it('키 개수 다르면 false', () => {
    expect(checkMatch(ans, { '1': 'b', '2': 'd' })).toBe(false);
  });
  it('부분 점수 — 5개 중 4개 맞음', () => {
    const r = scoreMatchPartial(ans, { '1': 'b', '2': 'd', '3': 'a', '4': 'e', '5': 'a' });
    expect(r).toEqual({ correct: 4, total: 5 });
  });
});

describe('UC-MS-03 용어 분해 채점', () => {
  it('parts 배열 정답 (cardiology)', () => {
    const answer = [
      { role: 'r', value: 'cardi' },
      { role: 'cv', value: 'o' },
      { role: 's', value: '-logy' },
    ];
    const response = [
      { role: 'r', value: 'cardi' },
      { role: 'cv', value: 'o' },
      { role: 's', value: '-logy' },
    ];
    expect(checkDecompose(answer, response)).toBe(true);
  });

  it('value만 일치, role 다름 — 기본은 통과 (느슨)', () => {
    const answer = [{ role: 'r', value: 'cardi' }];
    const response = [{ value: 'cardi' }];  // role 누락 OK
    expect(checkDecompose(answer, response)).toBe(true);
  });

  it('strictRole=true면 role 다르면 fail', () => {
    const answer = [{ role: 'r', value: 'cardi' }];
    const response = [{ role: 'p', value: 'cardi' }];
    expect(checkDecompose(answer, response, { strictRole: true })).toBe(false);
  });

  it('문자열 입력 (cardi/o/logy)도 허용', () => {
    const answer = [
      { role: 'r', value: 'cardi' },
      { role: 'cv', value: 'o' },
      { role: 's', value: '-logy' },
    ];
    expect(checkDecompose(answer, 'cardi/o/logy')).toBe(true);
  });

  it('musculoskeletal — 4-part 분해', () => {
    const answer = 'muscul/o/skelet/al';
    expect(checkDecompose(answer, 'muscul/o/skelet/al')).toBe(true);
    expect(checkDecompose(answer, 'muscul/o/skelet/-al')).toBe(true);  // 하이픈 무시
    expect(checkDecompose(answer, 'muscul/skelet/al')).toBe(false);    // cv 누락
  });

  it('순서가 다르면 fail', () => {
    expect(checkDecompose('cardi/o/logy', 'logy/o/cardi')).toBe(false);
  });
});

describe('UC-MS-05 빈칸 채점 (배열 형식)', () => {
  it('순서대로 일치', () => {
    expect(checkBlank(['붙이지 않는다', '붙인다'], ['붙이지 않는다', '붙인다'])).toBe(true);
  });
  it('느슨 매칭', () => {
    expect(checkBlank(['cardi-o', 'logy'], ['cardio', 'logy'])).toBe(true);
  });
});

describe('UC-MX-02 통합 채점 — gradeItem', () => {
  it('객관식', () => {
    expect(gradeItem('객관식', 'B', 'B')).toEqual({ correct: 1 });
    expect(gradeItem('객관식', 'B', 'A')).toEqual({ correct: 0 });
  });
  it('OX', () => {
    expect(gradeItem('OX', 'X', 'X')).toEqual({ correct: 1 });
  });
  it('단답형', () => {
    expect(gradeItem('단답형', 'mastectomy', 'Mastectomy')).toEqual({ correct: 1 });
  });
  it('매칭 — 부분 점수도 반환', () => {
    const ans = { '1': 'b', '2': 'd' };
    const res1 = gradeItem('매칭', ans, { '1': 'b', '2': 'd' });
    expect(res1).toEqual({ correct: 1, partial: { right: 2, total: 2 } });
    const res2 = gradeItem('매칭', ans, { '1': 'b', '2': 'a' });
    expect(res2).toEqual({ correct: 0, partial: { right: 1, total: 2 } });
  });
  it('용어분해', () => {
    expect(gradeItem('용어분해', 'cardi/o/logy', 'cardi/o/logy')).toEqual({ correct: 1 });
  });
  it('알 수 없는 유형 → 0', () => {
    expect(gradeItem('서술형', 'x', 'x').correct).toBe(0);
  });
});

describe('UC-MX-01 Leitner 5-box 갱신', () => {
  const fixedNow = new Date('2026-04-30T10:00:00Z');

  it('정답 시 box +1, max 5', () => {
    const r1 = nextLeitner(1, true, fixedNow);
    expect(r1.box).toBe(2);
    // box 2 = 1d 후
    expect(r1.nextReview.getTime() - fixedNow.getTime()).toBe(24 * 3600 * 1000);

    const r5 = nextLeitner(5, true, fixedNow);
    expect(r5.box).toBe(5); // cap

    const r4 = nextLeitner(4, true, fixedNow);
    expect(r4.box).toBe(5);
    expect(r4.nextReview.getTime() - fixedNow.getTime()).toBe(336 * 3600 * 1000);
  });

  it('오답 시 box=1, 4시간 후 재등장', () => {
    const r = nextLeitner(4, false, fixedNow);
    expect(r.box).toBe(1);
    expect(r.nextReview.getTime() - fixedNow.getTime()).toBe(4 * 3600 * 1000);
  });

  it('box1 정답 → box2 (1d 후)', () => {
    const r = nextLeitner(1, true, fixedNow);
    expect(r.box).toBe(2);
    expect(r.nextReview.getTime() - fixedNow.getTime()).toBe(24 * 3600 * 1000);
  });
});
