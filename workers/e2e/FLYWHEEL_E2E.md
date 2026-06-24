# vine-flywheel E2E 실행 가이드

유즈케이스별 실 HTTP(wrangler) + 실 D1(076/077) E2E. 스펙: `e2e/flywheel-usecases.spec.ts`.

> 전제: 대상 D1(`wawa-smart-erp-test`)에 기존 마이그레이션 **001~075가 이미 적용**돼 있어야 함
> (academies/students/users/classes 등 기반 스키마). 평소 `wrangler dev`를 쓰는 로컬·원격 D1은 이미 적용돼 있음.
> ※ 빈 D1을 0부터 만들려면 전체 체인을 순서대로 적용해야 하는데, 일부 데이터 마이그레이션이 FK 의존이라 별도 부트스트랩 필요.

## 적용 대상 7개 유즈케이스
| UC | 내용 | 기대 |
|---|---|---|
| UC1 | 가챠 오답 3건 → `/api/flywheel/drain` → `/api/ssaem/feed` | 약점 '지수법칙(최근 3번)' 노출 |
| UC2 | 징검다리 정답/오답 | 정답 무신호, 오답 wrong_answer 발신 |
| UC3 | 쌤키퍼 활동 기록 | activity 신호 + 활동 id |
| UC4 | 외부 SDK 발신 (`/api/signal` 워커키) | server-trust 적재 / 틀린 키 거부 |
| UC5 | 동의 게이트 (무동의 학생) | 422 거부('동의') |
| UC6 | academy 격리 (acad-1 토큰 → acad-2 학생) | 422 소유권 거부 |
| UC7 | 삭제권 `/api/flywheel/erase` | 추천 소멸 + 키 폐기 후 재적재 거부 |

---

## A. 로컬 dev (무비용·권장 첫 실행)
```bash
cd /mnt/g/vine_academy/wawa_smart_erp/workers

# 1) flywheel 스키마 + 시드 적용 (로컬 D1)
npx wrangler d1 execute wawa-smart-erp-test --local --env="" --file=migrations/076_flywheel_foundation.sql
npx wrangler d1 execute wawa-smart-erp-test --local --env="" --file=migrations/077_service_tables.sql
npx wrangler d1 execute wawa-smart-erp-test --local --env="" --file=migrations/_seed_test_fixtures.sql
npx wrangler d1 execute wawa-smart-erp-test --local --env="" --file=migrations/_seed_flywheel_e2e.sql

# 2) 시크릿 — .dev.vars에 이미 추가됨 (SIGNAL_MASTER_KEY / SIGNAL_WORKER_KEY)

# 3) 서버 (한 터미널)
npx wrangler dev --env="" --port 8787      # 로컬 D1 사용

# 4) E2E (다른 터미널)
SIGNAL_WORKER_KEY=dev-worker-key-flywheel-e2e npm run test:e2e -- flywheel-usecases
```

## B. 원격 test D1 (유료 계정)
```bash
# 1) 적용 — --local 대신 --remote
npx wrangler d1 execute wawa-smart-erp-test --remote --file=migrations/076_flywheel_foundation.sql
npx wrangler d1 execute wawa-smart-erp-test --remote --file=migrations/077_service_tables.sql
npx wrangler d1 execute wawa-smart-erp-test --remote --file=migrations/_seed_test_fixtures.sql
npx wrangler d1 execute wawa-smart-erp-test --remote --file=migrations/_seed_flywheel_e2e.sql

# 2) 시크릿 (배포용)
printf 'BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc=' | npx wrangler secret put SIGNAL_MASTER_KEY --env development
printf 'dev-worker-key-flywheel-e2e' | npx wrangler secret put SIGNAL_WORKER_KEY --env development

# 3) 서버 — 원격 D1 바인딩
npx wrangler dev --env development --remote --port 8787

# 4) E2E
SIGNAL_WORKER_KEY=dev-worker-key-flywheel-e2e npm run test:e2e -- flywheel-usecases
```

## 재실행
시드(`_seed_flywheel_e2e.sql`)는 학생들의 signals/jobs/recommendations/student_keys를 정리하므로,
**매 실행 전 시드만 다시 적용**하면 깨끗한 상태로 반복 가능 (특히 UC7이 키를 폐기하므로 필수).

## 한 방 러너
`bash scripts/flywheel-e2e.sh local` (또는 `remote`) — 적용+시드+안내까지. 서버·테스트는 별 터미널에서.
