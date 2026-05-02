# 카와이/캐릭터 수집 모바일 앱 디자인 레퍼런스 조사

**의뢰**: `mockup-evolution-cute-mobile.html` 의 "AI가 만든 티" 잔존 원인을 양산형 카와이 앱(Pokemon Sleep, Tamagotchi, Tsum Tsum, Animal Crossing PC, Duolingo, Finch)과 대조하여 진단하고 개선 방향 도출.

**날짜**: 2026-04-18
**조사 깊이**: standard (2 hop, 8개 검색)
**Confidence**: 중상 — 1차 디자인 가이드(Duolingo) + 3rd-party teardown(Finch, ACPC, Tamagotchi)에 근거. 단, Pokemon Sleep / Tsum Tsum 의 1차 디자인 자료는 비공개라 스크린샷·간접 분석에 의존.

---

## Executive Summary

우리 mockup의 잔존 AI-tell은 **장식 밀도** 문제가 아니라 **레퍼런스 부재로 인한 구조 오류**였다. 양산형 앱들은 공통적으로:

1. **ONE 캐릭터가 화면을 지배** — 다른 모든 요소는 보조
2. **배경은 단색 또는 1개의 소프트 그라디언트** — 절대 텍스처를 쌓지 않음
3. **커스텀 핸드레터링 워드마크** — Google Fonts(Caveat)는 1차 시그니처로 쓰지 않음
4. **장식이 아니라 캐릭터 자체의 idle motion(눈깜빡, 호흡)으로 "살아있는 느낌" 표현**
5. **카드/박스 사용을 의외로 절제** — Duolingo의 Duo는 흰 배경 위에 단독으로 서 있음

우리 mockup은 정반대 방향이었다 — 작은 캐릭터 + 많은 보조 요소 + 다중 카드 + 손글씨 폰트 + 배경 텍스처. 이 구성 자체가 "ChatGPT-에게-카와이-앱-만들어줘" 결과물의 시그니처다.

---

## 레퍼런스 별 핵심 설계 원칙

### 1. Duolingo (가장 신뢰도 높은 1차 자료)

> "use the fewest details needed to get the point across" — 공식 디자인 가이드라인

- **Shape language**: bright, bouncy, round. 이전의 flat/pointy를 버림
- **밀도 원칙**: 너무 적으면 혼란, **너무 많으면 한눈에 안 읽힘** — 명시적 경고
- **컬러**: 흰 배경 + vibrant 색. 무광·라이트그레이 금지로 명시
- **마스코트는 단독으로 흰 배경 위에 서 있음** — 주변 장식 없음
- **Real-time animation engine** (Rive State Machine) — 캐릭터가 사용자 입력에 반응
- 시사점: 우리는 토토 주변에 ✿/♡/✦를 흩뿌렸지만, Duolingo는 Duo 주변을 **비워둔다**.

### 2. Finch (가장 가까운 카테고리 — self-care + 캐릭터 양육)

- **스큐어모피즘 + 파스텔** + 둥근 모서리 — "app fatigue 줄이기"가 명시적 의도
- 캐릭터 시그니처: **head tilt + blink** = "active listening" 비언어 표현
- **단점으로 명시된 것**: "many pages can be cluttered", "dense layout, lots going on, especially if you're new"
- 시사점: **카와이 앱이 망하는 가장 흔한 길이 "정보 밀도 폭주"** — 우리 mockup의 today missions + dex + maker-lock 한 화면 동거가 이 패턴
- 시사점 2: 캐릭터 행동 설계가 "감정 디자인"의 핵심 — 우리는 breathe + blink만 있음, **시선/귀 움직임/가끔 사용자 쪽 보기** 같은 layer 부재

### 3. Tamagotchi (40년 검증된 원형)

- "Simple pixelated faces displaying joy, fatigue, illness" — **얼굴 표정 단 하나로 모든 상태 전달**
- "Tamagotchi Gestures" — 효율적이지 않아도 charm을 위해 남기는 의도된 비효율
- 보조 UI는 화면 위쪽 막대(배고픔/에너지/위생) 하나
- 시사점: 우리의 LV.2 + 67/100 exp + 312/500 단어 + 8/30 도감 = **4개의 동시 게이지**. Tamagotchi는 1개.

### 4. Animal Crossing Pocket Camp

- "simplicity and well-rounded interface, very intuitive"
- 사용자 커스터마이징(꾸미기)은 화려하지만, **시스템 UI 자체는 절제**
- pastel sunset + 단색 백그라운드 + 캐릭터 일러스트 중심
- 시사점: "꾸미기 가능"과 "기본 UI가 꾸며져 있음"은 다르다. 우리는 후자.

### 5. Pokemon Sleep

- 박사(Neroli) 캐릭터 + Snorlax + 파스텔 보라/노랑/크림
- 메인 화면: **거대한 Snorlax + 그 위에 자는 Pokemon들** — 다른 UI는 모두 화면 가장자리로
- "수면 스타일 연구" 라는 **세계관 메타포 1개**로 모든 요소 정렬
- 시사점: 우리 mockup의 "스티커 다이어리" 메타포는 좋으나, **다이어리 페이지·도감·메이커·교사 노트가 한 화면에 공존**하면 메타포가 깨진다. ACPC도 캠프장/도감/공방을 화면을 분리한다.

### 6. Kawaii 디자인 일반

- 핵심 형태: "**massive heads with innocent features, beady eyes**" + little bodies
- **커스텀 핸드레터링이 표준** — Caveat, Hi Melody 같은 Google Fonts cursive는 양산형 앱에서 1차 시그니처로 안 씀
- Pop kawaii (밝은 원색) vs Pastel kawaii (소프트 톤) — 두 갈래만 존재. 섞으면 망함

---

## 우리 mockup 진단 (대조 결과)

| 항목 | 양산형 앱 | 우리 mockup-mobile |
|------|-----------|---------------------|
| 1차 캐릭터 크기 | 화면 폭의 50–70% | ~30% (이름·exp·미션과 경쟁) |
| 배경 | 단색 or 1 그라디언트 | 단색 (✓ 이미 정리됨) |
| 워드마크 | 커스텀 SVG 핸드레터링 | Caveat 시스템 cursive |
| 동시 표시 게이지 | 1–2개 | 4개 (LV/exp/도감/단어) |
| 메타포 개수 | 1개 (수면연구/요정양육/일기) | 1개 (✓ 정리됨) |
| 캐릭터 idle 행동 layer | 3+ (눈/입/시선/귀) | 2 (호흡/눈) |
| 화면당 섹션 수 | 1–2 (탭으로 분리) | 5 (히어로/미션/진화알림/도감/공방) |
| 카드 배경 사용 | 1개 강조용만 | 모든 섹션이 카드 |

**핵심 진단**: AI-tell은 색·이모지가 아니라 **"한 화면에 모든 정보를 펼치려 한 정보 아키텍처"** 다. 양산형 앱은 캐릭터 화면을 **거의 비워둔다** — 게임 진행은 별도 탭에서 한다.

---

## 권장 개선 방향 (구현은 별도)

### P0 — 정보 아키텍처 재구성
- 첫 화면 = **캐릭터 단독 무대**. 미션·도감·공방은 하단 탭바에서 별도 화면으로
- 히어로 섹션이 viewport 100vh 차지 (현재는 작음)
- "오늘의 미션" 카드는 캐릭터 화면 하단에 1줄 요약만 ("오늘 단어 3개 더 → 토토가 자라요")

### P1 — 캐릭터 강화
- 토토 SVG를 viewport 폭 60% 크기로 확대
- idle 행동 layer 추가: 시선 추적(터치 위치 따라 눈동자 이동), 5초마다 한 번 사용자 쪽 보기, 귀 가끔 움직임
- 표정 상태 3종 (행복/배고픔/졸림) — Tamagotchi 원리

### P2 — 타이포그래피 정체성
- 헤더 "Word Gacha"를 SVG 핸드레터링으로 교체 (Caveat 의존 제거)
- 숫자(LV.2, 67/100)는 chunky display 폰트 1종 추가 (Bagel Fat One 다시 도입 검토 — 단, **숫자 전용**으로 한정)

### P3 — 메타포 정합성
- "스티커 다이어리"를 캐릭터 화면에서 **벗어나 도감 화면에만** 적용
- 캐릭터 화면은 ACPC/Finch처럼 "캐릭터의 공간(방/숲)" 메타포로 단순화

### 다음 단계
- `/sc:design` 으로 정보 아키텍처(탭 분리 구조) 설계
- 그 후 `/sc:implement` 또는 `/frontend-design` 으로 V2 mockup 작성

---

## Sources

- [Duolingo Shape Language Design Article](https://blog.duolingo.com/shape-language-duolingos-art-style/)
- [Duolingo Brand Guidelines · Characters](https://design.duolingo.com/illustration/characters)
- [How Duolingo Uses Rive for Character Animation](https://dev.to/uianimation/how-duolingo-uses-rive-for-their-character-animation-and-how-you-can-build-a-similar-rive-mascot-5d19)
- [UX Teardown: Finch Self-Care App (Medium)](https://medium.com/@deepthi.aipm/ux-teardown-finch-self-care-app-18122357fae7)
- [Design Critique: Finch (IXD@Pratt)](https://ixd.prattsi.org/2024/09/design-critique-finch-ios-app/)
- [The Magic of Finch: Where Self-Care Meets Enchanted Design](https://www.sophiepilley.com/post/the-magic-of-finch-where-self-care-meets-enchanted-design)
- [Tamagotchi: A Lesson in Emotional UX Design](https://www.ux-republic.com/en/emotional-design-what-the-tamagotchi-taught-us-without-saying-it/)
- [Tamagotchi Gestures and UX Design](https://info.keylimeinteractive.com/tamagotchi-gestures-and-ux-design)
- [What devs are saying about Animal Crossing: Pocket Camp](https://www.gamedeveloper.com/business/what-devs-are-saying-about-the-design-of-i-animal-crossing-pocket-camp-i-)
- [The Aesthetic of Animal Crossing: Pocket Camp (Crystal Dreams)](https://www.crystal-dreams.us/?p=9058)
- [Pokemon Sleep Official Press Assets](https://press.pokemon.com/en/Pokemon-Sleep/Focus/Pokemon-Sleep-Screenshots)
- [Kawaii Design: 5 Characteristics & Sub-genres (Kittl)](https://www.kittl.com/blogs/kawaii-design-guide/)
- [The Kawaiization of Product Design (Tobias van Schneider)](https://vanschneider.medium.com/the-kawaiization-of-product-design-1f0b1269e1d4)
- [Habitica Pet Collection System Wiki](https://habitica.fandom.com/wiki/Mobile_App_for_Android:_Habitica)
- [Game UI Database](https://www.gameuidatabase.com/)
