# Project Design Doctrine

## Design Context

### Users
- **중2 ~ 고등학생** 학원생 (와와 학원). 영단어/수학 학습용 앱
- 손에 폰 들고 학원 자리에서 / 자투리 시간에 사용
- 유치한 거 거부하는 연령대. "초등용 같다" 는 평가는 실패
- 동시에 학습 도구라 게임처럼 너무 자극적이면 학부모/원장 거부

### Brand Personality (3 단어)
**잘 만들어진 · 게임 같은 · 웰니스**

- "Pokemon Sleep" / "Apple Fitness+" / "Pokemon GO" 같은 — 게임 폴리시는 갖되 도파민 사기 아님
- 정보 밀도는 진지하게, 표현은 시원하게

### Aesthetic Direction

**Yes (레퍼런스)**
- **포켓몬** — 타입 시스템(빨/파/초/노 명확한 색 코딩), HP/EXP 바, 도감/배지
- 모던 포켓몬 UI (Scarlet/Violet, Sleep, GO) — **흰 바탕 + 채도 높은 단색 + 굵은 보더**
- 게임 폴리시: 모서리/그림자/모션이 모두 의도적, 자리채우기 0
- 콘솔 UI 의 명확한 패널 구획 (대화상자, 메뉴 박스)

**No (안티 레퍼런스)**
- 지금 상태(cream/berry 파스텔 + 둥근 마스코트 + emoji 아이콘) — 초등 저학년 동화책 톤
- 무한 글로우/바운스/sparkle ✨ — Cute Mobile Template
- 회색 SaaS 대시보드
- 가챠게임 베끼는 영문 RPG 등급제 (common/rare/epic/legendary)
- "AI가 친절하게 다 적어줌" 라벨 도배

### Theme & Color
- **Light mode 우선** (학원/실내/형광등 환경). Dark는 v2
- **Pure-ish white background** + tint 살짝 (#fafbfc 정도, 크림 NO)
- **Ink = near-black blueish** (#1a1d24)
- **Primary = 채도 높은 단색 1개** — 잠정 deep red (포켓몬 빨강 계열) 또는 electric blue
- **타입 컬러 시스템** — 토템/단원/난이도를 색으로 코딩 (5~6색, 포켓몬 타입처럼)
- 그라디언트 텍스트 / 보라-파랑 그라데 / 글래스모피즘 NO

### Typography
- **Display**: 굵은 산세리프 — Pretendard Black/ExtraBold 또는 SUIT Variable (한글 게임 UI 톤)
- **Body**: Pretendard Regular/Medium (Jua 빼고)
- **Numbers/Scoreboard**: monospace 또는 굵은 산세리프 large. (LCD 느낌, Bagel Fat One 은 너무 통통해서 보류)
- **No**: Jua, Comic Sans, 이모지 아이콘

### Motion
- 빠르고 결정적 (200~250ms, ease-out-quart)
- 무한 애니 금지 (totem-glow 같은 거)
- 한 시점 한 모션 (모달 진입, 또는 히트 피드백 — 둘 다 X)
- 페이지 진입 시 staggered reveal 1회 OK

### Layout
- 모바일 우선 (max-width 480 유지)
- 카드 남용 X — 패널 구획은 보더/배경색 변화로
- 둥근 모서리 절제 (대형 4-8px, pill 만 round-full)
- 좌측 정렬 기본, 가운데 정렬 남발 X

## Design Principles (5)

1. **타입(=색)으로 의미를 전달한다** — 라벨 텍스트 줄이고 색 시스템으로 분류 (포켓몬 type chip 처럼)
2. **이모지를 아이콘으로 쓰지 않는다** — 자체 SVG 또는 통일된 라인 아이콘. OS-dependent 렌더 X
3. **마스코트 없이 정보가 주인공** — 캐릭터는 보조. 단어/숫자/배지가 화면을 이끔
4. **친절 카피 금지** — "탭하여 장착!", "EXP가 1.5배가 돼요!" 같은 설명 줄임. 디자인이 자명하면 라벨 제거
5. **모션은 한 번, 진하게** — 무한 애니 0, 진입 모션 1회만 절제하여
