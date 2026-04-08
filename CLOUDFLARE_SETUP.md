# Cloudflare Pages 설정 가이드

## 1️⃣ Cloudflare 계정 생성

1. https://dash.cloudflare.com 방문
2. 이메일로 회원가입 또는 로그인
3. 계정 생성 완료

## 2️⃣ Pages 프로젝트 생성

### 옵션 A: GitHub 연동 (권장)

1. **Cloudflare 대시보드** → **Pages**
2. **Create a project** 클릭
3. **Connect to Git** 선택
4. GitHub 계정 연동 승인
5. 리포지토리 선택: `wawa_smart_erp`
6. 배포 설정:
   - **Project name**: `wawa-smart-erp` (또는 원하는 이름)
   - **Production branch**: `main` (또는 `master`)
   - **Build command**: 비워두기 (GitHub Actions 사용)
   - **Build output directory**: `apps/desktop/dist/renderer`

### 옵션 B: 수동 배포 (한 번만)

```bash
cd apps/desktop
npx wrangler pages publish dist/renderer
```

## 3️⃣ 환경 변수 설정

1. **Cloudflare 대시보드** → **Pages** → **프로젝트 선택**
2. **Settings** → **Environment variables**
3. 다음 변수 추가:

```
이름: VITE_API_BASE_URL
값: https://api.your-domain.com (백엔드 API 주소)

이름: VITE_NOTION_API_KEY  
값: *** (선택사항)

이름: VITE_GEMINI_API_KEY
값: *** (선택사항)
```

## 4️⃣ 커스텀 도메인 설정 (선택사항)

1. **Settings** → **Custom domain**
2. **Add custom domain** 클릭
3. 원하는 도메인 입력 (예: `app.wawa.com`)
4. DNS 설정 따라하기

## 5️⃣ GitHub Actions 자동 배포

### 필수: GitHub Secrets 설정

1. GitHub 리포 → **Settings** → **Secrets and variables** → **Actions**
2. **New repository secret** 클릭
3. 다음 secret 추가:

```
이름: CLOUDFLARE_API_TOKEN
값: [Cloudflare API 토큰]

이름: CLOUDFLARE_ACCOUNT_ID  
값: [Cloudflare 계정 ID]
```

**토큰/ID 얻는 방법:**
1. Cloudflare 대시보드 우측 상단 계정 메뉴
2. **API Tokens** 클릭
3. **Create Token** → "Pages" 템플릿 선택
4. 토큰 복사
5. Account ID는 대시보드 하단에서 확인

### 배포 자동화

이제 `git push`하면 자동으로:
1. 코드 빌드
2. Cloudflare Pages에 배포
3. 라이브 서버에 반영

```bash
git push origin main
# 자동 배포 시작 (GitHub Actions)
```

## 6️⃣ 배포 확인

### 라이브 URL 접속

- 기본 URL: `https://[project-name].pages.dev`
- 커스텀 도메인: `https://app.wawa.com`

### 배포 이력 확인

1. **Cloudflare 대시보드** → **Pages** → **프로젝트**
2. **Deployments** 탭에서 배포 이력 확인
3. 각 배포의 상세 로그 확인 가능

## 7️⃣ 주의사항

### .env 파일

- ❌ **하지 말 것**: `.env` 파일을 GitHub에 커밋
- ✅ **할 것**: GitHub Secrets 또는 Cloudflare 환경변수 사용

### API 키 보안

- 공개 저장소에서 API 키 노출 금지
- GitHub Secrets에만 저장
- 정기적으로 토큰 재발급

## 8️⃣ 성능 모니터링

Cloudflare 대시보드에서 제공:
- **Analytics**: 트래픽, 성능 지표
- **Cache**: CDN 캐싱 상태
- **Security**: DDoS, 악성 트래픽 차단

## 🆘 문제 해결

### 배포 실패

```
Error: Authentication failed
→ API 토큰/계정 ID 확인

Build failed
→ npm run build 로컬에서 실행해서 오류 확인
```

### 앱이 로드 안됨

```
GET 404 /static/...
→ base 경로 확인 (vite.config.ts에서 base: '/')
→ _redirects 파일 배포 확인
```

### API 호출 실패 (CORS)

```
CORS error
→ 백엔드에서 CORS 헤더 설정
→ Content-Type, Authorization 추가
```

---

**다음 단계:**
- 백엔드 API 서버 배포
- E2E 테스트 실행
- 모니터링 설정
