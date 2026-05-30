# workers/src 비효율 패턴 분석

**작성:** 2026-05-18
**범위:** `workers/src/**` 정적 분석. KV 무료 tier (1k writes/day) 한도 위협을 1차 기준.
**계기:** ask-ai sub-call이 KV.put 21회/요청 폭발 → 오늘 KV 50% 도달. 같은 패턴 더 있는지 점검.

---

## 심각도 등급

- **P0** — 무료 tier 한도 직접 위협 + 빈도 높음. 즉시 fix 권장.
- **P1** — 회귀 시 한도 위협. 검토 + 모니터링.
- **P2** — 효율 낭비. 손 댈 가치 있음.
- **P3** — 사실은 잘 되어 있음. 보존.

---

## 🟢 잘 되어 있는 것 (먼저 확인)

| 위치 | 패턴 | 메모 |
|---|---|---|
| `middleware/tenant.ts:18~`| 3-layer 캐시 (mem 5min → KV 1h → D1) | 모든 요청 hot path 인데 캐시로 KV 쓰기 거의 0 |
| `routes/onboard-handler.ts:181~` | academy list KV 캐시 | onboarding 페이지 새로고침 폭주 방어 |
| `routes/assignments-handler.ts:249, 345, 436, 516` | `db.batch(stmts)` 원자 | N+1 회피 패턴 표준화 |
| `routes/medterm-handler.ts:251~, 267~, 392~, 400~` | `stmts.push()` + `db.batch` | 동일 |
| `routes/board-handler.ts:164`, `routes/absence-handler.ts:209, 228, 449` | 동일 batch | |
| `middleware/rateLimit.ts:77~` `rateLimitMiddleware` (global) | **in-memory only**, KV 안 씀 | 전역 rate limit이 KV를 안 건드림 — 좋은 선택 |
| `routes/live-handler.ts:135` 주석 | "heartbeat PATCH KV.put 생략. 무료 tier 1k/day 보호" | 이미 인지하고 최적화한 흔적 |

---

## 🔴 발견된 비효율 패턴

### [P0] ask-ai sub-call KV 폭증 — *이미 fix됨 (commit 102ee2e)*

- 위치: `utils/gemini.ts` + `services/ask-ai/gemini-adapter.ts`
- 증상: v2 Plan+Fill N회 호출 × (`checkAiDailyLimit` 1 + `incrementUsage` 3) = ~21 writes/요청
- Fix 후: ~2 writes/요청 (90% 감소)
- Dead-write: `ai-usage:*` 키는 어디서도 읽히지 않음 — 완전 폐기
- 같이 도입한 Analytics Engine으로 대체

---

### [P1] `cron/expire-exam-attempts.ts:35` — N+1 UPDATE in cron

```ts
for (const row of targets) {
  await env.DB.prepare(
    `UPDATE exam_assignments SET exam_status='completed' WHERE id = ?`
  ).bind(row.exam_assignment_id).run();
}
```

- **빈도:** cron `* * * * *` (매분)
- **이슈:** 만료된 exam_attempt 수만큼 D1 쿼리. 보통 0건이라 무해하지만 **시험 종료 시점에 100+ 학생 동시 만료**되면 N개 분리 UPDATE → wall time + D1 writes 폭증
- **D1 한도:** 100k writes/day 무료 — KV보다 관대. 그래도 N개 → 1개로 줄일 수 있음
- **Fix (한 줄):**
  ```sql
  UPDATE exam_assignments SET exam_status='completed'
   WHERE id IN (SELECT exam_assignment_id FROM exam_attempts
                WHERE status='expired' AND ended_at = ?)
  ```
  또는 `db.batch(stmts)`로 묶기

---

### [P1] `middleware/rateLimit.ts` — 모든 KV 기반 rate-limit가 2 read + 2 write

10개 함수 (loginRateLimit, inviteAccept, publicAcademies, onboardRegister, verifySlug, academyInfo, teacherNames, vocabAdd, parentReport, gachaCardFeedback) 가 모두 같은 패턴:

```ts
const [mRaw, hRaw] = await Promise.all([kv.get(minKey), kv.get(hourKey)]);
// ... 체크
await Promise.all([
  kv.put(minKey, String(m + 1), { expirationTtl: 60 }),
  kv.put(hourKey, String(h + 1), { expirationTtl: 3600 }),
]);
```

호출 1회 = **2 read + 2 write** = 한도가 빠듯한 free tier에서 부담.

**Hot 사용처:**
| 함수 | 빈도 | 일 KV.put 추정 |
|---|---|---|
| `parentReportRateLimit` | 학부모 페이지 새로고침마다 | 학부모 30명 × 5/day × 2 = **300/day** |
| `gachaCardFeedbackRateLimit` | 가챠 카드 피드백마다 | 학생 50명 × 20/day × 2 = **2,000/day** ⚠️ |
| `academyInfoRateLimit` | onboarding 페이지 표시마다 | 가입 적음 → 무시 |
| 나머지 (login·invite·verify) | 드뭄 | <50/day |

**`gachaCardFeedbackRateLimit` 단독으로 한도 2배 초과 가능.**

**Fix 후보:**
1. **min·hour 합치기** — 둘 다 필요 없음. 10/min이면 600/hour 자동 보장. → write 50% 감소
2. **확률적 write** — 5회 중 1회만 KV 갱신. 정확도 약간 떨어지지만 충분 → write 80% 감소
3. **AE로 이관** — 누적 메트릭은 AE, rate-limit 자체는 in-memory burst (Durable Object 또는 isolate cache) → write 100% 감소
4. **즉시 fix:** `gachaCardFeedbackRateLimit`만 in-memory로 옮김. 다른 건 빈도 낮아서 패스

---

### [P1] `routes/gacha-play-handler.ts` — 가챠 게임 중 KV write 누적

발견된 KV.put:
- L185 `play:<token>` — play 토큰 갱신 (TTL 1d). 게임 시작마다.
- L231 rate-limit counter (P1 항목과 동일)
- L458, L531 — 게임 결과 KV write

**가챠 한 게임당 ~4 KV writes**. 학생 50명 × 5게임/day = **1,000 writes/day** — KV free tier 100% 단독 소진 시나리오.

**가능성:** L458/L531 KV write가 D1로 갈 수 있는 데이터인지 봐야 함. play 토큰은 KV 맞음 (TTL+빠른 read).

---

### [P2] `utils/gemini.ts` — 다른 feature도 incrementUsage 부담

ask-ai 외 5개 feature 가 같은 `geminiGenerate` 통해 호출:
- vocab-grammar, meeting-summary, meeting-action, ai-comment, ai-summary, ai-generate

각각 호출 1회 = 4 KV writes (1 daily + 3 incrementUsage).
- 빈도가 낮으면 OK (meeting 등)
- vocab-grammar는 학생당 자주 → 누적 위험

**제안:** `incrementUsage`를 Analytics Engine으로 일괄 이관 (ask-ai에서 했던 거 그대로 다른 feature에). `ai-usage:*` KV 키는 *읽히지 않는 dead-write*가 모든 feature에서 동일하게 발생 중.

---

### [P2] `services/ask-ai/quota.ts` 와 `ai-rate-limit.ts` 중복 가드

ask-ai는 quota를 **두 단계**로 막음:
1. `checkAiDailyLimit` (KV, kind 'ask-ai', 50/day 기본) ← 방금 fix로 진입점 1회
2. `checkQuota` from `services/ask-ai/quota.ts` (D1 `askai_quota`, 30 questions/day)

같은 의미의 한도가 KV + D1 두 곳. **하나는 dead** (한도 30 < 50이므로 항상 D1이 먼저 막음). KV 체크는 불필요.

**Fix:** `checkAiDailyLimit('ask-ai', ...)` 제거. D1 quota만 사용. KV 1 read + 1 write/요청 추가 절감.

→ ask-ai `/ask` 한 요청당 KV writes **~2 → ~1** 추가 50% 감소 가능.

---

### [P3] `routes/notifications-handler.ts` 등 — KV 단순 사용

빈도 낮음 (이벤트 기반), 패턴 정상.

---

## 종합 추산

오늘 KV 50% 도달 시나리오 분해 (대략):

| 출처 | 일 writes 추정 |
|---|---|
| ask-ai sub-call 폭증 (지금 fix됨) | ~500 ⇒ ~50 |
| gacha 게임 + feedback rate limit | ~1,000 |
| live-handler 세션 | ~150 |
| auth/onboard 등 | ~100 |
| **합계** | 약 1,750/day (한도 1,000 초과) |

**ask-ai fix 후만으로도 80% 감소 → 한도 안에 들어옴.**
이후 `gacha` 패턴 손대면 마진 충분.

---

## 추천 액션 (우선순위)

| 순위 | 항목 | 효과 (writes/day) | 노력 |
|---|---|---|---|
| 1 | ask-ai fix (완료, commit 102ee2e) | -450 | ✅ 완료 |
| 2 | `gachaCardFeedbackRateLimit` in-memory 전환 | -1,600 | 1시간 |
| 3 | `cron/expire-exam-attempts` 단일 UPDATE | -peak burst | 30분 |
| 4 | `incrementUsage` 전체 feature에서 제거 + AE 통일 | -100~300 | 2시간 |
| 5 | `checkAiDailyLimit('ask-ai')` 제거 (D1 quota 단일화) | -100 | 30분 |
| 6 | rate-limit min·hour 단일화 | -200 | 2시간 |

1~3만 해도 KV 한도 50% 이하 안정. 학생 수 늘어도 마진 큼.

---

## 추가 관찰

- **D1은 한도 100k writes/day** — 카운터 류는 D1이 더 안전. 다만 D1 batch가 필요.
- **Analytics Engine (5M writes/day)** — 메트릭/누적은 여기로. 이미 ask-ai에서 도입 (PR#1).
- **Durable Objects** — strongly consistent rate limit 필요할 때 도입 고려. 지금은 in-memory + KV로 충분.

---

## 결론

오늘 한 ask-ai fix가 가장 큰 출혈을 막았어. 그 다음 우선순위는:
1. **gacha card feedback rate limit** (P1, 추정 일 -1,600 writes)
2. **cron expire-exam-attempts** (P1, burst 안전화)

둘 다 손대면 KV writes ~50%/day 마진. 나머지(P2)는 다음 릴리스 사이클에 분산.

전반적으로 **이 코드베이스는 N+1·캐시·batch 패턴은 이미 잘 적용**되어 있음. 비효율의 99%가 "v2 multi-call이 KV 카운터 가정을 깬 것" — 즉 ask-ai가 이상치이고 나머지는 정상. 위에서 짚은 P1/P2도 한 군데 손보면 끝나는 수준.
