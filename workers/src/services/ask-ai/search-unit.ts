/**
 * UC-06 — search-unit RAG
 *
 * 학생 질문 → 학원 단원지 섹션 매칭 → references[] 반환.
 * 데이터셋은 inject (KV/R2 어디 저장하든 검색 로직은 동일).
 *
 * 점수 가중치:
 *   - title 매칭: +5/단어
 *   - keywords 매칭: +3/단어
 *   - body 매칭: +1/단어
 *   - unit_filter 일치: +10 (학생 현재 단원 우선)
 *
 * 한국어 처리: 단순 공백 split + "의/이/가/는/을/를" 등 자주 쓰는 조사 절단.
 * 한국어 형태소 분석은 v2에서 (mecab-ko 등).
 */

import type { Reference } from '@/schemas/ask-ai';

export interface UnitSection {
  unit_id: string;       // "확통 III-1"
  section_id: string;    // "§2.1"
  page: number;
  title: string;
  body: string;
  keywords?: string[];
  doc_id?: string;
}

export interface SearchUnitOpts {
  query: string;
  sections: UnitSection[];
  unit_filter?: string;  // 학생 현재 단원 — 가산점
  limit?: number;        // 기본 5
}

const DEFAULT_LIMIT = 5;
const QUOTE_MAX_LEN = 200;

const KO_PARTICLE = /[의이가은는을를에서로으]+$/;

export function searchUnit(opts: SearchUnitOpts): Reference[] {
  const tokens = tokenizeQuery(opts.query);
  if (tokens.length === 0) return [];

  const scored = opts.sections
    .map((section) => ({
      section,
      score: scoreSection(section, tokens, opts.unit_filter),
    }))
    .filter((s) => s.score > 0);

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.section.page - b.section.page;
  });

  const limit = opts.limit ?? DEFAULT_LIMIT;
  return scored.slice(0, limit).map(({ section }) => sectionToReference(section, tokens));
}

export function scoreSection(
  section: UnitSection,
  tokens: string[],
  unit_filter: string | undefined
): number {
  let score = 0;
  const titleLower = section.title.toLowerCase();
  const bodyLower = section.body.toLowerCase();
  const keywords = (section.keywords ?? []).map((k) => k.toLowerCase());

  for (const t of tokens) {
    const tLower = t.toLowerCase();
    if (titleLower.includes(tLower)) score += 5;
    if (keywords.some((k) => k.includes(tLower) || tLower.includes(k))) score += 3;
    if (bodyLower.includes(tLower)) score += 1;
  }

  if (unit_filter && section.unit_id === unit_filter) score += 10;

  return score;
}

function tokenizeQuery(query: string): string[] {
  return query
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 0)
    .map(stripParticle)
    .filter((w) => w.length > 0);
}

function stripParticle(word: string): string {
  return word.replace(KO_PARTICLE, '');
}

function sectionToReference(section: UnitSection, tokens: string[]): Reference {
  return {
    unit: `${section.unit_id} ${section.section_id}`,
    page: section.page,
    quote: extractQuote(section.body, tokens),
    doc_id: section.doc_id,
  };
}

function extractQuote(body: string, tokens: string[]): string {
  // 첫 매칭 단어 위치 중심 ± 100자
  const lower = body.toLowerCase();
  let firstMatch = -1;
  for (const t of tokens) {
    const idx = lower.indexOf(t.toLowerCase());
    if (idx !== -1 && (firstMatch === -1 || idx < firstMatch)) {
      firstMatch = idx;
    }
  }

  if (firstMatch === -1) {
    return body.slice(0, QUOTE_MAX_LEN);
  }

  const start = Math.max(0, firstMatch - 80);
  const end = Math.min(body.length, start + QUOTE_MAX_LEN);
  let quote = body.slice(start, end);
  if (start > 0) quote = '…' + quote;
  if (end < body.length) quote = quote + '…';
  return quote.slice(0, QUOTE_MAX_LEN);
}
