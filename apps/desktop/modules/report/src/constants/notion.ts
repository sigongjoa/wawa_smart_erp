/**
 * Notion database column name constants
 * Notion 데이터베이스 컬럼명 상수
 *
 * These constants prevent typos and make schema changes easier.
 * 이 상수들은 오타를 방지하고 스키마 변경을 용이하게 합니다.
 */

/** Teacher database columns */
export const NOTION_COLUMNS_TEACHER = {
  NAME: '선생님',
  SUBJECT: '과목',
  PIN: 'PIN',
  IS_ADMIN: 'isAdmin',
} as const;

/** Student database columns */
export const NOTION_COLUMNS_STUDENT = {
  NAME: '이름',
  GRADE: '학년',
  SUBJECTS: '수강과목',
  PARENT_NAME: '학부모',
  PARENT_PHONE: '전화번호',
  PARENT_CONTACT: '학부모연락처',
  PARENT_PHONE_ALT: '학부모전화',
  EXAM_DATE: '시험일',
  STATUS: '상태',
  ABSENCE_REASON: '결시사유',
} as const;

/** Score database columns */
export const NOTION_COLUMNS_SCORE = {
  NAME: '이름',
  YEAR_MONTH: '시험년월',
  SUBJECT: '과목',
  SCORE: '점수',
  COMMENT: '코멘트',
  DIFFICULTY: '난이도',
  STUDENT: '학생',
  TEACHER: '선생님',
} as const;

/** Exam database columns */
export const NOTION_COLUMNS_EXAM = {
  SUBJECT: '과목',
  YEAR_MONTH: '년월',
  DIFFICULTY: '난이도',
  EXAM_FILE: '시험지',
  SCOPE: '범위',
  UPLOADER: '등록자',
} as const;

/** Absence History database columns */
export const NOTION_COLUMNS_ABSENCE_HISTORY = {
  NAME: '이름',
  STUDENT: '학생',
  ORIGINAL_DATE: '원래시험일',
  ABSENCE_REASON: '결시사유',
  RETEST_DATE: '재시험일',
  RETEST_COMPLETED: '재시험완료',
  YEAR_MONTH: '년월',
} as const;

/** Exam Schedule database columns (월별 시험 일정) */
export const NOTION_COLUMNS_EXAM_SCHEDULE = {
  NAME: '이름',           // title
  STUDENT: '학생',        // rich_text (학생 이름 또는 ID)
  YEAR_MONTH: '년월',     // date (YYYY-MM-01 형식으로 저장)
  EXAM_DATE: '시험일',    // date
} as const;

/** Status values */
export const NOTION_STATUS_VALUES = {
  ACTIVE: '활성',
  INACTIVE: '비활성',
  TRUE: 'True',
} as const;
