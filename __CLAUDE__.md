# CLAUDE.md — AI 협업 및 작업 가이드

이 문서는 AI(Claude)가 코드를 작성할 때 지켜야 할 **행동 지침**과 WAWA Smart ERP 프로젝트의 **기술적 제약 사항**을 정의합니다.

---

## Ⅰ. Behavioral Guidelines (행동 지침)
*Andrej Karpathy의 코딩 가이드라인을 바탕으로 하며, 속도보다 정확성과 단순성을 우선합니다.*

### 1. 구현 전 사고 (Think Before Coding)
- **가정하지 마십시오.** 불확실한 점이 있다면 먼저 질문하십시오.
- **혼동을 숨기지 마십시오.** 여러 해석이 가능할 경우 마음대로 선택하지 말고 옵션을 제시하십시오.
- **더 단순한 방법이 있다면 제안하십시오.** 불필요하게 복잡한 설계에는 이의를 제기하십시오.

### 2. 단순함 우선 (Simplicity First)
- **요청받지 않은 기능은 추가하지 마십시오.** (No speculative features)
- **일회성 코드에 추상화를 도입하지 마십시오.**
- **불필요한 설정이나 유연성을 부여하지 마십시오.**
- **200줄의 코드가 50줄로 줄어들 수 있다면 다시 작성하십시오.**

### 3. 외과적 수정 (Surgical Changes)
- **필요한 곳만 수정하십시오.** 자신의 작업이 아닌 주변 코드, 주석, 포맷을 "개선"하려 하지 마십시오.
- **기존 스타일을 존중하십시오.** 본인의 선호보다 프로젝트의 기존 컨벤션을 우선합니다.
- **사용되지 않게 된 코드만 제거하십시오.** 본인의 수정으로 인해 고아가 된 import/변수/함수만 정리합니다. 기존의 데드 코드는 언급만 하고 직접 삭제하지 마십시오.

### 4. 목표 중심 실행 (Goal-Driven Execution)
- **성공 기준을 정의하십시오.** "그냥 작동하게 하기"가 아닌 구체적인 검증 지표를 세웁니다.
- **수정 → 검증 루프를 돌리십시오.** 버그 수정 시 재현 테스트를 먼저 작성하고, 이를 통과시키십시오.
- **다단계 작업 시 계획을 먼저 공유하십시오.** (Step-by-Step plan)

---

## Ⅱ. Project Technical Guidelines (WAWA Smart ERP)
*2026-04 보안 라운드 1~24의 회귀 방지를 위한 강제 사항입니다.*

### 1. multi-tenant academy 격리 (필수)
모든 SELECT/UPDATE/DELETE는 `academy_id` 격리 필수.
```ts
// 좋은 예: academy_id 필터 포함
'SELECT * FROM gacha_cards WHERE id = ? AND academy_id = ?'
```

### 2. 입력 위생화 (`utils/sanitize.ts` 사용)
모든 텍스트 입력은 DB/KV 저장 전 위생화 + 길이 캡. `sanitizeText`, `sanitizeNullable`, `sanitizeRequired`를 사용하십시오.

### 3. ID 형식 검증
URL 파라미터나 body의 ID는 `isValidId`로 반드시 검증하십시오.

### 4. SQL 파라미터 바인딩
문자열 보간(`...WHERE id = '${id}'`)은 절대 금지입니다. 항상 `?` 바인딩을 사용하십시오.

### 5. 멱등성 및 원자성 가드
상태 전이 시 `WHERE status NOT IN (...)` 가드를 사용하고, 다중 작업은 `db.batch()`로 묶으십시오.

### 6. N+1 쿼리 방지
반복문 내부의 DB 호출은 `db.batch()` 또는 `IN (...)` 쿼리로 변환하십시오.

### 7. 보안 통신 (R2/PIN/Shared Tokens)
- **R2**: 위험 MIME 타입 차단, academy_id를 포함한 경로 지정.
- **PIN**: 반드시 `utils/crypto.ts`의 `hashPin`/`verifyPin`을 사용하십시오.
- **Shared Tokens**: HMAC 서명 검증 및 만료 확인 필수.

### 8. 백업 정책
DB 스키마 변경 시 마이그레이션 전후로 반드시 `wrangler d1 export`를 수행하십시오.

---

## 작업 전 체크리스트
- [ ] 본인의 코드가 요청 사항에만 직접적으로 연결되어 있는가? (외과적 수정)
- [ ] `academy_id` 격리가 누락되지 않았는가?
- [ ] 입력값에 대해 `sanitize` 및 `isValidId` 검증을 수행했는가?
- [ ] 복잡한 로직을 더 단순화할 수 있는가?
