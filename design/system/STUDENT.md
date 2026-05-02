---
name: student design system
description: 학생용 student 앱(apps/student)의 디자인 시스템 — 포켓몬 타입 시스템 + 게임 폴리시 + 웰니스
---

# Student Design System (중2~고등학생)

> "잘 만들어진 · 게임 같은 · 웰니스" — Pokemon Sleep / Apple Fitness+ / Pokemon GO 톤. 도파민 사기 X, 폴리시 O.

**도크트린 원본**: [`design/IMPECCABLE.md`](../IMPECCABLE.md)
**SSoT**: `apps/student/src/styles/tokens.css`

## 1. 디자인 원칙 (IMPECCABLE 5)

1. **타입(=색)으로 의미를 전달** — 라벨 줄이고 색 시스템 (포켓몬 type chip)
2. **이모지를 아이콘으로 쓰지 않음** — 자체 SVG 또는 통일된 라인 아이콘
3. **마스코트 없이 정보가 주인공** — 단어/숫자/배지가 화면을 이끔
4. **친절 카피 금지** — "탭하여 장착!" 같은 설명 줄임. 디자인이 자명하면 라벨 제거
5. **모션은 한 번, 진하게** — 무한 애니 0, 진입 모션 1회만

## 2. 토큰

### 2.1 Color — Ink + Pokemon 타입 6색

#### Ink (불투명도 사다리)

| 토큰 | 값 | 용도 |
|---|---|---|
| `--ink` | `rgba(17,20,26,0.92)` | 본문 — blueish 진검정 (순검정 X) |
| `--ink-60` | `rgba(17,20,26,0.60)` | 보조 텍스트 |
| `--ink-40` | `rgba(17,20,26,0.40)` | 메타·캡션 |
| `--ink-20` | `rgba(17,20,26,0.20)` | 비활성 |
| `--ink-09` | `rgba(17,20,26,0.09)` | 9% 얇은 보더 |
| `--bg-canvas` | `#fafbfc` | 화면 배경 (크림 NO, 은은한 틴트 흰색) |
| `--bg-card` | `#ffffff` | 카드 배경 |

#### 타입 컬러 (과목·단원 코딩)

| 토큰 | 값 | 의도 |
|---|---|---|
| `--type-electric` | `#FAC000` | 수행평가 — 번쩍 |
| `--type-water` | `#2980EF` | 단어 — 흐르듯 |
| `--type-grass` | `#3FA129` | 증명 — 논리의 결 |
| `--type-psychic` | `#F584A8` | 문법 — 추상 사고 |
| `--type-ground` | `#915121` | 시험지 — 묵직함 |
| `--type-dragon` | `#5060E1` | 도전 — 최고 난이도 |

각 타입별 surface 토큰(`--type-*-surface`)은 8% 채움 — 카드 배경용.

#### 시멘틱

| 토큰 | 값 | 매핑 |
|---|---|---|
| `--primary` | `#2d3a8c` | 앱 기본 강조 |
| `--success` | `#3FA129` | type-grass와 통일 |
| `--danger` | `#E62829` | 채도 높은 빨강 |
| `--warning` | `#FAC000` | type-electric |

### 2.2 Typography — Notion Calendar 점프 스케일

| 토큰 | 값 | 용도 |
|---|---|---|
| `--fs-hero` | 56px | 홈 핵심 숫자 |
| `--fs-title-1` | 32px | 페이지 제목 |
| `--fs-title-2` | 22px | 섹션 제목 |
| `--fs-body-l` | 18px | 카드 본문 |
| `--fs-body` | 15px | 일반 본문 |
| `--fs-label` | 13px | 레이블 |
| `--fs-caption` | 11px | 캡션·메타 |

- Font: `Pretendard` (Variable). `Jua`, `Comic Sans`, `Bagel Fat One` 금지
- Numbers/Scoreboard는 `--font-mono` (SF Mono) — LCD 느낌
- Caption(`--fs-caption`)에는 `--ls-caption: 0.6px` 트래킹

### 2.3 Spacing — 4px 베이스

`--sp-1`(4px) ~ `--sp-10`(40px).

### 2.4 Radius

| 토큰 | 값 |
|---|---|
| `--r-xs` | 4px |
| `--r-sm` | 8px |
| `--r-md` | 12px |
| `--r-lg` | 16px |
| `--r-xl` | 24px |

대형 카드는 4-8px 모서리 절제, pill만 round-full.

### 2.5 Border·Shadow

- `--border-hairline: 1px solid var(--ink-09)` — 모든 분할선
- `--border-strong: 2px solid var(--ink)` — 선택/강조
- `--shadow-pop` — **오직 팝오버/모달**에만. 일반 카드는 그림자 X (보더로 분리)

### 2.6 Motion

- `--ease-out-quart: cubic-bezier(0.25, 1, 0.5, 1)` — 빠르고 결정적
- `--dur-fast: 150ms`, `--dur-base: 220ms`, `--dur-slow: 320ms`
- 페이지 진입 시 staggered reveal 1회 OK
- 무한 애니 (totem-glow 등) 절대 금지
- 한 시점 한 모션

### 2.7 Layout

- 모바일 우선, **max-width: 480px** 유지
- `--tabbar-h: 60px` — 하단 탭바
- 좌측 정렬 기본, 가운데 정렬 남발 X

## 2.8 피드백 패턴 (alert·confirm 대체)

학생 앱은 게임 폴리시 톤이라 native `alert()`/`confirm()`/`window.prompt` 모두 금지. 대안:

#### 인라인 에러 배너 (권장)

폼 제출·API 실패 시:

```tsx
const [error, setError] = useState<string | null>(null);
// ...
{error && (
  <div role="alert" style={{
    background: 'var(--danger-surface)',
    color: 'var(--danger)',
    border: 'var(--border-hairline)',
    borderRadius: 'var(--r-sm)',
    padding: 'var(--sp-3) var(--sp-4)',
  }} onClick={() => setError(null)}>
    {error}
  </div>
)}
```

#### 인라인 상태 배너 (성공·정보)

```tsx
const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
// ...
{feedback && (
  <div
    className={`feedback feedback--${feedback.kind}`}
    role={feedback.kind === 'err' ? 'alert' : 'status'}
    onClick={() => setFeedback(null)}
  >
    {feedback.text}
  </div>
)}
```

타입 컬러 surface와 매칭 (`--type-electric-surface` 안내, `--success-surface` 성공, `--danger-surface` 에러).

#### 정답·오답 피드백 (학습 카드)

```tsx
import { Check, X } from 'lucide-react';

<strong style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
  {correct ? <Check size={18} aria-hidden /> : <X size={18} aria-hidden />}
  {correct ? '정답' : '오답'}
</strong>
```

타입 컬러로 의미 전달 (정답=`--type-grass`, 오답=`--danger`).

## 3. 컬러 시스템 사용

### 타입 컬러로 분류

라벨 텍스트 대신 색으로 의미 전달:

```tsx
// 나쁜 예 — 라벨 도배
<Card>
  <Label>단어 시험</Label>
  <Subject>영단어 1500</Subject>
</Card>

// 좋은 예 — 타입 색으로 분류
<Card type="water">
  <Subject>영단어 1500</Subject>
</Card>
```

### 등급제 금지

`common/rare/epic/legendary` 같은 영문 RPG 등급제 안 씀. 타입 컬러 6개로 충분.

## 4. 안티 레퍼런스 (절대 NO)

- cream/berry 파스텔 + 둥근 마스코트 + emoji 아이콘 → **초등 동화책 톤**
- 무한 글로우/바운스/sparkle ✨ → Cute Mobile Template
- 회색 SaaS 대시보드
- 가챠게임 베끼는 영문 RPG 등급제
- "AI가 친절하게 다 적어줌" 라벨 도배
- 그라디언트 텍스트, 보라-파랑 그라데, 글래스모피즘

## 5. 아이콘

**라이브러리**: [`lucide-react`](https://lucide.dev/) (line icon, IMPECCABLE 원칙 #2 — 이모지 금지 충족)

```tsx
import { Check, X } from 'lucide-react';
<Check size={18} aria-hidden />
```

**규칙**:
- 이모지를 아이콘으로 쓰지 않음 (도크트린 위반)
- 정답·오답 등 강한 시멘틱은 타입 컬러와 함께 (`var(--type-grass)` for ✓, `var(--danger)` for ✗)
- 마스코트가 아니라 정보가 주인공 — 아이콘은 라벨 보조
- 색은 부모 토큰 상속

## 6. 접근성

- 본문 대비 WCAG AA (4.5:1)
- focus-visible 아웃라인 필수
- 터치 타겟 44x44
- `<div onClick>` 금지

## 7. 체크리스트

- [ ] 토큰만 사용
- [ ] 이모지 아이콘 0
- [ ] 무한 애니 0
- [ ] 라벨 도배 X (디자인이 자명하면 텍스트 제거)
- [ ] 카드 그림자 X (팝오버/모달만)
- [ ] hover/focus-visible/active 정의
- [ ] 모바일 480px 가정

## 8. 파일 구조 (현재)

```
apps/student/src/styles/
└── tokens.css      # SSoT (200줄)
apps/student/src/index.css   # 토큰 중복 선언 — P0 정리 진행 중
```
