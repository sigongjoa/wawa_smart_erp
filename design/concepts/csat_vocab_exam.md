# Word-Gacha 수능 영단어 시험 모드 — 설계 문서

- 작성일: 2026-04-27
- 대상: `apps/student/public/word-gacha/` + `workers/src/routes/vocab-*.ts` + D1 스키마
- 시드 자료: `/tmp/csat_vocab/curated_megastudy.txt` (1,086개 정제 단어, 메가스터디 무료 PDF에서 추출)

## 1. 목표 / 비목표

**목표**
1. 학생이 word-gacha에서 **"수능 영단어 시험"** 모드를 실행해 수능/모의 빈출 단어로 즉석 시험을 칠 수 있다.
2. 시드 단어 1,086개는 **학원 카탈로그(공유)** 로 두고, 학생 개인 `vocab_words`와 분리 — DB 부풀림 방지.
3. 시험 결과는 기존 Leitner box·EXP·코인 보상 흐름과 호환.
4. 오프라인(localStorage) 단독으로도 동작, 로그인 시 서버에 결과 저장.

**비목표**
- 단어 의미(한국어 뜻) 자동 생성 — 시드는 영어 단어만 들어 있으므로 **별도 한국어 매핑 작업이 선행**되어야 한다 (§7).
- 발음/예문 자동 수집 (Phase 2).
- 수능특강 본문 그대로의 임베드 (저작권).

## 2. 사용자 흐름 (UX)

```
[홈] → "수능 영단어 시험" 카드 클릭
  ↓
[난이도 선택]
  - 빈도 1~300위  (쉬움)
  - 빈도 301~700위 (중)
  - 빈도 701~1086위 (어려움)
  - 모든 단어 무작위
  ↓
[문제 수 / 모드 선택]
  - 10문항 / 20문항 / 30문항
  - 4지선다 (영→한)  ← 기본
  - 4지선다 (한→영)
  - 주관식 입력 (영→한, 띄어쓰기 무시)
  ↓
[퀴즈 진행]  ← 기존 quiz.js 재사용 + HP 3, 콤보 보너스
  ↓
[결과]
  - 정답 수 / 정확도
  - 틀린 단어 → 학생 개인 vocab_words에 box=1로 자동 추가 옵션
  - EXP/코인 보상 (기존 EXP_PER_CORRECT, COIN_PER_CORRECT 그대로)
  - 크리쳐 본드 +0~3 (정답률에 비례)
```

키 차별점: **틀린 단어를 개인 단어장에 흡수**해서 다음 일반 가챠 학습 루프와 자연스럽게 연결.

## 3. 데이터 시드 준비 (작업 전제)

### 3.1 한국어 뜻 매핑 — 가장 큰 선결과제
현재 `curated_megastudy.txt`는 영단어 + 빈도만 있다. 메가스터디 PDF 원본에는 한국어 뜻이 있었으나 2단 표 레이아웃 때문에 추출 시 손실됐다. 두 가지 옵션:

| 옵션 | 방법 | 장단점 |
|---|---|---|
| **A. PDF 재파싱 (정밀)** | `pdftotext -table` 또는 좌표 기반 파서로 영-한 쌍 복원 | 무료, 메가스터디가 정제한 뜻 그대로. 파싱 코드 1~2시간 |
| **B. 국립국어원 API** | 영단어 → 한국어기초사전 / 우리말샘 검색 | 자동, 다의어/기본형 이슈 발생 가능 |
| **C. Gemini 일괄 번역** | 1,086개 → JSON 한 번에 번역 | 빠름, 비용 약 $0.05, 검토 필요 |
| **D. 수동 정리** | 사람이 검수 | 품질 최상, 시간 ↑↑ |

**권장**: A → C 폴백. 정확도가 핵심.

산출물: `seeds/csat_vocab_v1.json`
```json
[
  {"english": "absolutely", "korean": "전적으로, 틀림없이", "rank": 1, "pos": "adv"},
  {"english": "accept",     "korean": "받아들이다",         "rank": 2, "pos": "verb"},
  ...
]
```

### 3.2 빈도 등급 부여
빈도 순위(rank)를 3등급으로 분할:
- `tier=1` (rank 1~300): 1등급 빈출
- `tier=2` (rank 301~700)
- `tier=3` (rank 701~1086)

## 4. DB 스키마 (D1, 마이그레이션 `051_vocab_catalog.sql`)

기존 `vocab_words`는 학생-소유 단어. **카탈로그(공유)** 는 신규 테이블로 분리.

```sql
-- 4.1 카탈로그 마스터
CREATE TABLE IF NOT EXISTS vocab_catalogs (
  id          TEXT PRIMARY KEY,             -- 'csat-megastudy-2025'
  title       TEXT NOT NULL,                -- '수능 영단어 (메가스터디)'
  source      TEXT NOT NULL,                -- 'megastudy-2025-pdf'
  license     TEXT,                         -- '학원 내부 학습용'
  word_count  INTEGER NOT NULL,
  created_at  DATETIME DEFAULT (datetime('now'))
);

-- 4.2 카탈로그 단어 (academy 무관, 전 학원 공유)
CREATE TABLE IF NOT EXISTS vocab_catalog_words (
  id          TEXT PRIMARY KEY,             -- 'cw-csat-0001'
  catalog_id  TEXT NOT NULL,
  english     TEXT NOT NULL,
  korean      TEXT NOT NULL,
  pos         TEXT,                         -- noun|verb|adj|adv|prep|conj
  rank        INTEGER NOT NULL,             -- 빈도 순위
  tier        INTEGER NOT NULL,             -- 1|2|3
  example     TEXT,                         -- nullable
  FOREIGN KEY (catalog_id) REFERENCES vocab_catalogs(id) ON DELETE CASCADE
);
CREATE INDEX idx_catalog_words_tier ON vocab_catalog_words(catalog_id, tier);
CREATE UNIQUE INDEX uq_catalog_word ON vocab_catalog_words(catalog_id, english);

-- 4.3 시험 세션 (서버 저장용 — 보상/통계)
CREATE TABLE IF NOT EXISTS vocab_exam_sessions (
  id          TEXT PRIMARY KEY,
  academy_id  TEXT NOT NULL,
  student_id  TEXT NOT NULL,
  catalog_id  TEXT NOT NULL,
  tier        INTEGER,                      -- null=mixed
  mode        TEXT NOT NULL,                -- 'mc-en2ko'|'mc-ko2en'|'sa-en2ko'
  total       INTEGER NOT NULL,
  correct     INTEGER NOT NULL,
  duration_ms INTEGER,
  wrong_ids_json TEXT,                      -- 틀린 catalog_word.id 배열
  created_at  DATETIME DEFAULT (datetime('now')),
  FOREIGN KEY (student_id) REFERENCES gacha_students(id) ON DELETE CASCADE
);
CREATE INDEX idx_exam_sessions_student ON vocab_exam_sessions(student_id, created_at);
```

**시드 import 스크립트**: `workers/scripts/seed_csat_vocab.ts`
```ts
// reads seeds/csat_vocab_v1.json, batch INSERT into vocab_catalog_words
// idempotent: ON CONFLICT(catalog_id, english) DO NOTHING
```

## 5. API 설계

기존 `vocab-play-handler.ts`(학생 플레이용 토큰 인증) 패턴을 따른다.

### 5.1 카탈로그 조회 — 공개 (인증 불필요)
```
GET /api/vocab/catalogs
  → 200 { catalogs: [{ id, title, word_count }] }

GET /api/vocab/catalogs/:id/words?tier=1&limit=300
  → 200 { words: [{ id, english, korean, pos, rank, tier }] }
```
- 카탈로그는 academy 무관 공유 자산이라 인증 불필요.
- 프론트는 1회 받아 localStorage에 캐시 (`wg.v1.catalog.csat-megastudy-2025`).

### 5.2 시험 결과 제출 — 학생 토큰
```
POST /api/play/vocab/exam
Headers: Authorization: Bearer <play_token>
Body: {
  catalog_id: 'csat-megastudy-2025',
  tier: 1 | 2 | 3 | null,
  mode: 'mc-en2ko',
  total: 10,
  correct: 8,
  duration_ms: 92000,
  wrong_word_ids: ['cw-csat-0042', 'cw-csat-0117'],
  absorb_wrong: true     // true면 wrong을 vocab_words에 box=1로 추가
}
→ 200 {
  session_id, exp_gained, coin_gained,
  absorbed_word_ids: [...]   // vocab_words 신규 행 id
}
```

서버 처리:
1. session insert
2. `absorb_wrong=true`이면 wrong_word_ids → catalog_words에서 lookup → 학생의 vocab_words에 INSERT (status='approved', box=1, added_by='exam')
3. EXP/coin 적립은 클라가 계산 후 보고하지만 서버는 anti-cheat로 `correct ≤ total` 검증

## 6. 프론트엔드 모듈 추가

### 6.1 신규 파일
```
apps/student/public/word-gacha/js/
  catalog.js        ← 카탈로그 fetch + localStorage 캐시
  exam.js           ← 시험 세션 (퀴즈와 별개 모드)
  exam-ui.js        ← UI 글루 (난이도/모드 선택 → 진행 → 결과)
```

### 6.2 `catalog.js` (요지)
```js
const CACHE_KEY = 'wg.v1.catalog.';

export async function loadCatalog(catalogId, { tier } = {}) {
  const cacheKey = `${CACHE_KEY}${catalogId}${tier ? `.t${tier}` : ''}`;
  const cached = localStorage.getItem(cacheKey);
  if (cached) {
    try { return JSON.parse(cached); } catch {}
  }
  const url = `${API_BASE}/api/vocab/catalogs/${catalogId}/words${tier ? `?tier=${tier}` : ''}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('catalog fetch failed');
  const { words } = await res.json();
  localStorage.setItem(cacheKey, JSON.stringify(words));
  return words;
}

// catalog word를 quiz가 받는 word shape으로 변환
export function toQuizWord(cw) {
  return {
    id: cw.id, word: cw.english, meaning: cw.korean,
    pos: cw.pos || 'noun', example: cw.example || '',
    box: 1, wrongCount: 0,
  };
}
```

### 6.3 `exam.js` (요지) — 기존 quiz.js를 슬림하게 재활용
```js
import { startQuiz, answer } from './quiz.js';

export function startExam(catalogWords, { size = 10, mode = 'mc-en2ko' } = {}) {
  const pool = catalogWords.map(toQuizWord);
  const session = startQuiz(pool);
  session.size = Math.min(size, pool.length);
  session.questions = session.questions.slice(0, session.size);
  session.mode = mode;          // mc-en2ko | mc-ko2en | sa-en2ko
  session.examMode = true;      // 서버 보고용 플래그
  return session;
}

// 'mc-ko2en'은 buildQuestion의 prompt/choices 스왑이 필요 → quiz.js의 buildQuestion에 mode 옵션 추가
```

`quiz.js`의 `buildQuestion`을 mode 인자 받도록 살짝 확장 (구문상 1-line 변화).

### 6.4 `index.html` 진입점
홈 화면(현재 가챠 카드들이 있는 영역)에 카드 추가:
```html
<button class="card card--exam" data-action="csat-exam">
  <span class="card__title">수능 영단어 시험</span>
  <span class="card__desc">1086 단어 · 빈도 등급별</span>
</button>
```
모달 → 난이도/모드/문항수 선택 → `startExam` → 결과 → 서버 POST → "틀린 N개를 단어장에 추가했습니다" 토스트.

### 6.5 오프라인 동작
- 카탈로그가 캐시돼 있으면 인증 없이도 시험 가능.
- 결과 POST가 실패하면 큐에 쌓아 다음 인증 시도 시 일괄 전송 (`wawa-bridge.js`의 기존 큐 패턴 재사용).

## 7. 시드 데이터 빌드 파이프라인

```
1. workers/scripts/build_csat_seed.py
   - input: /tmp/csat_vocab/megastudy_2025_susung.txt + megastudy_23mar.txt
   - 정확 파싱 (좌/우 컬럼 분리, 영단어 ↔ 한국어 짝 복원)
   - output: workers/seeds/csat_vocab_v1.json (1,086 entries)
   - rank = 빈도순, tier = ceil(rank / 362) 클램프

2. workers/scripts/seed_csat_vocab.ts
   - wrangler d1 execute로 batch insert
   - 멱등 (UNIQUE catalog_id+english)

3. CI: npm run seed:csat (production / preview)
```

## 8. 보상 / Leitner 연동

| 이벤트 | 효과 |
|---|---|
| 정답 1개 | EXP +10, 코인 +2 (기존과 동일) |
| 시험 완주 | 보너스 EXP +20 |
| 정확도 ≥ 90% | 코인 +10 + 크리쳐 bond +2 |
| 정확도 ≥ 100% | "수능 만점" 뱃지 (catalog_id+tier 별 1회) |
| 틀린 단어 흡수 | `vocab_words` box=1 신규 행, 다음 일반 가챠에서 출제 가중치 ↑ |

## 9. 마일스톤

| 단계 | 작업 | 예상 |
|---|---|---|
| M1 | PDF 재파싱 → `csat_vocab_v1.json` 1,086개 (영-한-tier) | 0.5d |
| M2 | 마이그레이션 `051_vocab_catalog.sql` + seed 스크립트 | 0.5d |
| M3 | API: catalogs GET, exam POST | 0.5d |
| M4 | 프론트: catalog.js, exam.js, 모달 UI | 1d |
| M5 | 서버 result POST + 틀린 단어 흡수 + 오프라인 큐 | 0.5d |
| M6 | E2E (`apps/student/e2e/csat-exam.spec.ts`) + 빈도 등급 검증 | 0.5d |

총 ~3.5일.

## 10. 위험 / 결정 필요 사항

1. **한국어 뜻 매핑 품질** — A안(PDF 재파싱) 실패 시 C안(Gemini)로 갈지, 그 경우 누가 검수할지 결정 필요.
2. **저작권 표기** — 카탈로그 메타에 "출처: 메가스터디 김동영 강사 무료 배포 PDF (학습용)" 명시. 외부 공개 학생 페이지에 카탈로그 전체 리스트가 노출되지 않도록 인증/세션 단위로만 단어 표시.
3. **카탈로그 캐싱 전략** — 1,086개 × ~50B = 약 50KB JSON. localStorage에 통째로 두어도 무방.
4. **빈도 vs 난이도** — 단순 빈도 = 난이도라 가정. 더 정교한 난이도(어휘 등급)가 필요하면 교육부 3000(하나셀) 매칭으로 보강.
5. **기존 vocab_print_jobs 재사용 여부** — 시험 결과를 `vocab_print_jobs`+`vocab_grade_results`로도 표현 가능하나, 카탈로그(공유) 단어는 학생-소유 `vocab_words`가 아니라 join이 어색. 별도 `vocab_exam_sessions` 테이블 권장 (위 §4).

## 11. 다음 단계
이 설계가 OK면:
- `/sc:implement` 로 진입 → M1(PDF 재파싱) 부터 차례로 구현.
- 또는 우선 §3.1의 한국어 매핑 옵션부터 결정.

---

## Appendix A — 핵심 파일 매핑

| 영역 | 파일 |
|---|---|
| 마이그레이션 | `workers/migrations/051_vocab_catalog.sql` (신규) |
| 시드 빌더 | `workers/scripts/build_csat_seed.py` (신규) |
| 시드 import | `workers/scripts/seed_csat_vocab.ts` (신규) |
| API | `workers/src/routes/vocab-catalog-handler.ts` (신규) + `vocab-play-handler.ts` (exam endpoint 추가) |
| 프론트 | `apps/student/public/word-gacha/js/catalog.js`, `exam.js`, `exam-ui.js` (신규), `index.html`, `quiz.js` (mode 옵션) |
| 데이터 | `workers/seeds/csat_vocab_v1.json` (신규) |
| E2E | `apps/student/e2e/csat-exam.spec.ts` (신규) |
