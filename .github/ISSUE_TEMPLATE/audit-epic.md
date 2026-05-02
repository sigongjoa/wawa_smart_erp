---
name: "[Epic] Audit 라운드"
about: 디자인/UX audit 라운드 전체 트래킹용 부모 이슈
title: "[Epic] <라운드명> Audit"
labels: ["epic", "audit"]
---

## 라운드 개요

- **라운드명**: <예: 2026-05 디자인 1라운드>
- **목적**: <예: 학생 앱 + 강사 앱 전 화면 디자인 품질 점검·개선>
- **결과 저장 위치**: `design/audits/<YYYY-MM>-<주제>-round-<N>/`
- **카테고리 정의**: `design/CATEGORIES.md`

## 카테고리 자식 이슈 (9개)

학생 앱 (우선)
- [ ] #__ category:student-auth-home
- [ ] #__ category:student-learning
- [ ] #__ category:student-assignments

강사 앱
- [ ] #__ category:desktop-student-mgmt
- [ ] #__ category:desktop-learning-content
- [ ] #__ category:desktop-academy-ops
- [ ] #__ category:desktop-content-distribution
- [ ] #__ category:desktop-gamification
- [ ] #__ category:desktop-medterm

## 진행 단계

- [ ] 카테고리 자식 이슈 9개 생성
- [ ] 학생 앱 3개 카테고리 audit 1차 완료
- [ ] 강사 앱 6개 카테고리 audit 1차 완료
- [ ] P0 발견 항목 별도 이슈 분리 + 우선 처리
- [ ] P1 batch PR 작업
- [ ] `/extract`로 공통 패턴 → `design/system/` 반영
- [ ] `/normalize`로 드리프트 정렬
- [ ] 라운드 종료 — `_index.md`에 카테고리별 점수표 정리

## P0/P1 분리 이슈

audit 결과 P0/P1로 판정된 항목은 이 epic 아래 별도 이슈로 만듭니다.
- [ ] #__ <분리된 P0 이슈>
- [ ] #__ <분리된 P1 이슈>

## 결과물

- `design/audits/<라운드>/_index.md` — 라운드 요약
- `design/audits/<라운드>/<카테고리>.md` — 카테고리별 리포트
- `design/audits/<라운드>/screenshots/` — Playwright 캡처
