/**
 * D1 Database Constants
 * Cloudflare D1 기반 데이터베이스 설정
 */

// ========== D1 Database Tables ==========
export const D1_TABLES = {
    USERS: 'users',
    STUDENTS: 'students',
    CLASSES: 'classes',
    ACADEMIES: 'academies',
    EXAMS: 'exams',
    GRADES: 'grades',
    REPORTS: 'reports',
    MESSAGES: 'messages',
    ATTENDANCE: 'attendance',
    SESSIONS: 'sessions',
    AUDIT_LOGS: 'audit_logs',
    EXAM_SETTINGS: 'exam_settings',
} as const;

// ========== API Endpoints ==========
export const API_ENDPOINTS = {
    // Auth
    AUTH_LOGIN: '/api/auth/login',
    AUTH_REFRESH: '/api/auth/refresh',

    // Teachers
    TEACHERS: '/api/teachers',

    // Students
    STUDENT_LIST: '/api/student',
    STUDENT_GET: (id: string) => `/api/student/${id}`,
    STUDENT_CREATE: '/api/student',
    STUDENT_UPDATE: (id: string) => `/api/student/${id}`,
    STUDENT_DELETE: (id: string) => `/api/student/${id}`,

    // Exams
    EXAMS: '/api/grader/exams',
    EXAM_GET: (id: string) => `/api/grader/exams/${id}`,
    EXAM_UPDATE: (id: string) => `/api/grader/exams/${id}`,

    // Grades
    GRADES: '/api/grader/grades',
    GRADES_REPORT: '/api/report',
    REPORT_MARK_SENT: (studentId: string) => `/api/report/${studentId}/mark-sent`,

    // Messages
    MESSAGES: '/api/message/',
    MESSAGE_CONVERSATION: (userId: string) => `/api/message/conversation/${userId}`,
    MESSAGE_INBOX: '/api/message/inbox',
    MESSAGE_READ: (id: string) => `/api/message/${id}/read`,

    // Migration
    MIGRATE_CSV: '/api/migrate/csv',
} as const;

// ========== Data Status Values ==========
export const STATUS_VALUES = {
    ACTIVE: 'active',
    INACTIVE: 'inactive',
    PENDING: 'pending',
    COMPLETED: 'completed',
} as const;

// ========== Grade/Score Constants ==========
export const GRADE_CONSTANTS = {
    MAKEUP_STATUS_PENDING: '시작 전',
    MAKEUP_STATUS_IN_PROGRESS: '진행 중',
    MAKEUP_STATUS_COMPLETED: '완료',
} as const;
