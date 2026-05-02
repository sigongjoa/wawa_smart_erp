# 증명 학습 데모 — GitHub Pages 배포

중1 수학 증명 3-Phase 학습 시스템의 인터랙티브 UX 목업입니다.

## 🌐 배포 방법 (1회 설정)

GitHub 저장소 페이지에서:

1. **Settings** 탭 → 왼쪽 사이드바 **Pages**
2. **Source** 섹션:
   - Branch: `master` (또는 `main`)
   - Folder: **`/docs`** 선택
3. **Save**
4. 1~2분 뒤 다음 URL에서 접근:
   ```
   https://sigongjoa.github.io/wawa_smart_erp/proof-demo/
   ```

## 📁 포함된 파일

| 파일 | 용도 |
|---|---|
| `index.html` | 랜딩 페이지 (4개 목업 링크) |
| `interactive.html` | ⭐ 실제 작동 프로토타입 (드래그&드롭, 채점, SRS) |
| `figure.html` | SVG 도형 + 자동검증 결과 |
| `phase1-static.html` | Phase 1 화면 설계도 |
| `submit-flow.html` | 제출 이후 8단계 플로우 |
| `.nojekyll` | Jekyll 처리 비활성화 (밑줄 시작 파일 허용) |

## 🔗 직접 링크

- 랜딩: `/proof-demo/`
- 프로토타입: `/proof-demo/interactive.html`
- 도형: `/proof-demo/figure.html`

## 📦 기술 특징

- 외부 의존성 **없음** — 순수 HTML/CSS/JS만 사용
- 빌드 과정 불필요 — 파일을 그대로 push하면 배포
- 모바일 반응형 + HTML5 drag & drop

## 🔄 업데이트

파일 수정 후 커밋·푸시만 하면 자동 재배포됩니다:
```bash
git add docs/proof-demo/
git commit -m "docs: update proof demo mockup"
git push
```
