# 개념 가차 × 증명 컨텐츠 통합 설계

**Date**: 2026-04-15
**Scope**: concept_gacha 세션에 증명 3-Phase 학습을 실질적으로 엮는다.
**Refs**: `EducationCoreArchitecture/proof-workbook`, `engine/math_verify.py`, `workers/migrations/019,025`, `apps/student/src/pages/Proof*.tsx`

---

## 1. 문제 정의

현재 상태:
- ERP에 `proofs / proof_steps / proof_assignments / proof_results`(019) + `proof_phases / proof_phase_items / proof_phase_results`(025) 스키마 **이중 존재**.
- 학생 앱에 `ProofOrderingPage`(Phase1) + `ProofFillBlankPage`(Phase2) 만 있음. Phase3 없음.
- `proof-m{1,2,3}-demo` 3개 정적 데모에 80개 증명이 **인라인 JSON**으로 박혀 있음 — D1과 무관.
- `EducationCoreArchitecture/proof-workbook/proofs/middle/` 19개 챕터 폴더에 `.typ` + `content.json`(phase1/2/2.5/3/ksat) 형식 **표준 소스**가 있음.
- `engine/math_verify.py` 가 Phase3 자유서술 검증 가능 (L0~L5 파이프라인).

문제:
- **데이터 소스가 3벌(데모 JSON / 019 스키마 / 025 스키마) 분리.** 단일 진실원(SSoT) 없음.
- 가차 세션(`gacha_sessions`)에 `proofs_done` 카운터만 있고 **증명이 언제 어떻게 끼어들지 플로우가 없음**.
- Phase3 채점 루트 부재 — `math_verify` 와 워커 사이 연결선 없음.

---

## 2. 목표

1. `proof-workbook/content.json` → D1 임포트 파이프라인 1개로 통일. 데모 3개는 **뷰어**로 격하.
2. 가차 세션 내부에 카드 N장당 증명 1개 삽입하는 **인터리브 플로우** 정의.
3. Phase3 자유서술은 `math_verify` 서비스(외부 Python)로 비동기 검증 후 `proof_phase_results.verify_status` 갱신.

---

## 3. 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│  EducationCoreArchitecture/proof-workbook/proofs/**/*.json  │  (SSoT)
└──────────────────────────┬──────────────────────────────────┘
                           │ scripts/import_proofs.ts (신규)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  D1: proofs + proof_givens + proof_phases + proof_phase_items│ (025 스키마 활용, 019는 deprecated)
└──────────────────────────┬──────────────────────────────────┘
                           │
          ┌────────────────┴─────────────────┐
          ▼                                  ▼
┌──────────────────────┐          ┌──────────────────────────┐
│ Workers (Hono/itty)  │          │ math_verify RPC (Python)│
│  /proof/session/*    │─ async ─▶│  POST /verify/phase3    │
│  /proof/phase/:no    │◀─webhook─│                          │
└──────────┬───────────┘          └──────────────────────────┘
           ▼
┌──────────────────────────────┐
│ apps/student: GachaSession   │
│  ├ CardStep × N               │
│  ├ ProofPhase1 (ordering)     │
│  ├ ProofPhase2 (blanks)       │
│  └ ProofPhase3 (free-text)    │
└──────────────────────────────┘
```

---

## 4. 데이터 모델 결정

**019 의 `proof_steps` / `proof_results` 는 버린다** (deprecate, 신규 쓰기 중단).
**025 의 `proof_phases` / `proof_phase_items` / `proof_phase_results` 를 정본**으로 한다.

매핑:
| content.json 필드 | D1 위치 |
|---|---|
| `meta.title/subject` | `proofs.title / subject` |
| `definition + theorem` | `proof_givens` (kind='definition' / 'theorem') |
| `phase1.cards` | `proof_phases(phase_no=1)` + `proof_phase_items(item_key='card_{label}', order_idx=answer_order 인덱스)` |
| `phase2.steps[].text/blank_answers` | `proof_phases(phase_no=2)` + 항목당 `proof_phase_items(content=text, correct_answer=JSON배열, meta_json={blanks:N})` |
| `phase25` | (옵션) `phase_no=25` — 오류 찾기 모드. MVP 제외 |
| `phase3.problem/model_proof` | `proof_phases(phase_no=3, prompt, model_answer)` |
| `ksat` | 별도 `proof_ksat_items` 테이블 필요(현재 없음) — MVP 제외 |

**Phase2 choices 풀**: `content.json` 엔 없음 → 임포터가 `blank_answers` 전체를 모아 distractor 섞어 `meta_json.choices` 에 저장(또는 `proof_phases.meta_json`).

---

## 5. 가차 × 증명 인터리브 플로우

`gacha_sessions` 는 이미 `cards_target` / `proofs_target` 보유. 클라이언트에 **스케줄러** 추가:

```
session.start()
  target = { cards: 10, proofs: 2 }
  queue = interleave(draw_cards(10), pick_proofs(2))
         = [C,C,C,C,C,P1,C,C,C,P2,C,C]   // 카드 5장당 증명 1개
  for step in queue:
    if step.type == 'card': render <CardStep>
    if step.type == 'proof':
      render ProofPhase1 → Phase2 → Phase3
      submit phase_results
      if Phase3 verify_status=='pending': 낙관적으로 진행, 결과는 대시보드에서 반영
  session.complete()
```

- **증명 선택 규칙**: `proof_assignments` + SRS 박스(`proof_phase_results` 집계) 기반. 박스 낮은 것 우선, 동점이면 가장 오래된 것.
- **취소 시**: 현재 step 까지만 결과 저장, 세션은 `completed_at` 비워둠.

---

## 6. API 스펙 (신규/변경)

### 6.1 `GET /api/proof/session/:sessionId/next`
응답:
```json
{ "type": "card" | "proof" | "done",
  "card": { ... } | null,
  "proof": { "id", "phases": [ {phase_no, prompt, items:[...]}, ... ] } | null,
  "progress": { "cards_done": 4, "cards_target": 10, "proofs_done": 0, "proofs_target": 2 } }
```

### 6.2 `POST /api/proof/phase/:phaseId/submit`
요청:
```json
{ "session_id": "...", "submitted_json": { ... }, "time_spent": 120 }
```
응답:
- Phase1/2: 즉시 채점 → `{ score, issues, box_after }`
- Phase3: `{ verify_status: "pending", job_id }` — 백그라운드 큐에 작업 enqueue.

### 6.3 `POST /api/proof/verify-webhook` (math_verify → Worker)
`math_verify` 서비스가 채점 완료 후 호출. `proof_phase_results.verify_status / score / issues_json` 갱신.

---

## 7. math_verify 연동

Workers 환경에선 Python 실행 불가 → **분리 서비스**:
- 옵션 A: `math_verify` 를 FastAPI 로 감싸 별도 호스팅(VPS/Cloud Run). Worker 가 `fetch()` 로 호출.
- 옵션 B: Cloudflare Queue + Worker 에서 메시지 발행 → 외부 Python 워커가 pull → 결과 webhook.

**권장: 옵션 A (MVP)**. 큐 인프라 비용·복잡도 대비 이득 작음.

Phase3 요청 포맷:
```json
{ "proof_id": "...",
  "grade": "중3",
  "textbook": "15_중3_실수와근호",
  "theorem": "$\\sqrt{2}$는 무리수이다.",
  "model_answer": "...",
  "student_answer": "...",
  "mode": "proof" }
```

응답: `{ verdict: "correct"|"partial"|"incorrect", score: 0-100, issues: [{severity, message, step_idx}] }`.

---

## 8. 임포트 파이프라인

`workers/scripts/import_proofs.ts`:
```
1. glob proof-workbook/proofs/**/content.json
2. 각 파일에 대해:
   - proofs row upsert (id = slug(path))
   - proof_givens 재생성 (DELETE + INSERT)
   - proof_phases(1,2,3) 재생성
   - proof_phase_items 재생성
3. D1 원격 실행: wrangler d1 execute --file=out.sql
```

데모 3개(`proof-m{1,2,3}-demo`)는 content.json 미생성 상태 → **후속 작업**: 데모 인라인 JSON → content.json 변환 스크립트(별도 PR).

---

## 9. 마이그레이션/전환

1. `026_proof_phase_choices.sql`: `proof_phases.meta_json TEXT` 추가(choices 풀 저장용).
2. 019 의 `proof_steps / proof_results` 는 **읽기만** 유지, 신규 쓰기는 025 계열만.
3. `/api/proof/*` 기존 엔드포인트(019 기반) → `v1` deprecated, 새 엔드포인트는 `v2` 또는 그냥 동일 경로 신버전.
4. 학생 앱: `ProofOrderingPage` / `ProofFillBlankPage` 을 **세션 내 step** 으로 포함시키기 (독립 라우트 대신 `GachaSessionPage` 하위 컴포넌트로).

---

## 10. MVP 범위 (추천)

포함:
- 025 스키마 기반 임포터 1개 (중3 19-챕터 먼저)
- 가차 세션 인터리브 (하드코딩 5:1)
- Phase1/2 즉시 채점 + Phase3 비동기(math_verify 옵션 A)
- 019 스키마 deprecate 표시

제외(후속):
- Phase2.5(오류 찾기), ksat 문제
- SRS 기반 증명 선택 (MVP 는 random + unassigned 우선)
- 데모→content.json 역변환

---

## 11. 위험 & 트레이드오프

| 항목 | 위험 | 대응 |
|---|---|---|
| 019↔025 이중 스키마 | 코드 분기로 복잡도 ↑ | 019 쓰기 즉시 중단, read-only 유지 |
| math_verify 외부 서비스 | 가용성·레이턴시 | 타임아웃 5s, 실패 시 `verify_status='manual_review'` 로 교사 수동 채점 폴백 |
| content.json 품질 편차 | 일부 챕터 미완성 | 임포터에 schema validator(ajv), 실패 파일 skip + 로그 |
| 세션 중 Phase3 대기 | UX 흐름 끊김 | 낙관적 UI — "제출 완료, 결과는 곧 도착" 배지, 대시보드에서 확인 |

---

## 12. 다음 단계

1. 이 설계 승인 → `026_proof_phase_choices.sql` 작성
2. `workers/scripts/import_proofs.ts` 스켈레톤
3. 중3 19챕터 중 1챕터(예: `15_중3_실수와근호`) 샘플 임포트 & E2E 검증
4. `math_verify` FastAPI 래퍼 POC

`/sc:implement` 로 넘어갈 준비 완료.
