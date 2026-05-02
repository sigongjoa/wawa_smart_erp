---
name: word-gacha 보건고 의학용어 진입 버튼 설계
type: component design
target: 장혜연(student-tx3blu2og), 장혜정(student-3mzmc3kin) — class-rossfz6wm 소속 보건고 학생
status: proposal · 데이터 도착 전 사전 설계
date: 2026-04-27
---

# 1. 목적과 범위

**목적**: word-gacha 미니앱에서 보건고 학생 전용 **의학용어 카탈로그 진입점**을 만들어, 기존 수능 영단어 시험 흐름과 충돌 없이 의학용어 학습/시험을 분리 제공.

**대상**: 현재는 장혜연·장혜정 두 명. 이후 동일 보건고 학생군 확장 가능 구조.

**범위 (1차)**:
- 진입 버튼 (UI)
- 시트(옵션 선택) → 카탈로그 시드 → 시험 시작
- 학생 가시성 게이팅 (보건고 학생에게만 노출)

**범위 외 (2차/별도 문서)**:
- 의학용어 데이터 임포트 파이프라인 (실데이터 도착 후 결정)
- 어원 분해/접사 학습 UI (데이터 형태 확정 후)

# 2. 현행 구조 (재사용 자산)

word-gacha는 단일 `index.html` (5,914줄) + `js/*.js` 정적 미니앱이며 백엔드는 `workers/src/routes/vocab-play-handler.ts`.

**현재 "내 단어장" 액션 영역** (`#pane-learn-mywords` 내부):
```
.mywords-actions
├── #btn-self-exam        — 내 단어 시험 (📝)
├── #btn-csat-exam        — 수능 영단어 시험 (🎯)  ← 이 옆에 새 버튼 추가
└── #btn-add-word-inline  — 단어 추가 (＋)
```

**현재 csat 흐름**:
1. `#btn-csat-exam` 클릭 → `#csat-sheet` 오픈
2. tier(1/2/3/0) + size(10/20/30) 선택
3. `selfStartPrintJob({ source: 'csat', tier, maxWords })` 호출
4. 백엔드 `ensureCsatWordsForStudent(db, auth, catalogId, tier)` →
   `vocab_catalog_words` 에서 `vocab_words` 로 시드 → 시험지 생성

**핵심 재사용 포인트**: `vocab-play-handler.ts:415-416` 에서 `parsed.source === 'csat'` 분기 + `catalog_id` 파라미터가 이미 존재. **카탈로그 ID만 다르게 넘기면 동일 흐름 그대로 재사용 가능**.

# 3. 설계 결정

## 3.1 진입점: "별도 버튼" 방식 채택

**옵션 비교**:

| 방식 | 장점 | 단점 |
|------|------|------|
| A. csat 시트 내부에 카탈로그 토글 추가 | 코드 변경 최소 | 보건고생에게 수능 단어가 보이는 게 부적절 / 시트 복잡도 증가 |
| **B. 별도 버튼 `#btn-medical-exam`** ⭐ | 학생군 분리 명확 / 시각적으로 즉시 구분 | 시트 중복 (그래도 약 30줄) |
| C. `learn` 탭에 새 서브탭 추가 | 카테고리로 격상 | 작업량 큼 / 단어 추가 흐름과 분리 필요 |

→ **B 채택**. 데이터 분량/학습 빈도가 늘어나면 차후 C로 격상.

## 3.2 카탈로그 식별자

```
catalog_id: 'medical-health-vocational-2026'
title:      '보건계열 의학용어 (보건고)'
source:     '<데이터 도착 시 확정>'
tier:       1=핵심, 2=빈출, 3=확장   (csat 동일 스킴 재사용)
```

기존 `vocab_catalogs` 스키마(`051_vocab_catalog.sql`)를 **그대로 사용**. 데이터 형태가 어원 분해를 요구하면 그때 `vocab_catalog_words` 에 옵션 컬럼(`prefix`, `root`, `suffix`) 추가하는 별도 마이그레이션.

## 3.3 가시성 게이팅: 학생 단위 카탈로그 배정

**문제**: 모든 학생에게 의학용어 버튼이 보이면 안 됨.

**해법 — 신규 매핑 테이블 도입**:

```sql
-- 차기 마이그레이션 052_student_vocab_catalogs.sql (예시)
CREATE TABLE IF NOT EXISTS student_vocab_catalogs (
  student_id  TEXT NOT NULL,
  catalog_id  TEXT NOT NULL,
  assigned_at DATETIME DEFAULT (datetime('now')),
  PRIMARY KEY (student_id, catalog_id),
  FOREIGN KEY (catalog_id) REFERENCES vocab_catalogs(id) ON DELETE CASCADE
);
```

수능 카탈로그(`csat-megastudy-2025`)는 **레거시 기본** — 매핑 없으면 모두에게 노출 (기존 동작 유지).
신규 카탈로그(`medical-...`)는 **명시 배정 필요** — 매핑된 학생에게만 노출.

**API**:
```
GET  /api/vocab/my-catalogs
     → [{ id, title, tier_count, is_default }]
       - 본인에게 보여야 할 카탈로그 목록
       - csat 기본 카탈로그는 항상 포함, 추가 카탈로그는 매핑 기반

POST /api/vocab/self-start  (기존, body 변경 없음)
     body: { source: 'csat', catalog_id: 'medical-...', tier, max_words }
     → catalog_id 만 바꿔서 호출
```

**초기 시드** (장혜연·장혜정):
```sql
INSERT INTO student_vocab_catalogs VALUES
  ('student-tx3blu2og', 'medical-health-vocational-2026', datetime('now')),
  ('student-3mzmc3kin', 'medical-health-vocational-2026', datetime('now'));
```

# 4. UI 명세

## 4.1 버튼 (HTML)

`apps/student/public/word-gacha/index.html` 의 `.mywords-actions` 블록에 추가:

```html
<button type="button"
        class="mywords-exam-btn mywords-exam-btn--medical"
        id="btn-medical-exam"
        hidden>
  <span aria-hidden="true">🩺</span>
  <span class="lbl">의학용어 시험치기</span>
  <span class="sub">보건계열 핵심 용어 · 등급 선택</span>
</button>
```

> `hidden` 기본값 → JS에서 `GET /api/vocab/my-catalogs` 응답에 의학용어가 포함될 때만 `hidden` 제거.

## 4.2 색/아이콘 차별화

기존 csat 버튼은 액센트 컬러 사용 (`--mywords-exam-btn--csat`). 의학용어 버튼은:
- 아이콘: 🩺 (청진기) — 의료 컨텍스트 즉시 인지
- 색: `--med-accent` 신규 토큰 — 차분한 청록 (#0E8C8C 계열) 권장. csat의 빨강/주황 계열과 충돌 없음.
- 라벨: "의학용어 시험치기" / 서브 "보건계열 핵심 용어 · 등급 선택"

```css
.mywords-exam-btn--medical {
  background: #0E8C8C;      /* 임시 토큰, design system 정합 시 교체 */
  color: #fff;
}
.mywords-exam-btn--medical:active {
  transform: translate(1px, 1px);
}
```

## 4.3 시트 (HTML)

csat-sheet 직후에 동일 구조의 medical-sheet 추가. 기존 셀렉터 충돌 방지를 위해 클래스 prefix `med-`:

```html
<div class="med-sheet-backdrop" id="med-sheet" aria-hidden="true"
     role="dialog" aria-labelledby="med-sheet-title">
  <div class="med-sheet">
    <h3 id="med-sheet-title">🩺 의학용어 시험</h3>
    <p class="med-sub">보건계열 핵심 용어 · 등급 선택</p>

    <div class="med-group">
      <span class="med-label">난이도</span>
      <button class="med-tier-btn" data-tier="1" aria-pressed="true">1등급 (핵심)</button>
      <button class="med-tier-btn" data-tier="2" aria-pressed="false">2등급 (빈출)</button>
      <button class="med-tier-btn" data-tier="3" aria-pressed="false">3등급 (확장)</button>
      <button class="med-tier-btn" data-tier="0" aria-pressed="false">전체 무작위</button>
    </div>

    <div class="med-group">
      <span class="med-label">문항수</span>
      <button class="med-size-btn" data-size="10" aria-pressed="true">10문제</button>
      <button class="med-size-btn" data-size="20" aria-pressed="false">20문제</button>
      <button class="med-size-btn" data-size="30" aria-pressed="false">30문제</button>
    </div>

    <p class="med-meta">시험 단어는 자동으로 내 단어장에 추가됩니다.</p>

    <div class="med-actions">
      <button class="med-cancel" id="med-cancel">취소</button>
      <button class="med-go" id="med-go">시험 시작 →</button>
    </div>
  </div>
</div>
```

**스타일**: `csat-*` 의 모든 CSS 규칙을 `med-*` 으로 1:1 복제. 향후 공통화는 별도 리팩토링 PR.

## 4.4 인터랙션 (JS)

기존 `setupCsatExam()` (index.html:5458) 패턴 그대로 복제 → `setupMedicalExam()`:

```js
(function setupMedicalExam() {
  const btn = document.getElementById('btn-medical-exam');
  const sheet = document.getElementById('med-sheet');
  // ... csat 동일 ...
  go.addEventListener('click', async () => {
    const tier = ...;
    const size = ...;
    const res = await selfStartPrintJob({
      source: 'csat',                                // 백엔드 분기 동일 (catalog 시드 흐름 재사용)
      catalog_id: 'medical-health-vocational-2026',
      tier,
      maxWords: size,
    });
    // ... csat 동일 핸들링 ...
  });
})();
```

> 백엔드 분기 이름이 `csat` 인 게 의미상 어색하지만, 1차 범위에서는 의미를 일반화하는 리네이밍은 보류 (블래스트 라디우스 큼). 차기 PR에서 `source: 'catalog'` 로 일반화 권장.

## 4.5 가시성 토글 (JS)

`learn` 탭 진입 시 또는 앱 부팅 시:

```js
async function applyCatalogVisibility() {
  try {
    const list = await api.get('/vocab/my-catalogs');
    const hasMedical = list.some(c => c.id.startsWith('medical-'));
    document.getElementById('btn-medical-exam').hidden = !hasMedical;
  } catch { /* 실패 시 hidden 유지 */ }
}
```

# 5. 백엔드 변경

## 5.1 신규 엔드포인트

```ts
// workers/src/routes/vocab-handler.ts
GET /api/vocab/my-catalogs
  Auth: 학생 토큰
  반환: [{ id, title, word_count, is_default: boolean }]
  로직:
    1) 항상 csat-megastudy-2025 (is_default=true) 포함
    2) student_vocab_catalogs 에서 student_id 매핑된 카탈로그 추가
```

## 5.2 기존 엔드포인트 (변경 없음)

`POST /api/vocab/self-start` — `catalog_id` 파라미터 이미 수용. 다만 **권한 체크 강화 필요**:

```ts
// vocab-play-handler.ts ensureCsatWordsForStudent 진입 전:
if (catalogId !== 'csat-megastudy-2025') {
  const allowed = await db.prepare(
    `SELECT 1 FROM student_vocab_catalogs WHERE student_id=? AND catalog_id=?`
  ).bind(auth.studentId, catalogId).first();
  if (!allowed) return c.json({ error: '카탈로그 접근 권한 없음' }, 403);
}
```

## 5.3 마이그레이션 순서

1. `052_student_vocab_catalogs.sql` — 매핑 테이블 + 인덱스
2. `053_medical_catalog_seed.sql` — `vocab_catalogs` 행 추가 (단어는 비움)
3. `054_medical_assign_health_students.sql` — 장혜연·장혜정 매핑 시드
4. **(데이터 도착 후 별도)** `055_medical_words_import.sql` — 실제 단어 데이터

# 6. 데이터 모델 (요약 ERD)

```
vocab_catalogs (기존)
  ├─ csat-megastudy-2025          ← 레거시 기본
  └─ medical-health-vocational-2026 (신규)

vocab_catalog_words (기존, 그대로)
  └─ catalog_id FK

student_vocab_catalogs (신규)
  ├─ student_id (FK students.id)
  └─ catalog_id (FK vocab_catalogs.id)

vocab_words (기존)
  └─ origin_catalog_word_id 로 추적 (변경 없음)
```

# 7. 작업 분할 (구현 시)

| # | 작업 | 위치 | 예상 LOC |
|---|------|------|---------:|
| 1 | 매핑 테이블 마이그레이션 | `workers/migrations/052_*.sql` | ~20 |
| 2 | 카탈로그 시드 (단어 비움) | `053_*.sql` + `054_*.sql` | ~10 |
| 3 | `GET /vocab/my-catalogs` | `vocab-handler.ts` | ~30 |
| 4 | 권한 체크 추가 | `vocab-play-handler.ts` | ~10 |
| 5 | 버튼 HTML | `index.html` `.mywords-actions` | ~6 |
| 6 | 시트 HTML/CSS | `index.html` | ~80 |
| 7 | `setupMedicalExam()` JS | `index.html` 스크립트 영역 | ~50 |
| 8 | 가시성 토글 JS | `index.html` (부팅/탭 진입) | ~15 |
| 9 | E2E live 테스트 | `apps/student/e2e/` | ~80 |

총 ~300 LOC. 데이터 임포트(055)는 별도.

# 8. 검증 계획

- **유닛**: `my-catalogs` 가 비매핑 학생에게 의학용어를 반환하지 않는지
- **권한**: 비매핑 학생이 `self-start` 에 `catalog_id=medical-...` 강제 전달 시 403
- **E2E (Playwright live)**:
  - 장혜정 로그인 → learn 탭 → 의학용어 버튼 visible
  - 일반 학생 로그인 → 버튼 hidden
  - 시트 → tier 선택 → 시험 시작 → 첫 문항 렌더
- **수동**: csat 시험 흐름이 회귀 없이 동작하는지 (동일 학생군 노출)

# 9. 미결 / 데이터 도착 후 결정

- **어원 분해 학습 UI**: 데이터에 prefix/root/suffix 컬럼이 있을 경우 카드 뒷면 토글로 노출 — 이는 별도 설계.
- **카드 자산**: 기존 word-gacha는 카드 이미지(가챠)와 단어를 1:1 연결. 의학용어용 카드 자산이 없으면 **임시로 텍스트 카드** 사용, 추후 일러스트 발주.
- **시험 모드 변형**: 의학용어는 한↔영 매칭 외에 "정의→용어" 매칭이 더 자연스러울 수 있음. 데이터 형태 확정 후 결정.
- **반(class-rossfz6wm) 단위 배정 vs 학생 단위**: 1차는 학생 단위(2명)면 충분. 보건고생이 늘면 `class_vocab_catalogs` 추가 검토.

# 10. 결론

**구현 가능 여부: 가능**. 백엔드 분기/시드 흐름이 이미 csat 카탈로그용으로 잘 분리돼 있어, 신규 카탈로그 추가는 거의 데이터 + UI 이슈입니다. 핵심 신규 작업은:

1. 매핑 테이블(`student_vocab_catalogs`) — 가시성/권한 게이팅
2. 의학용어 전용 버튼 + 시트 — UI 분리
3. 카탈로그 목록 조회 API — 버튼 노출 결정

데이터 도착하면 `055_medical_words_import.sql` 만 추가하면 학습 가능. 데이터 분석 보내주시는 즉시 4단계(시드 SQL)부터 진행하겠습니다.
