# ask-ai LLM 시스템 Harness Engineering 리서치

**작성일:** 2026-05-18
**대상:** WAWA Smart ERP `workers/src/services/ask-ai/` 일대 (Plan + Fill orchestrator v2, Gemini 2.5 Flash, Cloudflare Workers + D1 + R2)
**계기:** D1~D5 (#140~#144) — 모두 prod 데이터/live e2e로 사후 발견. 즉, **사전 회귀 방지 시스템 부재**

---

## TL;DR

D1~D5 같은 회귀를 사전에 잡으려면 **3층 harness**가 필요해:

1. **CI gate (cassette + golden set)** — Gemini 호출 0건, deterministic. PR마다 실행.
2. **Daily scheduled live eval** — 소규모 prod 호출 (~10건). confidence 분포·needs_teacher 비율 회귀 alert.
3. **Production observability** — Cloudflare AI Gateway + Analytics Engine로 token/confidence/`needs_teacher` 실시간 dashboard.

핵심 기술 선택:
- **promptfoo** (CI YAML 평가) + **MSW**/**Polly.JS** (HTTP cassette) — TypeScript/Workers와 호환
- **Cloudflare AI Gateway** (drop-in proxy) — 이미 Workers 위에 있으니 비용/token 추적은 *공짜 + 코드 변경 거의 0*
- **Zod safeParse + NoObjectGeneratedError 패턴** (Vercel AI SDK 4.1) — partial result salvage
- **LLM-as-judge** — D3 confidence rubric을 자동 채점하는 2차 LLM

D1~D5는 **각각** 위 3층 어딘가에서 잡혔어야 함:
- D1 (500 회귀): CI gate의 cassette unit test
- D2 (unit_id 고정): static eval — request snapshot에서 hardcode 발견
- D3·D4 (confidence/needs_teacher): daily live eval distribution check
- D5 (token 0): observability — AI Gateway 대시보드에서 즉시 보임

---

## 1. 문제 회고 — 왜 D1~D5는 prod에서야 보였나

| ID | 발견 경로 | 사전 잡기 가능했던 가드 |
|---|---|---|
| D1 500 회귀 | manual playwright `MC-1` | **단위 cassette test** (짧은 질문 1개) |
| D2 unit_id 고정 | prod D1 분포 분석 (39건 동일) | **request snapshot test** (client→server payload) |
| D3 confidence high 일색 | prod D1 집계 | **distribution check** (KS test vs 기준) |
| D4 needs_teacher 0 | prod D1 집계 | **synthetic off-domain set** 평가 |
| D5 token 0 | prod D1 컬럼 검사 | **AI Gateway 대시보드** (즉시) |

공통: 현재 `orchestrate-v2.test.ts`는 happy-path mock 1~2개뿐. **회귀 신호를 자동으로 내는 시스템이 없음.**

---

## 2. 3층 Harness 아키텍처

```
                       PR 시점               매일 1회             상시
                       ─────────             ────────             ────
Layer                  CI Gate              Live Eval            Observability
─────                  ───────              ─────────            ──────────────
Gemini 호출              0회               ~10회 (synthetic)        실호출 전부
실행 시간               <30s                ~2분                   상시
Deterministic           Yes                 No                    No
잡는 회귀              schema·shape         distribution·quality  cost·latency·error
스토리지              git (cassette YAML)   D1 askai_eval         Analytics Engine + AI Gateway
```

### Layer 1 — CI Gate (PR마다)

**구성:**
- **MSW** 또는 **Polly.JS**로 Gemini API HTTP cassette 기록 ([Polly.JS](https://github.com/Netflix/pollyjs), [MSW Workers 가이드](https://developers.cloudflare.com/workers/testing/))
- 한 번 record (`E2E_LIVE=1 RECORD=1 vitest ...`) → YAML 저장 → 이후 replay (deterministic)
- promptfoo로 YAML 기반 assertion (schema 위반·키워드·길이·confidence 값) ([promptfoo docs](https://www.promptfoo.dev))

**Golden 케이스 — 진단 PDF의 5개 + 추가:**
```yaml
# tests/ask-ai/golden.yaml
cases:
  - name: short-basic
    message: "삼각형 세 각의 합이 왜 180도예요?"
    expect:
      - http_status: 200
      - response.steps.length >= 2
      - response.confidence in [high, medium]
  - name: off-topic-history
    message: "안중근 의사가 왜 이토 히로부미를 저격했어요?"
    expect:
      - response.confidence == low
      - response.needs_teacher == true
  - name: abstract-epsilon-delta
    message: "ε-δ 정의로 lim 증명해줘"
    expect:
      - response.references.length > 0  # grounding 필수
  - name: figure-quadratic
    message: "y=x²-2x+1 그래프 그려줘"
    expect:
      - response.steps[?(@.kind=='figure')].length >= 1
  - name: vague
    message: "음... 그거 뭐였더라"
    expect:
      - response.confidence == low
  - name: token-tracking
    message: "표본평균 분산이 σ²/n 인 이유"
    expect:
      - used_tokens > 100  # D5 회귀 가드
```

**왜 promptfoo 인가:**
> "If you are a solo developer testing prompts before committing code, Promptfoo's CLI and YAML configs are fast and free. You do not need a platform yet." ([Braintrust 비교](https://www.braintrust.dev/articles/best-promptfoo-alternatives-2026))

YAML 한 파일 + Node CLI + zero cloud dependency → Workers 모노레포에 자연스럽게 끼움.

**Sample size**: golden set만으로는 D3 같은 분포 회귀를 못 잡지만 *shape*(schema/status/필드 존재) 회귀는 잡음. D3 잡는 건 Layer 2.

### Layer 2 — Daily Live Eval (cron)

**구성:**
- Cloudflare Cron Trigger → eval Worker → synthetic 10건 호출 → `askai_eval` 테이블 적재
- 분포 metric 계산 + 어제와 비교 (Mann-Whitney 또는 단순 ratio)
- alert 조건: `low %`가 어제 대비 -10pp 이상 또는 절대값 0% 등

**리서치 가이드:** 80% 정상률·5% margin·95% 신뢰도면 ~246 샘플 필요 ([Wilson score](https://medium.com/@falvarezpinto/evaluation-first-ai-product-engineering-golden-sets-drift-monitoring-and-release-gates-for-llm-2c3bfb3f1e7b)). 매일 10건 × 30일 = 300건 → 한 달 단위로 비교 가능. 비용은 일일 $0.014 × Gemini 호출 수.

**LLM-as-judge로 confidence rubric 검증** ([Evidently 가이드](https://www.evidentlyai.com/llm-guide/llm-as-a-judge), [Langfuse](https://langfuse.com/docs/evaluation/evaluation-methods/llm-as-a-judge)):
```ts
// 1차 응답 → 2차 LLM이 채점
const judgePrompt = `
다음 학생 질문과 ask-ai 응답을 보고 평가:
- confidence가 적절한가? (질문이 도메인 외/모호하면 low여야)
- needs_teacher 결정이 합리적인가?
- grounding 활용 OK?

응답 JSON: { confidence_appropriate: bool, needs_teacher_appropriate: bool, reason: string }
`;
```
Langfuse 또는 Braintrust dataset에 매일 결과 적재 → 일주일 동향.

### Layer 3 — Production Observability

**최단 경로 (Cloudflare 친화):**
- **AI Gateway**를 Gemini 호출 앞에 끼우면 token/cost/latency 대시보드 *공짜* ([AI Gateway analytics](https://developers.cloudflare.com/ai-gateway/observability/analytics/)). 코드 변경은 baseURL 한 줄.
- **Analytics Engine**으로 custom metric (`confidence`, `needs_teacher`, `unit_id_unique_per_day`) 쏘기. 5M writes/day 무료.

**Helicone**도 대안 — Cloudflare Workers 위에 proxy 구조, 무료 tier 충분 ([Helicone Workers 아키텍처](https://docs.helicone.ai/references/availability)). Langfuse는 self-hosted 깊은 trace를 원할 때 ([Langfuse MIT](https://langfuse.com/)).

**Dashboard에 박을 핵심 차트:**
1. `confidence` 일별 분포 — D3 회귀 즉시 보임 (목표: low 10% / medium 30% / high 60%)
2. `needs_teacher = 1` 비율 — D4 회귀 (목표 ≥ 5%)
3. `used_tokens` 분포 — D5 회귀 (0 비율 ≤ 1%)
4. `unit_id` 일별 unique count — D2 회귀 (≥ 3종)
5. HTTP 5xx 비율 by 메시지 길이 — D1 같은 회귀 (짧은 질문 5xx 비율 별도 추적)

---

## 3. 구체 기술 선택지 비교

### 3.1 Eval framework (PR CI 용)

| 도구 | 언어 | 셋업 | Cloudflare/TS 친화 | D1~D5 적합도 |
|---|---|---|---|---|
| **promptfoo** | YAML + Node | `npx promptfoo init` | ⭐⭐⭐ (Node, zero infra) | shape/keyword/grader — D1·D2 |
| DeepEval | Python (pytest) | pip + pytest plugin | ⭐ (다른 런타임) | metric 풍부하지만 Python wall |
| **Braintrust** | TS/Python SaaS | API key + SDK | ⭐⭐ (SaaS 호스팅) | dataset+UI 강력. 비용 발생 |
| Inspect AI | Python | UK AISI 프레임워크 | ⭐ | red-team/safety 중심 |

**추천:** promptfoo (Layer 1) + Braintrust 또는 Langfuse 자체 호스팅 (Layer 2 데이터셋·UI).
> "you almost certainly need two tools. A lightweight framework for CI/CD gating ... paired with a platform for human annotation, regression tracking, and stakeholder dashboards" ([inference.net 비교](https://inference.net/content/llm-evaluation-tools-comparison/))

### 3.2 Cassette/replay (PR CI 용)

| 도구 | 환경 | 장점 | 단점 |
|---|---|---|---|
| **Polly.JS** | Node + 브라우저 framework-agnostic | API 깔끔, replay/record/passthrough mode | Maintenance 활발도 보통 |
| **MSW** | Node + Workers + 브라우저 | Workers 공식 지원 ([Cloudflare 가이드](https://developers.cloudflare.com/workers/testing/)), 한 번 정의 → 모든 환경 | record 모드는 별도 (`msw-fetch-mock`) |
| nock | Node only | 오래된 표준 | Node 18+ native fetch 미지원 |

**추천: MSW** — 이 프로젝트는 Workers라서 공식 지원 + e2e/test/unit 한 번 정의로 재사용. Record는 1회만 manual (real Gemini hit) → fixture json 커밋.

### 3.3 Orchestrator 견고화 (코드 패턴)

현재 `orchestrate-v2.ts:199~201`은 schema fail이면 throw → 500. 업계 표준 흐름:

```
Plan 호출 → safeParse 실패면 fallback plan
   ↓
Fill[i] 호출 → safeParse 실패면 explain step으로 강등 (Promise.allSettled)
   ↓
모든 step 실패면 needs_teacher=true + 안내 메시지 1개
   ↓
절대 throw하지 않음 — 응답은 항상 valid, log.error로만 알림
```

Vercel AI SDK 4.1 패턴 ([NoObjectGeneratedError](https://vercel.com/blog/ai-sdk-4-1)): raw model output 살리고 partial 복구. 이 프로젝트는 `callTool`이 직접 throw하니 동일 정신으로 wrapping.

**Instructor 라이브러리** ([Gemini 지원](https://techsy.io/en/blog/best-llm-structured-output-libraries))도 옵션이지만 v2 코드가 이미 manual하니 굳이 도입 안 해도 됨. 다만 *retry on validation fail* 로직은 차용 가치.

### 3.4 Distribution drift 모니터링

**기법:**
- 카테고리 분포 (`confidence` 3가지 값): Chi-square 또는 단순 비율 비교
- 연속 변수 (token, latency): Kolmogorov-Smirnov 또는 Mann-Whitney ([Stackpulsar](https://stackpulsar.com/blog/llm-model-drift-detection/))
- Alert 임계: "어제 대비 score drop > 3%" ([Medium gate gate](https://medium.com/@falvarezpinto/evaluation-first-ai-product-engineering-golden-sets-drift-monitoring-and-release-gates-for-llm-2c3bfb3f1e7b))

**구현 위치:** Cron Worker → `askai_conversations` 일별 집계 → 어제 row 비교 → Slack/email webhook. SQL 한 줄로 끝남:
```sql
SELECT confidence, COUNT(*) FROM askai_conversations
WHERE started_at > datetime('now', '-1 day')
GROUP BY confidence;
```

---

## 4. 실행 로드맵 (권장 도입 순서)

| 순서 | 항목 | 비용 | 잡히는 회귀 | 효과 시간 |
|---|---|---|---|---|
| 1 | **AI Gateway 끼우기** | $0 + baseURL 1줄 | D5 (즉시) + 모든 cost/latency 가시화 | 30분 |
| 2 | **MSW + fixture 1개 + cassette unit test** | 0 | D1 회귀 영구 가드 | 반나절 |
| 3 | **promptfoo 골든 6케이스** | 0 | D1·D2 shape 회귀 | 1일 |
| 4 | **D1 대시보드 쿼리 5개** (confidence·needs_teacher·token·unit·5xx) | 0 (Analytics Engine 무료 tier) | D2·D3·D4 운영 가시성 | 반나절 |
| 5 | **Cron Worker 일 1회 synthetic 10건 + 분포 alert** | $0.5/월 (Gemini) | D3·D4 drift 사후 24시간 내 | 1일 |
| 6 | **LLM-as-judge eval (선택)** | $5/월 | confidence rubric 정밀 채점 | 2일 |

총 1주 내 1~5 완료 가능. 6은 미루어도 됨.

---

## 5. 권고 (사람이 결정할 항목)

1. **Layer 1·2·3 모두 도입할지, Layer 1+3만 할지** — Layer 2 (cron eval)은 비용/구현 비용 vs 회귀 감지 속도 trade-off. 추천: 일단 1+3, D 시리즈 fix 후 도입.
2. **promptfoo vs DeepEval** — 팀이 Python 도구를 별도로 쓰지 않는다면 promptfoo. (단원지 빌더는 Python인데 ERP backend는 TS — 분리 권장)
3. **Cassette를 git에 commit할지 R2에 둘지** — 작으면 (<100KB/케이스) git OK. 사진 multimodal은 R2 fixture 권장.
4. **Helicone vs AI Gateway** — AI Gateway는 Cloudflare 내장이라 vendor lock-in 동일. Helicone은 OSS + 별도 dashboard. **AI Gateway 권장** (이미 Cloudflare에 있음, 추가 의존성 0).
5. **LLM-as-judge 도입 시기** — D3 fix 후 calibration 정밀화 단계에서. 처음엔 rule-based로도 충분.

---

## 6. 후속 작업 (이 리서치 이후 결정 사항)

- [ ] `/sc:design`으로 위 Layer 1·3 구체 디자인 (file path, API 시그니처) — 필요 시
- [ ] `/sc:implement`로 D5 fix와 함께 AI Gateway 끼우기 (가장 빠른 ROI)
- [ ] golden set 케이스 6개 → 12개로 확장 (D2 unit_id 추론 케이스, D4 manual escalation 케이스 등)

---

## Sources

- [Best Promptfoo alternatives 2026 — Braintrust](https://www.braintrust.dev/articles/best-promptfoo-alternatives-2026)
- [LLM Evaluation Tools Comparison Guide 2026 — Inference.net](https://inference.net/content/llm-evaluation-tools-comparison/)
- [DeepEval alternatives 2026 — Braintrust](https://www.braintrust.dev/articles/deepeval-alternatives-2026)
- [Eliminating Flaky Tests: VCR for LLMs — Anay Nayak](https://anaynayak.medium.com/eliminating-flaky-tests-using-vcr-tests-for-llms-a3feabf90bc5)
- [Polly.JS — Netflix](https://github.com/Netflix/pollyjs)
- [Mock Service Worker docs](https://mswjs.io/docs/quick-start/)
- [Cloudflare Workers Testing — MSW guide](https://developers.cloudflare.com/workers/testing/)
- [LLM Drift Detection 2026 — Stack Pulsar](https://stackpulsar.com/blog/llm-model-drift-detection/)
- [Building a Golden Dataset — Maxim](https://www.getmaxim.ai/articles/building-a-golden-dataset-for-ai-evaluation-a-step-by-step-guide/)
- [Evaluation-First AI Product Engineering — Medium](https://medium.com/@falvarezpinto/evaluation-first-ai-product-engineering-golden-sets-drift-monitoring-and-release-gates-for-llm-2c3bfb3f1e7b)
- [LLM-as-a-judge complete guide — Evidently](https://www.evidentlyai.com/llm-guide/llm-as-a-judge)
- [Langfuse — LLM-as-a-Judge](https://langfuse.com/docs/evaluation/evaluation-methods/llm-as-a-judge)
- [Vercel AI SDK 4.1 — NoObjectGeneratedError](https://vercel.com/blog/ai-sdk-4-1)
- [Vercel AI SDK 3.4 — Workflow patterns](https://vercel.com/blog/ai-sdk-3-4)
- [Cloudflare AI Gateway Analytics](https://developers.cloudflare.com/ai-gateway/observability/analytics/)
- [Cloudflare AI Gateway Costs](https://developers.cloudflare.com/ai-gateway/observability/costs/)
- [Cloudflare D1 Metrics](https://developers.cloudflare.com/d1/observability/metrics-analytics/)
- [Helicone availability — Cloudflare Workers architecture](https://docs.helicone.ai/references/availability)
- [Top 5 LLM Observability Platforms 2026 — Deepak Gupta](https://guptadeepak.com/tools/top-5-llm-observability-platforms-2026/)
