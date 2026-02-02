/**
 * Notion database column name constants
 */

export const NOTION_COLUMNS_TEACHER = {
    NAME: '선생님',
    SUBJECT: '과목',
    PIN: 'PIN',
    IS_ADMIN: 'isAdmin',
} as const;

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
    TEACHERS: '담당선생님',
} as const;

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

export const NOTION_COLUMNS_EXAM = {
    SUBJECT: '과목',
    YEAR_MONTH: '년월',
    DIFFICULTY: '난이도',
    EXAM_FILE: '시험지',
    SCOPE: '범위',
    UPLOADER: '등록자',
} as const;

export const NOTION_COLUMNS_ABSENCE_HISTORY = {
    NAME: '이름',
    STUDENT: '학생',
    ORIGINAL_DATE: '원래시험일',
    ABSENCE_REASON: '결시사유',
    RETEST_DATE: '재시험일',
    RETEST_COMPLETED: '재시험완료',
    YEAR_MONTH: '년월',
} as const;

export const NOTION_COLUMNS_EXAM_SCHEDULE = {
    NAME: '이름',
    STUDENT: '학생',
    YEAR_MONTH: '년월',
    EXAM_DATE: '시험일',
} as const;

export const NOTION_COLUMNS_ENROLLMENT = {
    NAME: '이름',
    STUDENT: '학생',
    DAY: '요일',
    START_TIME: '시작시간',
    END_TIME: '종료시간',
    SUBJECT: '과목',
    TUITION: '수강료',
} as const;

export const NOTION_STATUS_VALUES = {
    ACTIVE: '활성',
    INACTIVE: '비활성',
    TRUE: 'True',
} as const;
