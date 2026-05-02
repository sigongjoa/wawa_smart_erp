# 수능 영단어 무료 온라인 자료 조사

- 작성일: 2026-04-27
- 목적: wawa_smart_erp(어휘/가챠 모듈)에 활용 가능한 한국 수능(CSAT) 영단어 자료 중 **합법적으로 무료 입수 가능한** 것을 정리
- 깊이: standard

## Executive Summary

수능 영단어 무료 자료는 크게 **(A) 공식·준공식 PDF 단어장**, **(B) 플래시카드 플랫폼의 공유 세트**, **(C) 출판사 부가자료**, **(D) 개발자용 데이터셋(GitHub/오픈 API)** 네 갈래로 나뉜다.

- **즉시 쓸 수 있는 신뢰도 높은 무료 PDF**: EBSi 부가자료실(수능특강/수능완성 교재 단어장) — *공식, 매년 업데이트*
- **대량 어휘 + 엑셀(XLSX) 형식**: 한글영어 출판사의 "수능 영단어 5000" 부가자료, 하나셀의 교육부 필수 영단어 3000(2015 개정 교육과정 기준)
- **플래시카드/학습 세트 재활용**: 클래스카드, Quizlet에 교사·학생들이 만든 수능 단어 세트가 다수 공유돼 있음
- **프로그래밍/DB 시드용**: 수능 영단어 전용 GitHub 리포는 **거의 없음**. 일반 한국어/영어 워드리스트 또는 교육부 3000 단어 정도가 한계. ERP에 넣으려면 **PDF/엑셀에서 직접 파싱**해야 한다.
- **저작권 주의**: EBS 교재 본문 PDF는 EBSi 회원 한정, 메가스터디·쏠북 자료는 "재배포 금지" 명시. 학원 내부 학습용으로만 사용 가능, 공개 서비스에 그대로 임베드하면 침해 가능성.

---

## A. 공식·준공식 PDF 단어장

### 1. EBSi 부가자료실 — *최우선 추천*
- URL: https://www.ebsi.co.kr/ebs/pot/potg/txbkAdtlDatList.ebs
- 2026학년도 수능특강 영어 단어장: https://www.ebsi.co.kr/ebs/pot/potg/txbkAdtlDat.ebs?bbsId=BK_REC_03&artclId=000000400458178
- 형식: PDF (단어/뜻/예문 정리표)
- 비용: 무료 (EBSi 무료 회원가입 필요)
- 범위: 수능특강 영어, 영어독해연습, 수능완성 — 매년 신규
- 라이선스: EBS 저작물. 학생·교사 학습용 다운로드는 허용, 재배포/상업적 이용 불가

### 2. 메가스터디 영단어 모음 (강사 김동영)
- 2025 수능 기출 영단어: https://file.megastudy.net/FileServer//Board/tec_bbs_2024/25%EB%85%84%20%EC%88%98%EB%8A%A5%20%EC%98%81%EB%8B%A8%EC%96%B4%20%EB%AA%A8%EC%9D%8C.pdf
- 23년 3월 고3 모의고사 영단어: https://file.megastudy.net/FileServer//Board/tec_bbs_2023/23%EB%85%84%203%EC%9B%94%20%EA%B3%A03%20%EC%98%81%EB%8B%A8%EC%96%B4%20%EB%AA%A8%EC%9D%8C.pdf
- 형식: 2열 표 PDF (단어/뜻)
- 비용: 무료(직링크)
- 라이선스: 메가스터디 강사 자료. 개인 학습용, 재배포 금지

### 3. 쏠북(Solvook) — 시즌 무료 배포
- 무료배포 페이지: https://campaign.solvook.com/english/250114-solvookpass-contents-event
- 2026 EBS 수특 영어/영독 자료: https://static.solvook.com/promotion/2026_st_ed.pdf
- 비용: 회원가입 후 무료
- 주의: "다운로드한 파일을 제3자에게 공유하거나 재판매, 복제하는 행위는 엄격히 금지" 명시 → 학원 내부 자료로만 사용

### 4. 오르비 — 미미보카(MIMI VOCA) 빈출 분류표
- 2026 수능 1등급 단어 리스트: https://orbi.kr/00073856398
- 2024 MIMI VOCA 6500 게시글: https://orbi.kr/00063996203
- 5개년 6/9월 모평·수능 기출 + EBS 연계교재 단어를 빈출도별로 분류
- 일부 무료(맛보기 470개), 전체는 유료 PDF
- 라이선스: 저자 개인 자료, 무료 부분만 학습용 활용

---

## B. 엑셀(XLSX/CSV) 형식 — *DB 시드에 가장 유리*

### 1. 한글영어 — "고등 수능 영단어 5000"
- URL: http://www.hanglenglish.com/mp3_download/bbs/board.php?bo_table=t_mp3&wr_id=110
- 형식: 엑셀, 100단어 × 50페이지 = 5000개
- 부가: MP3 발음 다운로드 함께 제공
- 비용: 무료
- ERP 활용도: ★★★★★ — 표 정형 데이터라 그대로 import 가능

### 2. 하나셀 — "교육부 필수 영단어 3000개 (2015 개정)"
- URL: https://hanaabc.com/index.php?mid=learnenglish&document_srl=485
- 형식: XLSX (단어/뜻/등급: 초/중/고)
- 출처: 교육과학기술부 지정 어휘
- 비용: 무료
- ERP 활용도: ★★★★☆ — 학년/등급 메타가 있어 가챠 난이도 분류에 적합

> 참고: 메가스터디북스 "수능 2580 종합편" 부가자료(https://www.megastudybooks.com/book/file/extra)도 회원 다운로드 가능하나 책 구매가 전제.

---

## C. 플래시카드 플랫폼 — 학습용 그대로 사용

### 1. 클래스카드 (classcard.net)
- EBS 수능영단어 rescue 시리즈, 수능특강 일차별 세트 등이 다수 공유
- 예: https://www.classcard.net/folder/78378 , https://www.classcard.net/folder/323124
- 비용: 학생·교사 무료 (출판사 공식 세트 + 교사 자작 세트 혼재)
- ERP 활용도: 직접 데이터 추출은 어렵지만, **학생을 외부 링크로 보내는 빠른 통합** 가능

### 2. Quizlet 한국 (quizlet.com/kr)
- 수능 단어 검색 시 다수 공개 세트 존재
- 비용: 기본 무료 (일부 기능 유료)

---

## D. 개발자 데이터셋 / API

### 1. GitHub — 수능 전용 리포는 사실상 없음
조사 결과 "수능 영단어"를 정형 데이터(JSON/CSV)로 제공하는 공개 리포는 발견되지 않음. 인접 자료:
- https://github.com/CodingFriends/basic-vocabulary-word-lists — 영/한 등 기본 단어 CSV (수능용 아님)
- https://github.com/julienshim/combined_korean_vocabulary_list — 국립국어원·TOPIK 한국어 단어 (영→한 아님)
- https://github.com/songys/AwesomeKorean_Data — 한국어 데이터셋 큐레이션 (참고용 인덱스)

### 2. 국립국어원 오픈 API — 뜻풀이 보강용
- 표준국어대사전 API: https://stdict.korean.go.kr/openapi/openApiInfo.do
- 한국어기초사전 API: https://krdict.korean.go.kr/kor/openApi/openApiInfo
- 우리말샘 (공공데이터포털): https://www.data.go.kr/data/15105193/openapi.do
- 형식: XML/JSON, 무료(키 신청)
- ERP 활용도: 단어 자체 리스트는 PDF/엑셀에서 가져오고, **한국어 뜻풀이/예문은 이 API로 보강**하는 식의 조합이 현실적

---

## ERP(wawa_smart_erp) 적용 권장안

현재 vocab 모듈(`workers/src/routes/vocab-handler.ts`, `apps/student/public/word-gacha/`)에 시드 데이터가 필요한 상황 가정:

1. **빠른 시작 (1일 작업)**: 한글영어 "수능 5000" XLSX 다운 → 컬럼 정리 → CSV → D1 import. 등급/난이도 메타가 없어 빈도순 chunk만 가능.
2. **품질 중시 (3~5일 작업)**: 하나셀 "교육부 3000"으로 등급 분류 시드 + EBSi 수능특강 PDF에서 단원별 단어 추출(파서 작성) → 학년별/단원별 가챠 풀.
3. **법적 안전 마진**: 학원 **내부 학습용**임을 명시하고 외부 공개 학생 페이지에서는 단어 리스트를 그대로 노출하지 말 것(특히 EBS·메가스터디·쏠북 자료). 영단어 자체는 저작권 대상이 아니지만, **선별·배열·뜻풀이 표현**에는 권리가 발생할 수 있음.
4. **장기**: 자체 출제 기출 분석 스크립트로 학원 보유 모의고사 PDF에서 단어 추출 → 자체 빈출 사전 구축이 가장 안전.

---

## 신뢰도 / 미확인 사항

- ✅ EBSi/메가스터디/쏠북 페이지 존재는 검색에서 다수 확인
- ⚠️ 2026 EBS 단어장 PDF의 정확한 단어 수, 라이선스 세부 문구는 다운로드 후 페이지 확인 필요
- ⚠️ 한글영어 5000 자료의 최신 갱신일은 미확인 — 사이트 직접 확인 권장
- ❌ 수능 영단어 전용 정형 GitHub 데이터셋은 **없다**고 잠정 결론. 직접 파싱 파이프라인이 불가피.

## Sources

- [EBSi 부가자료실 — 2026 수능특강 영어 단어장 PDF](https://www.ebsi.co.kr/ebs/pot/potg/txbkAdtlDat.ebs?bbsId=BK_REC_03&artclId=000000400458178)
- [EBSi 부가자료실 목록](https://www.ebsi.co.kr/ebs/pot/potg/txbkAdtlDatList.ebs)
- [메가스터디 2025 수능 기출 영단어 PDF](https://file.megastudy.net/FileServer//Board/tec_bbs_2024/25%EB%85%84%20%EC%88%98%EB%8A%A5%20%EC%98%81%EB%8B%A8%EC%96%B4%20%EB%AA%A8%EC%9D%8C.pdf)
- [메가스터디 23년 3월 고3 모의고사 영단어 PDF](https://file.megastudy.net/FileServer//Board/tec_bbs_2023/23%EB%85%84%203%EC%9B%94%20%EA%B3%A03%20%EC%98%81%EB%8B%A8%EC%96%B4%20%EB%AA%A8%EC%9D%8C.pdf)
- [메가스터디북스 부가자료](https://www.megastudybooks.com/book/file/extra)
- [한글영어 — 수능 영단어 5000 (엑셀)](http://www.hanglenglish.com/mp3_download/bbs/board.php?bo_table=t_mp3&wr_id=110)
- [하나셀 — 교육부 필수 영단어 3000 (엑셀)](https://hanaabc.com/index.php?mid=learnenglish&document_srl=485)
- [쏠북 무료배포 — 2026 EBS 수특 영어/영독](https://campaign.solvook.com/english/250114-solvookpass-contents-event)
- [쏠북 — 2026 수특 영독 PDF](https://static.solvook.com/promotion/2026_st_ed.pdf)
- [오르비 — 2026 수능 1등급 단어 리스트(미미보카)](https://orbi.kr/00073856398)
- [오르비 — 2024 MIMI VOCA 6500](https://orbi.kr/00063996203)
- [클래스카드 EBS 수능영단어 폴더](https://www.classcard.net/folder/78378)
- [클래스카드 김유진 선생님 세트 폴더](https://www.classcard.net/folder/323124)
- [Quizlet 한국](https://quizlet.com/kr)
- [표준국어대사전 Open API](https://stdict.korean.go.kr/openapi/openApiInfo.do)
- [한국어기초사전 Open API](https://krdict.korean.go.kr/kor/openApi/openApiInfo)
- [공공데이터포털 — 우리말샘](https://www.data.go.kr/data/15105193/openapi.do)
- [GitHub — CodingFriends/basic-vocabulary-word-lists](https://github.com/CodingFriends/basic-vocabulary-word-lists)
- [GitHub — songys/AwesomeKorean_Data](https://github.com/songys/AwesomeKorean_Data)
