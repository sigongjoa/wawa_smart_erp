# Word Gacha — UI 레퍼런스 리서치

**Date**: 2026-04-19
**Scope**: 포켓로그, 디지로그, 유사 모바일 수집/학습 게임 5종
**Goal**: v3 mockup(`docs/wordgacha-v3-clean.html`)이 "너무 페이지 같다"는 피드백 해결 → 모바일 게임 앱의 뼈대 이식
**Target audience**: 중2~고등학생 학원생 (유치한 거 거부하지만 게임 요소는 환영)

---

## 1. 포켓로그 (PokéRogue) — 확인됨

**정체**: Phaser3 기반 브라우저 팬게임. 포켓몬 배틀 엔진 + 로그라이트. 2024년 한국어화 완료.

### UI 특징
- **완전 픽셀 게임 UI** — 모든 화면이 Phaser3 canvas 내부에 렌더
- **클래식 포켓몬 GBA 텍스트박스** — 하단 고정, 모서리 각진 패널, 2px 굵은 보더, 내부 자간 큰 픽셀 폰트
- **스타터 선택**: 중앙 그리드(회색 박스) + 좌측 상세 패널 + 우측 파티 슬롯 + 빨간 사각 셀렉터
- **배틀 HUD**: 상단 상대 포켓몬 HP/이름플레이트 + 하단 자기 포켓몬 HP + 기술 4버튼 그리드
- **상점**: 매 웨이브 후 오버레이 패널, 아이템 아이콘 그리드
- **도감(Pokédex)**: 타입별 색 코딩 박스, 각 포켓몬 미니 스프라이트

### Word Gacha 에 가져올 것
- ✅ **각진 패널 보더** (2px, 둥근 코너 최소화) — 게임 콘솔 느낌
- ✅ **영역별 명확한 구획** (좌측 정보 / 중앙 그리드 / 우측 파티)
- ✅ **하단 고정 텍스트박스** 개념 — 마스코트가 말하는 대화창
- ❌ 픽셀 폰트 자체는 NO (초등처럼 보임, .impeccable.md 위배)

**출처**: [PokéRogue Wiki](https://wiki.pokerogue.net/guides:new_player_guide), [나무위키 PokéRogue](https://namu.wiki/w/Pok%C3%A9Rogue), [GitHub](https://github.com/pagefaultgames/pokerogue), [한국 위키](https://wiki.pokerogue.net/ko:start)

---

## 2. 디지털 테이머즈: ReBorn / Digital Tamers 2 — ⭐ 핵심 레퍼런스

**정체**: dragonrod342 개발, itch.io 배포. **Digimon World Championship (DS, 2008) 정신적 후속작** + Digimon Battle Spirit (GBA) 요소. Windows/Android. ReBorn v2.2.2 (2023 최종) → Digital Tamers 2 (2024 출시, 380+ 디지몬).

### UI/시스템 핵심 구조

**메인 허브 = Tamagotchi + 디지털 농장**
- 중앙에 **내 디지몬이 걸어다님** (정적 아바타 아님)
- 플레이어는 **케어를 해줌** — 먹이, 훈련, 휴식, 치유, 청소, 진화
- 좌측 사이드바: 상태 정보 + 네비게이션
- 중앙 영역: 액티브 플레이 / 디지몬 인터랙션 공간
- 우측 패널: 아이템 관리 / 스탯

**메뉴 모듈 구성 (탭 아님, 기능별 "방")**
- 먹이주기 / 훈련 / 진화 / 퀘스트 로그
- 각 기능이 고유 화면 영역 차지

**배틀 UI**
- 하단좌 클릭 가능 커맨드 버튼 (Z/X/C/Shift/Space 대응)
- HP/스탯 상단 오버레이
- 2D 사이드 뷰 픽셀 스프라이트

**컬렉션 시스템**
- 500+ 디지몬 도감 (ReBorn), 380+ (DT2)
- 진화 요구사항 화면에서 시각화
- 특화 XP별 진화 분기 (예: dark XP 1500 → Keramon→Chrysalimon)

### Word Gacha 에 가져올 핵심 패턴

**1. "방"으로서의 홈 — 이것이 v3의 근본 해결책**
> 홈은 대시보드가 아니라 **내 마스코트가 사는 공간**
> 단어/퀴즈는 "방 안의 물건"처럼 배치 — 책상, 책장, 칠판, 퀘스트 보드

```
┌──────────────────────────────┐
│  [HUD]  LV·EXP·스트릭         │
├──────────────────────────────┤
│                              │
│    📚 책장       🎯 칠판      │
│   (내 단어장)   (오늘 퀴즈)    │
│                              │
│         🐾                   │  ← 마스코트 걸어다님
│                              │
│    📝 노트       🏆 도감      │
│   (문법 Q&A)   (수집)         │
│                              │
├──────────────────────────────┤
│  [마스코트 대사 패널]         │
└──────────────────────────────┘
```

물건을 탭하면 해당 기능으로 진입. 이게 Digital Tamers 의 "hub with creature walking" 패턴.

**2. 케어 메타포 = 학습 행동**
| Digital Tamers | Word Gacha |
|---|---|
| 먹이주기 (식사) | 새 단어 학습 |
| 훈련 (스탯업) | 퀴즈 풀기 |
| 휴식 (HP회복) | 복습 (기억 정리) |
| 진화 | Leitner Box 1→5 승급 |
| 챔피언십 | 주말/월말 모의고사 |

**3. 사이드바 + 중앙 + 우측패널 3단 구도**
모바일에서는 스크롤이지만, 각 "방" 진입 시 이 구도 유지 가능. 예: 퀴즈 화면 → 좌측 마스코트 상태 / 중앙 단어 카드 / 우측 진행도.

**4. 진화/성장의 시각적 표현**
Word Gacha 의 Box 1→5 를 그냥 pip 5개로 표현 말고, **작은 진화 일러스트** (단어가 "어린 단어"에서 "완성된 단어"로 성장하는 비주얼)로. 포켓몬 EXP 바 같은 단순 게이지보다 디지몬 진화 트리 같은 분기 시각화.

### 나무위키/커뮤니티 언급

사용자가 "디지로그"라고 부른 것은 이 팬게임의 약칭/별칭일 가능성 높음. 정식 제목은 **Digital Tamers: ReBorn** (줄여서 DT:R, DTR) 및 **Digital Tamers 2** (DT2).

### 출처
- [Digital Tamers 2 (itch.io)](https://dragonrod342.itch.io/digital-tamers-2) — 공식 배포
- [Digital Tamers: ReBorn (itch.io)](https://dragonrod342.itch.io/digital-tamers-reborn)
- [Digital Tamers 2 Wiki — Grindosaur](https://www.grindosaur.com/en/games/digital-tamers-2)
- [Fan:Digital Tamers: ReBorn — DigimonWiki](https://digimon.fandom.com/wiki/Fan:Digital_Tamers:_ReBorn)
- [VirtualPetList forum](https://www.virtualpetlist.com/showcase/digital-tamers-2.223/)
- [Digimon World Championship (DS) — 시초 게임, GameFAQs](https://gamefaqs.gamespot.com/ds/943756-digimon-world-championship)

---

## 2-A. 기타 디지몬 후보 (비관련)

참고로 검색에서 발견된 다른 디지몬 게임들 — **Word Gacha 레퍼런스로는 부적합**:
- **Digimon: Virus Version / Nova Red** — Pokemon FireRed ROM 해킹 (RPG, 모바일 톤 아님)
- **Digimon Super Rumble** — 한국 MMO (2021, Unreal 4, PC)

이들은 배제하고 **Digital Tamers: ReBorn/2** 만 핵심 레퍼런스로 채택.

---

## 3. 모바일 학습/수집 게임 공통 뼈대

### A. Pokémon Sleep (Niantic/TPC, 2023)
- **씬 기반 홈** — 침실 디오라마 + 잠든 포켓몬이 모여있음. 카드 스택 아님.
- **중앙 Pikachu 버튼** — 수면 측정 시작 CTA가 캐릭터 자체
- **리포트 화면** — 카드 + 수면 그래프, 클래식 대시보드지만 상단에 씬 배치
- **도감(Sleep Styles)** — 포켓몬 자세별 수집, 다이어리/연구노트 톤
- **컬러**: 밤-블루 + 따뜻한 포인트 색. 파스텔 아님, 채도 살아있음.

### B. Duolingo (2012~)
- **Learning Path** — 세로 스크롤 트리, 레슨 노드 = 동그란 버튼
- **마스코트 3D primitive** — Duo(올빼미), Lily, Oscar 등 (구/큐브/필 조합)
- **상단 HUD 바** — 국기 | 스트릭 🔥 | 다이아 | XP 하트 (가로 4분할)
- **레슨 중 캐릭터** — 말풍선으로 대화 전달 (포켓몬 텍스트박스 DNA)
- **컬러**: 초록 primary + 레슨별 보조색 + 대비 높은 버튼 (입체 3D 느낌)

### C. Finch (2021, self-care pet)
- **펫 protagonist** — 알 부화 → 이름 → 성격 선택 (애착 형성)
- **Idle 애니메이션** — 눈 깜빡, 머리 갸우뚱, 주위 보기 (살아있음 느낌)
- **에너지바 = 목표 달성** 직접 연결 (게임 메타포가 기능)
- **숲 탐험 미니 메카닉** — 루틴 완료 시 모험 진행
- **컬러**: 파스텔 쓰지만 따뜻한 중간톤, 과도한 핑크 아님

### D. Habitica (2013, RPG task manager)
- **완전 픽셀 RPG UI** + Tamagotchi 펫
- **클래스/방어구/퀘스트** 은유로 할일 관리
- **색 코딩 할일** (습관/일일/todo/보상) — 난이도 색상
- **레벨업 페이드 애니메이션** — 성취 순간 연출

### E. Cookie Run: Kingdom (Devsisters, 한국)
- **HUD 오버레이** — 게임 월드 위에 반투명 리소스 바
- **이벤트 UI 레이어** — 메인 화면 위에 패널이 "소환"되듯 등장
- **쿠키 컬렉션** — 인물 카드가 주인공, 능력치가 보조
- **한국식 게임 UI 톤** — 각진 보더 + 금속 질감 + 그라디언트 (참고용)

---

## 4. 공통 패턴 추출 — "모바일 학습 게임의 뼈대"

5개 앱에서 공통으로 발견되는 구조:

```
┌──────────────────────────────┐
│  1. HUD 바                    │  ← 항상 보이는 상태 (LV/EXP/통화/스트릭)
├──────────────────────────────┤
│                              │
│  2. Hero 영역                 │  ← 씬/펫/경로/디오라마 (리스트 NO)
│     (캐릭터 존재감 최대)       │
│                              │
├──────────────────────────────┤
│  3. Quest Log / Action       │  ← 오늘 할 것 (퀘스트 느낌, 카드 아님)
│     (보드/메모지/패널)         │
├──────────────────────────────┤
│  4. 보조 정보 (차트/피드)       │  ← 세컨더리
└──────────────────────────────┘
  [5. Tab bar 4-5개]
```

**v3가 놓친 것**:
- Hero 영역을 아예 생략 → 스크린 전체가 "카드 스택" → 페이지/대시보드 느낌
- HUD가 없음 → 게임 상태가 숨겨짐 (EXP 바는 1번만 등장)
- Quest Log 를 단순 리스트로 만듦 → 퀘스트 같지 않음
- 캐릭터가 48px 배지로 축소 → 존재감 소멸

---

## 5. Word Gacha v4 방향 제안 (Digital Tamers DNA 반영)

### 핵심 전환
> v3 = 토스 대시보드 (카드 스택 + 미니 통계)
> v4 = **Digital Tamers 스타일 "디지털 방"** (마스코트가 사는 공간 + 기능별 "물건" + 콘솔 UI 패널)
> 유지: 토스 수준의 타이포 깔끔함, .impeccable.md 컬러 규칙, `포켓로그`의 각진 보더

### 구체 설계 방향

**홈 화면**
- 상단 16px HUD 바 — `LV 12` · EXP bar 얇게 · `342` 단어 · `92일 🔥`
- Hero 영역 (화면의 40%) — 마스코트가 책상에 앉아있는 SVG 씬. 책/단어카드 주변에 흩어짐. 여기서 말풍선:
  > "오늘 복습 12개. 한 박스 올릴까?"
- Quest Log — 리스트가 아니라 **게시판 / 포스트잇** 3개 (각 task가 종이 한 장)
- 하단 CTA — 포켓몬 대화 박스 스타일 (각진 2px 보더, 우하단 ▼ 인디케이터)

**학습 퀴즈**
- 중앙 단어 카드는 유지하되, 주변에 **마스코트 리액션** 배치 (생각중/정답/오답 표정)
- 객관식 버튼을 포켓몬 기술 선택 4분할 그리드로 (좌상/우상/좌하/우하)
- 진행도 = 상단 막대가 아니라 **포켓몬 배틀풍 HP 바**

**도감**
- 타입 타일 그리드 유지하되, 각 타일 열면 **진열장/선반** 뷰로 전환 (수집 창고 느낌)
- 5단계 박스 = 포켓몬 진화 단계 비주얼 (1→5 레벨업)

**콘솔 UI 패널 스타일** (`.impeccable.md` 요구)
```
┌─────────────────────────┐
│  magnificent            │
│  ─────────────────────  │  ← 2px 이중 보더
│  /mæɡ'nɪfɪsənt/         │
│  [ADJ · BOX 2 · 3회]    │
└─────────────────────────┘
```
각진 모서리, 얇은 inner 보더, 상단 헤더 영역 구분.

**마스코트 존재감 복원**
- 홈: 120px, 표정 5종(default/wink/surprised/sleepy/celebrate)
- 퀴즈 중: 40px 피드백 아바타, 선택에 따라 표정 변화
- 도감/기록: 작은 아바타 유지 (기록 페이지는 중앙 배치)
- idle: 2초에 1번 눈깜빡 (무한 애니 NO, 인터벌 트리거)

### 건드리지 말 것 (v3에서 유지)
- ✅ SUIT Variable + Pretendard 조합
- ✅ 6색 타입 시스템 (NOUN/VERB/ADJ/ADV/PREP/CONJ)
- ✅ primary 1개 (electric blue) + hot accent 1개
- ✅ 좌측 정렬, 4-8px 라운드, 흰 배경
- ✅ Leitner 5 pips

### 건드릴 것 (v3의 페이지 느낌 제거)
- ❌ 카드 남용 → 패널+보더 구획
- ❌ "오늘의 학습" 라벨 리스트 → 게시판 UI
- ❌ 48px 배지 아바타 → 홈은 120px 씬 중심
- ❌ 주간 pace 차트를 그냥 bar → 포켓몬 상태 그래프풍 프레임
- ❌ 상단 status bar 시간만 → HUD (LV/EXP/스트릭)

---

## 6. 다음 단계 (implementation)

이 리서치는 **디자인 결정을 위한 근거**이며, 구현은 별도 `/frontend-design` 또는 `/sc:implement` 명령으로 진행.

제안 순서:
1. `docs/wordgacha-v4-game.html` 단일 파일로 홈 화면만 먼저 프로토타입
2. 사용자 리뷰 → 학습/퀴즈 화면 확장
3. 전체 5화면 완성 후 `word-gacha-mockup` 레포 배포

---

## Sources

### 포켓로그
- [PokéRogue 공식](https://pokerogue.net)
- [PokéRogue Wiki — 신규 플레이어 가이드](https://wiki.pokerogue.net/guides:new_player_guide)
- [나무위키 PokéRogue](https://namu.wiki/w/Pok%C3%A9Rogue)
- [한국 PokéRogue 위키](https://wiki.pokerogue.net/ko:start)
- [GitHub pagefaultgames/pokerogue](https://github.com/pagefaultgames/pokerogue)
- [오라시온의 감성공간 — 한국어 플레이 가이드](https://oracionspace.com/entry/%ED%8F%AC%EC%BC%93%EB%AA%AC%EC%8A%A4%ED%84%B0-%EB%A1%9C%EA%B7%B8%EB%9D%BC%EC%9D%B4%ED%81%AC-%ED%8F%AC%EC%BC%93%EB%A1%9C%EA%B7%B8-%EA%B2%8C%EC%9E%84-%ED%95%98%EB%8A%94-%EB%B0%A9%EB%B2%95-%EB%B0%8F-%ED%95%9C%EA%B5%AD%EC%96%B4-%ED%95%98%EB%8A%94-%EB%B2%95-%EA%B7%B8%EB%A6%AC%EA%B3%A0-%EC%B4%88%EB%B0%98-%EC%B6%94%EC%B2%9C-%ED%8F%AC%EC%BC%93%EB%AA%AC)

### 디지몬 관련
- [itch.io Digimon tag](https://itch.io/games/tag-digimon)
- [Digimon Nova Red (pokerogue.io 호스팅)](https://pokerogue.io/digimon-nova-red)
- [Digimon Super Rumble 포럼](https://withthewill.net/threads/new-digimon-mmo-digimon-super-rumble-announced-for-korea.25799/)

### 모바일 학습/수집 게임
- [Pokémon Sleep 공식](https://www.pokemonsleep.net/en/)
- [Pokémon Sleep — Apple App Store](https://apps.apple.com/us/app/pok%C3%A9mon-sleep/id1579464667)
- [Duolingo Dribbble 포트폴리오](https://dribbble.com/Duolingo)
- [Duolingo UILand 참고 자료](https://uiland.design/screens/duolingo/screens/3497acfe-84e0-400a-bbac-cf38c19e6b9a)
- [Finch UX Teardown — Medium](https://medium.com/@deepthi.aipm/ux-teardown-finch-self-care-app-18122357fae7)
- [Finch Design Critique — Pratt IXD](https://ixd.prattsi.org/2024/09/design-critique-finch-ios-app/)
- [Habitica App Store](https://apps.apple.com/us/app/habitica-gamified-taskmanager/id994882113)
- [Cookie Run Kingdom Behance UI](https://www.behance.net/gallery/224231889/CookieRun-Kingdom-Event-UI-Design)
- [Pokémon Café Mix — Game UI Database](https://www.gameuidatabase.com/gameData.php?id=446)

### 참고 툴
- [Game UI Database](https://www.gameuidatabase.com/) — 1,300+ 게임 / 55,000+ UI 스크린샷
- [old-pokemon-jrpg-style-message-box (GitHub)](https://github.com/scythianwizard/old-pokemon-jrpg-style-message-box)
- [pixel-ui-dialog (GitHub)](https://github.com/browsermage/pixel-ui-dialog)
