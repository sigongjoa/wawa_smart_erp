---
name: design system index
description: WAWA Smart ERP는 두 앱이 서로 다른 디자인 시스템을 의도적으로 운영합니다 — desktop(Toss-inspired 운영 도구)·student(포켓몬 타입 게임 폴리시)
---

# Design System Overview

WAWA Smart ERP는 **두 개의 의도적으로 분리된 디자인 시스템**을 운영합니다.

| 시스템 | 대상 사용자 | 톤 | 시스템 문서 | 토큰 |
|---|---|---|---|---|
| **Desktop (강사·관리자)** | 학원 강사 / 원장 | Toss-inspired 운영 도구 (Deep Indigo + Warm Mint, 여백·큰 타입) | [DESKTOP.md](./DESKTOP.md) | `apps/desktop/src/index.css` `:root` |
| **Student (학생)** | 중2~고등학생 | 포켓몬 타입 시스템 게임 폴리시 (게임 같은·웰니스) | [STUDENT.md](./STUDENT.md) | `apps/student/src/styles/tokens.css` |

## 단일 진실원 (SSoT)

각 시스템은 **CSS 토큰 파일이 SSoT**입니다. 시스템 문서는 그 토큰의 의도와 제약을 설명하고, 컴포넌트 사용 규칙을 제공합니다.

- 문서와 코드가 충돌할 때는 **코드(토큰 파일)가 진실** — 문서를 갱신할 것
- 토큰 추가/변경은 토큰 파일 + 시스템 문서 동시 갱신
- 두 시스템 간 토큰 이름은 의도적으로 겹치지 않게 유지 (`--primary`는 양쪽 다르게 정의됨)

## 공통 원칙 ([IMPECCABLE.md](../IMPECCABLE.md) — Student 도크트린)

`IMPECCABLE.md`는 **학생 앱의 디자인 원칙·안티 레퍼런스**를 정의합니다. 데스크톱 앱에는 IMPECCABLE을 그대로 적용하지 않습니다 (대상이 다름).

데스크톱 공통 원칙:
1. 카드 남용 금지 — 섹션은 여백·구획선으로 분리
2. 게임 폴리시 톤 금지 — 운영자 도구는 진지함 우선
3. 정보 밀도 우선, 장식 후순위
4. 모든 상태(hover/focus/active/loading/error/empty) 정의
5. 토큰 우회 금지 — 하드코딩 hex·정적 inline style 금지

## 변경 이력

| 날짜 | 변경 |
|---|---|
| 2026-05-02 | DESIGN.md(v1.0)을 DESKTOP.md + STUDENT.md로 분리, IMPECCABLE을 student 도크트린으로 정식화 |
| 2026-04-18 | IMPECCABLE.md 작성 (student 도크트린) |
| 2026-02-02 | DESIGN.md v1.0 작성 (legacy unified, 현재 분리됨) |
