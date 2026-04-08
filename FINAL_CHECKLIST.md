# 🎯 WAWA Smart ERP - 최종 배포 체크리스트

## ✅ 개발 완료 항목

### 코드 완성
- [x] Electron 완전 제거
- [x] React SPA 웹 기반 앱 전환
- [x] AdminDashboard 컴포넌트 구현
- [x] StudentModal 분리 (별도 컴포넌트)
- [x] 폼 유효성 검사 추가
- [x] 에러 메시지 디스플레이
- [x] 로딩 상태 표시
- [x] 모바일 반응형 디자인
- [x] 접근성 개선 (Focus Trap, ARIA)
- [x] 빌드 성공 ✓

### E2E 테스트
- [x] 10개 유즈케이스 작성 (UC-1 ~ UC-10)
- [x] Playwright 설정 수정
- [x] 테스트 파일 생성 (`admin-live.spec.ts`)
- [ ] 테스트 실행 및 검증 (진행 중)

### 배포 설정
- [x] wrangler.toml (Cloudflare Pages)
- [x] public/_redirects (SPA 라우팅)
- [x] .env.example (환경변수 템플릿)
- [x] GitHub Actions 워크플로우 (.github/workflows/deploy.yml)
- [x] 배포 문서 작성

---

## ⚠️ 배포 전 필수 작업

### GitHub Secrets 설정
```
필수:
[ ] CLOUDFLARE_API_TOKEN  - https://dash.cloudflare.com/profile/api-tokens
[ ] CLOUDFLARE_ACCOUNT_ID - https://dash.cloudflare.com (Account ID 찾기)

선택사항:
[ ] API_BASE_URL          - 백엔드 API 주소
[ ] NOTION_API_KEY        - Notion 인테그레이션
[ ] GEMINI_API_KEY        - Google Gemini API
```

### Cloudflare Pages 프로젝트
```
[ ] Cloudflare 계정 생성 (https://dash.cloudflare.com)
[ ] Pages 프로젝트 생성
[ ] GitHub 연동 설정
  - Repository: wawa_smart_erp
  - Production branch: main
  - Build command: (비워두기)
  - Build output directory: apps/desktop/dist/renderer
[ ] 환경변수 설정 (Cloudflare)
[ ] 커스텀 도메인 연동 (선택)
```

### 백엔드 API 서버
```
[ ] API 서버 구현 (Node.js/Fastify/Express)
[ ] Notion API 래퍼 작성
[ ] CORS 설정
[ ] 환경변수 설정
[ ] 배포 (Vercel, Heroku, EC2, etc.)
```

---

## 🚀 배포 단계

### 1단계: 코드 커밋
```bash
git add .
git commit -m "refactor: Electron 제거 및 Cloudflare Pages 전환

- Electron 관련 코드 및 의존성 제거
- wrangler.toml 및 GitHub Actions 설정 추가
- E2E 테스트 유즈케이스 10개 작성
- 배포 가이드 문서 작성"

git push origin main
```

### 2단계: GitHub Actions 자동 실행
```
GitHub Actions가 자동으로:
1. 코드 체크아웃
2. npm install
3. npm run build
4. wrangler pages deploy
```

### 3단계: 라이브 배포 확인
```
배포 완료 URL:
https://[project-name].pages.dev

또는 커스텀 도메인:
https://app.wawa.com
```

### 4단계: E2E 테스트 실행
```bash
E2E_BASE_URL=https://your-app.pages.dev npm run test:e2e
```

---

## 📋 배포 전 검증

### 로컬 빌드 테스트
```bash
cd apps/desktop
npm run build
# ✓ built in X.XXs (에러 없음)

npm run preview
# 브라우저에서 http://localhost:4173 접속
# 관리자 대시보드 정상 작동 확인
```

### 브라우저 테스트
```
확인 사항:
[ ] 페이지 로드 시간 (5초 이내)
[ ] 학생 관리 탭 작동
[ ] 시스템 설정 탭 작동
[ ] 학생 추가 모달 열림/닫힘
[ ] 필터링 및 검색 정상
[ ] 모바일 반응형 (F12 → 375x667)
[ ] 콘솔 에러 없음
```

### 네트워크 테스트
```
확인 사항:
[ ] API 호출 성공 (Network 탭)
[ ] CORS 에러 없음
[ ] 캐싱 정상 (Cache-Control 헤더)
[ ] 보안 헤더 설정됨
```

---

## 📊 배포 후 모니터링

### 즉시 확인 (배포 후 30분)
```
[ ] 라이브 페이지 접속 가능
[ ] 관리자 대시보드 로드됨
[ ] 탭 전환 정상 작동
[ ] 검색/필터링 정상
[ ] 콘솔 에러 없음
```

### 1시간 모니터링
```
[ ] Cloudflare Analytics 확인
[ ] 성능 지표 정상 (로드 시간 < 5초)
[ ] 에러율 0%
[ ] 방문자 수 정상
```

### 일일 모니터링
```
[ ] Uptime 모니터링 (100%)
[ ] 에러 추적 (Sentry 등)
[ ] 성능 추적 (Web Vitals)
[ ] 사용자 피드백 수집
```

---

## 🎯 배포 후 계획

### 즉시 (배포 후 1일)
- [ ] E2E 테스트 모두 통과 확인
- [ ] 라이브 서버 성능 모니터링
- [ ] 사용자 초대 및 피드백 수집
- [ ] 버그 추적 시스템 설정

### 단기 (1주)
- [ ] 백엔드 API 서버 배포
- [ ] 모니터링 대시보드 구축
- [ ] 사용자 교육 자료 작성
- [ ] 성능 최적화 (필요시)

### 중기 (1개월)
- [ ] 추가 기능 구현 (요청사항)
- [ ] 더 많은 E2E 테스트 추가
- [ ] 보안 감사 (OWASP Top 10)
- [ ] 성능 튜닝 (번들 크기, 로드 시간)

---

## 📞 비상 연락처

### 배포 중 문제 발생
```
1. 로그 확인
   - GitHub Actions: Actions 탭
   - Cloudflare: Pages 프로젝트 → Deployments

2. 문서 확인
   - DEPLOYMENT.md
   - CLOUDFLARE_SETUP.md
   - E2E_TEST_GUIDE.md

3. 롤백
   - Cloudflare Pages에서 이전 배포 선택
   - (자동 롤백 버튼)
```

### 배포 후 문제 해결
```
문제: 페이지 로드 안됨
→ CloudFlare 대시보드 확인
→ DNS 설정 확인
→ GitHub Actions 로그 확인

문제: API 호출 실패
→ 백엔드 API 서버 상태 확인
→ CORS 설정 확인
→ 환경변수 설정 확인

문제: 느린 로딩
→ Cloudflare Analytics 확인
→ 캐싱 설정 확인
→ 번들 크기 확인
```

---

## ✨ 완료 기준

배포 성공 = 다음 모두 만족:

```
✓ GitHub에서 코드 푸시
✓ GitHub Actions 자동 실행
✓ Cloudflare Pages 배포 완료
✓ 라이브 URL에서 앱 접근 가능
✓ 관리자 대시보드 정상 작동
✓ E2E 테스트 모두 통과
✓ 콘솔 에러 없음
✓ 로드 시간 < 5초
```

---

## 📈 성공 지표

배포 후 1주일 이내 목표:

```
로드 타임: < 3초 (LCP)
성공률: > 99.9% (Uptime)
에러율: < 0.1% (Error Rate)
사용자 만족도: > 4.5/5 (NPS)
```

---

**상태:** 🟡 배포 준비 완료, E2E 테스트 진행 중
**예상 배포:** 2026-04-10
**담당자:** DevOps Team
**검토 담당:** QA Team
