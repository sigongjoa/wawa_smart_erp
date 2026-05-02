---
name: design folder
description: WAWA Smart ERP의 디자인 자산·UX 리서치·UI 컨셉·목업·audit 라운드 결과를 모아두는 영구 자산 폴더
---

# design/

UI/UX 디자인 자산을 한 곳에 모아둡니다. 시스템 설계 문서(DB 스키마, API, 비즈니스 로직)는 `docs/`에 그대로 둡니다.

## 폴더 구조

```
design/
├── README.md              # 이 문서
├── CATEGORIES.md          # audit 카테고리 정의 (앱 × 도메인 매핑)
├── IMPECCABLE.md          # /teach-impeccable 결과 — 프로젝트 디자인 가이드라인
├── system/                # 디자인 시스템 (토큰·컬러·타이포·컴포넌트 가이드)
│   └── DESIGN.md
├── research/              # UI/UX 리서치 (참고 사례·UX 연구)
├── concepts/              # UI 디자인 컨셉 (특정 화면/플로우의 시각 설계)
├── mockups/               # HTML 목업·정적 데모
└── audits/                # 라운드별 audit 결과 (날짜·주제별 폴더)
    └── 2026-05-design-round-1/
        ├── _index.md      # 라운드 요약 + 카테고리별 점수표
        ├── <category>.md  # 카테고리별 audit 리포트
        └── screenshots/   # Playwright 캡처
```

## 분류 기준

| 폴더 | 들어가는 것 | 들어가지 않는 것 |
|---|---|---|
| `system/` | 토큰, 컬러 팔레트, 타이포 스케일, 컴포넌트 사용 가이드 | 시스템 아키텍처 설계 → `docs/` |
| `research/` | 참고 앱 분석, UX 사례 연구, 사용자 행동 리서치 | API/DB 분석 → `claudedocs/` |
| `concepts/` | 특정 화면의 UI 디자인 의도·레이아웃 결정·시각 컨셉 | 기능 명세·로직 설계 → `docs/` |
| `mockups/` | HTML/이미지 정적 목업, 인터랙션 데모 | 실제 컴포넌트 코드 → `apps/*/src/` |
| `audits/` | `/audit` 라운드 결과, 점수표, P0~P3 리스트 | 코드 분석 → `claudedocs/` |

## 라운드 명명 규칙

`audits/<YYYY-MM>-<주제>-round-<N>/`

예시:
- `2026-05-design-round-1/` — 첫 디자인 audit
- `2026-Q3-perf-round-1/` — 성능 audit
- `2026-Q4-a11y-round-1/` — 접근성 audit

## 다른 폴더와의 분리

| 폴더 | 용도 |
|---|---|
| `claudedocs/` | 1회성 분석·연구 메모 (research, code analysis 결과) |
| `design/` | **영구·누적** 디자인 자산 + 라운드별 audit |
| `docs/` | 제품·시스템 설계 (USECASES, *_DESIGN.md, RUN_GUIDE) |

## audit 라운드 운영

1. `CATEGORIES.md`의 카테고리 묶음 확인
2. GitHub Epic 이슈 + 카테고리별 자식 이슈 batch 생성
3. 카테고리당 `/audit <대상>` 실행 → `audits/<라운드>/<카테고리>.md`에 결과 저장
4. P0/P1 발견 시 별도 이슈로 분리, `audit:p0` / `audit:p1` 라벨
5. 라운드 완료 후 `_index.md`에 카테고리별 점수표 정리
6. `/extract`로 공통 패턴을 `system/`에 반영
