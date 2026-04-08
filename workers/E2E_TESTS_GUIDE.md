# E2E 테스트 가이드

## 현재 상태
- ✅ Playwright E2E 테스트 완전 설정
- ✅ 39개 테스트 케이스 작성 (health, auth, timer, message, file)
- ⏳ 라우팅 아키텍처 이슈로 인해 서버 500 에러 (해결 대기)

## 테스트 실행

```bash
# 전체 E2E 테스트 실행
npm run test:e2e

# UI 모드로 인터랙티브하게 실행
npm run test:e2e:ui

# 디버그 모드
npm run test:e2e:debug

# HTML 리포트 보기
npm run test:e2e:report
```

## 테스트 구조

```
e2e/
├── health.spec.ts         # 헬스체크, CORS 테스트
├── auth.spec.ts           # 로그인, 토큰 갱신, 인증 검증
├── timer.spec.ts          # 학급 관리, 출석 기록
├── message.spec.ts        # 메시지 API (CRUD)
└── file.spec.ts           # 파일 업로드/다운로드/삭제
```

## 테스트 케이스 요약

### Health Check (4 테스트)
- ✅ GET /health → 200 OK
- ✅ ISO timestamp 검증
- ✅ CORS OPTIONS 처리
- ✅ CORS 헤더 포함

### 인증 (7 테스트)
- ❌ 잘못된 이메일 검증 (400 기대, 500 발생)
- ❌ 빠진 비밀번호 검증
- ❌ 존재하지 않는 사용자
- ❌ Missing 인증 헤더 → 401
- ❌ Invalid 토큰 → 401
- ❌ 토큰 갱신 검증
- ✅ Rate Limiting 동작

### Timer API (10 테스트)
- ❌ 학급 목록 조회 (인증 필요)
- ❌ 학급 상세 조회
- ❌ 학급 생성 (강사/관리자만)
- ❌ 학급 수정
- ❌ 출석 기록
- ❌ 출석 조회

### Message API (7 테스트)
- ❌ 메시지 전송 (인증 필요)
- ❌ 메시지 조회 (inbox, sent, conversation)
- ❌ 메시지 읽음 표시
- ❌ 메시지 삭제

### File API (8 테스트)
- ❌ 파일 업로드 (10MB 제한)
- ❌ 파일 다운로드
- ❌ 파일 삭제 (소유권 검증)
- ❌ 파일 목록 조회

## 현재 문제

### 라우팅 아키텍처 이슈
```
Main Router (Router<any>)
  ↓
  router.handle(request, context)
  ↓
Nested Router (timerRouter.handle(...))
  ↓
  ❌ context 전달 실패 → 500 에러
```

### 근본 원인
itty-router의 `handle()` 메서드:
- 첫 번째 인자 (request)만 전달
- 두 번째 인자 (context)가 route handler에 도달하지 않음

## 해결 방법

### 옵션 1: 직접 라우팅 (권장)
```typescript
// src/index.ts
if (pathname.startsWith('/api/timer/')) {
  return await handleTimerRequest(request, context);
}
```

**장점:** 간단, 명확한 제어 흐름
**단점:** 라우트 추가 시 수동 처리

### 옵션 2: Express-like 구현
```typescript
app.get('/api/timer/classes', async (context) => { ... })
```

**장점:** 라우팅 자동화
**단점:** Express 라이브러리 필요

### 옵션 3: itty-router 패치
```typescript
// 중첩 라우터 사용 제거
// 모든 라우트를 메인 라우터에 등록
```

## 다음 단계

1. **라우팅 아키텍처 선택**
   - [ ] 직접 라우팅으로 변경
   - [ ] 또는 Express 라이브러리 추가

2. **route handler 수정**
   - 모든 route handler를 새 아키텍처에 맞게 수정

3. **E2E 테스트 재실행**
   ```bash
   npm run test:e2e
   ```

4. **모든 테스트 Pass 확인**
   ```
   39 passed (✅)
   ```

## 파일 구조

```
src/
├── index.ts              # 메인 라우터 (현재 문제 있음)
├── routes/
│   ├── auth.ts           # 인증 라우터
│   ├── timer.ts          # 학급/출석 라우터
│   ├── message.ts        # 메시지 라우터
│   ├── file.ts           # 파일 라우터
│   └── ... (grader, report, student)
├── middleware/
│   ├── auth.ts           # 인증 검증
│   ├── cors.ts           # CORS 처리
│   └── rateLimit.ts      # Rate limiting
├── schemas/
│   └── validation.ts     # Zod 스키마 (13개)
└── utils/
    ├── logger.ts         # 구조화된 로깅
    ├── secrets.ts        # 환경변수 관리
    └── response.ts       # 응답 포맷

e2e/
├── health.spec.ts
├── auth.spec.ts
├── timer.spec.ts
├── message.spec.ts
└── file.spec.ts
```

## 배포 정보

- **라이브 서버:** https://wawa-smart-erp-api.zeskywa499.workers.dev
- **현재 버전:** 5dcd548a-0f47-4a49-ace8-1d6741815d58
- **상태:** 라우팅 이슈로 인한 500 에러 (API 로직은 정상)

## 참고 자료

- [Playwright 문서](https://playwright.dev/)
- [itty-router GitHub](https://github.com/kwhitley/itty-router)
- [Zod 검증](https://zod.dev/)
- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
