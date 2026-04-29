# WAWA Smart ERP — Claude 작업 가이드

이 문서는 신규 핸들러를 추가하거나 기존 코드를 수정할 때 반드시 따라야 하는 보안·성능·코드 패턴을 정리합니다. **2026-04 보안 라운드 1~24의 회귀 방지가 목적**.

## 프로젝트 구조

```
workers/                    # Cloudflare Workers 백엔드 (D1 + KV + R2)
  src/
    routes/                 # 도메인별 핸들러 (auth, student, exam, vocab, ...)
    middleware/             # auth, cors, rateLimit
    utils/                  # db, crypto, sanitize, jwt, response, logger, ...
    types/                  # TypeScript 타입
  migrations/               # D1 SQL 마이그레이션 (순번 prefix)
apps/
  desktop/                  # 강사 React 앱 (Cloudflare Pages)
  student/                  # 학생 React 앱 (Cloudflare Pages, PIN 토큰 인증)
docs/USECASES.md           # 유즈케이스 인덱스 (UC-A1, UC-S1, ...)
```

## 핵심 보안 규칙 (신규 핸들러는 모두 따를 것)

### 1. multi-tenant academy 격리 (필수)

모든 SELECT/UPDATE/DELETE는 `academy_id` 격리 필수.

```ts
// 나쁜 예
'SELECT * FROM gacha_cards WHERE id = ?'

// 좋은 예
'SELECT * FROM gacha_cards WHERE id = ? AND academy_id = ?'
```

학생/강사 ID도 본인 학원 소속인지 사전 검증:

```ts
const student = await executeFirst<{id: string}>(
  db, 'SELECT id FROM students WHERE id = ? AND academy_id = ?',
  [input.studentId, academyId]
);
if (!student) return errorResponse('학생을 찾을 수 없습니다', 404);
```

**주의**: `academyId` 파라미터만으로는 부족. 학원 내 다른 강사 학생을 잠그려면 `instructor` role은 `student_teachers` 또는 `teacher_id` 필터 추가 필요.

### 2. 입력 위생화 (`utils/sanitize.ts` 사용)

**모든 텍스트 입력**은 DB/KV 저장 전 위생화 + 길이 캡.

```ts
import { sanitizeText, sanitizeNullable, sanitizeRequired } from '@/utils/sanitize';

const cleanTitle = sanitizeText(body.title, 200);  // 빈 문자열 가능
const cleanDesc = sanitizeNullable(body.description, 2000);  // 빈 → null
const cleanName = sanitizeRequired(body.name, 'name', 50);  // 빈 시 throw
```

**금지**: 핸들러마다 자체 sanitize 함수 정의. 반드시 `utils/sanitize.ts` 사용.

### 3. ID 형식 검증

URL 파라미터·body의 ID는 `isValidId`로 검증 (path traversal·SQL meta 차단):

```ts
import { isValidId } from '@/utils/sanitize';

if (!isValidId(studentId)) return errorResponse('id 형식 오류', 400);
```

### 4. SQL은 항상 파라미터 바인딩

```ts
// 금지
db.prepare(`SELECT * FROM students WHERE id = '${id}'`).run();

// 필수
db.prepare('SELECT * FROM students WHERE id = ?').bind(id).run();
```

문자열 보간 SQL은 PR review에서 즉시 reject.

### 5. 멱등 가드 (status 전이 작업)

제출/종료 같은 상태 전이는 race condition + 재시도 시 두 번 실행되지 않도록:

```ts
// 좋은 예
'UPDATE exam_attempts SET status="submitted" WHERE id=? AND status NOT IN ("submitted","expired","voided")'
```

여러 UPDATE/INSERT는 `db.batch()`로 원자화:

```ts
await db.batch([
  db.prepare('UPDATE attempts SET status="submitted" WHERE id=? AND status="running"').bind(id),
  db.prepare('UPDATE assignments SET completed=1 WHERE id=?').bind(assignId),
]);
```

### 6. N+1 제거

for-loop INSERT/UPDATE는 항상 `db.batch()` 또는 `IN (...)` SELECT로 변환:

```ts
// 나쁜 예
for (const id of ids) {
  await db.prepare('INSERT INTO foo VALUES (?)').bind(id).run();
}

// 좋은 예
await db.batch(ids.map(id => db.prepare('INSERT INTO foo VALUES (?)').bind(id)));
```

병렬 가능한 SELECT는 `Promise.all`:

```ts
const [a, b] = await Promise.all([queryA(), queryB()]);
```

### 7. 외부 노출 토큰 (학부모/공개 링크)

HMAC 서명 토큰 + 만료 + rate limit 3종 세트 필수:

```ts
import { signShareToken, verifyShareToken } from '@/utils/share-token';
import { parentReportRateLimit } from '@/middleware/rateLimit';

// 검증 실패 시 logSecurity 기록
const blocked = await parentReportRateLimit(kv, request, targetId);
if (blocked) return blocked;

const verify = await verifyShareToken(token, targetId, 'kind', secret);
if (!verify.ok) {
  logger.logSecurity('TOKEN_INVALID', 'medium', { targetId, reason: verify.reason });
  return errorResponse(...);
}
```

### 8. URL 응답에 origin 신뢰 금지

공유 링크 URL을 만들 때 `request.headers.get('origin')` 그대로 사용 금지 — phishing 위험.

```ts
function resolveSafeBase(env, requestOrigin: string): string {
  const allowed = env.APP_BASE_URL;
  if (allowed) return requestOrigin === allowed ? requestOrigin : allowed;
  return /^https?:\/\//.test(requestOrigin) ? requestOrigin : '';
}
```

### 9. 파일 업로드 (R2)

```ts
// 1. 위험 mime deny (XSS 호스팅 차단)
const blocked = ['text/html', 'text/javascript', 'application/javascript', 'image/svg+xml'];
if (blocked.some(m => file.type.startsWith(m))) return errorResponse('허용되지 않는 형식', 415);

// 2. ext sanitize
const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 32);

// 3. R2 키에 academy_id 포함 (ACL 검증용)
const key = `myfolder/${academyId}/...`;

// 4. contentType은 서버가 결정 (file.type 신뢰 금지)
await BUCKET.put(key, buffer, { httpMetadata: { contentType: 'application/octet-stream' } });
```

### 10. PIN 해싱은 `utils/crypto.ts`만 사용

```ts
import { hashPin, verifyPin, isLegacyHash } from '@/utils/crypto';

const stored = await hashPin(pin);  // 100k iter pbkdf2$<iter>$<salt>$<hash>
const ok = await verifyPin(pin, user.password_hash);
if (ok && isLegacyHash(user.password_hash)) {
  // 자동 재해시
  await db.prepare('UPDATE users SET password_hash=? WHERE id=?').bind(await hashPin(pin), user.id).run();
}
```

**금지**: 핸들러에서 자체 PBKDF2 호출 (iteration 약함 위험).

### 11. PIN/시크릿 응답 cache 차단

평문 PIN을 응답 body에 포함하는 경우 (admin reset 등):

```ts
const resp = successResponse({ tempPin, ... });
resp.headers.set('Cache-Control', 'no-store, private, max-age=0');
resp.headers.set('Pragma', 'no-cache');
return resp;
```

## 변경 시 백업 정책

DB 스키마 변경 (마이그레이션 추가) **전후로 반드시** 백업:

```bash
# /erp-backup 스킬 또는 직접 실행:
wrangler d1 export wawa-smart-erp --remote --output=/tmp/erp-backup/wawa-smart-erp-$(date +%Y%m%d-%H%M).sql
gdrive upload /tmp/erp-backup/...sql --folder-name "erpbackup"
```

## 이슈 #106 (보안 트래킹)

라운드별 보안 패치 진행 상황. 신규 핸들러 작성 시 이 이슈에서 패턴 확인 후 적용.

## 보류 중인 H급 항목 (별도 PR)

이 항목들은 위 규칙으로 막을 수 없는 영역 — 마이그레이션·클라이언트 협업 필요:

- **이슈 #60**: localStorage `play_token` → httpOnly 쿠키 전환
- **SEC-AUTH-M1**: refresh DB 평문 → SHA-256 (마이그레이션 + 사용자 재로그인 강제)
- **SEC-AUTH-M3**: CSRF 토큰 (state-change 헤더 강제)
- **SEC-AUTH-M5**: Logout JWT 즉시 무효화 (KV deny-list, 비용)

## 작업 시 체크리스트

신규 핸들러 PR을 만들기 전:

- [ ] 모든 SELECT/UPDATE/DELETE에 `academy_id` 필터?
- [ ] 외부 입력 ID는 `isValidId` 검증?
- [ ] 텍스트 필드는 `sanitizeText`/`sanitizeNullable` + 길이 캡?
- [ ] 상태 전이는 `WHERE status NOT IN (...)` 가드?
- [ ] for-loop DB 호출 → `db.batch()` 또는 `IN`?
- [ ] 병렬 가능 SELECT → `Promise.all`?
- [ ] 파일 업로드는 mime deny + ext sanitize + academy prefix?
- [ ] 평문 시크릿 응답은 `Cache-Control: no-store`?
- [ ] DB 스키마 변경 시 마이그레이션 직전·직후 백업?
