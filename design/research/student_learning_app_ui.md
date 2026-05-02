# 학생 학습 앱 UI/UX 레퍼런스 리서치

- 작성일: 2026-04-24
- 대상: 와와 학습 앱 (https://wawa-learn.pages.dev)
- 타겟 사용자: 중2 ~ 고등학생 (10대 중후반)
- 브랜드 톤: 잘 만들어진 · 게임 같은 · 웰니스 (Pokemon Scarlet/Violet, Pokemon Sleep, Apple Fitness+, Pokemon GO)

---

## 1. Executive Summary

1. **초등 "마스코트 + 파스텔 + 이모지"** 는 중2~고등 타겟에서 즉시 거부된다. Duolingo 조차 "patronizing" 피드백을 받는 중이다.
2. **"게임 폴리시"의 본질**은 자극이 아니라 *한 시점 한 모션, 잘 정렬된 타입 컬러, 굵은 수치 타이포* 다 (Pokemon Sleep, Scarlet/Violet).
3. **Streak** 는 강력하지만 "잃을까봐 두려움" 기반이라 웰니스 톤과 충돌한다 → 와와는 **stamp(도장) · 주간 리듬** 으로 변형해야 한다 (Pokemon Sleep 방식).
4. **진도 시각화** 는 XP 바 하나가 아니라 **얇은 1px 보더 + 굵은 숫자 + 타입 컬러 dot** 의 다층 표현이 10대에게 "진짜 같다" 고 읽힌다 (Notion Calendar 근거).
5. **홈 대시보드** 는 "오늘 할 일 1개 큰 카드 + 주간 리듬 띠 + 하단 4탭" 조합이 공통 패턴 (Apple Fitness+ Summary, Pokemon Sleep 홈).
6. 타입 컬러 시스템은 **포켓몬 18타입 팔레트** 를 직접 참고해 **과목/단원 컬러** 로 전용할 수 있다 — 채도 높은 단색 1~2개 + 5~6개 보조 타입색.
7. Fitness+ 방식의 **큰 카테고리 카드(12개) + 상단 필터 탭** 은 와와의 "단어/증명/숙제/시험" 네 카테고리를 진지하게 보이게 만든다.
8. Duolingo 의 **3~5분 세션 포맷** 은 차용, 하지만 confetti/bounce/sparkle 은 금지. 정답 피드백은 **200ms 채도 단색 border flash + mono 숫자 +1**.
9. "AI가 ~해드려요" 문구, SSR/SR/R 영문 등급, glassmorphism 카드 — 이 셋은 즉시 삭제 대상.
10. 우리 독트린 내에서 즉시 적용 가능한 패턴 10개를 섹션 3에 정리함 (구현 난도 포함).

---

## 2. 앱별 분석

### 2.1 Pokemon Sleep (Tier 1 · 핵심 레퍼런스)

**왜 중요한가**: "웰니스 × 게임 폴리시 × 도파민 사기 아님" 의 유일한 상업적 성공 사례. 2025년 7월 기준 2,800만 다운로드, 10억 회 수면 세션 기록.

**홈 대시보드 구조**:
- 메인 메뉴에 **"이번 주 수면 점수 그래프"** 를 띠 형태로 항상 노출 (= 와와의 주간 학습 그래프 직접 대응)
- 아침에 앱을 열면 **"수면 리포트 → 새로 만난 포켓몬 → 밤새 모은 재료 수거 → 아침식사"** 의 *선형 아침 의식* 이 자동 재생됨 — 유저가 결정해야 할 게 없음
- Stamp(도장) 시스템: 매일 수면 완료 → 도장 1개, N장 모이면 보상. **"잃으면 망하는 streak"가 아니라 "모이면 더 좋은 stamp"** — 이게 웰니스 톤의 핵심

**진도/보상 시각화**:
- "Dozing / Snoozing / Slumbering" 세 수면 타입을 **3색 도넛 차트 + 각 타입 컬러 dot + 큰 모노 숫자(점수)** 로 표현
- 포켓몬의 각 타입 색이 바로 카테고리 색이 됨 — **common/rare 영문 등급 없음**, 대신 희귀도는 "잠꼬대 스타일" 같은 **명사적 이름**으로 표기

**학습(= 수면) 세션 UI**:
- 자기 전 "Sleep Research" 버튼 1개. 진행 중에는 화면이 **거의 검은색 + 작은 시계** 만. 한 시점 한 모션.
- 깨어나면 세션 종료 버튼 + 순차 리포트 애니 (한 번에 한 카드 페이드인, **stagger 약 200ms**)

**우리가 차용할 것**:
- "주간 리듬 띠" 를 홈 대시보드 최상단에
- "모이는 stamp" 메커니즘 — 단어 완료 1개 = stamp 1개, 7개 모이면 box 오픈
- 아침 의식처럼 **"오늘의 선형 루틴"** (단어→증명→숙제 체크 1회) 을 자동 플로우로
- 모든 희귀도/등급을 **한국어 명사**로 (예: "새벽반 단어", "거친 증명") — 영문 SSR 금지

**출처**: [Pokemon Sleep 공식](https://www.pokemonsleep.net/en/), [Bulbapedia: Pokemon Sleep](https://bulbapedia.bulbagarden.net/wiki/Pok%C3%A9mon_Sleep), [Game8: Best Bedtime Rewards](https://game8.co/games/Pokemon-Sleep/archives/419834)

---

### 2.2 Duolingo (Tier 1 · 차용과 경계 구분이 핵심)

**차용할 것**:
- **Streak 위젯 개념** — 홈 화면 최상단에 "🔥 대신 얇은 bar + 숫자" 로 항상 보이게. 단, 불꽃 이모지/마스코트 울음은 금지
- **3~5분 짧은 세션** 포맷 — 활성화 마찰 낮춤. 와와 단어장 한 세션 = 10문항 = 약 3분
- **선형 path UI** (과거 트리 → 현재 linear path, 단원당 10문항 이상) — "다음 할 일이 오직 하나" 라는 단순성
- **여러 진도 동시 진행** — 어떤 날에도 뭔가는 올라감 (XP 바, 레벨, 주간 리그, 배지). 와와에선 "단어 XP · 증명 레벨 · 주간 과제 체크" 로 치환
- **틀려도 진도 바 조금은 올라감** — demoralizing 방지
- **색-피드백 시스템** (단, 색만 빌림):
  - 성공: `#58cc02` → 우리 채도 높은 primary 녹색으로 전환 가능
  - 실패: `#ff4b4b` → 와와의 틀림 표시 빨강
  - XP: `#ffc800` → 숫자 강조용 옐로우

**거부할 것 (안티패턴 섹션에도 기록)**:
- **Duo 마스코트의 "crying owl"** 푸시 — "patronizing" 이라는 평이 강하게 나옴. 와와는 마스코트 자체를 쓰지 말 것
- **Confetti / sparkle / bounce** 완료 애니 — 10대가 "baby app" 으로 인식
- **"If a 5-year-old can't figure it out in 5 seconds"** 디자인 철학 — 이 자체가 와와 타겟과 정반대

**Streak 심리적 문제**:
- 7일 streak 유지자는 장기 유지율 3.6배 높음 (실효성 O)
- 그러나 "잃을 것에 대한 공포" 기반 → 웰니스 독트린 위반
- **대안**: streak 대신 **"주간 리듬"** — 7일 중 4~5일 학습하면 주간 색이 채워짐 (잃지 않음, 쌓임)

**출처**: [925studios: Duolingo UX Breakdown](https://www.925studios.co/blog/duolingo-design-breakdown), [Blake Crosley: Duolingo Gamification](https://blakecrosley.com/guides/design/duolingo), [Premjit Singha: Streak Detailed Breakdown](https://medium.com/@salamprem49/duolingo-streak-system-detailed-breakdown-design-flow-886f591c953f), [Orizon: Duolingo Gamification](https://www.orizon.co/blog/duolingos-gamification-secrets)

---

### 2.3 Apple Fitness+ (Tier 1 · "진지한 웰니스" 톤)

**핵심 톤**: "sleek UI + concise UX" 으로 **premium 권위감** 조성. Fitness+ 의 UI 는 "웰니스가 진지하게 보이는" 레퍼런스로 거의 유일하다.

**구조 3탭 패턴**:
1. **Summary** — 오늘의 ring, 이번 주 트렌드, 어워드. 숫자 중심.
2. **Fitness+** — 12개 카테고리 카드 + 상단에 trainer/duration/equipment 필터 탭 → 와와에 적용하면 **"오늘의 단어 / 오늘의 증명 / 오늘의 숙제 / 오늘의 시험"** 4 카테고리 + 단원/난이도 필터
3. **Sharing** — 친구 초대, 응원 메시지

**타이포 원칙** (SF Pro, SF Rounded):
- 숫자는 항상 **case-sensitive numerals** 로 정렬 (49/60 km 같은 분수 표현에서 `/` 수직 정렬)
- 숫자-단위 사이 간격을 **좁게** — 시각적 덩어리 유지
- 순수 검정 대신 **진한 회색 `#222`** — 눈 피로 저감 (장시간 학습 앱에 직접 적용 가능)
- 큰 제목 64px급 → 본문 16px → 보조 11~12px 로 **극단적 스케일 점프** → 색·보더 없이도 위계 완성

**Today 링 시각화**:
- Move / Exercise / Stand 의 3중 동심원 — 색 3개, 숫자 중앙 큰 mono, 완료 시에도 스파클 없음
- 와와 대응: "단어 · 증명 · 숙제" 3중 ring 또는 3-bar stack

**무엇을 하지 않는가**:
- 이모지 없음, 마스코트 없음, "AI 트레이너가 응원해줘요" 라벨 없음
- 완료 시 confetti 없이 **ring 색이 가득 차며 체크 표시 하나만**

**출처**: [Apple Fitness+](https://www.apple.com/apple-fitness-plus/), [App Store: Apple Fitness](https://apps.apple.com/us/app/apple-fitness/id1208224953), [mindbodygreen: Fitness+ Review](https://www.mindbodygreen.com/articles/apple-fitness-plus-review), [Pimp My Type: Fitness App Review](https://pimpmytype.com/review-fitness-app/), [Apple HIG: Typography](https://developer.apple.com/design/human-interface-guidelines/typography)

---

### 2.4 Pokemon GO (Tier 1 · 타입 컬러 시스템 + 탭바)

**홈/맵 구조**:
- 중심 = 맵, 주변 정보는 모두 **하단 탭** 혹은 **우측 아이콘 스택** 으로 밀려남 → 와와의 메인 학습 영역이 항상 우선이고 메뉴는 주변에 있게 하라는 원칙의 근거
- 버튼은 **둥근 네온 원 위에 흰 아이콘 + 굵은 보더** (네오모피즘/글라스 아님)

**타입 컬러 시스템 (포켓몬 18 타입 · Scarlet/Violet 기준)**:

| 타입 | Hex |
|---|---|
| Normal | `#9FA19F` |
| Fire | `#E62829` |
| Water | `#2980EF` (공식 팔레트) |
| Grass | `#3FA129` |
| Electric | `#FAC000` |
| Ice | `#3DCEF3` |
| Fighting | `#FF8000` |
| Poison | `#9141CB` |
| Ground | `#915121` |
| Flying | `#81B9EF` |
| Psychic | `#F584A8` |
| Bug | `#91A119` |
| Rock | `#AFA981` (공식 팔레트) |
| Ghost | `#704170` |
| Dragon | `#5060E1` |
| Dark | `#624D4E` |
| Steel | `#60A1B8` (공식 팔레트) |
| Fairy | `#EF70EF` |

**와와 적용**: 이 18색을 그대로 학문/단원 컬러로 전용할 수 있다.
- 예: 국어 = Psychic pink, 수학 = Electric yellow, 과학 = Grass green, 영어 = Water blue, 사회 = Ground brown, 증명 = Dragon indigo
- 6개 선택 시 채도가 서로 충돌하지 않도록: **Electric · Grass · Water · Psychic · Dragon · Dark** 추천 (명도 격차 고르게 분포)

**카탈로그(도감) UI**:
- 격자 그리드 + 각 셀이 타입 색 border-left 3~4px + 회색톤 배경 + 번호 mono → 와와 "단어 도감" 에 직접 이식 가능

**출처**: [Pixso: Pokemon GO UI 분석](https://pixso.net/tips/pokemon-go-ui/), [Pokemon GO Hub: UI 원칙](https://pokemongohub.net/post/article/lets-talk-does-pokemon-go-meet-the-principles-of-ui-design/), [Game UI Database: Pokemon GO](https://www.gameuidatabase.com/gameData.php?id=1317), [Bulbapedia: Color templates](https://bulbapedia.bulbagarden.net/wiki/Help:Color_templates), [Pokemon Aaah ColorDex](https://www.pokemonaaah.net/art/colordex/)

---

### 2.5 Notion Calendar (Tier 2 · 타이포/보더 레퍼런스)

**왜 중요**: 게임도 학습도 아닌 **"잘 만들어진"** 의 순수 레퍼런스. 독트린의 *"흰 바탕 + 굵은 보더 + 모노스페이스 숫자"* 의 기준점.

**실측 스펙**:
- Font: **NotionInter** (Inter 포크, 메트릭 조정)
- Display H1: `64px / 700 / line-height 1.0 / letter-spacing -2.125px`
- Section Label: `12px / 500 / letter-spacing 0.125px / UPPERCASE`
- Body: `16px`
- Time Gutter: `11px / 500 / monospaced numerals`
- H1:H2 비율 **5.3:1** (극단적 스케일 점프 → 색·보더 없이 위계)

**컬러**:
- 배경: `rgb(255,255,255)` (Light 우선, 독트린과 일치)
- Text Primary: `rgba(0,0,0,0.9)` (순검정 금지)
- Text Secondary: `rgba(0,0,0,0.54)`
- Text Tertiary: `rgba(0,0,0,0.35)`
- Surface: `rgb(247,247,245)` (warm gray)
- Border: `rgba(0,0,0,0.09)` **(← 9% 불투명도. 이게 "잘 만들어진" 의 실체)**
- Primary Blue: `rgb(35,131,226)`

**Border/Shadow**:
- Grid line: **1px at 9% opacity** ("decorate 하지 말고 organize 하라")
- Border Radius: `4px (sm)`, `6px (md)` — 독트린의 "굵은 보더" 와는 다른 방향. 와와는 **borders 1~2px + border-radius 8~10px** 로 중도 설정 권장
- Popover shadow: `0 4px 12px rgba(0,0,0,0.12)` (딱 한 단계)

**출처**: [Blake Crosley: Notion Calendar](https://blakecrosley.com/guides/design/notion-calendar)

---

### 2.6 Quizlet / Anki (Tier 2 · 학습 세션 흐름)

**Quizlet**:
- 모바일 앱은 "polished, delightful" 평. 5가지 학습 모드 (Learn / Write / Spell / Test / Match) 가 한 덱에 붙어있음 → 와와 단어장도 **단일 세트에 3~4모드 탭** 가능
- 플립: 앞면 읽고 → 탭해서 뒤집기 → 다음 카드. 단순한 선형 흐름.

**Anki**:
- 스페이스드 리피션 4단계 평가 버튼: Again / Hard / Good / Easy — 와와 단어장의 **"다시/어려움/좋음/쉬움"** 4버튼으로 이식 가능
- 리뷰 시점이 학습자 선택 기반 → 와와 "시험" 리듬에 적용 가능
- UI 가 "clunky, dated" 평가 → **좋은 학습 로직 + 나쁜 UI** 가 얼마나 유저를 놓치는지 반례

**출처**: [Coursebox: Quizlet vs Anki](https://www.coursebox.ai/blog/quizlet-vs-anki), [makeuseof: Anki vs Quizlet](https://www.makeuseof.com/anki-vs-quizlet/), [Anki 공식](https://apps.ankiweb.net/)

---

### 2.7 Sololearn (Tier 2 · 10대~20대 코딩 학습)

- 게이미피케이션 풀셋: 챌린지, 배지, 지역·글로벌 랭킹, 진도 바
- 배지 53종 — 이름이 **명사적 업적** (e.g. "First Lesson", "Creator") 이지 common/rare 등급 없음
- 최소 연령 13세 → 중2~고등 타겟 정확히 겹침
- 과목별 코스 → 진도 바가 상단 항상 노출. 와와 "단원별 진도 스트라이프" 직접 대응

**출처**: [Sololearn: About Badges](https://www.sololearn.com/en/Discuss/316122/about-badges), [Common Sense Media: Sololearn Review](https://www.commonsensemedia.org/app-reviews/sololearn-learn-to-code), [Career Karma: Sololearn](https://careerkarma.com/blog/sololearn-app-review/)

---

## 3. **와와 학생 앱에 즉시 적용 가능한 패턴 TOP 10** (가장 중요)

각 패턴마다: 출처 · 왜 먹히는가 · 독트린 적합성 · 구현 난도 · 예상 임팩트

---

### #1. 주간 리듬 띠 (Weekly Rhythm Bar) — streak 대체

- **출처**: Pokemon Sleep (주간 수면 점수 그래프) + Apple Fitness+ (weekly trend)
- **왜 먹히는가**: 10대는 "잃을까봐" 기반 streak 의 압박감에 역반응하는 세대. 주간 리듬은 "쌓이는" 구조라 실패해도 다음 주 월요일에 초기화되므로 심리 부담 낮음
- **구현**: 홈 상단 띠 (높이 8~10px, 7칸 분할, 각 칸은 타입 컬러 중 1개로 채워짐 / 비어있음). 숫자는 옆에 `4/7` mono
- **독트린 적합**: O — streak의 도파민 문제 회피, 웰니스 톤 유지
- **난도**: Low
- **임팩트**: High (홈 상단 고정 요소, 매일 본다)

### #2. "오늘의 의식" 선형 루틴 카드

- **출처**: Pokemon Sleep 아침 의식 + Duolingo linear path
- **왜 먹히는가**: 결정 피로 제거. "뭘 할지" 고르지 않아도 되는 단일 진입점. 중·고생은 숙제 압박이 이미 많음 → 선택지 제공이 오히려 저항 발생
- **구현**: 홈 화면 최상단 큰 카드 1개, "오늘: 단어 10 → 증명 1 → 숙제 체크" 가로 3스텝. 완료된 스텝은 채도 있는 타입 컬러 체크, 미완료는 회색 보더
- **독트린 적합**: O — "한 시점 한 모션", 선형성
- **난도**: Medium (기존 오늘 할 일 로직과 통합 필요)
- **임팩트**: High

### #3. 타입 컬러 시스템 (과목/단원 전용)

- **출처**: Pokemon Scarlet/Violet + Pokemon GO type color
- **왜 먹히는가**: "SSR/SR/R" 공통 등급제 대신 **의미 있는 카테고리 색**. 10대는 "내 과목이 어느 색" 을 기억하면 앱 전체 탐색이 빨라짐
- **구현**: 6색 팔레트 시작 권장
  - 수학: `#FAC000` (Electric)
  - 영어: `#2980EF` (Water)
  - 국어: `#F584A8` (Psychic)
  - 과학: `#3FA129` (Grass)
  - 사회: `#915121` (Ground)
  - 증명: `#5060E1` (Dragon)
- 각 카드/칩/dot 에 좌측 3px border 혹은 8px dot 형태로 적용
- **독트린 적합**: O — "채도 높은 단색 1~2개 + 타입 컬러 5~6색" 독트린 직인용
- **난도**: Low (토큰만 정의)
- **임팩트**: High (전체 앱 인상이 "게임" 처럼 바뀜)

### #4. Stamp 적립 시스템 (공포→보상 전환)

- **출처**: Pokemon Sleep stamps
- **왜 먹히는가**: 연속 스트릭은 하루 놓치면 0. stamp 는 놓쳐도 소실 없음 → 웰니스 독트린과 일치하면서 "모으는 재미" 유지
- **구현**: 단어 세션 1개 완료 = stamp 1개. 7개 모이면 box 오픈 연출 (1회 220ms 카드 뒤집기, 그 이상 안됨). 월간 달력에 stamp 격자로 시각화
- **독트린 적합**: O
- **난도**: Medium (백엔드 스탬프 집계 + 월간 달력 UI)
- **임팩트**: Medium-High

### #5. Apple Fitness+ 스타일 "큰 카테고리 카드"

- **출처**: Apple Fitness+ Fitness+ 탭 12 카테고리
- **왜 먹히는가**: 카테고리가 "타일" 로 제시되면 카탈로그처럼 진지하고 재미있음. 리스트 UI 는 학원 숙제 느낌
- **구현**: "오늘의 단어 / 오늘의 증명 / 오늘의 숙제 / 오늘의 시험" 2×2 그리드, 각 카드는 **타입 컬러 백그라운드 + 흰 bold 라벨 + 우하단 mono 숫자 (남은 개수)**
- **독트린 적합**: O (글라스 금지, 단색 채도)
- **난도**: Low
- **임팩트**: High (첫인상 업그레이드)

### #6. 극단적 타입 스케일 위계 (64px → 12px)

- **출처**: Notion Calendar (5.3:1 비율)
- **왜 먹히는가**: 색/보더 없이도 위계 완성 → 화면이 조용해짐 → "잘 만들어진" 톤
- **구현**:
  - 숫자 (점수/카운트): 48~64px Pretendard Black, mono-digit
  - 카드 제목: 18~20px Pretendard Bold
  - 본문: 15~16px Pretendard Medium
  - 보조 라벨: 11~12px Pretendard Medium UPPERCASE letter-spacing +0.5px
- **독트린 적합**: O (Pretendard 유지, Jua 금지, mono-digit 숫자)
- **난도**: Low (토큰만 정의)
- **임팩트**: High

### #7. 9% 불투명 얇은 보더 + 단일 섀도우

- **출처**: Notion Calendar
- **왜 먹히는가**: "굵은 보더" 독트린과 충돌 없이 **"조용한 정리감"** 추가. 색을 줄이면서 구조를 보이게 함
- **구현**:
  - 섹션 분할: `border: 1px solid rgba(0,0,0,0.09)`
  - 카드 호버/선택: `border: 2px solid [타입 컬러]` (여기서는 "굵은 보더" 적용)
  - 단일 섀도우: `0 4px 12px rgba(0,0,0,0.12)` — 오직 팝오버/모달에만
- **독트린 적합**: O (굵은 보더는 "선택된 상태" 에만, 평시 9%)
- **난도**: Low
- **임팩트**: Medium

### #8. 세션 내 정답 피드백: 200ms border flash + mono 카운터

- **출처**: Duolingo 색 피드백 + Apple Fitness+ 간결한 완료 UI + 독트린 모션 규칙
- **왜 먹히는가**: Duolingo의 bounce/confetti 는 "초등", 그러나 색 신호 자체는 즉각적 이해. 짧은 border flash 는 "게임" 이지만 자극적이지 않음
- **구현**:
  - 정답: 카드 border 를 2px → 4px 초록 (`#3FA129`) 으로 220ms ease-out-quart, 동시에 상단 카운터 숫자 `+1` mono flip
  - 오답: 동일 시간 빨강 (`#E62829`) border, shake 금지, 카운터 정지
  - 사운드는 기본 off, 설정에서 짧은 mallet 톤만 opt-in
- **독트린 적합**: O (200~250ms, 한 시점 한 모션, sparkle 없음)
- **난도**: Low
- **임팩트**: High (매 문제마다 느낌)

### #9. 도감(카탈로그) 스타일 단어/증명 라이브러리

- **출처**: Pokemon GO 도감 + Sololearn 배지 시스템
- **왜 먹히는가**: 10대가 "수집" 에는 여전히 긍정적. 단, 도감은 "번호 + 이름 + 타입 색" 의 중립적 수집이라 "가챠" 느낌 없음
- **구현**:
  - 그리드 셀: 정사각형, 번호 좌상단 mono (`001`), 이름 하단 Pretendard Bold, 좌측 3px 타입 컬러 border
  - 미획득은 `rgba(0,0,0,0.09)` 회색톤 + 물음표 outline
  - 필터: 타입별 칩 탭 (상단 고정)
- **독트린 적합**: O (영문 등급 없음, 이모지 없음)
- **난도**: Medium
- **임팩트**: Medium-High (재방문 유도)

### #10. 상단: 숫자 대시보드 / 하단: 4탭 네비게이션

- **출처**: Apple Fitness+ Summary + Pokemon GO 탭바 + Pokemon Sleep 홈
- **왜 먹히는가**: "드로어 햄버거" 는 SaaS 느낌. "하단 탭 4개" 는 게임/앱 네이티브 느낌. 10대는 뒤로가기가 아니라 탭 전환에 익숙
- **구현**:
  - 하단 탭: **홈 / 학습 / 도감 / 나**
  - 상단 헤더는 최소화 (타이틀 + 프로필 원형), **햄버거 금지**
  - 각 탭 선택 시 아이콘 fill 만 바뀜, 튀는 bounce 없음
  - 홈 탭 최상단에 주간 리듬 띠 + 오늘 점수 큰 mono 숫자
- **독트린 적합**: O
- **난도**: Medium (라우팅 재구조)
- **임팩트**: High (앱 전체 인상 변경)

---

## 4. 안티패턴 리스트 (절대 따라 하지 말 것)

### 4.1 시각적 안티패턴

- **Duo 마스코트 / 크라잉 올빼미 푸시** — "patronizing", 10대 불쾌 반응 사례 존재
- **Confetti · sparkle · stars · glow** — "초등톤" 즉시 확정
- **Bounce / elastic / spring** 과도한 애니 — "baby app" 시그널
- **Glassmorphism / blur 카드** — 2020 레트로, 10대 "old" 반응
- **그라디언트 텍스트** — AI slop 대명사
- **파스텔 cream/berry 팔레트** — Finch/Forest 같은 "힐링 초딩앱" 톤
- **Common · Rare · Epic · Legendary 영문 등급** — 가챠 RPG 클리셰. 도감의 중립적 수집과 정반대
- **SSR / SR / R / N** — 일본 가챠 시장 바깥에서는 조롱 대상
- **이모지 아이콘 버튼** (🔥 🎉 ⭐ 💎) — 모두 SVG 아이콘으로 교체 필수
- **둥근 마스코트 얼굴 캐릭터** — 독트린 정면 위반. 마스코트 쓰려면 실루엣/기하 형태만
- **회색 SaaS 대시보드** — "선생님 관리 툴" 느낌. 학생 앱에서 치명적

### 4.2 카피 안티패턴

- "**AI가 친절하게 ~해드릴게요**", "**AI 선생님이 응원합니다**" 류 — 10대가 "AI 티 팍팍" 이라 인식, 즉시 신뢰도 저하
- "**대단해요!**", "**최고예요!**", "**굉장해요!**" 감탄사 피드백 — "애들한테 하는 말". 대신 수치 (`+10 XP`) 만
- "**열심히 했군요~**" 같은 물결 어미 — 친근한 척하다 실패
- "**Fantastic!**", "**Awesome!**" 영문 감탄사 — 미국 소프트뱅크 교육앱 톤, 한국 중·고생 거부 반응 강함

### 4.3 구조 안티패턴

- **햄버거 메뉴 + 사이드 드로어** — SaaS 웹앱 패턴, 모바일 네이티브 감 없음
- **끝없는 무한 스크롤 피드** — 학습 앱은 하루 할 것이 정해져 있어야 함. TikTok 모방 금지
- **"오늘 할 일 0개" 빈 상태에서 마스코트가 손 흔드는 UI** — 비어있으면 "고요하게" 비어있어야 함 (Pokemon Sleep 의 검은 자기 전 화면 참고)
- **"공부 시간 누적 = 순위" 리더보드 전면 노출** — 하위권 학생 이탈 주요 원인. 친구별 cheer는 허용하되 전체 순위는 피하기
- **레벨업 모달 풀스크린 takeover** — 학습 흐름 끊음. 상단 toast 나 프로필 아이콘의 숫자 변경으로 충분

---

## 5. 레퍼런스 URL / 이미지 소스

### Tier 1 (깊이 분석)

**Pokemon Sleep**
- [Pokemon Sleep 공식](https://www.pokemonsleep.net/en/)
- [Bulbapedia: Pokemon Sleep](https://bulbapedia.bulbagarden.net/wiki/Pok%C3%A9mon_Sleep)
- [Game8: Best Bedtime Rewards](https://game8.co/games/Pokemon-Sleep/archives/419834)
- [Pokemon Sleep 공식 FAQ](https://support.pokemon.com/hc/en-us/articles/17264561707796-Pok%C3%A9mon-Sleep-Gameplay-FAQ)
- [HowToGeek: Screen Time 분석](https://www.howtogeek.com/how-pokmon-sleep-helped-me-cut-down-my-screen-time/)

**Duolingo**
- [925studios: Duolingo UX Breakdown](https://www.925studios.co/blog/duolingo-design-breakdown)
- [Blake Crosley: Duolingo Gamification](https://blakecrosley.com/guides/design/duolingo)
- [Premjit Singha: Streak 상세 분석](https://medium.com/@salamprem49/duolingo-streak-system-detailed-breakdown-design-flow-886f591c953f)
- [Orizon: Duolingo Gamification Secrets](https://www.orizon.co/blog/duolingos-gamification-secrets)
- [UserGuiding: Duolingo Onboarding](https://userguiding.com/blog/duolingo-onboarding-ux)
- [UI Change Users Want 2025](https://duolingoguides.com/ui-change-that-duolingo-users-want/)

**Apple Fitness+**
- [Apple Fitness+ 공식](https://www.apple.com/apple-fitness-plus/)
- [App Store: Apple Fitness](https://apps.apple.com/us/app/apple-fitness/id1208224953)
- [mindbodygreen: Fitness+ Review](https://www.mindbodygreen.com/articles/apple-fitness-plus-review)
- [Pimp My Type: Fitness App 타이포 리뷰](https://pimpmytype.com/review-fitness-app/)
- [Apple HIG: Typography](https://developer.apple.com/design/human-interface-guidelines/typography)
- [Apple HIG: Workouts](https://developer.apple.com/design/human-interface-guidelines/workouts)

**Pokemon GO**
- [Pixso: Pokemon GO UI 분석](https://pixso.net/tips/pokemon-go-ui/)
- [Pokemon GO Hub: UI 원칙](https://pokemongohub.net/post/article/lets-talk-does-pokemon-go-meet-the-principles-of-ui-design/)
- [Game UI Database: Pokemon GO](https://www.gameuidatabase.com/gameData.php?id=1317) (접근 403 — VPN 필요할 수 있음)
- [Bulbapedia: Color templates](https://bulbapedia.bulbagarden.net/wiki/Help:Color_templates)
- [Pokemon Aaah ColorDex](https://www.pokemonaaah.net/art/colordex/) (접근 403 — 웹 아카이브 권장)

### Tier 2

**Notion Calendar**
- [Blake Crosley: Notion Calendar 상세 스펙](https://blakecrosley.com/guides/design/notion-calendar)
- [Designyourway: Notion Font](https://www.designyourway.net/blog/what-font-does-notion-use/)

**Quizlet / Anki**
- [Coursebox: Quizlet vs Anki](https://www.coursebox.ai/blog/quizlet-vs-anki)
- [makeuseof: Anki vs Quizlet](https://www.makeuseof.com/anki-vs-quizlet/)
- [Anki 공식](https://apps.ankiweb.net/)
- [FlashcardLab 비교](https://flashcardlab.co/blog/choosing-the-best-flashcard-app-a-thorough-review-of-anki-quizlet-flashcard)

**Sololearn**
- [Sololearn Badges 가이드](https://www.sololearn.com/en/Discuss/316122/public)
- [Career Karma: Sololearn Review](https://careerkarma.com/blog/sololearn-app-review/)
- [Common Sense Media: Sololearn](https://www.commonsensemedia.org/app-reviews/sololearn-learn-to-code)

### 팔레트 참고

- [Bulbapedia Type Color Templates](https://bulbapedia.bulbagarden.net/wiki/Help:Color_templates)
- [Pokepalettes](https://pokepalettes.com/)
- [SchemeColor: Pokemon](https://www.schemecolor.com/pokemon-colors.php)

### 비교/배경 연구

- [Medium: Finch vs Habitica 온보딩](https://medium.com/design-bootcamp/main-character-energy-how-two-habit-building-apps-build-motivation-in-onboarding-a3d144bd2818)
- [UX for Kids (비교용)](https://www.lullabot.com/articles/ux-kids-personal-journey)
- [Gapsy: UX Design for Kids](https://gapsystudio.com/blog/ux-design-for-kids/)

### 접근 불가 / 주의

- `gameuidatabase.com` — 403 응답 (IP/국가 차단 가능성). 내용은 수동 캡처/아카이브 활용 필요
- `pokemonaaah.net` — 403 응답. Wayback Machine 경유 권장

---

## 부록 A. 와와 학습 앱 색 토큰 제안 (draft)

```
/* Base */
--bg:            #FFFFFF;
--surface:       rgb(247,247,245);
--text-1:        rgba(0,0,0,0.9);
--text-2:        rgba(0,0,0,0.54);
--text-3:        rgba(0,0,0,0.35);
--border-quiet:  rgba(0,0,0,0.09);
--border-strong: rgba(0,0,0,0.2);
--shadow-pop:    0 4px 12px rgba(0,0,0,0.12);

/* Primary (채도 1색) */
--primary:       #2980EF;  /* Water blue — 차가운 웰니스 + 집중 */

/* Accent (채도 1색 보조) */
--accent:        #FAC000;  /* Electric — 숫자/성과 강조용 */

/* 과목 타입 컬러 (6색, 포켓몬 타입 차용) */
--subject-math:    #FAC000; /* Electric */
--subject-english: #2980EF; /* Water */
--subject-korean:  #F584A8; /* Psychic */
--subject-science: #3FA129; /* Grass */
--subject-social:  #915121; /* Ground */
--subject-proof:   #5060E1; /* Dragon */

/* 상태 */
--success:       #3FA129;
--error:         #E62829;
```

## 부록 B. 모션 규칙 (독트린 강제)

- 기본 duration: **220ms**, easing **ease-out-quart** `cubic-bezier(0.25, 1, 0.5, 1)`
- 모달 진입: `fade + translateY(8px→0)` 220ms
- 카드 selection: `border 2px color flash` 220ms, 이후 유지
- 정답 피드백: `border color flash` 220ms → 다음 문제 slide 180ms
- 금지: `infinite`, `bounce`, `sparkle`, `glow`, `spin`, stagger > 3항목
- 페이지 진입 stagger: 최대 3개 카드, 각 80ms 지연
