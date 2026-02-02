# DEPRECATED - 이 모듈은 더 이상 사용되지 않습니다

## 마이그레이션 완료

이 독립 report 모듈은 메인 앱 (`apps/desktop/src/modules/report/`)으로 통합되었습니다.

### 변경 사항

1. **Store 통합**: `src/stores/reportStore.ts`를 단일 Store로 사용
2. **UI 개선**: PreviewPage의 차트와 시각화 기능이 `src/modules/report/Preview.tsx`로 이식됨
3. **데이터 흐름**: 성적 입력 → 리포트 미리보기 흐름이 단일 앱 내에서 동작

### 사용하지 마세요

- 이 디렉토리의 코드는 메인 앱과 localStorage 키가 충돌할 수 있습니다
- 새로운 기능은 `src/modules/report/`에 추가하세요

### 정리 예정

추후 이 디렉토리는 완전히 삭제될 예정입니다.
