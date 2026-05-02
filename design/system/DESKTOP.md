---
name: desktop design system
description: 강사·관리자용 desktop 앱(apps/desktop)의 디자인 시스템 — Toss-inspired 운영 도구 톤
---

# Desktop Design System (강사·관리자)

> Toss-inspired: 넉넉한 여백, 큰 타이포, 섹션 기반 레이아웃, 불필요한 카드 없음.

**SSoT**: `apps/desktop/src/index.css` (`:root` 블록)

## 1. 디자인 원칙

1. **운영 도구 톤** — 학생 앱처럼 게임 폴리시 X. 진지함·정보 밀도 우선
2. **카드 남용 금지** — 섹션은 여백과 보더로 분리, 카드는 클릭 가능한 entity에만
3. **상태 완비** — 모든 인터랙티브 요소에 hover/focus/active/loading/disabled 정의
4. **토큰 사용 강제** — 하드코딩 hex·정적 inline style 금지

## 2. 토큰

### 2.1 Color

| 토큰 | 값 | 용도 |
|---|---|---|
| `--primary` | `#2d3a8c` (deep indigo) | 핵심 CTA·강조 |
| `--primary-light` | `#4f5cb3` | hover/active 보조 |
| `--primary-surface` | `#eef0f8` | 강조 배경 (selected row 등) |
| `--primary-hover` | `#252f73` | primary CTA hover |
| `--accent` | `#00c4a3` (warm mint) | 보조 CTA·success 변주 |
| `--accent-surface` | `#e8faf6` | mint 배경 |
| `--bg-primary` | `#f8f9fb` | 화면 배경 (slate, NOT gray) |
| `--bg-secondary` | `#ffffff` | 카드/패널 배경 |
| `--bg-tertiary` | `#f1f3f6` | 섹션 분리 배경 |
| `--text-primary` | `#1a1e2e` | 본문 |
| `--text-secondary` | `#5e6478` | 보조 텍스트 |
| `--text-tertiary` | `#9098ad` | 메타·캡션 |
| `--border-primary` | `#e3e6ed` | 일반 보더 |
| `--border-secondary` | `#eff1f5` | 약한 분리선 |
| `--success` | `#22a861` | 성공 상태 |
| `--warning` | `#f59e0b` | 경고 |
| `--danger` | `#ef4444` | 위험·에러 |
| `--info` | `#3b82f6` | 정보 |

(다크 모드 토큰은 `index.css:4461-` 미디어 쿼리. **현재 부분 적용 — 다크 모드 완전 대응은 v2 항목**)

### 2.2 Spacing — 4px 베이스

`--sp-1`(4px) ~ `--sp-16`(64px). 컴포넌트 간격은 `--sp-4`(16px) / `--sp-6`(24px) / `--sp-8`(32px) 위주.

### 2.3 Radius

| 토큰 | 값 | 용도 |
|---|---|---|
| `--radius-xs` | 6px | 작은 컨트롤 |
| `--radius-sm` | 8px | 입력·버튼 |
| `--radius-md` | 12px | 카드·컨테이너 |
| `--radius-lg` | 16px | 큰 카드 |
| `--radius-xl` | 20px | 모달 |
| `--radius-full` | 9999px | pill·아바타 |

### 2.4 Shadow

`--shadow-xs` (subtle border-like) → `--shadow-overlay` (modal). 카드 hover에는 `--shadow-md` 정도.

### 2.5 Typography

- Font: `Pretendard Variable`, `Pretendard`, system fallback
- Body 기본: 15px / line-height 1.6
- Headings: 별도 클래스 (`.page-title` 등) — index.css 참조

### 2.6 Motion

- `--ease-out: cubic-bezier(0.16, 1, 0.3, 1)` — 진입·확장
- `--duration-fast: 150ms` (호버), `--duration-normal: 250ms` (전환), `--duration-slow: 400ms` (페이지)
- 무한 애니 금지

### 2.7 Layout

- `--sidebar-width: 240px`, `--header-height: 0px` (헤더 미사용), `--content-max: 960px`

## 3. 컴포넌트 규칙

### 3.1 Button

variant: `primary` / `secondary` / `ghost` / `danger`. 모든 variant에 hover·focus-visible·disabled 상태.
Size: `sm`(13px) / `md`(14px) / `lg`(15px). 터치 타겟 최소 44x44.

### 3.2 Input·Select

- `border: 1px solid var(--border-primary)`, focus 시 `--primary` border + `--primary-surface` 3px ring
- placeholder 색은 `--text-tertiary`

### 3.3 Card

- `bg-secondary` + `border-primary` + `radius-md` + 기본 `shadow-xs`
- 클릭 가능한 카드만 hover에 `shadow-md`
- **카드 안에 카드 중첩 금지**

### 3.4 Table

- 헤더: `bg-tertiary` 50% 투명, 11px uppercase, `--text-secondary`
- 행: `border-secondary` 하단선, hover `bg-tertiary` 50%
- 페이지네이션 영역은 `bg-tertiary` 30%

### 3.5 Status Badge

variant: `success` / `warning` / `danger` / `info` / `neutral`. pill 형태 (`radius-full`), 12px / 600 weight, 보더 + surface 배경.

### 3.6 Grade Badge (학년)

`중1`/`중2`/`중3`/`고1`/`고2`/`고3`/`기타`별 단색 배경 + 흰 텍스트, 11px / 700 weight, `radius-xs`. 색상 매핑은 `index.css` 참조.

## 4. 아이콘

**미정 — P1 결정 필요**. 현재 일부 페이지에 이모지(✅❌⚠️) 사용 → SVG 라이브러리 도입 후 치환 예정 (`lucide-react` 후보). 결정 시 본 문서 갱신.

## 5. 접근성

- 색상 대비 WCAG AA (4.5:1) 충족 — 모든 토큰 조합은 본 기준 통과
- 모든 인터랙티브 요소에 `:focus-visible` 아웃라인 (2px solid `--primary`)
- 클릭 영역 최소 44x44
- `<div onClick>` 금지 — `<button>` 또는 `role="button" tabIndex` + 키보드 핸들러

## 6. 체크리스트 (신규 컴포넌트·페이지)

- [ ] 토큰만 사용 (하드코딩 hex 0)
- [ ] 정적 스타일은 CSS 클래스 (inline `style={{}}`은 동적 값만)
- [ ] hover / focus-visible / active / disabled 정의
- [ ] 키보드 Tab으로 전부 접근 가능
- [ ] 빈 상태·로딩·에러 상태 처리
- [ ] 반응형 (1024px 이하 동작 확인)

## 7. 안티 패턴

- 카드 안에 카드 중첩
- 그라디언트 텍스트 / 보라-파랑 그라데
- 글래스모피즘
- 이모지를 아이콘으로 사용
- 무한 글로우/바운스 애니
- 친절 카피 도배 ("AI가 친절하게 다 적어줍니다!" 같은)

## 8. 파일 구조 (목표)

```
apps/desktop/src/
├── styles/
│   ├── tokens.css         # :root 토큰만 (현재 index.css에 통합 — P0 분할 작업 진행 중)
│   ├── reset.css          # 리셋
│   ├── components.css     # 공통 컴포넌트 클래스
│   └── utilities.css      # 유틸리티
└── components/
    └── ...
```

(현재 `index.css` 단일 파일 8,654줄 — P0 분할 작업 진행 중)
