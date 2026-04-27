# 도감(Dex) — 데이터 연동 분석

- 작성일: 2026-04-27
- 범위: `apps/student/public/word-gacha/` 도감 화면 + 백엔드 vocab API 연동
- 결론: **부분 연동**. 서버 단어 본체는 연동되지만, 시드 더미가 섞이고 갱신/seen 동기화에 구멍이 있다.

## TL;DR

| 항목 | 상태 |
|---|---|
| 학생 단어장(`vocab_words`) → 도감 | ✅ 연동 (boot 시 1회 fetch) |
| `box`(마스터) 표시 | ✅ 서버 값 사용 |
| **시드 12개 더미 단어 (identity, friendship 등)** | ❌ **항상 도감에 섞여 표시됨 — 핵심 문제** |
| 시험 중간/직후 도감 즉시 갱신 | ❌ 다음 부팅 전엔 stale |
| `seen`(흐릿하게 본 적 있음) 상태 | ⚠️ 신규 시험(print-take, csat) 흐름에서 갱신 안 됨 |
| `js/dex.js` 모듈 | ❌ Dead code — 정의만 있고 어디서도 import 안 함 |
| 카탈로그(수능) 단어 품사 | ⚠️ 휴리스틱 추론(`infer_pos`) — 잡음 |

## 데이터 흐름 추적

### 부팅 시퀀스 (`index.html:4076~4115`)

```
hydrateFromServer()        ← GET /api/play/vocab/state  (profile/quizHistory/badges/seen/creature 블롭)
  → localStorage 주입

seed(store)                ← state.js:73, SEED_WORDS 12개를 KEYS.words 가 비어있을 때 주입

loadServerWords().then    ← GET /api/play/vocab/words  (학생 vocab_words 행)
  const merged = [...serverWords];
  for (const w of local) {                              ← 시드 12개가 local 에 있음
    if (!merged.some(s => s.word === w.word)) merged.push(w);
  }
  rawStore.set(KEYS.words, merged);                     ← 시드가 그대로 살아남음 ❌
```

### 도감 렌더링 (`index.html:4385~4410`)

```js
function renderDexCounts() {
  const words = store.get(KEYS.words) ?? [];      // ← 시드 12개 + 서버 단어 혼합
  for (const t of types) {
    const list = words.filter(w => (w.pos || 'noun') === t);
    const mastered = list.filter(w => (w.box ?? 1) >= 5).length;
    ...
  }
}
```

### 도감 드릴다운 (`index.html:4477~4520`)

```js
window.openDexType = function(pos) {
  const words = (store.get(KEYS.words) ?? []).filter(w => (w.pos||'noun')===pos);
  const seenIds = new Set(store.get(KEYS.seen) ?? []);
  // unlockState: box>=5 → unlocked, seenIds.has → seen, else locked
}
```

## 발견된 문제 (심각도 순)

### 🔴 P0 — 시드 더미 단어가 항상 도감에 섞임
**증상**: 신규 학생도, 단어 200개 가진 학생도 도감에 항상 `identity / friendship / nature / culture / explore / achieve / brave / gentle / quickly / between / although / technology` 12개가 추가로 보인다.

**원인**: `state.js:73` `seed(store)`가 `loadServerWords()`보다 먼저 실행되고, merge 로직(`index.html:4108~4112`)이 "서버에 없는 단어는 살린다" 정책이라 시드가 영구 잔존.

**영향**: 도감 정확도 심각하게 훼손. "외운 단어 5/N" 표시가 시드 포함 합계라 비율 왜곡. 학생이 절대 안 외운 12개 단어가 도감에 항상 떠 있음.

**해결**:
- 옵션 A (간단): `state.js`의 `SEED_WORDS = []` 비우기 + `seed()` 의 words 주입 제거
- 옵션 B (안전): 시드 단어에 `_seed: true` 플래그 → boot 후 `loadServerWords()` 응답 받았으면 시드 제거 (`words = words.filter(w => !w._seed)`)
- 옵션 C: 시드는 `id`가 `w001`~`w012` 패턴(이미 `SEED_ID` 정규식 정의됨!) → 서버 hydrate 성공 후 일괄 삭제

### 🔴 P0 — 시험 종료 후 도감 즉시 갱신 안 됨
**증상**: 학생이 시험을 통과해 단어 box가 1→5(마스터)로 올라가도, 도감 화면을 다시 와도 카운트 그대로. 새로고침해야 반영.

**원인**: `loadServerWords()`는 부팅 시 단 한 번만 호출. print-take/csat 시험(`vocab-play-handler`)은 서버에서 box를 갱신하지만, 클라가 그걸 다시 끌어오지 않음. quiz.js의 인라인 퀴즈는 클라사이드에서 box를 mutate하지만, print-take는 서버 채점이라 클라 store는 stale.

**영향**: 학생이 시험 보고 도감 와서 "왜 그대로지?" 의문. 다음날 들어와야 반영됨.

**해결**:
- 시험 결과 화면(`renderPrintTakeResult`) 닫을 때 `loadServerWords()` 재호출 → store 갱신 → `renderDexCounts()` 재실행
- 또는 도감 화면 진입 시(`goto('dex')`) 강제 `loadServerWords()` 한 번 더

### 🟠 P1 — `seen` 상태가 신규 시험 흐름에서 누락
**증상**: 카탈로그 수능 단어를 시험에서 마주쳤지만 box 5 미만이면 도감에서 영원히 "잠김"으로만 보임. quiz.js의 `finishQuiz`는 `seen` 셋에 wordId를 추가하지만(`index.html:5137`), print-take/csat 서버 채점 흐름은 quiz.js를 거치지 않으므로 `seen` 영영 안 채워짐.

**영향**: 새 시험 시스템 도입 후 도감의 "흐릿한 카드" 단계가 무의미해짐. 카드는 `unlocked`(box≥5) 아니면 `locked` 둘 중 하나만.

**해결**: 시험 결과 페이지에서 출제된 wordId 들을 `KEYS.seen`에 일괄 추가:
```js
const seen = new Set(store.get(KEYS.seen) ?? []);
for (const q of printState.questions) seen.add(q.wordId);
store.set(KEYS.seen, [...seen]);
```

### 🟡 P2 — `js/dex.js` 모듈 전체가 Dead code
파일 정의된 export: `DEX_UNLOCK_BOX`, `syncSeen`, `isUnlocked`, `collectionRate`, `countByType`, `filterDex`.
`grep`으로 확인 — index.html / 다른 .js 어디서도 import 하지 않음. `renderDexCounts`/`openDexType`이 같은 로직을 인라인으로 재구현.

**영향**: 유지보수 위험. 나중에 dex.js 수정해도 효과 없음.

**해결**: 두 가지 중 하나
- (a) dex.js 의 함수들을 실제로 import해서 인라인 로직 대체 (테스트 용이성↑)
- (b) dex.js 파일 삭제

### 🟡 P2 — 카탈로그(수능) 단어 품사 분류 부정확
`build_csat_seed.py:infer_pos`는 한국어 뜻 prefix(`v./n./a./adv.`)와 어미(`하다/되다/적인`) 휴리스틱. 시드 635개 분포: `noun:413, verb:148, adj:62, adv:12` — 명사 비율이 65%로 비정상적으로 높음. PDF에서 prefix가 누락된 행이 모두 noun으로 떨어진 결과.

**영향**: 도감 품사별 카운트 균형이 깨짐. NOUN 카드만 잔뜩, ADV/PREP/CONJ는 거의 비어있음.

**해결**:
- (a) 시드 빌더에서 영단어 자체로 품사 추론 (예: `-ly` 어미 → adv, `-tion/-ness` → noun, common verb list 참조)
- (b) 카탈로그 import 후 SQL UPDATE로 누락된 품사 보강

### 🟢 P3 — 도감 메타 부족 (만난 날짜, 시험 본 횟수, 정답률)
서버 `vocab_words`에는 `review_count`, `wrong_count`, `last_quizzed_at`, `created_at`이 있지만, `toClient` 매퍼(`wawa-bridge.js:95`)가 `wrongCount`와 `addedAt`만 매핑. 도감 카드 상세에서 풍부한 통계를 못 보여줌.

**해결**: `toClient`에 `reviewCount`, `lastQuizzedAt` 추가 + `openCardDetail`에서 표시.

## 권장 수정 우선순위

```
1. [P0] state.js의 SEED_WORDS 비우기 또는 hydrate 후 정리   (시드 더미 제거)
2. [P0] 시험 결과 후 loadServerWords() 재호출               (실시간 갱신)
3. [P1] print-take/csat 결과 → seen 추가                     (도감 흐릿 단계 부활)
4. [P2] dex.js dead code 정리 (삭제 또는 사용)
5. [P2] 카탈로그 품사 재분류 (SQL UPDATE 또는 빌더 개선)
6. [P3] 도감 카드 상세에 reviewCount/lastQuizzedAt 노출
```

P0 두 개만 고쳐도 사용자가 느끼는 "도감이 실제 데이터랑 안 맞아 보인다"는 인상은 대부분 해결.

## 영향받는 파일

| 파일 | 변경 |
|---|---|
| `apps/student/public/word-gacha/js/state.js` | SEED_WORDS 비우기 또는 _seed 플래그 |
| `apps/student/public/word-gacha/index.html` | hydrate 후 시드 정리, 시험 후 reload, seen 추가 |
| `apps/student/public/word-gacha/js/wawa-bridge.js` | toClient에 review_count/last_quizzed_at 추가 (P3) |
| `apps/student/public/word-gacha/js/dex.js` | 삭제 또는 import 연결 (P2) |
| `workers/scripts/build_csat_seed.py` 또는 SQL 패치 | 품사 재분류 (P2) |

## 다음 단계

OK면 `/sc:improve` 또는 직접 수정 시작 — P0 두 항목부터.
