# AskAI E2E UC 보고서

- **생성 시각**: 2026-05-16T02:13:29.889Z
- **검증 사이트**: https://wawa-learn.pages.dev
- **총 UC**: 9
- **결과**: 9 PASS / 0 FAIL

각 UC는 Playwright 가 실제 브라우저로 사이트를 조작하면서 캡처한 결과입니다. 스크린샷은 같은 폴더의 PNG, 네트워크 응답 코드 + assertion 통과 여부도 함께 기록.

---

## UC-A — Hub 렌더 (헤더·CTA·quota·탭바)

- **상태**: ✅ PASS
- **최종 URL**: `https://wawa-learn.pages.dev/#/ask-ai`

**네트워크 응답**:

| Endpoint | Status |
|---|---|
| `/api/ask-ai/drill/today` | ✅ 200 |
| `/api/ask-ai/quota` | ✅ 200 |

**검증**:

| 항목 | 결과 | 상세 |
|---|---|---|
| 인사 텍스트에 학생 이름 | ✅ | `안녕, 서재용!` |
| 히어로 섹션 표시 | ✅ | `` |
| quota 바 표시 | ✅ | `` |
| CTA 2개 (사진/글) | ✅ | `` |
| 하단 탭바 표시 | ✅ | `` |

**스크린샷**:

![UC-A](./uc-a-hub.png)

---

## UC-B — 글로 묻기 → /write

- **상태**: ✅ PASS
- **최종 URL**: `https://wawa-learn.pages.dev/#/ask-ai/write`

**네트워크 응답**:

| Endpoint | Status |
|---|---|
| `/api/ask-ai/drill/today` | ✅ 200 |
| `/api/ask-ai/quota` | ✅ 200 |

**검증**:

| 항목 | 결과 | 상세 |
|---|---|---|
| URL이 /ask-ai/write | ✅ | `https://wawa-learn.pages.dev/#/ask-ai/write` |
| composer textarea 표시 | ✅ | `` |
| 카메라 버튼 표시 | ✅ | `` |

**스크린샷**:

![UC-B](./uc-b-write.png)

---

## UC-C — 질문 제출 → AI 응답 + KaTeX

- **상태**: ✅ PASS
- **최종 URL**: `https://wawa-learn.pages.dev/#/ask-ai/write`

**네트워크 응답**:

| Endpoint | Status |
|---|---|
| `/api/ask-ai/ask` | ✅ 200 |

**검증**:

| 항목 | 결과 | 상세 |
|---|---|---|
| POST /api/ask-ai/ask 응답 200 | ✅ | `status=200` |
| 응답 step 카드 ≥ 2 (질문+응답) | ✅ | `count=7` |
| KaTeX 수식 렌더 | ✅ | `katex=7` |

**스크린샷**:

![UC-C](./uc-c-result.png)

---

## UC-D — 사진으로 묻기 → /photo

- **상태**: ✅ PASS
- **최종 URL**: `https://wawa-learn.pages.dev/#/ask-ai/photo`

**네트워크 응답**:

| Endpoint | Status |
|---|---|
| `/api/ask-ai/quota` | ✅ 200 |
| `/api/ask-ai/drill/today` | ✅ 200 |

**검증**:

| 항목 | 결과 | 상세 |
|---|---|---|
| URL이 /ask-ai/photo | ✅ | `https://wawa-learn.pages.dev/#/ask-ai/photo` |

**스크린샷**:

![UC-D](./uc-d-photo.png)

---

## UC-E — /drill 카드 페이지

- **상태**: ✅ PASS
- **최종 URL**: `https://wawa-learn.pages.dev/#/drill`

**네트워크 응답**:

| Endpoint | Status |
|---|---|
| `/api/ask-ai/drill/today` | ✅ 200 |

**검증**:

| 항목 | 결과 | 상세 |
|---|---|---|
| 페이지 렌더 (body 텍스트 존재) | ✅ | `len=102` |
| "오늘 복습" 헤더 존재 | ✅ | `오늘 복습 0 / 0
🌱
오늘 복습할 카드가 없어요

AskAI에서 막혔던 단계, 시험 ` |

**스크린샷**:

![UC-E](./uc-e-drill.png)

---

## UC-F — bogus 토큰 → /login

- **상태**: ✅ PASS
- **최종 URL**: `https://wawa-learn.pages.dev/#/login`

**네트워크 응답**:

| Endpoint | Status |
|---|---|
| `/api/ask-ai/drill/today` | ⚠ 401 |
| `/api/ask-ai/quota` | ⚠ 401 |

**검증**:

| 항목 | 결과 | 상세 |
|---|---|---|
| URL이 /login 으로 리다이렉트 | ✅ | `https://wawa-learn.pages.dev/#/login` |
| localStorage play_token 제거됨 | ✅ | `remained=null` |

**스크린샷**:

![UC-F](./uc-f-401.png)

---

## UC-G1 — 탭 학습 이동

- **상태**: ✅ PASS
- **최종 URL**: `https://wawa-learn.pages.dev/#/assignments`

**네트워크 응답**:

| Endpoint | Status |
|---|---|
| `/api/ask-ai/quota` | ✅ 200 |
| `/api/ask-ai/drill/today` | ✅ 200 |
| `/api/play/assignments` | ✅ 200 |

**검증**:

| 항목 | 결과 | 상세 |
|---|---|---|
| URL이 /assignments 또는 /learn | ✅ | `https://wawa-learn.pages.dev/#/assignments` |

**스크린샷**:

![UC-G1](./uc-g-learn.png)

---

## UC-G2 — 탭 도감 이동

- **상태**: ✅ PASS
- **최종 URL**: `https://wawa-learn.pages.dev/#/dex`

**네트워크 응답**:

| Endpoint | Status |
|---|---|
| `/api/ask-ai/quota` | ✅ 200 |
| `/api/ask-ai/drill/today` | ✅ 200 |
| `/api/play/archives` | ⚠ 404 |

**검증**:

| 항목 | 결과 | 상세 |
|---|---|---|
| URL이 /dex | ✅ | `https://wawa-learn.pages.dev/#/dex` |

**스크린샷**:

![UC-G2](./uc-g-dex.png)

---

## UC-G3 — 탭 나 이동

- **상태**: ✅ PASS
- **최종 URL**: `https://wawa-learn.pages.dev/#/me`

**네트워크 응답**:

| Endpoint | Status |
|---|---|
| `/api/ask-ai/drill/today` | ✅ 200 |
| `/api/ask-ai/quota` | ✅ 200 |
| `/api/play/vocab/my-catalogs` | ✅ 200 |
| `/api/play/vocab/exam/availability` | ✅ 200 |

**검증**:

| 항목 | 결과 | 상세 |
|---|---|---|
| URL이 /me | ✅ | `https://wawa-learn.pages.dev/#/me` |

**스크린샷**:

![UC-G3](./uc-g-me.png)

---

# 컨텐츠 검증 (AI 답변 + 숙제)

- **생성**: 2026-05-16T02:27:12.140Z
- **AI**: 3/3 PASS · **숙제**: 2/2 PASS

## AI-1 — AI 답변 검증

- **상태**: ✅ PASS  · HTTP `200` · steps `3` · KaTeX `1`

**질문**: 표본평균 X̄가 무엇인지 정의와 함께 설명해주세요.

**검증**:

| 항목 | 결과 | 상세 |
|---|---|---|
| HTTP 200 | ✅ | `status=200` |
| step 카드 ≥ 2 | ✅ | `count=3` |
| explain step 존재 | ✅ | `` |
| checkpoint step 존재 (한 줄씩 멈춤) | ✅ | `` |
| 응답 본문에 한국어 (가-힣 ≥ 20자) | ✅ | `한글수=83` |

**AI 응답 step**:

| # | kind | 제목 / 질문 | 본문 미리보기 |
|---|---|---|---|
| 1 | `explain` | 모집단과 표본 | 우리가 알고 싶어 하는 전체 집단을 **모집단**이라고 해요. 하지만 모집단 전체를 조사하는 것은 시간, 비용 등의 문제로 어려울 때가 많죠. 그래서 모집단에서 일부를 뽑아 조사하 |
| 2 | `explain` | 표본평균의 정의 | 표본평균 $\bar{X}$는 표본으로 뽑은 자료들의 평균을 의미해요. 만약 크기가 $n$인 표본 $x_1, x_2, \dots, x_n$을 뽑았다면, 표본평균은 다음과 같이 계산합 |
| 3 | `checkpoint` | 표본평균 $\bar{X}$는 무엇을 나타내며, 왜 사용하는지 설명해 볼까요? | 표본평균 $\bar{X}$는 무엇을 나타내며, 왜 사용하는지 설명해 볼까요? |

**첫 explain 본문 (raw)**:

```markdown
우리가 알고 싶어 하는 전체 집단을 **모집단**이라고 해요. 하지만 모집단 전체를 조사하는 것은 시간, 비용 등의 문제로 어려울 때가 많죠. 그래서 모집단에서 일부를 뽑아 조사하는데, 이 일부를 **표본**이라고 합니다.
```

**스크린샷**:

![ai-1](./content-ai-1.png)

---

## AI-2 — AI 답변 검증

- **상태**: ✅ PASS  · HTTP `200` · steps `6` · KaTeX `4`

**질문**: 등차수열의 합 공식 S_n = n(a₁+a_n)/2 가 왜 성립하는지 한 줄씩 풀어주세요.

**검증**:

| 항목 | 결과 | 상세 |
|---|---|---|
| HTTP 200 | ✅ | `status=200` |
| step 카드 ≥ 2 | ✅ | `count=6` |
| explain step 존재 | ✅ | `` |
| checkpoint step 존재 (한 줄씩 멈춤) | ✅ | `` |
| 응답 본문에 한국어 (가-힣 ≥ 20자) | ✅ | `한글수=33` |

**AI 응답 step**:

| # | kind | 제목 / 질문 | 본문 미리보기 |
|---|---|---|---|
| 1 | `explain` | 등차수열의 합 $S_n$ 이해하기 | 등차수열의 합 $S_n$은 첫째항부터 제$n$항까지의 모든 항을 더한 값을 의미해요. 즉, $S_n = a_1 + a_2 + a_3 + \dots + a_{n-1} + a_n$ 입 |
| 2 | `explain` | 합을 두 가지 방식으로 표현하기 | 우리는 이 합 $S_n$을 두 가지 방식으로 써볼 거예요. 첫 번째는 순서대로 쓰는 방식이고, 두 번째는 역순으로 쓰는 방식입니다. 등차수열의 정의에 따라 $a_k = a_1 +  |
| 3 | `explain` | 두 식을 더하여 규칙 찾기 | 1. $S_n = a_1 + (a_1+d) + (a_1+2d) + \dots + (a_n-d) + a_n$2. $S_n = a_n + (a_n-d) + (a_n-2d) + \dot |
| 4 | `explain` | 간단한 형태로 정리하기 | 위 식에서 각 괄호 안의 합을 계산하면 모두 $a_1+a_n$이 됩니다. 예를 들어, $(a_1+d)+(a_n-d) = a_1+a_n$ 이죠.이러한 $(a_1+a_n)$ 항이 총  |
| 5 | `explain` | 최종 공식 도출 | $2S_n = n(a_1+a_n)$ 이라는 식을 $S_n$에 대해 정리하면, 등차수열의 합 공식 $S_n = \frac{n(a_1+a_n)}{2}$ 가 완성됩니다. |
| 6 | `checkpoint` | 등차수열의 합 공식을 유도하는 과정, 이해했나요? | 등차수열의 합 공식을 유도하는 과정, 이해했나요? |

**첫 explain 본문 (raw)**:

```markdown
등차수열의 합 $S_n$은 첫째항부터 제$n$항까지의 모든 항을 더한 값을 의미해요. 즉, $S_n = a_1 + a_2 + a_3 + \dots + a_{n-1} + a_n$ 입니다.
```

**스크린샷**:

![ai-2](./content-ai-2.png)

---

## AI-3 — AI 답변 검증

- **상태**: ✅ PASS  · HTTP `200` · steps `4` · KaTeX `5`

**질문**: 편미분이 일반 미분과 어떻게 다른지 직관적으로 설명해주세요.

**검증**:

| 항목 | 결과 | 상세 |
|---|---|---|
| HTTP 200 | ✅ | `status=200` |
| step 카드 ≥ 2 | ✅ | `count=4` |
| explain step 존재 | ✅ | `` |
| checkpoint step 존재 (한 줄씩 멈춤) | ✅ | `` |
| 응답 본문에 한국어 (가-힣 ≥ 20자) | ✅ | `한글수=120` |

**AI 응답 step**:

| # | kind | 제목 / 질문 | 본문 미리보기 |
|---|---|---|---|
| 1 | `explain` | 일반 미분: 한 방향으로의 변화율 | 일반 미분은 **하나의 변수**에 따라 함수가 어떻게 변하는지 측정합니다. 예를 들어, 자동차가 일직선 도로를 달릴 때, 시간당 속도(위치의 변화율)를 측정하는 것과 같아요. 움직 |
| 2 | `checkpoint` | 일반 미분은 몇 개의 변수를 가진 함수에 적용될까요? | 일반 미분은 몇 개의 변수를 가진 함수에 적용될까요? |
| 3 | `explain` | 편미분: 여러 방향 중 한 방향으로의 변화율 | 편미분은 **여러 개의 변수**를 가진 함수에서, **다른 변수들을 고정시킨 채** 특정 한 변수가 변할 때 함수가 어떻게 변하는지 측정합니다. 마치 자동차가 2차원 평면(산등성이 |
| 4 | `checkpoint` | 편미분에서 '다른 변수들을 고정시킨다'는 것이 어떤 의미인지 이해했나요? | 편미분에서 '다른 변수들을 고정시킨다'는 것이 어떤 의미인지 이해했나요? |

**첫 explain 본문 (raw)**:

```markdown
일반 미분은 **하나의 변수**에 따라 함수가 어떻게 변하는지 측정합니다. 예를 들어, 자동차가 일직선 도로를 달릴 때, 시간당 속도(위치의 변화율)를 측정하는 것과 같아요. 움직일 수 있는 방향이 하나뿐이죠. $y = f(x)$와 같이 변수가 하나인 함수에서 $x$가 변할 때 $y$가 얼마나 변하는지 나타냅니다. 기호로는 $\frac{dy}{dx}$ 또는 $f'(x)$로 씁니다.
```

**스크린샷**:

![ai-3](./content-ai-3.png)

---

## HW-1 — 숙제 목록 (/assignments) 진입

- **상태**: ✅ PASS
- **URL**: `https://wawa-learn.pages.dev/#/assignments`

**검증**:

| 항목 | 결과 | 상세 |
|---|---|---|
| URL이 /assignments | ✅ | `https://wawa-learn.pages.dev/#/assignments` |
| 페이지 텍스트 존재 | ✅ | `len=64` |
| 발행한 테스트 숙제 표시 | ✅ | `과제 ← 홈 제출하기 과제 E2E 테스트 숙제 — 표본분포 기본 마감 5. 23. 오전 11:24 홈 학습 도감 나` |

**스크린샷**:

![hw-1](./content-hw-1.png)

---

## HW-2 — 숙제 카드 클릭 → 상세 화면

- **상태**: ✅ PASS
- **URL**: `https://wawa-learn.pages.dev/#/assignments/atg-2aa5f99b`

**검증**:

| 항목 | 결과 | 상세 |
|---|---|---|
| 숙제 카드 표시됨 (클릭 가능) | ✅ | `` |
| URL이 /assignments/<id> | ✅ | `https://wawa-learn.pages.dev/#/assignments/atg-2aa5f99b` |
| 상세 화면에 instructions 표시 | ✅ | `← LIST 제출 전 DUE · 5. 23. 오전 11:24 E2E 테스트 숙제 — 표본분포 기본 지시 사항 표본평균 분산 σ²/n 유도 과정을 한 줄씩 적어보세요. AskAI에 ` |

**스크린샷**:

![hw-2](./content-hw-2.png)

---

---

## 재현 방법

```bash
cd apps/student
npx playwright test e2e/screenshot-uc-report.spec.ts --project=chromium --workers=1
npx playwright test e2e/screenshot-content-report.spec.ts --project=chromium --workers=1
node e2e/uc-report/build-report.mjs
```
