# 코드 분석 리포트 — 2026-04-21

**범위**: `apps/desktop` (React 프런트), `workers` (Cloudflare Workers API)
**총 라인수**: desktop 14,858 / workers 15,647 / E2E 48개 spec
**분석 도메인**: 품질 · 보안 · 성능 · 아키텍처

---

## 요약 (Executive Summary)

| 도메인 | 상태 | 주요 이슈 |
| --- | --- | --- |
| 보안 | 🟢 양호 | JWT + PBKDF2 PIN 해시 + 레거시 자동 업그레이드, zod 검증 광범위 적용 |
| 품질 | 🟡 보통 | `any` 103건 / 26파일, 1000+ 줄 거대 파일 5개 |
| 성능 | 🟡 보통 | 1.7MB+ `api.ts` 단일 파일, polling 5초 주기, 번들은 lazy-split 양호 |
| 아키텍처 | 🟡 보통 | page-per-file 비대화, 공유 컴포넌트 추출 미흡, Unit test 0건 |

**최우선 개선**: `api.ts` 1715줄 분할 → 도메인별 슬라이스, `TimerPage.tsx` 936줄 컴포넌트 추출, Unit test 도입.

---

## 1. 보안 (Security) — 🟢 양호

### 강점
- **JWT 시크릿 강제**: `workers/src/index.ts:62` 요청 진입 시 `JWT_SECRET`/`JWT_REFRESH_SECRET` 부재 즉시 500 반환
- **PIN 해시 마이그레이션 전략** (`auth-handler.ts`): PBKDF2 100k iter (SHA-256) 신규 + 레거시 SHA256 검증 후 **자동 업그레이드** 구현 (`auth-handler.ts:137`). 저장 형식 `pbkdf2$<iter>$<salt_b64>$<hash_b64>`
- **Rate Limit 계층화**:
  - 일반 API: 120 req/min per IP (in-memory)
  - 로그인: 5 req/min per IP (KV 기반, isolate 재시작 영향 없음)
  - 민감 엔드포인트: `/api/grader` 20, `/api/ai/` 10, `/api/file/upload` 20 …
- **입력 검증**: zod 스키마가 14개 핸들러에 적용됨 (`auth`, `academy`, `teachers`, `student`, `meeting`, `settings`, `grader`, `onboard` 등)
- **SQL Injection 방어**: `prepare(..., ${...})` 형태의 문자열 보간 **0건** — 모두 `.bind()` 파라미터화
- **요청 크기 제한**: 10MB 하드 컷 (`index.ts:95`)
- **XSS 위험 패턴**: `dangerouslySetInnerHTML` / `eval(` / `innerHTML =` 0건
- **테넌트 격리**: `tenantMiddleware` + `academy_id` 스코프 + `canAccessStudent` 헬퍼

### 리스크
| 심각도 | 파일 | 이슈 | 권고 |
| --- | --- | --- | --- |
| 🟠 중 | `apps/desktop/src/api.ts:12, 24, 47` | `accessToken`을 `localStorage`에 저장 — XSS 시 탈취 가능 | `httpOnly Secure SameSite=Strict` 쿠키로 이전. 당장 어렵다면 `refreshToken`만이라도 쿠키로 |
| 🟡 저 | `wrangler.toml:16` | 프로덕션 route가 `api.wawa.app` 인데 `wawa.app`은 외부 파킹/매도 도메인 | route 제거 or 실제 소유 도메인으로 교체 (현재 `zeskywa499.workers.dev` 실사용 중) |
| 🟡 저 | `workers/src/middleware/rateLimit.ts:13` | In-memory rate limit이 isolate 전역 공유 (`globalThis.__rateLimitStore`) — multi-isolate에서 per-isolate만 막음 | KV 기반 기본 limiter를 sensitive endpoint처럼 확장하거나 Durable Objects |
| 🟡 저 | `utils/secrets.ts` | `SecretsManager` 클래스 정의됐지만 `jwt.ts`는 `env.JWT_SECRET` 직접 참조 — 매니저 미사용 | 일관되게 SecretsManager 경유하거나 클래스 삭제 |

---

## 2. 품질 (Code Quality) — 🟡 보통

### 지표
- `any` 사용: **103건 / 26 파일** (최다: `api.ts` 25, `AssignmentsPage.tsx` 11, `StudentListPage.tsx` 7, `TeacherEditModal.tsx` 6)
- `@ts-ignore|@ts-expect-error|@ts-nocheck`: **E2E 테스트 2건만** (production 코드 0건)
- `console.*`: 프로덕션 코드 **1건** (`ConsultationPanel.tsx` — `console.error` 디버그 잔재)
- `TODO/FIXME/HACK`: **0건** — 양호
- Unit test (`*.test.ts`): **0건** — E2E 48개만 존재
- `tsconfig`: `strict: true` ✓, 그러나 `noUnusedLocals: false` / `noUnusedParameters: false` — 사용 안 되는 심볼 탐지 꺼짐

### Top 5 거대 파일 (유지보수 리스크)

| 파일 | 라인 | 문제 |
| --- | --- | --- |
| `apps/desktop/src/api.ts` | **1,715** | 도메인 무관 모든 REST 래퍼 집약. 수정 시 머지 충돌 유발, lazy-import 불가, 타입 변경 전파 범위 큼 |
| `workers/src/routes/student-handler.ts` | **1,180** | `handleStudent` 1개 핸들러에 학생/상담/일정/담임/프로필 전체. switch-case 길이 폭주 |
| `apps/desktop/src/pages/TimerPage.tsx` | 936 | 단일 페이지에 출석/타이머/UI 로직 혼재 |
| `workers/src/routes/timer-session-handler.ts` | 898 | 세션/출석/집계 혼합 |
| `apps/desktop/src/pages/ExamManagementPage.tsx` | 812 | 월탭+시험+응시자 리스트 한 파일 |

### 권고
1. **`api.ts` 도메인 분할** — `api/auth.ts`, `api/student.ts`, `api/homeroom.ts`, `api/exam.ts` 형태. 타입만 `api/types.ts`에 공용.
2. **`student-handler.ts` 서브핸들러 분리** — `consultation-handler.ts`, `schedule-handler.ts`, `homeroom-handler.ts` 로 이관 (상담/일정은 이미 독립된 엔티티)
3. **`noUnusedLocals: true`** 켜기 — 최근 homeroom 추가 시 사용되지 않는 `importing` state 등 조기 감지
4. **`ConsultationPanel.tsx:68` `console.error` 제거** — 이미 `toast.error`로 사용자 알림 있음
5. **Unit test 도입** — 최소 `jwt.ts`, `validation.ts`, `computeRemaining(ExamTimer)` 같은 순수 함수부터

---

## 3. 성능 (Performance) — 🟡 보통

### 강점
- **Lazy route code-splitting**: 모든 페이지 `lazy(() => import(...))` — 초기 번들 44KB gzip
- **Bundle 크기**: vendor-react 53KB gzip, page chunks 1–7KB gzip 수준 — 양호
- **Gzip 전체 CSS**: 22KB (138KB raw) — 적절
- **`React.memo`**: `AttemptCard` 등 리스트 아이템에 적용
- **Refresh 중복 방지**: `api.ts:6` `refreshPromise` 싱글턴

### 리스크
| 위치 | 이슈 | 영향 |
| --- | --- | --- |
| `ExamTimerPage.tsx:193` | `setInterval(load, 5000)` — 탭이 백그라운드여도 지속 polling | 다중 탭 사용자 * 학생 수만큼 D1 쿼리 부하 |
| `ExamTimerPage.tsx:199` | 1초 setInterval로 `now` 갱신 → 전체 카드 리렌더 | 카드 다수 시 불필요한 리페인트. 카드 내부에서만 tick 하도록 분리 가능 |
| `api.ts` 1715줄 | 한 파일을 수정할 때마다 번들의 `index-XXX.js`가 바뀜 → 사용자 캐시 전면 무효화 | 쓸데없는 전체 번들 재다운로드 |
| `HomeroomConsultationsPage.tsx:61-62` | `any` 캐스트 (`m.get(c.student_id) as any`) | 타입 안전성 상실. `Map<string, Array<...>>` 명시 |
| polling 일괄 5초 | 페이지 벗어나도 interval cleanup은 됨 (ok) but `document.hidden` 체크 없음 | 배터리/네트워크 낭비 |

### 권고
- `ExamTimerPage` polling을 **visibility API로 pause** (`document.hidden` 시 skip)
- 1초 tick을 `AttemptCard` 내부 `useEffect`로 이관 (memo와 조합 시 불필요 리렌더 감소)
- Service Worker 또는 `ETag` 기반 incremental fetch 검토

---

## 4. 아키텍처 (Architecture) — 🟡 보통

### 구조
- **모노레포 구성**: `apps/desktop` (교사), `apps/student` (학생), `workers` (API). 올바른 분리
- **인증 레이어**: `authMiddleware` → `requireRole`/`requireAcademy` 헬퍼 조합. 단순 명확
- **DB 패턴**: D1 prepared statement + KV(세션/rate limit) + R2(파일). 비용-효율적
- **마이그레이션**: 번호제 SQL 파일 (`037_homeroom_and_consultation.sql` 등) — 양호

### 문제
| 심각도 | 이슈 | 설명 |
| --- | --- | --- |
| 🟠 | **라우트 중앙집중**: `workers/src/index.ts:100+`에서 모든 prefix 분기를 긴 `if` 체인으로 처리 | 새 엔드포인트 추가 시 4곳 수정 필요 (index, handler, api.ts, types). Router 객체/Hono 같은 경량 프레임워크 검토 |
| 🟠 | **`student-handler.ts` 책임 과다**: 학생 CRUD + 프로필 + 상담 + 일정 + 담임 지정 + 요약/캘린더 모두 한 파일 | SRP 위반 — 상담/일정은 독립 엔티티인데 URL 경로가 `student/` 하위라 한 파일에 묶임. Router가 있으면 분리 자유로움 |
| 🟡 | **공유 UI 미추출**: `ConsultationPanel`, `ExternalSchedulePanel`이 `StudentProfilePage`에만 쓰임. 재사용 여지 없으면 `components/student/` 로 이동 | 기존 `components/academy/` 패턴과 일관성 |
| 🟡 | **E2E 의존 테스트만 존재**: 단위 테스트 0건. 순수 함수 (`computeRemaining`, zod 스키마, JWT) 단위 커버 없음 | 회귀 시 E2E 느린 피드백만 |
| 🟢 | `api.ts`와 `types/` 분리 안 됨 | 타입만 `api/types.ts`로 빼면 workers의 zod 스키마와 공유 가능 (codegen 혹은 공용 패키지) |

---

## 우선순위 개선 로드맵

### P0 (즉시)
1. `localStorage` accessToken → httpOnly 쿠키 이전 (보안 상위 리스크)
2. `ConsultationPanel.tsx:68` `console.error` 제거 (사소, 디버그 잔재)
3. `wrangler.toml` `api.wawa.app` route 제거 (외부 도메인)

### P1 (1~2스프린트)
4. `api.ts` 도메인별 분할 (auth, student, homeroom, exam, gacha, vocab, …)
5. `student-handler.ts`에서 consultation/schedule/homeroom 분리
6. `ExamTimerPage` visibility-aware polling
7. `tsconfig`에 `noUnusedLocals: true` 적용

### P2 (점진)
8. Unit test 도입: 최우선 `jwt.ts`, `computeRemaining`, zod schemas
9. Hono/itty-router 검토 (index.ts 라우팅 간소화)
10. `any` 103건 점진 제거 — 파일별 탑다운
11. 공통 타입을 `packages/shared-types` 로 승격

---

## 메트릭 스냅샷

```
files:        ts/tsx 99 (desktop 51, workers 48)
tests:        unit 0, e2e 48
lines:        30,505 (desktop 14,858 + workers 15,647)
biggest:      api.ts 1715, student-handler.ts 1180
any usage:    103 occurrences / 26 files
ts-ignore:    0 (production)
console.*:    1 (production)
TODO/FIXME:   0
SQL injection surface:  0
XSS surface (dangerouslySetInnerHTML/eval/innerHTML): 0
strict mode:  ✓ (desktop, workers)
```

---

**다음 단계**: 우선순위 항목 확정 후 `/sc:improve` 로 P0 처리, 또는 `/sc:cleanup` 으로 `any` 제거.
