/**
 * UC-06 — search-unit RAG 테스트
 *
 * data/by-curriculum/ 에서 학생 질문에 매칭되는 단원 섹션 fetch.
 * 외부 데이터셋은 inject (KV/R2 등 어디에 저장하든 검색 로직은 같음).
 *
 * 비즈니스 룰:
 *   - title 매칭이 body 매칭보다 가중치 높음
 *   - unit_filter 일치 시 가산 (학생 현재 단원 우선)
 *   - 모든 query 단어가 매칭될 필요 없음 (부분 매칭 OK)
 *   - 결과는 score 내림차순 정렬, 동점이면 page 오름차순
 *   - limit 기본 5 (응답 폭주 방지)
 *   - 매칭 0건이면 빈 배열
 */

import { describe, it, expect } from 'vitest';
import { searchUnit, scoreSection } from './search-unit';
import type { UnitSection } from './search-unit';

const FIXTURE: UnitSection[] = [
  {
    unit_id: '확통 III-1',
    section_id: '§2.1',
    page: 11,
    title: '표본과 모집단',
    body: '확률변수 X1, X2, ..., Xn이 모분포를 따르고 서로 독립일 때, 이를 크기 n인 확률표본이라 한다.',
    keywords: ['표본', '모집단', '확률표본', '독립'],
    doc_id: 'data/by-curriculum/2026-1/확통/III-1/section-2.json',
  },
  {
    unit_id: '확통 II-3',
    section_id: '§1.4',
    page: 7,
    title: '분산의 성질',
    body: '독립인 두 확률변수의 합의 분산은 각 분산의 합과 같다. V(X+Y) = V(X) + V(Y).',
    keywords: ['분산', '독립', '합', '가법성'],
    doc_id: 'data/by-curriculum/2026-1/확통/II-3/section-1.json',
  },
  {
    unit_id: '확통 III-1',
    section_id: '§2.3',
    page: 14,
    title: '표본평균의 분산',
    body: '표본평균 X̄의 분산은 σ²/n이다. 즉 표본 크기가 클수록 표본평균은 모평균 주위에 더 집중된다.',
    keywords: ['표본평균', '분산', 'σ²/n'],
    doc_id: 'data/by-curriculum/2026-1/확통/III-1/section-2.json',
  },
  {
    unit_id: '수II',
    section_id: '§3.2',
    page: 42,
    title: '함수의 극한',
    body: 'lim x→a f(x) = L 의 정의는 ε-δ로 정의된다.',
    keywords: ['극한', '함수', 'epsilon-delta'],
    doc_id: 'data/by-curriculum/2026-1/수II/section-3.json',
  },
];

describe('searchUnit — UC-06', () => {
  it('단어가 body에 매칭되면 결과 반환', () => {
    const refs = searchUnit({ query: '표본평균', sections: FIXTURE });
    expect(refs.length).toBeGreaterThan(0);
    expect(refs[0].unit).toMatch(/확통/);
  });

  it('title 매칭이 body 매칭보다 우선', () => {
    // "분산" 단어 — title에 있는 §1.4(분산의 성질)이 §2.3(표본평균의 분산 — 사실 둘 다 title에 있음)
    // "분산의 성질" title 매칭이 더 직접적
    const refs = searchUnit({ query: '분산 성질', sections: FIXTURE });
    expect(refs[0].unit).toContain('II-3');
  });

  it('unit_filter 일치 시 가산점', () => {
    const refs = searchUnit({
      query: '표본',
      sections: FIXTURE,
      unit_filter: '확통 III-1',
    });
    // 확통 III-1 섹션이 상위에
    expect(refs[0].unit).toContain('III-1');
  });

  it('매칭 0건이면 빈 배열', () => {
    const refs = searchUnit({ query: '미적분 적분 미분', sections: FIXTURE });
    expect(refs).toEqual([]);
  });

  it('limit 기본 5 적용', () => {
    // FIXTURE 4개라 5보다 적지만, 임의 단어로 모두 매칭되도록
    const refs = searchUnit({ query: '한다', sections: FIXTURE });
    expect(refs.length).toBeLessThanOrEqual(5);
  });

  it('limit 명시 시 잘림', () => {
    const refs = searchUnit({ query: '확률 분산 표본', sections: FIXTURE, limit: 2 });
    expect(refs.length).toBe(2);
  });

  it('결과는 Reference 형태 — unit, page, quote 포함', () => {
    const refs = searchUnit({ query: '표본평균', sections: FIXTURE });
    expect(refs[0]).toMatchObject({
      unit: expect.any(String),
      page: expect.any(Number),
      quote: expect.any(String),
    });
  });

  it('quote는 매칭된 본문 발췌 (200자 이하)', () => {
    const refs = searchUnit({ query: '표본평균', sections: FIXTURE });
    expect(refs[0].quote.length).toBeLessThanOrEqual(200);
  });

  it('한국어 공백 토큰화 — "표본평균의 분산"은 "표본평균"과 "분산" 두 단어로', () => {
    const refs = searchUnit({ query: '표본평균의 분산', sections: FIXTURE });
    // §2.3 (표본평균의 분산) 가 1순위여야
    expect(refs[0].unit).toBe('확통 III-1 §2.3');
  });

  it('keywords 매칭도 점수에 반영', () => {
    const refs = searchUnit({ query: '가법성', sections: FIXTURE });
    // §1.4 keywords에 "가법성" 있음 → 매칭
    expect(refs.length).toBeGreaterThan(0);
    expect(refs[0].unit).toContain('II-3');
  });
});

describe('scoreSection — 단일 섹션 점수 계산', () => {
  const section = FIXTURE[2];  // §2.3 표본평균의 분산

  it('title 일치 단어당 +5', () => {
    const score = scoreSection(section, ['표본평균'], undefined);
    expect(score).toBeGreaterThanOrEqual(5);
  });

  it('body 일치 단어당 +1', () => {
    const score = scoreSection(section, ['집중된다'], undefined);
    expect(score).toBeGreaterThanOrEqual(1);
  });

  it('keywords 일치 단어당 +3', () => {
    const score = scoreSection(section, ['σ²/n'], undefined);
    expect(score).toBeGreaterThanOrEqual(3);
  });

  it('unit_filter 일치 +10', () => {
    const noFilter = scoreSection(section, ['표본평균'], undefined);
    const withFilter = scoreSection(section, ['표본평균'], '확통 III-1');
    expect(withFilter - noFilter).toBe(10);
  });

  it('매칭 0이면 score 0', () => {
    const score = scoreSection(section, ['미적분'], undefined);
    expect(score).toBe(0);
  });

  it('case-insensitive', () => {
    const lo = scoreSection(section, ['σ²/n'], undefined);
    expect(lo).toBeGreaterThan(0);
  });
});
