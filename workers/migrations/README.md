# D1 마이그레이션 컨벤션

`wawa-smart-erp` D1 데이터베이스의 스키마 변경 이력. **이 파일들은 빈 DB를 현재 스키마까지 재구성하는 유일한 복원 소스다. 적용이 끝났어도 삭제 금지.**

## 파일 네이밍 규칙

| 형식 | 의미 | 예 |
|---|---|---|
| `NNN_snake_case_설명.sql` | **순차 마이그레이션** — 한 파일 = 하나의 논리적 스키마 변경 | `067_calendar_events.sql` |
| `_설명.sql` (밑줄 prefix) | **유틸리티** — 순차 적용 대상이 아님 (점검·테스트 시드 등) | `_post_check.sql` |

- 번호는 단조 증가. 새 마이그레이션은 현재 최대 번호 + 1.
- 새 파일 추가 시 본 표의 형식을 반드시 따른다.

## 적용 방법 (production)

`wrangler d1 migrations apply`는 **쓰지 않는다.** 수동 파일 실행 방식이다:

```bash
npm run db:migrations:list:production       # 적용 현황 확인
npm run db:apply:production -- migrations/NNN_name.sql   # 개별 적용
```

### ⚠️ d1_migrations 추적 갭 (중요)

`d1_migrations` 추적 테이블은 **001~019까지만** 기록한다. **020번 이후는 수동 적용**이라 추적 테이블에 없다.

- 따라서 `db:migrations:list:production`은 020+ 를 "미적용"처럼 보여줄 수 있으나 **실제로는 prod에 반영되어 있다.**
- 이 상태에서 `migrations apply`를 실행하면 020+ 가 **재적용**되어 깨진다 → 절대 금지.
- 적용 여부는 list 출력이 아니라 실제 스키마/이 폴더 기준으로 판단할 것.

## 알려진 불규칙 (의도된 것 — 미스터리 아님)

적용 완료된 파일이라 rename하지 않는다 (list 오인·재적용 위험 > 미관 이득). 기록용으로 남김:

- **중복 번호 006** — `006_student_teachers.sql` + `006_student_teachers_data.sql` (스키마 / 데이터 분리). 정렬상 스키마가 먼저 실행됨.
- **중복 번호 025** — `025_makeup_scheduled_time.sql` + `025_proof_phased.sql` (동시기 두 작업).
- **073 결번** — 작성 중 폐기되어 비어 있음. 무해.

## 유틸리티 파일

- `_post_check.sql` — 마이그레이션 후 데이터 무결성 점검 쿼리. 적용이 아니라 검증용.
- `_seed_test_fixtures.sql` — **`wawa-smart-erp-test` 전용** 시드. **prod에 실행 금지.**

## 스키마 변경 시 (CLAUDE.md §8)

마이그레이션 적용 **직전/직후** 백업으로 롤백 지점 확보:

```bash
wrangler d1 export wawa-smart-erp --remote --output=backup-pre-NNN.sql
```
