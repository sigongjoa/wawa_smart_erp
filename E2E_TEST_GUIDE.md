# UC-07: 월말평가 완전 플로우 E2E 테스트 가이드

## 개요
이 문서는 월말평가에서 AI 종합평가 생성 → 저장 → 미리보기 → 이미지 생성 → 알림톡 전송까지의 전체 플로우를 테스트하는 E2E 테스트 가이드입니다.

## 테스트 대상
- **파일**: `apps/desktop/e2e/07-report-full-flow.spec.ts`
- **테스트 케이스**: 6개 (TC-01 ~ TC-06)

## 테스트 환경 준비

### 1. Notion 설정 파일 확인
프로젝트 루트의 `notion_config.json` 파일이 존재해야 합니다.
```bash
cat /mnt/g/progress/wawa/wawa_smart_erp/notion_config.json
```

필수 설정값:
- `notionApiKey`: Notion API 키
- `notionScoresDb`: 성적 데이터베이스 ID
- `notionStudentsDb`: 학생 데이터베이스 ID
- `notionTeachersDb`: 선생님 데이터베이스 ID

### 2. 앱 빌드
```bash
cd /mnt/g/progress/wawa/wawa_smart_erp/apps/desktop
npm run build
```

## 테스트 실행

### 전체 테스트 실행
```bash
cd /mnt/g/progress/wawa/wawa_smart_erp/apps/desktop
npm run test:e2e 07-report-full-flow
```

### 특정 테스트 케이스만 실행
```bash
# TC-06만 실행 (완전한 데이터 플로우)
npm run test:e2e 07-report-full-flow --grep "TC-06"
```

### UI 모드로 실행 (권장)
```bash
npm run test:e2e:ui
```

### 화면 기록과 함께 실행
```bash
npm run test:e2e 07-report-full-flow --record
```

## 테스트 케이스 설명

### TC-01: 학생 선택 후 AI 종합평가 생성
**목표**: 학생 선택 후 AI 생성 기능이 정상 작동하는지 확인

**검증 항목**:
- ✅ 월말평가 > 성적 입력 탭 진입 가능
- ✅ 학생 목록 로딩 및 선택 가능
- ✅ AI 생성 버튼 존재 여부 확인

### TC-02: AI 종합평가 생성 및 저장 - 데이터 유지 검증
**목표**: 저장된 데이터가 유지되는지 확인 (핵심 테스트)

**검증 항목**:
- ✅ 종합평가 텍스트 입력/AI 생성 가능
- ✅ 저장 버튼 클릭 성공
- ✅ "select option not found" 에러 없음
- ✅ 저장 성공 토스트 메시지 출력
- ✅ 콘솔 에러 없음

**예상 결과**:
```
✓ 총평이 저장되었습니다.
```

### TC-03: 저장된 데이터가 미리보기에 반영되는지 확인
**목표**: 저장한 종합평가가 미리보기에 제대로 표시되는지 확인 (데이터 손실 감지)

**검증 항목**:
- ✅ 리포트 미리보기 탭 진입
- ✅ 학생 선택
- ✅ 미리보기에 종합평가 내용이 표시됨
- ✅ 미리보기 텍스트 길이 > 100자

**데이터 손실 증상**:
- 미리보기가 비어있거나 종합평가가 보이지 않음
- 미리보기 텍스트가 너무 짧음

### TC-04: 리포트 이미지(JPG) 생성 및 저장
**목표**: 리포트를 이미지로 내보낼 수 있는지 확인

**검증 항목**:
- ✅ JPG 내보내기 버튼 존재
- ✅ 이미지 파일 다운로드 감지
- ✅ 이미지 파일 생성됨

### TC-05: 알림톡 전송 플로우 및 카카오톡 URL 검증
**목표**: 알림톡 전송 플로우가 정상 작동하는지 확인

**검증 항목**:
- ✅ 리포트 전송 탭 진입
- ✅ 학생 체크박스 선택 가능
- ✅ 일괄 전송 버튼 클릭 가능
- ✅ Mock 알림톡 전송 완료

**주의**: 현재 알림톡 전송은 Mock 구현입니다. 실제 카카오톡 URL과 이미지 생성은 백엔드 통합이 필요합니다.

### TC-06: 완전한 데이터 플로우 통합 테스트
**목표**: 전체 플로우를 통합해서 테스트

**검증 항목**:
- ✅ STEP 1: 학생 선택 및 종합평가 입력 → 저장
- ✅ STEP 2: 미리보기에 데이터 반영 확인
- ✅ STEP 3: 전송 페이지 확인

## 테스트 결과 해석

### 성공 신호
```
✓ TC-01 통과
✓ TC-02 통과 (핵심)
✓ TC-03 통과 (데이터 손실 감지)
✓ TC-04 통과
✓ TC-05 통과
✓ TC-06 통과 (완전한 플로우)
```

### 실패 신호

#### 문제 1: TC-02에서 저장 실패
```
❌ select option not found for property "과목"
```
**원인**: `__TOTAL_COMMENT__` 저장 시 과목 필드 설정 문제
**해결**: `src/services/notion.ts`의 `saveScore` 함수 확인

#### 문제 2: TC-03에서 미리보기 비어있음
```
❌ 미리보기 텍스트 길이 < 100
```
**원인**: 데이터가 저장되지 않음 또는 조회 실패
**해결**: `fetchScores` 함수에서 `totalComment` 필드 확인

#### 문제 3: 종합평가가 저장되었는데 미리보기에 안 보임
```
❌ TC-02 통과, TC-03 실패
```
**원인**: 데이터 조회 로직 문제
**해결**: `Preview.tsx`에서 `totalComment` 렌더링 확인

## 스크린샷 위치
모든 스크린샷은 다음 위치에 저장됩니다:
```
apps/desktop/e2e-screenshots-all/uc07-*.png
```

## 문제 진단 가이드

### 문제 1: 데이터 손실 증상
**증상**: TC-02에서는 저장 성공하지만 TC-03에서 미리보기에 데이터가 안 보임

**진단 단계**:
1. Notion DB 직접 확인
   - 성적 DB에서 김도윤의 `__TOTAL_COMMENT__` 레코드 조회
   - 실제로 저장되어 있는지 확인

2. 브라우저 개발자 도구에서 localStorage 확인
   ```javascript
   const state = JSON.parse(localStorage.getItem('wawa-report-storage'));
   console.log(state.state.reports);
   ```

3. `fetchScores` 함수 디버깅
   ```typescript
   // src/services/notion.ts 라인 430
   const isTotalComment = subject === '__TOTAL_COMMENT__' || recordTitle.includes('__TOTAL_COMMENT__');
   ```

### 문제 2: 저장 실패
**증상**: "select option not found" 에러

**진단**:
1. 콘솔 에러 메시지 확인
2. `notion.ts`의 `saveScore` 함수에서 `properties` 생성 로직 확인
3. `__TOTAL_COMMENT__`일 때 과목(subject) 필드를 제외하는지 확인

### 문제 3: 미리보기에서 커멘트 안 보임
**증상**: 저장도 되고 조회도 되지만 화면에 안 보임

**진단**:
1. `Preview.tsx`에서 `totalComment` 렌더링 여부 확인
2. 리포트 구조 확인:
   ```typescript
   // Preview.tsx에서 totalComment가 표시되는지 확인
   const { totalComment } = selectedReport || {};
   ```

## 실제 테스트 시나리오

### 시나리오 1: 완전한 플로우 (권장)
1. TC-06 실행: 완전한 데이터 플로우 통합 테스트
2. 스크린샷 확인: `uc07-tc06-*.png`
3. 콘솔 로그 확인

### 시나리오 2: 문제 진단
1. TC-02 실행 후 Notion DB 확인
2. 저장이 되었으면 TC-03 실행
3. 미리보기 스크린샷 확인

### 시나리오 3: 수정 후 검증
1. 코드 수정
2. `npm run build`
3. TC-02 → TC-03 순서로 실행해서 수정 여부 확인

## 추가 정보

### 테스트 데이터
- **학생**: 김도윤
- **종합평가 텍스트**: `[e2e-ai] {timestamp} 이번 달 학습태도가 매우 좋았습니다...`

### Mock 알림톡 전송
현재 알림톡 전송은 Mock 구현입니다. (`src/services/alimtalk.ts`)
```typescript
export const sendAlimtalk = async (request: AlimtalkRequest): Promise<AlimtalkResult> => {
    console.log('[Mock 알림톡] 전송 요청:', request);
    await new Promise((resolve) => setTimeout(resolve, 500));
    return { success: true, messageId: `mock_${Date.now()}` };
};
```

실제 카카오톡 URL과 이미지 생성을 위해서는:
1. 백엔드 API 구현 필요
2. 카카오 비즈니스 채널 설정 필요
3. 이미지 업로드 서비스 (Cloudinary 등) 연동 필요

## 참고 문서
- `src/services/notion.ts`: Notion API 호출
- `src/stores/reportStore.ts`: 상태 관리
- `src/modules/report/`: UI 컴포넌트
- `06-total-comment.spec.ts`: 기존 총평 저장 테스트
