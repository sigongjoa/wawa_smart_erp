---
name: "[Audit] 카테고리"
about: 단일 카테고리에 대한 audit 진행 트래킹
title: "[audit] <category-id>"
labels: ["audit"]
---

## 카테고리

- **ID**: <예: student-auth-home>
- **앱**: <app:desktop / app:student>
- **부모 epic**: #__

## 대상 페이지

`design/CATEGORIES.md` 정의 그대로 옮겨 적습니다.

- `apps/<app>/src/pages/...`
- `apps/<app>/src/pages/...`

## 진행 체크리스트

- [ ] `/audit <대상>` 1차 실행
- [ ] Playwright 스크린샷 캡처 → `design/audits/<라운드>/screenshots/<category>/`
- [ ] 결과 리포트 작성 → `design/audits/<라운드>/<category>.md`
- [ ] P0 발견 항목 별도 이슈로 분리 (`audit:p0` 라벨)
- [ ] P1 발견 항목 별도 이슈 또는 본 이슈에서 PR 작업
- [ ] P2/P3는 본 이슈 코멘트로 누적 (batch 처리 대상)
- [ ] 1차 개선 완료 후 재audit으로 회귀 검증
- [ ] 카테고리 종료 — 점수표를 `_index.md`에 반영

## audit 출력 요약

(audit 실행 후 코멘트로 누적)

| 영역 | 점수 | 주요 발견 |
|---|---|---|
| 접근성 | | |
| 시각 일관성 | | |
| 타이포 | | |
| 반응형 | | |
| 인터랙션 | | |

## 분리된 P0/P1 이슈

- [ ] #__
- [ ] #__

## 결과물 링크

- 리포트: `design/audits/<라운드>/<category>.md`
- 스크린샷: `design/audits/<라운드>/screenshots/<category>/`
