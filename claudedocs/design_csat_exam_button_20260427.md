# 수능 영단어 시험 — "시험 치기" 버튼 아래 추가 (Focused Design)

- 작성일: 2026-04-27
- 범위: 기존 word-gacha의 **내 단어장 상단 "시험 치기" 버튼 바로 아래**에 "수능 영단어 시험치기" 버튼 추가
- 시드: `/tmp/csat_vocab/curated_megastudy.txt` (1,086 단어)

## 1. 핵심 설계 원칙 — *기존 흐름 그대로 재사용*

기존 "시험 치기" 버튼은 다음 경로를 탄다:
```
btn-self-exam (mywords-actions)
  → selfStartPrintJob(10)            // wawa-bridge.js
  → POST /api/play/vocab/print-jobs/self-start
  → 서버가 학생 vocab_words에서 가중치 출제 → { id, questions }
  → printState 채우고 data-screen='print' 로 전환
  → renderPrintTake() (이미 완성된 다지선다 응시 화면)
```

**전략**: 새 버튼도 **같은 경로**를 타되, 서버에 `source: 'csat'` + `tier`만 추가로 보낸다. 서버는 `vocab_words` 대신 `vocab_catalog_words`에서 출제. 결과 UI/이어풀기/채점/box 갱신 로직은 **그대로 재사용**.

장점: 클라이언트 변경 ≈ 100줄, 서버 변경 ≈ 50줄. 별도 화면/쿼리/상태 불필요.

## 2. UI — 버튼 추가 위치

`apps/student/public/word-gacha/index.html:3304-3310` 의 `.mywords-actions` 컨테이너 안, 기존 `#btn-self-exam` 직후:

```html
<div class="mywords-actions">
  <!-- 기존 -->
  <button type="button" class="mywords-exam-btn" id="btn-self-exam">
    <span aria-hidden="true">📝</span>
    <span class="lbl">시험 치기</span>
    <span class="sub">내 단어 최대 10문제</span>
  </button>

  <!-- 신규 -->
  <button type="button" class="mywords-exam-btn mywords-exam-btn--csat" id="btn-csat-exam">
    <span aria-hidden="true">🎯</span>
    <span class="lbl">수능 영단어 시험치기</span>
    <span class="sub">메가스터디 빈출 1086개 · 빈도등급 선택</span>
  </button>
</div>
```

CSS 변형 (기존 `.mywords-exam-btn` 클래스 그대로 + 색만 다르게):
```css
.mywords-exam-btn--csat {
  background: linear-gradient(90deg, #c2410c, #ea580c);  /* 빨강~주황: 수능 분위기 */
  margin-top: 8px;
}
```

## 3. 클릭 시 흐름 — 간단한 시트 한 장

새 화면은 만들지 않고, 기존 패턴인 **하단 시트 모달** 1개로 끝낸다.

```
[수능 영단어 시험치기] 클릭
  ↓
시트 표시:
  ┌─────────────────────────┐
  │ 수능 영단어 시험         │
  │                         │
  │ 난이도                  │
  │  ○ 1등급 (빈출 1~300위) │
  │  ● 2등급 (301~700위)    │  ← 기본
  │  ○ 3등급 (701~1086위)   │
  │  ○ 전체 무작위          │
  │                         │
  │ 문항수                  │
  │  [10] [20] [30]         │
  │                         │
  │   [ 시험 시작 → ]       │
  └─────────────────────────┘
  ↓
selfStartPrintJob({ source: 'csat', tier: 2, size: 10 })
  ↓
기존 renderPrintTake() 흐름 그대로
  ↓
결과 화면(이미 존재) → 박스 갱신/EXP 보상도 그대로
```

시트 마크업(약 30줄)은 기존 모달 스타일(`.print-alert` 등)과 같은 톤으로 작성.

## 4. 백엔드 변경 — 1개 핸들러만 확장

### 4.1 마이그레이션 (신규)
`workers/migrations/051_vocab_catalog.sql`:
```sql
CREATE TABLE IF NOT EXISTS vocab_catalogs (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  source TEXT NOT NULL,
  word_count INTEGER NOT NULL,
  created_at DATETIME DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS vocab_catalog_words (
  id TEXT PRIMARY KEY,
  catalog_id TEXT NOT NULL,
  english TEXT NOT NULL,
  korean TEXT NOT NULL,
  pos TEXT,
  rank INTEGER NOT NULL,
  tier INTEGER NOT NULL,           -- 1|2|3
  example TEXT,
  FOREIGN KEY (catalog_id) REFERENCES vocab_catalogs(id) ON DELETE CASCADE
);
CREATE INDEX idx_catalog_words_tier ON vocab_catalog_words(catalog_id, tier);
CREATE UNIQUE INDEX uq_catalog_word ON vocab_catalog_words(catalog_id, english);
```

### 4.2 시드 import (1회)
`workers/scripts/seed_csat_vocab.ts` — `seeds/csat_vocab_v1.json`을 batch INSERT.

### 4.3 기존 `vocab-play-handler.ts`의 `self-start` 핸들러 확장

요청 바디 스키마에 두 필드 추가:
```ts
const SelfStartSchema = z.object({
  size: z.number().int().min(5).max(30).default(10),
  source: z.enum(['mywords', 'csat']).default('mywords'),    // 신규
  tier: z.number().int().min(1).max(3).optional(),           // 신규 (csat 전용)
  catalog_id: z.string().optional(),                         // 신규, 기본='csat-megastudy-2025'
});
```

핸들러 분기:
```ts
if (input.source === 'csat') {
  // catalog에서 tier 필터 + LIMIT size로 무작위 추출
  // questions = catalog_words → 4지선다 빌드 (오답은 같은 catalog_id 안에서 추출)
  // 이때 print_job 행을 별도 컬럼 source='csat' 로 기록
} else {
  // 기존 학생 vocab_words 기반 출제 (변경 없음)
}
```

### 4.4 채점 / box 갱신 정책

수능 시험은 학원 공유 카탈로그라 **학생-소유 box를 갱신할 대상이 없다**. 두 옵션:

| 옵션 | 동작 |
|---|---|
| **A (권장)** | 정답: EXP/coin만 적립. 오답: `vocab_words`에 catalog_word를 box=1로 자동 흡수(중복 시 skip). 학생이 다음 일반 가챠/시험에서 자연스레 복습. |
| B | 카탈로그 전용 학생-단어-진척도 테이블 신설 (오버 엔지니어링) |

A안 채택. `vocab_print_jobs` 테이블에 `source` 컬럼만 추가:
```sql
ALTER TABLE vocab_print_jobs ADD COLUMN source TEXT DEFAULT 'mywords';
```

채점 핸들러는 source가 'csat'이면 box 갱신 단계를 건너뛰고, 대신 wrong_word_ids를 `vocab_words`로 흡수.

## 5. 프론트엔드 변경 — 정확한 diff

### 5.1 `index.html`
- **+ HTML**: §2 의 `<button id="btn-csat-exam">` 1개 + 시트 모달 div 1개 (~40줄)
- **+ CSS**: `.mywords-exam-btn--csat` + 시트 스타일 (~30줄)
- **+ JS**: 버튼 click → 시트 open / 시트 "시작" → `selfStartPrintJob({source:'csat', tier, size})` (~40줄)

### 5.2 `js/wawa-bridge.js`의 `selfStartPrintJob`
시그니처 확장:
```js
// before
export async function selfStartPrintJob(size = 10) { ... }

// after
export async function selfStartPrintJob(opts = 10) {
  const body = typeof opts === 'number'
    ? { size: opts }
    : { size: opts.size ?? 10, source: opts.source, tier: opts.tier };
  // POST 본문에 body 그대로 보냄 (서버는 추가 필드 무시 또는 §4.3 처리)
}
```
기존 호출(`selfStartPrintJob(10)`)은 그대로 동작.

## 6. 시드 빌드 (영-한 매핑 보강)

현재 추출본은 영단어 + 빈도뿐. `vocab_catalog_words.korean`은 NOT NULL이라 1,086개 모두 한국어 뜻이 있어야 한다.

1. `workers/scripts/build_csat_seed.py` — `pdftotext -layout` 결과를 좌/우 컬럼 좌표로 분리해 영-한 쌍 복원 (메가스터디 PDF는 폭 고정 표 → 안정적).
2. 빈도 순위 부여 → tier = `1 if rank≤300 else 2 if rank≤700 else 3`.
3. 출력: `workers/seeds/csat_vocab_v1.json`
4. 잔여 누락은 Gemini 일괄 번역 폴백.

산출 예:
```json
{ "english": "absolutely", "korean": "전적으로, 틀림없이", "rank": 1, "tier": 1, "pos": "adv" }
```

## 7. 작업 분해 / 시간

| # | 작업 | 변경 파일 | 분량 |
|---|---|---|---|
| 1 | PDF 재파싱 → seed JSON 1086개 | `workers/scripts/build_csat_seed.py` | 0.5d |
| 2 | 마이그레이션 + seed import | `migrations/051_vocab_catalog.sql`, `scripts/seed_csat_vocab.ts` | 0.3d |
| 3 | `vocab-play-handler.ts` self-start 분기 + `vocab_print_jobs.source` | `workers/src/routes/vocab-play-handler.ts`, `migrations/052_print_job_source.sql` | 0.5d |
| 4 | 버튼 + 시트 + JS 글루 | `apps/student/public/word-gacha/index.html` | 0.5d |
| 5 | wawa-bridge `selfStartPrintJob` 시그니처 확장 | `apps/student/public/word-gacha/js/wawa-bridge.js` | 0.1d |
| 6 | E2E: `csat-exam-button.spec.ts` (버튼 클릭 → 시트 → 시험 시작 → 1문항 풀이) | `apps/student/e2e/` | 0.4d |

총 ~2.3일. 이전 설계 대비 1일 단축(별도 화면/exam 모듈 없음).

## 8. 결정 필요 / 위험

1. **한국어 뜻 매핑** — PDF 재파싱(권장) 우선, 실패 시 Gemini 폴백.
2. **버튼 노출 조건** — 항상 노출 vs 학원 설정으로 토글. 일단 항상 노출, 나중에 `vocab_exam_policy` 같은 기존 정책 테이블에 플래그 추가 가능.
3. **결과 후 흡수 단어 알림** — 시험 결과 화면에서 "오답 N개를 단어장에 추가" 토스트 정도면 충분. 별도 UI 불필요.
4. **저작권** — 카탈로그 메타에 출처 명시(메가스터디 김동영 강사 무료 PDF 기반, 학원 학습용). 학생 페이지에는 한 번에 4단어(다지선다 보기)만 노출되므로 카탈로그 전체 덤프 노출 위험 낮음.

## 9. 다음 단계

이 설계가 OK면 `/sc:implement` 또는 직접 진행 → 작업 1번(PDF 재파싱)부터 시작.

---

## Appendix — 정확한 코드 변경 지점

| 파일 | 라인 | 변경 |
|---|---|---|
| `apps/student/public/word-gacha/index.html` | 2519~2555 (CSS) | `.mywords-exam-btn--csat` 추가 |
| 같은 파일 | 3310 직후 | `<button id="btn-csat-exam">` + 시트 div |
| 같은 파일 | 5311 직후 | `btn-csat-exam` 클릭 핸들러 + 시트 동작 |
| `apps/student/public/word-gacha/js/wawa-bridge.js` | `selfStartPrintJob` 함수 | opts 객체 받도록 확장 |
| `workers/src/routes/vocab-play-handler.ts` | self-start 핸들러 | source/tier 분기, catalog 쿼리 |
| `workers/migrations/` | 신규 | `051_vocab_catalog.sql`, `052_print_job_source.sql` |
| `workers/scripts/` | 신규 | `build_csat_seed.py`, `seed_csat_vocab.ts` |
| `workers/seeds/` | 신규 | `csat_vocab_v1.json` |
| `apps/student/e2e/` | 신규 | `csat-exam-button.spec.ts` |
