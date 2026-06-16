# Seeds

DB 초기/콘텐츠 데이터 시드. **루트(`workers/`)에 흩어두지 말고 반드시 여기에 둔다.**

| 위치 | 용도 | git |
|---|---|---|
| `seeds/` | **콘텐츠 시드** — 커리큘럼·증명·단어 등 PII 없는 데이터 | ✅ 추적 |
| `seeds/local/` | **데모·PII 시드** — `students`/`users`/`gacha_students` 등 개인정보 포함 | 🔒 gitignored (커밋 금지) |
| `seeds/.generated/` | 스크립트로 자동 생성된 시드 | ✅ 추적 |

## 규칙

- **PII(실명·전화·PIN 해시·학생/계정 행) 포함 시드는 `seeds/local/`에만 둔다.** `.gitignore`의 `workers/seeds/local/` 규칙으로 커밋이 차단된다.
- 콘텐츠 시드는 `seeds/` 직하에 두면 자동으로 버전 관리된다.
- 적용: `npm run db:apply:production -- seeds/<파일>.sql` (스키마 변경은 `migrations/` 참고)
