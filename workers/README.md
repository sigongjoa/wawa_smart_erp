# WAWA Smart ERP - Cloudflare Workers API

Cloudflare Workers 기반 학원 관리 시스템 백엔드 API

## 🚀 빠른 시작

### 1. 의존성 설치

```bash
cd workers
npm install
# 또는
pnpm install
```

### 2. 로컬 개발 서버 실행

```bash
npm run dev
# 또는
pnpm dev
```

서버가 `http://localhost:8787`에서 시작됩니다.

### 3. API 테스트

```bash
# 헬스 체크
curl http://localhost:8787/health

# 로그인 (먼저 사용자 생성 필요)
curl -X POST http://localhost:8787/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'
```

## 📦 프로젝트 구조

```
workers/
├── src/
│   ├── index.ts              # 메인 진입점
│   ├── types/
│   │   └── index.ts          # TypeScript 타입 정의
│   ├── middleware/
│   │   ├── auth.ts           # 인증 미들웨어
│   │   ├── cors.ts           # CORS 미들웨어
│   │   └── rateLimit.ts      # Rate Limiting
│   ├── routes/
│   │   ├── auth.ts           # 인증 API
│   │   ├── timer.ts          # 시간표/출석 API
│   │   ├── grader.ts         # 성적 API
│   │   ├── report.ts         # 보고서 API
│   │   └── student.ts        # 학생 관리 API
│   └── utils/
│       ├── db.ts             # 데이터베이스 헬퍼
│       ├── jwt.ts            # JWT 토큰 관리
│       └── response.ts       # 응답 포맷
├── migrations/
│   └── 001_init.sql          # D1 데이터베이스 스키마
├── wrangler.toml             # Cloudflare 설정
├── package.json              # 의존성
└── tsconfig.json             # TypeScript 설정
```

## 🔑 환경 변수 설정

### 개발 환경 (`.env.local`)

```env
GEMINI_API_KEY=your_gemini_api_key
JWT_SECRET=dev-secret-key
JWT_REFRESH_SECRET=dev-refresh-secret-key
```

### 배포 환경

Cloudflare 대시보드에서 설정:

```bash
wrangler secret put JWT_SECRET
wrangler secret put JWT_REFRESH_SECRET
wrangler secret put GEMINI_API_KEY
```

## 📚 API 엔드포인트

### 인증 (Auth)

```
POST   /api/auth/login        - 로그인
POST   /api/auth/refresh      - 토큰 갱신
POST   /api/auth/logout       - 로그아웃
```

### 시간표 (Timer)

```
GET    /api/timer/classes           - 학급 목록
POST   /api/timer/classes           - 학급 생성
GET    /api/timer/classes/:id       - 학급 상세
PATCH  /api/timer/classes/:id       - 학급 수정
DELETE /api/timer/classes/:id       - 학급 삭제
POST   /api/timer/attendance        - 출석 기록
GET    /api/timer/attendance/:classId/:date - 출석 조회
```

### 성적 (Grader)

```
GET    /api/grader/exams            - 시험 목록
POST   /api/grader/exams            - 시험 생성
POST   /api/grader/grades           - 성적 입력
GET    /api/grader/grades/:studentId - 학생 성적 조회
PATCH  /api/grader/grades/:id       - 성적 수정
```

### 학생 (Student)

```
GET    /api/student                 - 학생 목록
POST   /api/student                 - 학생 추가
GET    /api/student/:id             - 학생 상세
PATCH  /api/student/:id             - 학생 정보 수정
DELETE /api/student/:id             - 학생 삭제
```

### 보고서 (Report)

```
POST   /api/report/generate         - 보고서 생성 (AI)
GET    /api/report/:studentId/:month - 보고서 조회
GET    /api/report/student/:studentId - 보고서 목록
POST   /api/report/:reportId/send   - 카카오톡 전송
```

## 🗄️ 데이터베이스 설정

### D1 데이터베이스 생성

```bash
# 데이터베이스 생성
wrangler d1 create wawa-smart-erp

# 스키마 마이그레이션 적용
wrangler d1 execute wawa-smart-erp --file=./migrations/001_init.sql

# 로컬 테스트
wrangler d1 execute wawa-smart-erp --local --file=./migrations/001_init.sql
```

### 기존 SQLite 데이터 마이그레이션

```bash
# 1. 기존 SQLite 데이터베이스에서 CSV로 내보내기
sqlite3 existing_db.sqlite ".mode csv" ".output students.csv" "SELECT * FROM students;"

# 2. D1로 가져오기
wrangler d1 execute wawa-smart-erp --file=./scripts/import.sql
```

## 🧪 테스트

로컬 개발 중 API 테스트:

```bash
# 1. 개발 서버 실행
npm run dev

# 2. 다른 터미널에서 테스트
curl -X GET http://localhost:8787/health

# 3. Postman 또는 API 클라이언트로 테스트
# 컬렉션 파일: ./postman/wawa-smart-erp.postman_collection.json
```

## 🚀 배포

### Cloudflare에 배포

```bash
# 스테이징 환경으로 배포
wrangler deploy --env development

# 프로덕션 배포
wrangler deploy --env production
```

## 🔐 보안 체크리스트

- [ ] JWT 시크릿 키 설정 (강력한 랜덤 문자열)
- [ ] CORS 오리진 설정 확인
- [ ] 환경 변수 (API 키) 보안 설정
- [ ] SQL Injection 방지 (prepared statements 사용)
- [ ] Rate Limiting 설정 확인
- [ ] HTTPS 강제
- [ ] 감사 로그 활성화

## 📊 모니터링

### Cloudflare 대시보드

```
https://dash.cloudflare.com/workers
```

### 로그 확인

```bash
wrangler tail --env production
```

## 🆘 문제 해결

### 로컬 개발에서 데이터베이스 에러

```bash
# .wrangler 캐시 초기화
rm -rf .wrangler

# 다시 실행
npm run dev
```

### 배포 중 권한 에러

```bash
# Cloudflare 로그인 다시
wrangler login

# 계정 확인
wrangler whoami
```

### CORS 에러

CORS 설정이 `wrangler.toml`에 올바르게 설정되었는지 확인하세요:

```toml
[env.production.vars]
FRONTEND_URL = "https://wawa.app"
```

## 📖 참고 자료

- [Cloudflare Workers 문서](https://developers.cloudflare.com/workers/)
- [D1 데이터베이스](https://developers.cloudflare.com/d1/)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)
- [itty-router](https://itty.dev/)

## 🤝 기여

버그 보고 및 기능 제안은 이슈로 등록해주세요.

## 📝 라이센스

MIT License
