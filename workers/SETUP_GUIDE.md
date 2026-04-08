# Cloudflare Workers 마이그레이션 - 사용자 실행 가이드

구현된 코드가 완성되었습니다! 이제 **당신이 해야 할 일**을 단계별로 정리합니다.

## ✅ 체크리스트

### Phase 1: Cloudflare 계정 설정 (30분)

#### Step 1: Cloudflare 계정 생성
- [ ] https://dash.cloudflare.com 접속
- [ ] **새 이메일로 계정 생성** (무료, 기존 계정과 분리)
- [ ] 이메일 확인

#### Step 2: Wrangler CLI 설치
```bash
npm install -g wrangler
# 또는 이미 설치된 경우
wrangler --version
```

#### Step 3: Cloudflare 로그인
```bash
wrangler login
# 브라우저에서 Authorize 클릭
```

#### Step 4: D1 데이터베이스 생성
```bash
cd workers
wrangler d1 create wawa-smart-erp
# 출력되는 database_id를 복사하여 wrangler.toml에 붙여넣기
```

**wrangler.toml에서 수정:**
```toml
[[d1_databases]]
binding = "DB"
database_name = "wawa-smart-erp"
database_id = "여기에_붙여넣기" # ← 복사한 ID로 변경
```

#### Step 5: KV 네임스페이스 생성
```bash
wrangler kv:namespace create "CACHE_KV"
wrangler kv:namespace create "CACHE_KV" --preview
# 출력되는 id를 wrangler.toml에 붙여넣기
```

**wrangler.toml에서 수정:**
```toml
[[kv_namespaces]]
binding = "KV"
id = "여기에_붙여넣기"
preview_id = "여기에_붙여넣기"
```

---

### Phase 2: 로컬 테스트 (30분)

#### Step 1: 의존성 설치
```bash
cd workers
npm install
```

#### Step 2: 데이터베이스 마이그레이션
```bash
wrangler d1 execute wawa-smart-erp --local --file=./migrations/001_init.sql
```

#### Step 3: 로컬 서버 시작
```bash
npm run dev
# http://localhost:8787 에서 서버 시작
```

#### Step 4: API 테스트
```bash
# 헬스 체크
curl http://localhost:8787/health

# 출력 예상:
# {"status":"ok","timestamp":"2025-04-08T..."}
```

**성공하면 ✅**

---

### Phase 3: 기존 Electron 앱 수정 (2-3시간)

#### Step 1: API 엔드포인트 변경

**파일**: `apps/desktop/src/services/` 에서 API 호출 수정

기존 방식 (로컬):
```typescript
// 기존 - 로컬 파일 또는 Electron IPC
const user = await ipcRenderer.invoke('auth:login', email, password);
```

새로운 방식:
```typescript
// 새 방식 - Cloudflare Workers API
const response = await fetch('http://localhost:8787/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
});

const data = await response.json();
const { accessToken, refreshToken } = data.data;

// 토큰을 로컬에 저장
localStorage.setItem('accessToken', accessToken);
localStorage.setItem('refreshToken', refreshToken);
```

#### Step 2: 인증 토큰 관리 추가

**파일**: `apps/desktop/src/utils/auth.ts` (새로 생성)

```typescript
export function getAccessToken(): string | null {
  return localStorage.getItem('accessToken');
}

export function getRefreshToken(): string | null {
  return localStorage.getItem('refreshToken');
}

export async function setTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem('accessToken', accessToken);
  localStorage.setItem('refreshToken', refreshToken);
}

export async function clearTokens() {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
}

// API 요청에 자동으로 토큰 추가
export function getAuthHeaders(): Record<string, string> {
  const token = getAccessToken();
  return {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
  };
}
```

#### Step 3: IndexedDB 캐싱 추가 (선택사항이지만 권장)

**파일**: `apps/desktop/src/utils/cache.ts` (새로 생성)

```typescript
export async function cacheStudentData(students: any[]) {
  const db = await openDB('wawa-cache', 1, {
    upgrade(db) {
      db.createObjectStore('students', { keyPath: 'id' });
    },
  });
  
  const tx = db.transaction('students', 'readwrite');
  for (const student of students) {
    await tx.store.put(student);
  }
  await tx.done;
}

export async function getCachedStudents() {
  const db = await openDB('wawa-cache', 1);
  return await db.getAll('students');
}
```

#### Step 4: API 응답 처리

모든 API 호출에서 응답 확인:

```typescript
const response = await fetch(url, {
  headers: getAuthHeaders(),
});

if (!response.ok) {
  if (response.status === 401) {
    // 토큰 만료 → 리프레시 토큰으로 새로 발급
    await refreshAccessToken();
    // 재시도...
  }
  throw new Error(await response.text());
}

const data = await response.json();
if (!data.success) {
  throw new Error(data.error);
}

return data.data; // 실제 데이터 반환
```

#### Step 5: 주요 모듈별 API 호출 수정

**Timer (시간표/출석)**
```typescript
// GET /api/timer/classes
// POST /api/timer/classes
// POST /api/timer/attendance
```

**Grader (성적)**
```typescript
// GET /api/grader/exams
// POST /api/grader/exams
// POST /api/grader/grades
// GET /api/grader/grades/:studentId
```

**Student (학생)**
```typescript
// GET /api/student
// POST /api/student
// PATCH /api/student/:id
```

**Report (보고서)**
```typescript
// POST /api/report/generate
// GET /api/report/:studentId/:month
```

---

### Phase 4: 데이터 마이그레이션 (1-2시간)

#### Step 1: 기존 SQLite 데이터 추출

Electron 앱이 로컬 SQLite를 사용한다면:

```bash
# Electron 앱의 데이터 폴더 위치 찾기
# Windows: %APPDATA%/WAWA Smart ERP/
# Mac: ~/Library/Application Support/WAWA Smart ERP/
# Linux: ~/.config/WAWA Smart ERP/

# SQLite 데이터베이스에서 CSV로 내보내기
sqlite3 "~/Library/Application Support/WAWA Smart ERP/data.db" \
  ".mode csv" \
  ".output students.csv" \
  "SELECT * FROM students;"
```

#### Step 2: D1에 데이터 업로드

**파일**: `workers/scripts/import.sql` (새로 생성)

```sql
-- 사용자 데이터 (필요시)
INSERT INTO users (id, email, name, password_hash, role, academy_id, created_at, updated_at)
VALUES ('user-1', 'teacher@example.com', '선생님', 'hashed_password', 'instructor', 'academy-1', datetime('now'), datetime('now'));

-- 학생 데이터
INSERT INTO students (id, academy_id, name, class_id, contact, status, created_at, updated_at)
SELECT 
  'student-' || id,
  'academy-1',
  name,
  'class-' || class_id,
  contact,
  'active',
  datetime('now'),
  datetime('now')
FROM imported_students_csv;
```

#### Step 3: 마이그레이션 실행

```bash
wrangler d1 execute wawa-smart-erp --file=./scripts/import.sql
```

---

### Phase 5: 배포 (30분)

#### Step 1: 프로덕션 배포

```bash
cd workers

# 프로덕션으로 배포
wrangler deploy --env production
```

#### Step 2: 환경 변수 설정

Cloudflare 대시보드에서:

```bash
# 시크릿 설정
wrangler secret put JWT_SECRET --env production
# 강력한 랜덤 문자열 입력 (예: openssl rand -base64 32)

wrangler secret put JWT_REFRESH_SECRET --env production
# 다른 강력한 랜덤 문자열

wrangler secret put GEMINI_API_KEY --env production
# Google Gemini API 키 입력
```

#### Step 3: 도메인 설정 (선택사항)

`wrangler.toml`에 도메인 추가:

```toml
[env.production]
routes = [
  { pattern = "api.wawa.app/*", zone_name = "wawa.app" }
]
```

---

### Phase 6: Electron 앱 배포 (30분)

#### Step 1: API URL 변경

**파일**: `apps/desktop/src/constants/api.ts`

```typescript
export const API_BASE_URL = 
  process.env.NODE_ENV === 'production'
    ? 'https://api.wawa.app'  // 또는 Cloudflare Workers URL
    : 'http://localhost:8787';
```

#### Step 2: 빌드 및 테스트

```bash
cd apps/desktop

# 빌드
npm run build

# 테스트
npm run test

# 패키징 (Windows)
npm run package
```

#### Step 3: Cloudflare Workers URL 확인

배포 후 Workers URL:
```
https://wawa-smart-erp-api.YOUR_ACCOUNT.workers.dev
```

이를 Electron 앱의 API_BASE_URL로 설정하면 됩니다.

---

## 🆘 문제 해결

### 문제 1: `wrangler login` 실패

```bash
# 다시 시도
wrangler logout
wrangler login
```

### 문제 2: D1 생성 실패

```bash
# 계정 확인
wrangler whoami

# 다시 생성
wrangler d1 create wawa-smart-erp
```

### 문제 3: 로컬 테스트 중 "Cannot find module" 에러

```bash
cd workers
rm -rf node_modules
npm install
npm run dev
```

### 문제 4: "No such table" 에러

```bash
# 마이그레이션 다시 실행
wrangler d1 execute wawa-smart-erp --local --file=./migrations/001_init.sql
```

---

## 📝 다음 단계

1. **로컬 테스트** 완료 후 → Phase 4 (데이터 마이그레이션)
2. **데이터 마이그레이션** 완료 후 → Phase 5 (배포)
3. **배포** 완료 후 → Phase 6 (Electron 앱 수정 및 재배포)

---

## 🎯 성공 기준

- [ ] `npm run dev` 실행 시 서버 시작
- [ ] `curl http://localhost:8787/health` 응답 확인
- [ ] Electron 앱에서 Cloudflare API로 로그인 가능
- [ ] 보고서 생성 및 저장 동작 확인
- [ ] 프로덕션 배포 완료

---

**질문이나 막히는 부분이 있으면 언제든지 물어보세요!**
