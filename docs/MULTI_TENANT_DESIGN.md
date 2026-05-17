# 멀티테넌트 SaaS 설계서

## WAWA Smart ERP — 다중 센터/선생님 지원 아키텍처

---

## 1. 현재 상태 분석

### 이미 갖춰진 것 (강점)
| 항목 | 상태 | 설명 |
|------|------|------|
| `academy_id` FK | ✅ 이미 존재 | `users`, `students`, `classes`, `exams` 등 핵심 테이블에 이미 있음 |
| JWT에 `academyId` | ✅ 포함됨 | 토큰 페이로드에 academy 식별자 포함 |
| `requireAcademy()` | ✅ 미들웨어 존재 | academy 소유권 검증 함수 존재 |
| 역할 기반 접근제어 | ✅ 3단계 | admin / instructor / student |

### 멀티테넌트 전환시 해결해야 할 문제
| 문제 | 심각도 | 설명 |
|------|---------|------|
| 이름 기반 로그인 충돌 | 🔴 Critical | `WHERE name = ?`로 로그인 — 다른 학원에 같은 이름 선생님이 있으면 충돌 |
| 테넌트 격리 미적용 | 🔴 Critical | 대부분의 쿼리에 `AND academy_id = ?` 조건이 빠져있음 |
| 학원 가입 플로우 없음 | 🟡 Major | 현재 하드코딩 `acad-1`만 존재 |
| R2 네임스페이스 미분리 | 🟡 Major | 리포트 PDF 등이 학원별로 구분되지 않음 |
| 슈퍼 어드민 부재 | 🟡 Major | 전체 시스템을 관리할 수 있는 역할 없음 |
| 요금제/결제 없음 | 🟢 Phase 2 | SaaS화하려면 필요하지만 초기엔 후순위 |

---

## 2. 설계 원칙

```
1. 공유 인프라, 논리적 격리  — 하나의 D1 + Worker, academy_id로 데이터 분리
2. 점진적 전환              — 기존 코드를 최소한으로 변경, 마이그레이션 안전
3. 제로 트러스트 쿼리        — 모든 DB 쿼리에 academy_id 필터 자동 적용
4. 자가 서비스 온보딩        — 새 학원이 스스로 가입하고 즉시 사용 가능
```

---

## 3. 아키텍처 개요

```
┌──────────────────────────────────────────────────────────┐
│                    Cloudflare Pages                        │
│           (프론트엔드 - 하나의 빌드, 모든 테넌트)           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                │
│  │ 학원 A    │  │ 학원 B    │  │ 학원 C    │  ...          │
│  │ a.wawa.app│  │ b.wawa.app│  │ c.wawa.app│              │
│  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘              │
│        │              │              │                     │
│        └──────────────┼──────────────┘                     │
└───────────────────────┼──────────────────────────────────┘
                        │ HTTPS
┌───────────────────────┼──────────────────────────────────┐
│              Cloudflare Worker (API)                       │
│  ┌────────────────────┼──────────────────────────┐        │
│  │    Tenant Resolver Middleware                   │        │
│  │    (subdomain → academy_id 매핑)                │        │
│  └────────────────────┼──────────────────────────┘        │
│  ┌────────────────────┼──────────────────────────┐        │
│  │    Academy Scope Middleware                     │        │
│  │    (모든 쿼리에 academy_id 자동 주입)            │        │
│  └────────────────────┼──────────────────────────┘        │
│                       │                                    │
│  ┌────────────┬───────┴────────┬──────────────┐           │
│  │    D1      │     KV         │     R2       │           │
│  │ (데이터)   │ (세션/캐시)     │ (파일저장)    │           │
│  │            │                │              │           │
│  │ academy_id │ academy:{id}:  │ {academy}/   │           │
│  │ 필터링     │ 키 프리픽스     │ 폴더 분리     │           │
│  └────────────┴────────────────┴──────────────┘           │
└──────────────────────────────────────────────────────────┘
```

---

## 4. 데이터베이스 변경사항

### 4.1 새로운 테이블

```sql
-- ============================================
-- 016_multi_tenant.sql
-- ============================================

-- 학원 테이블 확장 (가입/플랜 정보)
ALTER TABLE academies ADD COLUMN slug TEXT UNIQUE;        -- 서브도메인용 (예: "mathplus")
ALTER TABLE academies ADD COLUMN owner_id TEXT;           -- 학원 대표 (최초 가입자)
ALTER TABLE academies ADD COLUMN plan TEXT DEFAULT 'free'; -- free / basic / pro
ALTER TABLE academies ADD COLUMN max_students INTEGER DEFAULT 30;
ALTER TABLE academies ADD COLUMN max_teachers INTEGER DEFAULT 3;
ALTER TABLE academies ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE academies ADD COLUMN logo_url TEXT;
ALTER TABLE academies ADD COLUMN expires_at DATETIME;

CREATE INDEX IF NOT EXISTS idx_academies_slug ON academies(slug);
CREATE INDEX IF NOT EXISTS idx_academies_owner_id ON academies(owner_id);

-- 슈퍼 어드민 테이블 (시스템 전체 관리자)
CREATE TABLE IF NOT EXISTS super_admins (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 학원 가입 초대 코드
CREATE TABLE IF NOT EXISTS invitations (
  id TEXT PRIMARY KEY,
  academy_id TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,           -- 6자리 초대코드
  role TEXT DEFAULT 'instructor',      -- 초대받는 역할
  created_by TEXT NOT NULL,
  used_by TEXT,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (academy_id) REFERENCES academies(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_invitations_code ON invitations(code);
CREATE INDEX IF NOT EXISTS idx_invitations_academy_id ON invitations(academy_id);
```

### 4.2 기존 테이블 변경 없음
- `users`, `students`, `classes` 등에 이미 `academy_id`가 있으므로 스키마 변경 불필요
- 다만 모든 쿼리에 `academy_id` 필터를 추가해야 함

---

## 5. 인증 & 테넌트 식별 재설계

### 5.1 로그인 플로우 변경

**현재**: 이름 + PIN → 전체 users에서 검색 (이름 충돌 위험)

**변경후**: 학원 식별 + 이름 + PIN

```
방법 A: 서브도메인 기반 (권장)
─────────────────────────────
사용자가 mathplus.wawa.app 접속
→ 프론트엔드가 subdomain "mathplus"를 추출
→ 로그인 시 { slug: "mathplus", name: "김선생", pin: "1234" }
→ 서버: WHERE slug='mathplus' → academy_id 확인
       → WHERE name='김선생' AND academy_id='{확인된 id}' → PIN 검증

방법 B: 학원 코드 입력 (서브도메인이 어려운 경우)
─────────────────────────────
로그인 화면에 "학원코드" 필드 추가
→ 사용자가 학원코드 + 이름 + PIN 입력
→ 나머지는 동일
```

### 5.2 JWT 페이로드 (변경 없음)
```typescript
{
  userId: string;
  email: string;       // name으로 변경 검토
  role: 'admin' | 'instructor' | 'student';
  academyId: string;   // ← 이미 있음, 핵심 격리 키
}
```

### 5.3 새로운 미들웨어 스택

```typescript
// 1단계: 테넌트 식별 (모든 요청)
async function tenantResolver(context: RequestContext): Promise<void> {
  // JWT에서 academyId 추출 (인증된 요청)
  // 또는 subdomain/slug에서 추출 (공개 요청)
  const academyId = context.auth?.academyId 
    || await resolveFromSubdomain(context);
  
  if (!academyId) throw new Error('테넌트를 식별할 수 없습니다');
  
  // 학원 활성 상태 확인
  const academy = await getAcademy(context.env.DB, academyId);
  if (!academy?.is_active) throw new Error('비활성화된 학원입니다');
  
  context.tenantId = academyId;
  context.academy = academy;
}

// 2단계: 스코프 적용 (쿼리 헬퍼)
function scopedQuery(baseQuery: string, context: RequestContext): string {
  // 자동으로 academy_id 조건 주입
  // 예: SELECT * FROM students → SELECT * FROM students WHERE academy_id = ?
}
```

---

## 6. API 변경사항

### 6.1 새로운 엔드포인트

```
학원 온보딩 (공개)
──────────────────
POST   /api/onboard/register       새 학원 + 대표 계정 생성
POST   /api/onboard/verify-slug    서브도메인 중복 확인
GET    /api/onboard/plans           요금제 목록 조회

학원 관리 (admin 전용)
──────────────────
GET    /api/academy                학원 정보 조회
PUT    /api/academy                학원 정보 수정
POST   /api/academy/invite         선생님 초대 코드 생성
GET    /api/academy/usage          사용량 조회 (학생수, 선생님수)

초대 수락 (공개)
──────────────────
POST   /api/invite/accept          초대 코드로 선생님 계정 생성

슈퍼 어드민 (시스템 관리)
──────────────────
GET    /api/super/academies        전체 학원 목록
PUT    /api/super/academies/:id    학원 상태 변경 (활성/비활성)
GET    /api/super/stats            전체 시스템 통계
```

### 6.2 기존 엔드포인트 수정 패턴

**모든 핸들러에 적용할 변경:**

```typescript
// Before (현재)
const students = await executeQuery(
  env.DB,
  'SELECT * FROM students WHERE status = ?',
  ['active']
);

// After (멀티테넌트)
const students = await executeQuery(
  env.DB,
  'SELECT * FROM students WHERE academy_id = ? AND status = ?',
  [context.tenantId, 'active']
);
```

**영향받는 핸들러 목록:**
| 핸들러 | 필요한 변경 | 복잡도 |
|--------|------------|--------|
| student-handler.ts | academy_id 필터 추가 | 낮음 |
| timer-handler.ts | academy_id 필터 추가 | 낮음 |
| timer-session-handler.ts | academy_id 필터 추가 | 낮음 |
| grader-handler.ts | academy_id 필터 추가 | 낮음 |
| report-handler.ts | academy_id 필터 + R2 경로 분리 | 중간 |
| teachers-handler.ts | academy_id 필터 추가 | 낮음 |
| board-handler.ts | academy_id 필터 추가 | 낮음 |
| absence-handler.ts | academy_id 필터 추가 | 낮음 |
| materials-handler.ts | academy_id 필터 + R2 경로 분리 | 중간 |
| auth-handler.ts | 로그인 로직 변경 (slug 기반) | 높음 |
| message-handler.ts | academy 내부 메시지만 허용 | 중간 |

---

## 7. 프론트엔드 변경사항

### 7.1 테넌트 인식 로그인 페이지

```
┌─────────────────────────────────────────┐
│         WAWA Smart ERP                   │
│                                          │
│  ┌─── 서브도메인 방식 ─────────────────┐ │
│  │  mathplus.wawa.app                  │ │
│  │  → 자동으로 학원 로고 + 이름 표시     │ │
│  │  → 선생님 이름 드롭다운              │ │
│  │  → PIN 입력                         │ │
│  └──────────────────────────────────────┘ │
│                                          │
│  ┌─── 학원코드 방식 (대안) ────────────┐ │
│  │  [ 학원코드 입력 ] → 학원 확인       │ │
│  │  → 이후 이름 + PIN                  │ │
│  └──────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

### 7.2 변경 파일 목록

```
apps/desktop/src/
├── api.ts              → baseURL에 slug 포함 또는 헤더 추가
├── store.ts            → academy 정보 저장
├── pages/
│   ├── LoginPage.tsx   → 학원 식별 + 로고/이름 표시
│   └── SettingsPage.tsx → 학원 관리 (admin용)
└── App.tsx             → subdomain 파싱 로직 추가
```

### 7.3 랜딩 페이지 (신규)

```
wawa.app (메인 도메인)
──────────────────────
- 서비스 소개
- 요금제 안내
- "무료로 시작하기" → 학원 등록 플로우
- 이미 가입한 학원 → "{학원코드}.wawa.app" 접속 안내
```

---

## 8. R2 스토리지 격리

```
현재: /reports/{report_id}.pdf
변경: /{academy_id}/reports/{report_id}.pdf

현재: /materials/{material_id}
변경: /{academy_id}/materials/{material_id}
```

---

## 9. 요금제 설계

```
┌──────────┬──────────┬──────────┬──────────┐
│          │  Free    │  Basic   │   Pro    │
├──────────┼──────────┼──────────┼──────────┤
│ 학생 수   │ 30명     │ 100명    │ 무제한   │
│ 선생님 수 │ 3명      │ 10명     │ 무제한   │
│ 리포트    │ 5건/월   │ 50건/월  │ 무제한   │
│ AI 채점   │ ✗       │ 50건/월  │ 무제한   │
│ 파일 저장 │ 100MB   │ 1GB     │ 10GB    │
│ 게시판    │ ✓       │ ✓       │ ✓       │
│ 출석 관리 │ ✓       │ ✓       │ ✓       │
│ 메시지    │ ✓       │ ✓       │ ✓       │
│ 커스텀 도메인│ ✗    │ ✗       │ ✓       │
│ 가격/월   │ ₩0     │ ₩29,000 │ ₩79,000 │
└──────────┴──────────┴──────────┴──────────┘
```

### 요금제 적용 미들웨어

```typescript
async function planLimitMiddleware(context: RequestContext): Promise<Response | void> {
  const academy = context.academy;
  
  // 학생 수 제한 체크 (POST /api/student 에서만)
  if (isStudentCreation(context)) {
    const count = await getStudentCount(context.env.DB, academy.id);
    if (count >= academy.max_students) {
      return errorResponse(
        `현재 요금제(${academy.plan})의 학생 수 제한(${academy.max_students}명)에 도달했습니다`,
        403
      );
    }
  }
  // ... 다른 제한 체크
}
```

---

## 10. 구현 로드맵

### Phase 1: 핵심 멀티테넌트 (2~3주)
> 목표: 다른 학원이 안전하게 데이터를 분리해서 사용할 수 있는 상태

```
Week 1 — 기반 작업
├── [P1-1] DB 마이그레이션 (academies 확장, invitations 테이블)
├── [P1-2] 테넌트 스코프 미들웨어 구현
├── [P1-3] 로그인 플로우 변경 (slug 기반 학원 식별)
└── [P1-4] 모든 핸들러에 academy_id 필터 추가

Week 2 — 온보딩 & 관리
├── [P1-5] 학원 등록 API (POST /api/onboard/register)
├── [P1-6] 선생님 초대 API (POST /api/academy/invite)
├── [P1-7] 프론트엔드 로그인 페이지 수정
└── [P1-8] 학원 설정 페이지 (이름, 로고, 선생님 관리)

Week 3 — 테스트 & 안정화
├── [P1-9] 데이터 격리 E2E 테스트
├── [P1-10] 기존 학원(acad-1) 마이그레이션
└── [P1-11] R2 스토리지 경로 분리
```

### Phase 2: SaaS 기능 (2주)
> 목표: 랜딩 페이지, 요금제, 사용량 추적

```
├── [P2-1] 랜딩 페이지 (wawa.app)
├── [P2-2] 요금제 & 사용량 제한 미들웨어
├── [P2-3] 슈퍼 어드민 대시보드
└── [P2-4] 학원별 사용량 통계 API
```

### Phase 3: 성장 (장기)
> 목표: 결제, 커스텀 도메인, 확장

```
├── [P3-1] 결제 연동 (토스페이먼츠 / 아임포트)
├── [P3-2] 커스텀 도메인 지원
├── [P3-3] D1 샤딩 전략 (학원 수 증가 대비)
└── [P3-4] 학원간 벤치마크/통계 (익명화)
```

---

## 11. 보안 체크리스트

```
✅ 인증 단계
 □ 로그인 시 academy_id 스코프 적용 (이름 충돌 방지)
 □ JWT에 academyId 포함 (이미 됨)
 □ refresh token도 academy 스코프 검증

✅ 데이터 격리
 □ 모든 SELECT에 academy_id WHERE 조건
 □ 모든 INSERT에 academy_id 값 주입
 □ UPDATE/DELETE 시 academy_id 소유권 검증
 □ JOIN 쿼리에서도 양쪽 테이블 academy_id 일치 확인

✅ API 격리
 □ 학생 조회/수정 시 해당 학원 소속인지 확인
 □ 메시지는 같은 학원 내부만 가능
 □ 리포트/파일 접근 시 학원 소유 확인

✅ 스토리지 격리
 □ R2 경로에 academy_id 프리픽스
 □ KV 키에 academy_id 프리픽스

✅ 운영
 □ 슈퍼 어드민과 학원 admin 권한 분리
 □ 학원 비활성화 시 데이터 접근 차단 (삭제 아님)
 □ 감사 로그에 academy_id 포함
```

---

## 12. 핵심 코드 변경 예시

### 12.1 학원 등록 API

```typescript
// workers/src/routes/onboard-handler.ts

export async function handleOnboard(
  method: string, pathname: string,
  request: Request, context: RequestContext
): Promise<Response> {

  // POST /api/onboard/register
  if (method === 'POST' && pathname === '/api/onboard/register') {
    const { academyName, slug, ownerName, pin } = 
      RegisterSchema.parse(await request.json());

    // slug 중복 확인
    const existing = await executeFirst(
      context.env.DB,
      'SELECT id FROM academies WHERE slug = ?', [slug]
    );
    if (existing) return errorResponse('이미 사용 중인 학원코드입니다', 409);

    // 학원 생성
    const academyId = `acad-${crypto.randomUUID().slice(0,8)}`;
    await executeUpdate(context.env.DB,
      `INSERT INTO academies (id, name, slug, plan, max_students, max_teachers, is_active)
       VALUES (?, ?, ?, 'free', 30, 3, TRUE)`,
      [academyId, academyName, slug]
    );

    // 기본 "전체" 클래스 생성
    const classId = `class-default-${academyId}`;
    await executeUpdate(context.env.DB,
      `INSERT INTO classes (id, academy_id, name) VALUES (?, ?, '전체')`,
      [classId, academyId]
    );
    await executeUpdate(context.env.DB,
      `UPDATE academies SET default_class_id = ?, owner_id = ? WHERE id = ?`,
      [classId, `user-owner-${academyId}`, academyId]
    );

    // 대표 계정 (admin) 생성
    const userId = `user-owner-${academyId}`;
    const hashedPin = await hashPinPbkdf2(pin);
    await executeUpdate(context.env.DB,
      `INSERT INTO users (id, email, name, password_hash, role, academy_id)
       VALUES (?, ?, ?, ?, 'admin', ?)`,
      [userId, `${slug}@wawa.app`, ownerName, hashedPin, academyId]
    );

    return successResponse({ academyId, slug, message: '학원이 생성되었습니다' }, 201);
  }
}
```

### 12.2 테넌트 스코프 미들웨어

```typescript
// workers/src/middleware/tenant.ts

export async function tenantMiddleware(
  context: RequestContext
): Promise<RequestContext | Response> {
  const academyId = context.auth?.academyId;
  
  if (!academyId) {
    return errorResponse('학원 정보가 없습니다', 403);
  }

  // 학원 활성 상태 + 플랜 정보 캐시 (KV, 5분 TTL)
  const cacheKey = `academy:${academyId}:info`;
  let academy = await context.env.KV.get(cacheKey, 'json');
  
  if (!academy) {
    academy = await executeFirst(
      context.env.DB,
      'SELECT * FROM academies WHERE id = ? AND is_active = TRUE',
      [academyId]
    );
    if (academy) {
      await context.env.KV.put(cacheKey, JSON.stringify(academy), { expirationTtl: 300 });
    }
  }

  if (!academy) {
    return errorResponse('비활성화된 학원이거나 존재하지 않습니다', 403);
  }

  context.tenantId = academyId;
  context.academy = academy;
  return context;
}
```

### 12.3 로그인 변경 (slug 기반)

```typescript
// auth-handler.ts 변경

const TeacherLoginSchema = z.object({
  slug: z.string().min(1, '학원코드는 필수입니다'),  // 추가
  name: z.string().min(1, '이름은 필수입니다'),
  pin: z.string().min(4, 'PIN은 최소 4자 이상이어야 합니다'),
});

// 로그인 쿼리 변경
const user = await executeFirst<any>(
  context.env.DB,
  `SELECT u.id, u.email, u.name, u.role, u.academy_id, u.password_hash
   FROM users u
   JOIN academies a ON u.academy_id = a.id
   WHERE u.name = ? AND a.slug = ? AND a.is_active = TRUE
   LIMIT 1`,
  [name, slug]
);
```

---

## 13. 데이터 마이그레이션 전략

### 기존 학원 (acad-1) 처리

```sql
-- 기존 학원에 slug 부여
UPDATE academies SET slug = 'wawa', owner_id = (
  SELECT id FROM users WHERE academy_id = 'acad-1' AND role = 'admin' LIMIT 1
) WHERE id = 'acad-1';

-- R2 파일 경로 마이그레이션은 점진적으로
-- 기존 경로(/reports/...) 접근 시 새 경로(/acad-1/reports/...)로 fallback
```

---

## 14. 확장성 고려사항

### D1 제한 및 대응
| 제한 | 값 | 대응 |
|------|-----|------|
| DB 크기 | 10GB | 학원 100개 이상 시 DB 샤딩 검토 |
| 읽기 성능 | 글로벌 복제 | 이미 최적화됨 (Cloudflare 엣지) |
| 쓰기 성능 | 단일 리더 | 대부분 읽기 위주이므로 충분 |
| 동시 연결 | 충분 | Worker 당 요청 격리로 문제없음 |

### 학원 수 증가에 따른 단계적 전략
```
~50개 학원  : 단일 D1, 단일 Worker (현재 설계)
~200개 학원 : D1 읽기 복제 활용, KV 캐싱 강화
~500개 학원 : 지역별 D1 분리 검토 (한국 내이므로 불필요할 수 있음)
~1000개+   : 학원 그룹별 D1 샤딩, 또는 Turso/PlanetScale 마이그레이션
```

---

## 요약

| 항목 | 방식 |
|------|------|
| **테넌트 식별** | 서브도메인 (`{slug}.wawa.app`) + JWT `academyId` |
| **데이터 격리** | 공유 DB + `academy_id` 필터 (논리적 격리) |
| **인증** | 학원코드(slug) + 이름 + PIN |
| **온보딩** | 자가 서비스 등록 → 즉시 사용 |
| **초대** | admin이 초대코드 생성 → 선생님이 코드로 가입 |
| **요금제** | free/basic/pro 3단계 |
| **저장소** | R2 `{academy_id}/` 프리픽스로 분리 |
| **기존 데이터** | `acad-1`에 slug 부여, 무중단 마이그레이션 |
