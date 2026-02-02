# Wawa Smart ERP - 통합 프로젝트 Task List

## 프로젝트 개요
- **목적**: wawa_timer, wawa_month_report, smart_grade 3개 서브모듈 통합
- **타겟 사용자**: 교사/강사 + 학원 관리자
- **기술 스택**: Electron + React/Vite + Notion DB
- **생성일**: 2026-02-02

---

## ✅ 완료된 작업

### Phase 1: Monorepo 기반 구축
- [x] pnpm workspace 설정
- [x] 프로젝트 디렉토리 구조 생성
- [x] 3개 레포지토리 코드 복사
  - [x] wawa_timer → apps/desktop/modules/timer
  - [x] smart_grade/frontend → apps/desktop/modules/grader
  - [x] wawa_month_report → apps/desktop/modules/report
- [x] Wear OS 앱 external로 분리
- [x] 공유 패키지 생성
  - [x] @wawa/notion-client
  - [x] @wawa/shared-types
- [x] Electron 쉘 기본 코드 작성
- [x] 통합 웹 인터페이스 (index.html)
- [x] 개발 서버 테스트
  - [x] Timer 모듈 (:5176)
  - [x] Grader 모듈 (:5174)
  - [x] 통합 ERP (:8080)

---

## 🔄 진행 중

### Report 모듈 설치
- [ ] vite 버전 호환성 문제 해결
- [ ] npm install 완료
- [ ] 개발 서버 실행 확인 (:5175)

---

## 📋 TODO

### Phase 2: Notion 연동
- [ ] `.env` 파일 생성 및 설정
  ```
  NOTION_API_KEY=your_api_key
  NOTION_DB_STUDENTS=database_id
  NOTION_DB_SCHEDULES=database_id
  NOTION_DB_GRADES=database_id
  NOTION_DB_REPORTS=database_id
  ```
- [ ] notion-client 패키지 완성
  - [ ] 학생 CRUD 메서드
  - [ ] 시간표 CRUD 메서드
  - [ ] 성적 CRUD 메서드
  - [ ] 보고서 CRUD 메서드
- [ ] 각 모듈에 Notion 연동
  - [ ] Timer: 시간표 데이터 연동
  - [ ] Grader: 성적 데이터 저장
  - [ ] Report: 보고서 생성 및 조회
- [ ] 오프라인 캐싱 구현 (로컬 SQLite)

### Phase 3: 데이터 통합
- [ ] 모듈 간 통신 구현
  - [ ] postMessage API 설정
  - [ ] 메시지 타입 정의 (shared-types)
  - [ ] 이벤트 브로드캐스트 시스템
- [ ] 데이터 연동 시나리오
  - [ ] 학생 선택 → 전 모듈 동기화
  - [ ] 채점 완료 → 보고서 자동 반영
  - [ ] 시간표 변경 → 관련 데이터 업데이트
- [ ] 대시보드 실데이터 연동
  - [ ] 오늘 수업 카운트
  - [ ] 채점 대기 건수
  - [ ] 이번 달 보고서 수

### Phase 4: UX 개선 및 배포
- [ ] UI/UX 개선
  - [ ] 통합 검색 기능
  - [ ] 알림 시스템
  - [ ] 다크/라이트 테마
- [ ] Electron 빌드 설정
  - [ ] electron-builder 설정 완성
  - [ ] Windows 빌드 테스트
  - [ ] 자동 업데이트 설정
- [ ] CI/CD 파이프라인
  - [ ] GitHub Actions 워크플로우
  - [ ] 자동 빌드/릴리스
  - [ ] 버전 관리

---

## 📁 프로젝트 구조

```
wawa_smart_erp/
├── pnpm-workspace.yaml
├── package.json
├── tsconfig.json
├── .gitignore
├── task.md                    # 이 파일
│
├── apps/
│   └── desktop/
│       ├── package.json
│       ├── vite.config.ts
│       ├── src/
│       │   ├── main/          # Electron main
│       │   ├── preload/       # IPC bridge
│       │   └── renderer/      # 통합 UI
│       └── modules/
│           ├── timer/         # 시간표 관리
│           ├── grader/        # AI 채점
│           └── report/        # 월간 보고서
│
├── packages/
│   ├── notion-client/         # Notion API 래퍼
│   └── shared-types/          # 공유 타입
│
└── external/
    └── wear-os-app/           # Wear OS (별도 관리)
```

---

## 🔗 개발 서버 URL

| 모듈 | URL | 설명 |
|-----|-----|------|
| 통합 ERP | http://localhost:8080 | 메인 인터페이스 |
| Timer | http://localhost:5176 | 시간표 관리 |
| Grader | http://localhost:5174 | AI 채점 |
| Report | http://localhost:5175 | 월간 보고서 |

---

## 📝 참고사항

### Notion DB 스키마 (예상)
- **학생 DB**: 이름, 학년, 연락처, 학부모 연락처
- **시간표 DB**: 학생ID, 요일, 시작시간, 종료시간, 과목
- **성적 DB**: 학생ID, 과목, 점수, 날짜, 시험유형
- **보고서 DB**: 학생ID, 월, 출석요약, 성적요약, 코멘트

### 기존 레포지토리
- https://github.com/sigongjoa/wawa_timer
- https://github.com/sigongjoa/wawa_month_report
- https://github.com/sigongjoa/smart_grade
