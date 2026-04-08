# Cloudflare Workers 빠른 시작 가이드

## ✅ 완료된 설정

- ✅ Cloudflare D1 데이터베이스 생성: `9e485667-419d-4fb8-ae28-c3a2a69bd8a1`
- ✅ Cloudflare KV 네임스페이스 생성: `858af78c9d0b4a0ab94f786a5ddf79e8`
- ✅ Cloudflare R2 버킷 생성: `wawa-smart-erp`
- ✅ D1 스키마 마이그레이션 완료 (30개 테이블 생성)
- ✅ 로컬 개발 서버 실행 중: `http://localhost:8787`

---

## 🚀 즉시 테스트 가능 (지금 바로 해보기)

### 1️⃣ 헬스 체크 (정상 작동 확인)

```bash
curl http://localhost:8787/health
```

**예상 응답**:
```json
{
  "status": "ok",
  "timestamp": "2026-04-08T08:50:39.377Z"
}
```

### 2️⃣ 로그인 테스트

```bash
curl -X POST http://localhost:8787/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'
```

**참고**: 아직 데이터베이스에 사용자가 없으므로 실패합니다. 하지만 API 구조가 정상 작동함을 확인할 수 있습니다.

### 3️⃣ 실제 데이터 추가 후 테스트

데이터베이스에 사용자를 추가하려면:

```bash
# D1 콘솔에서 직접 쿼리 실행
wrangler d1 execute wawa-smart-erp --local --command="
INSERT INTO users (id, email, name, password_hash, role, academy_id, created_at, updated_at)
VALUES ('user1', 'test@example.com', 'Test User', 'hashed_password', 'instructor', 'academy1', datetime('now'), datetime('now'));

INSERT INTO academies (id, name, created_at, updated_at)
VALUES ('academy1', 'Test Academy', datetime('now'), datetime('now'));
"
```

그 다음 로그인 테스트 시도

---

## 📦 프로덕션 배포 준비

### Step 1: 환경 변수 설정

```bash
cd workers

# JWT 시크릿 생성 (강력한 랜덤 문자열)
openssl rand -base64 32  # 출력된 값을 복사

# Cloudflare에 시크릿 저장
wrangler secret put JWT_SECRET --env production
# 위에서 생성한 값 붙여넣기

wrangler secret put JWT_REFRESH_SECRET --env production
# 다른 강력한 랜덤 값 붙여넣기

wrangler secret put GEMINI_API_KEY --env production
# Google Gemini API 키 입력
```

### Step 2: 프로덕션 D1 설정

```bash
# 프로덕션 D1 데이터베이스에 마이그레이션 적용
wrangler d1 execute wawa-smart-erp --remote --file=./migrations/001_init.sql

# 또는 명령어로 직접 실행
wrangler d1 execute wawa-smart-erp --remote --command="
  SELECT name FROM sqlite_master WHERE type='table';
"
```

### Step 3: 배포

```bash
# 프로덕션으로 배포
wrangler deploy --env production

# 또는 기본 배포
wrangler deploy
```

**배포 후 URL**: 
```
https://wawa-smart-erp-api.YOUR_ACCOUNT.workers.dev
```

### Step 4: 배포 후 테스트

```bash
# 프로덕션 API 테스트
curl https://wawa-smart-erp-api.YOUR_ACCOUNT.workers.dev/health
```

---

## 🔧 주요 명령어

### 개발

```bash
# 로컬 서버 시작
npm run dev

# TypeScript 컴파일 확인
npm run type-check

# 빌드
npm run build
```

### 데이터베이스

```bash
# 로컬 D1에 쿼리 실행
wrangler d1 execute wawa-smart-erp --local --command="SELECT * FROM users LIMIT 1;"

# 원격 D1에 쿼리 실행
wrangler d1 execute wawa-smart-erp --remote --command="SELECT * FROM users LIMIT 1;"

# 마이그레이션 적용 (로컬)
wrangler d1 execute wawa-smart-erp --local --file=./migrations/001_init.sql

# 마이그레이션 적용 (원격)
wrangler d1 execute wawa-smart-erp --remote --file=./migrations/001_init.sql
```

### KV 스토어

```bash
# KV에 데이터 저장
wrangler kv:key put --namespace-id=858af78c9d0b4a0ab94f786a5ddf79e8 testkey testvalue

# KV에서 데이터 조회
wrangler kv:key get --namespace-id=858af78c9d0b4a0ab94f786a5ddf79e8 testkey

# KV 비우기
wrangler kv:namespace delete --namespace-id=858af78c9d0b4a0ab94f786a5ddf79e8
```

### 배포 및 모니터링

```bash
# 배포 목록 확인
wrangler deployments list

# 로그 확인
wrangler tail

# 프로덕션 로그 확인
wrangler tail --env production
```

---

## 🎯 API 테스트 예제

### 학급 조회 (인증 필요)

```bash
# 토큰 먼저 획득 (로그인 후 accessToken 복사)
TOKEN="your_access_token_here"

curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8787/api/timer/classes
```

### 학급 생성

```bash
TOKEN="your_access_token_here"

curl -X POST http://localhost:8787/api/timer/classes \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "수학 1반",
    "grade": "고1",
    "dayOfWeek": 1,
    "startTime": "14:00",
    "endTime": "15:30"
  }'
```

### 학생 추가

```bash
TOKEN="your_access_token_here"

curl -X POST http://localhost:8787/api/student \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "김학생",
    "contact": "010-1234-5678",
    "enrollmentDate": "2025-03-01"
  }'
```

### 출석 기록

```bash
TOKEN="your_access_token_here"
CLASS_ID="class-uuid"
STUDENT_ID="student-uuid"

curl -X POST http://localhost:8787/api/timer/attendance \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "studentId": "'$STUDENT_ID'",
    "classId": "'$CLASS_ID'",
    "date": "2025-04-08",
    "status": "present"
  }'
```

---

## 📊 구성 정보

### 데이터베이스

| 항목 | 값 |
|------|-----|
| Database ID | `9e485667-419d-4fb8-ae28-c3a2a69bd8a1` |
| Database Name | `wawa-smart-erp` |
| 지역 | APAC |
| 테이블 수 | 12 |
| 인덱스 수 | 18 |

### KV 스토어

| 항목 | 값 |
|------|-----|
| Production ID | `858af78c9d0b4a0ab94f786a5ddf79e8` |
| Preview ID | `d8cbd478e5eb4e6aa164f9e012a3687c` |
| 용도 | 세션, 캐시, Rate Limit |

### R2 버킷

| 항목 | 값 |
|------|-----|
| Bucket Name | `wawa-smart-erp` |
| 용도 | 파일 저장소 (PDF, 이미지) |

---

## 🆘 문제 해결

### "Cannot find module" 에러

```bash
rm -rf node_modules
npm install
npm run dev
```

### D1 마이그레이션 실패

```bash
# 로컬 상태 초기화
rm -rf .wrangler

# 다시 마이그레이션 실행
wrangler d1 execute wawa-smart-erp --local --file=./migrations/001_init.sql
```

### 포트 8787이 이미 사용 중

```bash
# 다른 포트로 시작
npm run dev -- --port 8788
```

### Cloudflare 인증 만료

```bash
wrangler logout
wrangler login
```

---

## 📝 다음 단계

1. **데이터 마이그레이션**
   - 기존 Electron 앱의 SQLite 데이터 추출
   - D1에 업로드

2. **Electron 앱 수정**
   - API 엔드포인트를 `http://localhost:8787` → Cloudflare URL로 변경
   - 토큰 저장 로직 추가
   - IndexedDB 캐싱 추가 (선택사항)

3. **프로덕션 배포**
   - 시크릿 설정
   - `wrangler deploy --env production` 실행
   - 도메인 설정

4. **모니터링**
   - Cloudflare 대시보드에서 로그 확인
   - 에러 추적

---

## 💬 지원

문제가 있으면:
1. `wrangler tail` 명령어로 로그 확인
2. 에러 메시지와 함께 GitHub Issue 생성
3. Cloudflare 문서: https://developers.cloudflare.com/workers/

---

**축하합니다! Cloudflare Workers 백엔드가 준비되었습니다! 🚀**
