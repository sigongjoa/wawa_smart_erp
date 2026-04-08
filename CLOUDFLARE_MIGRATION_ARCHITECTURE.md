# Cloudflare 마이그레이션 아키텍처 설계

## 1. 현황 분석

### 기존 시스템
- **프론트엔드**: Electron (React + TypeScript)
- **백엔드**: Electron Main Process
- **데이터 저장소**: 로컬 SQLite 또는 파일 시스템
- **AI 서비스**: Google Generative AI (Gemini)
- **외부 통합**: Kakao API, Cloudinary, Notion API

### 핵심 모듈
1. **Timer**: 학원 시간표 및 출석 관리
2. **Grader**: 채점 및 성적 관리
3. **Report**: AI 기반 보고서 자동 생성
4. **Makeup**: 보충 수업 관리
5. **DM**: 실시간 메시징 및 알림
6. **Skills**: AI 기반 자동화 기능

---

## 2. Cloudflare 마이그레이션 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                    클라이언트 계층                            │
├─────────────────────────────────────────────────────────────┤
│ Electron App (React)                                         │
│ - 로컬 캐싱 (IndexedDB)                                      │
│ - 오프라인 지원                                              │
│ - REST API 클라이언트                                       │
└─────────────────────────────────────────────────────────────┘
                            ↓ HTTPS
┌─────────────────────────────────────────────────────────────┐
│                  Cloudflare Edge 네트워크                     │
├─────────────────────────────────────────────────────────────┤
│ Cloudflare Workers                                          │
│ - API Gateway / Authentication                              │
│ - Request Routing & Validation                              │
│ - Rate Limiting & DDoS Protection                           │
│ - CORS & Security Headers                                   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                   백엔드 서비스 계층                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────┐  ┌──────────────────┐               │
│  │ Auth Workers     │  │ Core API Workers │               │
│  │ - JWT생성/검증   │  │ - Timer          │               │
│  │ - Refresh Token  │  │ - Grader         │               │
│  │ - Session Mgmt   │  │ - Report         │               │
│  │ - OAuth Integration│ │ - Makeup         │               │
│  └──────────────────┘  │ - Student        │               │
│                        └──────────────────┘               │
│                                                              │
│  ┌──────────────────┐  ┌──────────────────┐               │
│  │ AI Workers       │  │ Integration      │               │
│  │ - Google Gemini  │  │ - Kakao API      │               │
│  │ - Cloudflare AI  │  │ - Cloudinary     │               │
│  │ - Prompt Cache   │  │ - Notion API     │               │
│  └──────────────────┘  └──────────────────┘               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                   데이터 & 스토리지 계층                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────┐  ┌──────────────────┐               │
│  │ Cloudflare D1    │  │ Cloudflare R2    │               │
│  │ (SQLite DB)      │  │ (파일 저장소)     │               │
│  │ - Users          │  │ - 보고서 PDF     │               │
│  │ - Classes        │  │ - 이미지         │               │
│  │ - Grades         │  │ - 문서           │               │
│  │ - Attendance     │  │ - 아카이브       │               │
│  │ - Reports        │  └──────────────────┘               │
│  └──────────────────┘                                     │
│                                                              │
│  ┌──────────────────┐  ┌──────────────────┐               │
│  │ Cloudflare KV    │  │ Analytics        │               │
│  │ (캐시/세션)      │  │ (Logpush)        │               │
│  │ - Auth Tokens    │  │ - Monitoring     │               │
│  │ - Session Data   │  │ - Audit Log      │               │
│  │ - Rate Limit     │  │ - Performance    │               │
│  │ - Cache          │  └──────────────────┘               │
│  └──────────────────┘                                     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. 아키텍처 컴포넌트 상세설계

### 3.1 API Gateway Worker

```typescript
// src/workers/api-gateway.ts
import { Router } from 'itty-router';
import { corsHeaders, authenticate, rateLimit } from '@/middleware';

const router = Router();

// 미들웨어 적용
router.use('*', rateLimit);
router.use('*', authenticate);
router.use('*', cors);

// API 라우팅
router.post('/api/auth/login', handleLogin);
router.post('/api/auth/refresh', handleRefresh);
router.post('/api/auth/logout', handleLogout);

// 각 모듈별 라우팅
router.route('/api/timer/*', timerRouter);
router.route('/api/grader/*', graderRouter);
router.route('/api/report/*', reportRouter);
router.route('/api/makeup/*', makeupRouter);
router.route('/api/student/*', studentRouter);

export default {
  fetch: (request) => router.handle(request),
};
```

### 3.2 데이터베이스 스키마 (D1)

```sql
-- Users & Authentication
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'instructor', -- instructor, admin, student
  academy_id TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (academy_id) REFERENCES academies(id)
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  refresh_token TEXT NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Core Data
CREATE TABLE classes (
  id TEXT PRIMARY KEY,
  academy_id TEXT NOT NULL,
  name TEXT NOT NULL,
  grade TEXT,
  day_of_week INTEGER,
  start_time TEXT,
  end_time TEXT,
  instructor_id TEXT,
  capacity INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (academy_id) REFERENCES academies(id),
  FOREIGN KEY (instructor_id) REFERENCES users(id)
);

CREATE TABLE students (
  id TEXT PRIMARY KEY,
  academy_id TEXT NOT NULL,
  name TEXT NOT NULL,
  class_id TEXT,
  contact TEXT,
  guardian_contact TEXT,
  enrollment_date DATE,
  status TEXT DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (academy_id) REFERENCES academies(id),
  FOREIGN KEY (class_id) REFERENCES classes(id)
);

CREATE TABLE attendance (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  class_id TEXT NOT NULL,
  date DATE NOT NULL,
  status TEXT DEFAULT 'present', -- present, absent, late, makeup
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id),
  FOREIGN KEY (class_id) REFERENCES classes(id),
  UNIQUE(student_id, class_id, date)
);

CREATE TABLE grades (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  exam_id TEXT NOT NULL,
  score REAL,
  comments TEXT,
  graded_at DATETIME,
  graded_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id),
  FOREIGN KEY (exam_id) REFERENCES exams(id),
  FOREIGN KEY (graded_by) REFERENCES users(id)
);

CREATE TABLE exams (
  id TEXT PRIMARY KEY,
  academy_id TEXT NOT NULL,
  class_id TEXT NOT NULL,
  name TEXT NOT NULL,
  date DATE NOT NULL,
  total_score REAL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (academy_id) REFERENCES academies(id),
  FOREIGN KEY (class_id) REFERENCES classes(id)
);

CREATE TABLE reports (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  month TEXT NOT NULL,
  content TEXT,
  pdf_url TEXT,
  generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  sent_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id)
);

CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  sender_id TEXT NOT NULL,
  recipient_id TEXT NOT NULL,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sender_id) REFERENCES users(id),
  FOREIGN KEY (recipient_id) REFERENCES users(id)
);

CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  changes TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 인덱스
CREATE INDEX idx_users_academy_id ON users(academy_id);
CREATE INDEX idx_classes_academy_id ON classes(academy_id);
CREATE INDEX idx_students_academy_id ON students(academy_id);
CREATE INDEX idx_attendance_student_id ON attendance(student_id);
CREATE INDEX idx_grades_student_id ON grades(student_id);
CREATE INDEX idx_reports_student_id ON reports(student_id);
CREATE INDEX idx_messages_sender_id ON messages(sender_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
```

### 3.3 인증 시스템

```typescript
// src/workers/auth.ts
import { sign, verify } from '@tsndr/cloudflare_workers_jwt';

interface AuthPayload {
  userId: string;
  email: string;
  role: string;
  academyId: string;
  iat: number;
  exp: number;
}

export const generateTokens = async (
  userId: string,
  email: string,
  role: string,
  academyId: string,
  env: Env
) => {
  const now = Math.floor(Date.now() / 1000);
  
  const accessToken = await sign(
    {
      userId,
      email,
      role,
      academyId,
      iat: now,
      exp: now + 3600, // 1시간
    },
    env.JWT_SECRET
  );

  const refreshTokenId = crypto.randomUUID();
  const refreshToken = await sign(
    {
      tokenId: refreshTokenId,
      userId,
      iat: now,
      exp: now + 86400 * 30, // 30일
    },
    env.JWT_REFRESH_SECRET
  );

  // 리프레시 토큰을 D1에 저장
  await env.DB.prepare(
    `INSERT INTO sessions (id, user_id, refresh_token, expires_at)
     VALUES (?, ?, ?, ?)`
  ).bind(
    refreshTokenId,
    userId,
    refreshToken,
    new Date(now * 1000 + 86400 * 30 * 1000)
  ).run();

  return { accessToken, refreshToken };
};

export const handleLogin = async (request: Request, env: Env) => {
  const { email, password } = await request.json();

  // 사용자 조회 및 암호 검증
  const user = await env.DB.prepare(
    'SELECT * FROM users WHERE email = ?'
  ).bind(email).first();

  if (!user) {
    return new Response('Invalid credentials', { status: 401 });
  }

  // 토큰 생성
  const { accessToken, refreshToken } = await generateTokens(
    user.id,
    user.email,
    user.role,
    user.academy_id,
    env
  );

  return new Response(
    JSON.stringify({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    }),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );
};

export const authenticate = async (request: Request, env: Env) => {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response('Unauthorized', { status: 401 });
  }

  const token = authHeader.slice(7);
  try {
    const payload = await verify(token, env.JWT_SECRET) as AuthPayload;
    // 요청 컨텍스트에 저장
    (request as any).auth = payload;
  } catch (error) {
    return new Response('Invalid token', { status: 401 });
  }
};
```

### 3.4 AI 통합 Worker

```typescript
// src/workers/ai-service.ts
import { Anthropic } from '@anthropic-ai/sdk';

export const generateReport = async (
  studentId: string,
  month: string,
  env: Env
): Promise<string> => {
  // 학생 데이터 조회
  const studentData = await env.DB.prepare(
    `SELECT s.*, a.attendance, g.grades FROM students s
     LEFT JOIN attendance a ON s.id = a.student_id
     LEFT JOIN grades g ON s.id = g.student_id
     WHERE s.id = ?`
  ).bind(studentId).all();

  // Prompt Caching을 활용한 AI 기반 보고서 생성
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2000,
      system: [
        {
          type: 'text',
          text: '당신은 학원 보고서 작성 전문가입니다. 학생의 학습 성과를 분석하고 부모님께 전달할 긍정적이고 구체적인 보고서를 작성합니다.',
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        {
          role: 'user',
          content: `다음 학생의 ${month}월 학습 현황을 바탕으로 부모님께 드릴 수 있는 수준의 보고서를 작성해주세요.
          
학생명: ${studentData.name}
출석현황: ${studentData.attendance}
성적: ${studentData.grades}

다음 포맷으로 작성해주세요:
1. 출석 현황 및 학습 태도
2. 이번 달 학습 성과
3. 개선할 점 및 피드백
4. 다음 달 학습 목표`,
        },
      ],
    }),
  });

  const data = await response.json();
  return data.content[0].text;
};

// Cloudflare AI 대안
export const generateReportWithCloudflareAI = async (
  studentData: any,
  env: Env
): Promise<string> => {
  const response = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
    prompt: `학생 ${studentData.name}의 ${studentData.month}월 보고서를 작성하세요.
    
출석: ${studentData.attendance}
성적: ${studentData.grades}`,
  });

  return response.response;
};
```

### 3.5 캐싱 전략 (Cloudflare Cache + KV)

```typescript
// src/workers/cache-middleware.ts
export const cacheMiddleware = async (
  request: Request,
  env: Env
): Promise<Response | null> => {
  const cacheKey = new Request(request.url, { method: 'GET' });
  const cache = caches.default;

  // 캐시 조회
  let response = await cache.match(cacheKey);
  if (response) {
    return response;
  }

  // KV에서 조회
  const kvKey = `cache:${request.url}`;
  const kvData = await env.CACHE_KV.get(kvKey);
  if (kvData) {
    return new Response(kvData, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'max-age=300',
      },
    });
  }

  return null;
};

export const setCacheHeaders = (response: Response, ttl: number = 300) => {
  const newResponse = new Response(response.body, response);
  newResponse.headers.set('Cache-Control', `max-age=${ttl}, s-maxage=${ttl}`);
  return newResponse;
};

export const invalidateCache = async (pattern: string, env: Env) => {
  // KV의 관련 키 삭제
  const keys = await env.CACHE_KV.list({ prefix: pattern });
  for (const key of keys.keys) {
    await env.CACHE_KV.delete(key.name);
  }

  // Cloudflare 캐시 삭제 API 호출
  await fetch('https://api.cloudflare.com/client/v4/zones/{zoneId}/purge_cache', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Auth-Key': env.CLOUDFLARE_API_KEY,
      'X-Auth-Email': env.CLOUDFLARE_EMAIL,
    },
    body: JSON.stringify({
      files: [pattern],
    }),
  });
};
```

### 3.6 파일 저장소 (R2)

```typescript
// src/workers/file-service.ts
export const uploadFile = async (
  file: File,
  folder: string,
  env: Env
): Promise<string> => {
  const key = `${folder}/${crypto.randomUUID()}-${file.name}`;
  
  await env.BUCKET.put(key, file.stream(), {
    httpMetadata: {
      contentType: file.type,
    },
  });

  return `${env.R2_PUBLIC_URL}/${key}`;
};

export const generatePresignedUrl = async (
  key: string,
  expiresIn: number = 3600,
  env: Env
): Promise<string> => {
  const url = new URL(`${env.R2_ENDPOINT}/${key}`);
  
  // AWS Signature v4로 서명된 URL 생성
  const signature = await signRequest(url, expiresIn, env);
  
  return url.toString();
};

export const deleteFile = async (key: string, env: Env) => {
  await env.BUCKET.delete(key);
};
```

---

## 4. 마이그레이션 경로

### Phase 1: 준비 및 설계 (2주)
- [ ] Cloudflare Workers 프로젝트 초기화
- [ ] 데이터베이스 스키마 정의 및 생성
- [ ] 개발 환경 설정 (wrangler.toml)
- [ ] API 명세 문서 작성

### Phase 2: 백엔드 API 구현 (3주)
- [ ] 인증 시스템 (로그인, 토큰 관리)
- [ ] 핵심 모듈 API 구현
  - Timer API (학급, 시간표, 출석)
  - Grader API (시험, 성적)
  - Student API (학생 관리)
- [ ] 파일 업로드 시스템 (R2)
- [ ] 에러 처리 및 로깅

### Phase 3: AI 및 통합 구현 (2주)
- [ ] Report API (AI 기반 보고서 생성)
- [ ] Makeup API (보충 수업 관리)
- [ ] 외부 API 통합 (Kakao, Cloudinary, Notion)
- [ ] 메시징 시스템

### Phase 4: 프론트엔드 마이그레이션 (2주)
- [ ] API 클라이언트 업데이트
- [ ] 로컬 저장소 제거
- [ ] 환경 변수 설정
- [ ] API 엔드포인트 변경

### Phase 5: 테스트 및 최적화 (1주)
- [ ] 통합 테스트
- [ ] 성능 최적화 (캐싱, CDN)
- [ ] 보안 감사
- [ ] 부하 테스트

### Phase 6: 배포 및 모니터링 (1주)
- [ ] 프로덕션 배포
- [ ] 데이터 마이그레이션
- [ ] 모니터링 설정
- [ ] 롤백 계획

---

## 5. 주요 기술 결정

### 5.1 데이터베이스 선택: D1 (SQLite)
**장점**:
- 낮은 지연시간 (edge location에서 실행)
- SQL 기반으로 기존 쿼리 재사용 가능
- 자동 백업 및 복제
- 비용 효율적

**단점**:
- 읽기 전용 레플리카로 스케일링
- 대용량 병렬 쓰기 제한

### 5.2 AI 서비스: 이중 전략
**주전략**: Claude 3.5 Sonnet (Anthropic API)
- Prompt Caching으로 비용 절감
- 한국어 지원 우수
- 더 나은 품질

**대체책**: Cloudflare AI
- 추가 비용 없음
- 낮은 지연시간
- 모델 선택 제한

### 5.3 인증: JWT + Refresh Token
```typescript
AccessToken: 1시간 유효성
RefreshToken: 30일 유효성 (DB에 저장)
토큰 로테이션: 보안 향상
```

### 5.4 캐싱 계층
1. **Cloudflare Cache**: 정적 자산, 자주 변경 안 하는 데이터
2. **KV Store**: 세션, 임시 데이터
3. **Browser Cache**: 클라이언트 측 캐시

---

## 6. 보안 고려사항

### 6.1 전송 계층 보안
- HTTPS 필수 (기본으로 적용)
- HSTS 헤더 설정
- TLS 1.3 이상

### 6.2 인증 & 인가
- JWT 토큰 검증
- CORS 정책 설정
- Rate Limiting (IP당 요청 제한)

### 6.3 데이터 보안
- 민감한 데이터 암호화
- SQL Injection 방지 (prepared statements)
- XSS 방지 (Content-Type 설정)

### 6.4 감사 및 모니터링
- 모든 API 요청 로깅
- 관리자 활동 감사
- 비정상 활동 감지

---

## 7. 환경 설정 (wrangler.toml)

```toml
name = "wawa-smart-erp-api"
main = "src/index.ts"
compatibility_date = "2025-04-08"

[env.production]
routes = [
  { pattern = "api.wawa.app/*", zone_name = "wawa.app" }
]

[[d1_databases]]
binding = "DB"
database_name = "wawa-smart-erp"
database_id = "YOUR_DATABASE_ID"

[[kv_namespaces]]
binding = "CACHE_KV"
id = "YOUR_KV_NAMESPACE_ID"

[[r2_buckets]]
binding = "BUCKET"
bucket_name = "wawa-smart-erp-files"
jurisdiction = "eu"

[env.production.vars]
ENVIRONMENT = "production"
API_URL = "https://api.wawa.app"
R2_PUBLIC_URL = "https://files.wawa.app"

[env.production.secrets]
JWT_SECRET = "YOUR_JWT_SECRET"
JWT_REFRESH_SECRET = "YOUR_REFRESH_SECRET"
ANTHROPIC_API_KEY = "YOUR_ANTHROPIC_KEY"
CLOUDFLARE_API_KEY = "YOUR_CF_API_KEY"

[[migrations]]
tag = "v1"
new = true
```

---

## 8. API 엔드포인트 스펙

### 인증
```
POST   /api/auth/login           - 로그인
POST   /api/auth/refresh         - 토큰 갱신
POST   /api/auth/logout          - 로그아웃
```

### 학급 & 시간표
```
GET    /api/timer/classes        - 학급 목록
POST   /api/timer/classes        - 학급 생성
GET    /api/timer/classes/:id    - 학급 상세
PATCH  /api/timer/classes/:id    - 학급 수정
DELETE /api/timer/classes/:id    - 학급 삭제

GET    /api/timer/attendance     - 출석 목록
POST   /api/timer/attendance     - 출석 기록
```

### 성적 & 평가
```
GET    /api/grader/exams         - 시험 목록
POST   /api/grader/exams         - 시험 생성
GET    /api/grader/grades        - 성적 목록
POST   /api/grader/grades        - 성적 입력
PATCH  /api/grader/grades/:id    - 성적 수정
```

### 보고서
```
GET    /api/report/:studentId    - 보고서 조회
POST   /api/report/generate      - 보고서 생성 (AI)
POST   /api/report/send          - 카카오톡 전송
GET    /api/report/pdf/:id       - PDF 다운로드
```

---

## 9. 트래픽 및 비용 예상

### 월간 트래픽 (소규모 학원 기준)
- 동시 사용자: 50-100명
- 일일 API 요청: 10,000-50,000건
- 월간 스토리지: 10-50GB

### 예상 비용 (월별, USD)
| 서비스 | 비용 |
|--------|------|
| Workers | $5-50 |
| D1 (SQLite) | $0.75-5 |
| R2 (스토리지) | $0.015/GB |
| R2 (전송) | $0.02/GB |
| KV | $0-5 |
| Anthropic API | $5-100 |
| **합계** | **$10-160/월** |

---

## 10. 롤백 계획

### 배포 전 체크리스트
- [ ] 전체 데이터 백업
- [ ] 로컬 환경에서 전체 테스트
- [ ] Staging 환경에서 1주 테스트
- [ ] 롤백 스크립트 준비

### 롤백 절차
1. Cloudflare 라우팅 변경 (이전 서버로)
2. 데이터 일관성 확인
3. 클라이언트 캐시 무효화
4. 모니터링 강화

---

## 참고 자료

- [Cloudflare Workers 문서](https://developers.cloudflare.com/workers/)
- [D1 데이터베이스](https://developers.cloudflare.com/d1/)
- [R2 객체 저장소](https://developers.cloudflare.com/r2/)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)
