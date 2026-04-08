# WAWA Smart ERP - Cloudflare Pages 배포 가이드

## 📋 개요

WAWA Smart ERP는 이제 **Cloudflare Pages**에서 호스팅되는 완전한 웹 애플리케이션입니다.

## 🚀 로컬 개발

### 1단계: 환경 설정

```bash
cd apps/desktop

# .env.example을 .env.local로 복사
cp .env.example .env.local

# .env.local 수정 (API 서버 주소 등)
```

### 2단계: 개발 서버 실행

```bash
npm run dev
# http://localhost:5173에서 앱 실행
```

## 🌍 배포

### 옵션 1: GitHub Actions 자동 배포 (권장)

**필수 환경변수 설정:**
1. GitHub 리포 → Settings → Secrets and variables → Actions
2. 다음 변수 추가:
   - `CLOUDFLARE_API_TOKEN`: Cloudflare API 토큰
   - `CLOUDFLARE_ACCOUNT_ID`: Cloudflare 계정 ID
   - `API_BASE_URL`: 백엔드 API 주소 (선택사항)
   - `NOTION_API_KEY`: Notion API 키 (선택사항)
   - `GEMINI_API_KEY`: Google Gemini API 키 (선택사항)

**배포 방법:**
```bash
git push origin main
# GitHub Actions가 자동으로 빌드 및 배포
```

### 옵션 2: 수동 배포

```bash
# 1. 빌드
npm run build

# 2. Cloudflare에 배포
npm run deploy
# 또는
npx wrangler pages deploy dist/renderer
```

## 🔧 환경 변수

### 프로덕션 (Cloudflare Pages)

Cloudflare 대시보드에서 환경변수 설정:
```
VITE_API_BASE_URL=https://api.your-domain.com
VITE_NOTION_API_KEY=***
VITE_GEMINI_API_KEY=***
```

### 로컬 개발 (.env.local)

```
VITE_API_BASE_URL=http://localhost:3000/api
VITE_NOTION_API_KEY=***
VITE_GEMINI_API_KEY=***
```

## 📦 빌드 및 배포 확인

```bash
# 로컬에서 프로덕션 빌드 미리 보기
npm run build
npm run preview
# http://localhost:4173에서 확인
```

## 🔐 보안 체크리스트

- [ ] API 키가 환경변수에 저장되어 있는가?
- [ ] `.env.local`이 `.gitignore`에 추가되어 있는가?
- [ ] CORS가 백엔드에서 올바르게 설정되어 있는가?
- [ ] HTTPS만 사용 중인가?

## 📱 도메인 설정

Cloudflare에서 커스텀 도메인 설정:

1. Cloudflare 대시보 → Pages
2. 프로젝트 선택 → Settings → Domains
3. 커스텀 도메인 추가 (예: app.wawa.com)

## 🧪 E2E 테스트

```bash
# 라이브 서버로 테스트
E2E_BASE_URL=https://app.wawa.pages.dev npm run test:e2e

# 로컬 프리뷰로 테스트
npm run test:e2e
```

## 🛠️ 문제 해결

### 배포 실패

```bash
# 로그 확인
npx wrangler pages deployment list

# 상세 로그 보기
wrangler pages create-deployment
```

### 앱이 로드되지 않음

1. 브라우저 콘솔(F12) 확인
2. 네트워크 탭에서 404 오류 확인
3. `_redirects` 파일이 배포되었는지 확인

### API 호출 실패

1. API 베이스 URL 확인
2. CORS 에러 확인 (콘솔)
3. 백엔드 API 서버 상태 확인

## 📚 참고 문서

- [Cloudflare Pages 문서](https://developers.cloudflare.com/pages/)
- [Wrangler CLI 가이드](https://developers.cloudflare.com/workers/wrangler/)
- [React SPA 배포](https://vitejs.dev/guide/static-deploy.html)

---

**마지막 배포:** 2026-04-08
**배포 담당:** DevOps Team
