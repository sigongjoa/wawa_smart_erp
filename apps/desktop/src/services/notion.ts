/**
 * D1 Database Service
 * 모든 Notion API 호출을 D1 Workers API로 변환
 */

import type {
  Teacher,
  Student,
  Score,
  MonthlyReport,
  Exam,
  AbsenceHistory,
  Enrollment,
  MakeupRecord,
  MakeupStatus,
  DirectMessage,
  AppNotification,
} from '../types';
import { ApiResult } from '../types/api';
import apiClient from './api';

// ========== 선생님 함수 ==========

export const fetchTeachers = async (): Promise<Teacher[]> => {
  try {
    console.log('[fetchTeachers] D1 API');
    const teachers = await apiClient.get('/api/teachers');
    return Array.isArray(teachers) ? teachers : [];
  } catch (error) {
    console.error('[fetchTeachers] 실패:', error);
    return [];
  }
};

// ========== 학생 함수 ==========

export const fetchStudents = async (): Promise<Student[]> => {
  try {
    console.log('[fetchStudents] D1 API');
    const students = await apiClient.getStudents();
    return Array.isArray(students) ? students : [];
  } catch (error) {
    console.error('[fetchStudents] 실패:', error);
    return [];
  }
};

export const createStudent = async (
  student: Omit<Student, 'id' | 'createdAt' | 'updatedAt'>
): Promise<ApiResult<Student>> => {
  try {
    console.log('[createStudent] D1 API:', { name: student.name });
    const result = await apiClient.post('/api/student', {
      name: student.name,
      grade: student.grade,
      status: student.status || 'active',
    });
    return { success: true, data: result as Student };
  } catch (error) {
    return {
      success: false,
      error: { message: error instanceof Error ? error.message : '학생 생성 실패' },
    };
  }
};

export const updateStudent = async (
  studentId: string,
  updates: Partial<Student>
): Promise<ApiResult<boolean>> => {
  try {
    console.log('[updateStudent] D1 API:', { studentId });
    await apiClient.updateStudent(studentId, updates);
    return { success: true, data: true };
  } catch (error) {
    return {
      success: false,
      error: { message: error instanceof Error ? error.message : '학생 수정 실패' },
    };
  }
};

export const deleteStudent = async (studentId: string): Promise<ApiResult<boolean>> => {
  try {
    console.log('[deleteStudent] D1 API:', { studentId });
    await apiClient.deleteStudent(studentId);
    return { success: true, data: true };
  } catch (error) {
    return {
      success: false,
      error: { message: error instanceof Error ? error.message : '학생 삭제 실패' },
    };
  }
};

export const getStudents = async () => {
  return fetchStudents();
};

// ========== 성적 함수 ==========

export const saveScore = async (
  studentId: string,
  examId: string,
  score: number,
  comment: string,
  subject: string,
  yearMonth: string,
  teacherId: string
): Promise<ApiResult<Score>> => {
  try {
    console.log('[saveScore] D1 API:', {
      studentId,
      examId,
      score,
      yearMonth,
    });
    // API 스키마에 정확히 맞춘 요청
    const result = await apiClient.post('/api/grader/grades', {
      student_id: studentId,
      exam_id: examId,
      score: Number(score), // 반드시 숫자 타입
      comments: comment || '', // comments (s 필수)
    });
    return { success: true, data: result as Score };
  } catch (error) {
    return {
      success: false,
      error: { message: error instanceof Error ? error.message : '성적 저장 실패' },
    };
  }
};

export const fetchScores = async (yearMonth: string): Promise<MonthlyReport[]> => {
  try {
    console.log('[fetchScores] D1 API:', { yearMonth });
    const reports = await apiClient.get('/api/report', { params: { yearMonth } });
    return Array.isArray(reports) ? reports : [];
  } catch (error) {
    console.error('[fetchScores] 실패:', error);
    return [];
  }
};

// ========== 시험 함수 ==========

export const fetchExams = async (yearMonth?: string): Promise<Exam[]> => {
  try {
    console.log('[fetchExams] D1 API:', { yearMonth });
    const exams = await apiClient.get('/api/grader/exams', {
      params: yearMonth ? { exam_month: yearMonth } : {},
    });
    return Array.isArray(exams) ? exams : [];
  } catch (error) {
    console.error('[fetchExams] 실패:', error);
    return [];
  }
};

export const createExamEntry = async (
  exam: Omit<Exam, 'id' | 'uploadedAt'>
): Promise<ApiResult<Exam>> => {
  try {
    console.log('[createExamEntry] D1 API:', {
      subject: exam.subject,
      yearMonth: exam.yearMonth,
    });
    await apiClient.post('/api/grader/exams', {
      subject: exam.subject,
      year_month: exam.yearMonth,
      difficulty: exam.difficulty,
      scope: exam.scope || '',
      uploaded_by: exam.uploadedBy,
    });

    const id = crypto.randomUUID();
    const uploadedAt = new Date().toISOString();
    return { success: true, data: { ...exam, id, uploadedAt } as Exam };
  } catch (error) {
    return {
      success: false,
      error: {
        message: error instanceof Error ? error.message : '시험 정보 등록 실패',
      },
    };
  }
};

export const updateExamDifficulty = async (
  examId: string,
  difficulty: string
): Promise<ApiResult<boolean>> => {
  try {
    console.log('[updateExamDifficulty] D1 API:', { examId, difficulty });
    await apiClient.patch(`/api/grader/exams/${examId}`, { difficulty });
    return { success: true, data: true };
  } catch (error) {
    return {
      success: false,
      error: { message: error instanceof Error ? error.message : '난이도 수정 실패' },
    };
  }
};

// ========== 수강일정 함수 ==========

export const fetchEnrollments = async (): Promise<Enrollment[]> => {
  try {
    console.log('[fetchEnrollments] D1 API');
    // 향후 D1 엔드포인트 추가 예정
    return [];
  } catch (error) {
    console.error('[fetchEnrollments] 실패:', error);
    return [];
  }
};

export const fetchEnrollmentsByStudent = async (
  studentId: string
): Promise<Enrollment[]> => {
  try {
    console.log('[fetchEnrollmentsByStudent] D1 API:', { studentId });
    // 향후 D1 엔드포인트 추가 예정
    return [];
  } catch (error) {
    console.error('[fetchEnrollmentsByStudent] 실패:', error);
    return [];
  }
};

export const updateStudentEnrollments = async (
  studentId: string,
  enrollments: { subject: string; day: string; startTime: string; endTime: string }[]
): Promise<ApiResult<boolean>> => {
  try {
    console.log('[updateStudentEnrollments] D1 API:', {
      studentId,
      count: enrollments.length,
    });
    // 향후 D1 엔드포인트 추가 예정
    return { success: true, data: true };
  } catch (error) {
    return {
      success: false,
      error: { message: error instanceof Error ? error.message : '수강일정 업데이트 실패' },
    };
  }
};

// ========== 보강관리 함수 ==========

export const fetchMakeupRecords = async (status?: MakeupStatus): Promise<MakeupRecord[]> => {
  console.log('[fetchMakeupRecords] D1 API 구현 대기:', { status });
  return [];
};

export const createMakeupRecord = async (record: {
  studentId: string;
  studentName: string;
  subject: string;
  teacherId?: string;
  absentDate: string;
  absentReason: string;
  makeupDate?: string;
  makeupTime?: string;
  memo?: string;
}): Promise<ApiResult<MakeupRecord>> => {
  console.log('[createMakeupRecord] D1 API 구현 대기:', { studentId: record.studentId });
  const id = crypto.randomUUID();
  return {
    success: true,
    data: {
      ...record,
      id,
      status: '시작 전' as MakeupStatus,
      createdAt: new Date().toISOString(),
    },
  };
};

export const updateMakeupRecord = async (
  id: string,
  updates: {
    makeupDate?: string;
    makeupTime?: string;
    status?: MakeupStatus;
    memo?: string;
  }
): Promise<ApiResult<boolean>> => {
  console.log('[updateMakeupRecord] D1 API 구현 대기:', { id });
  return { success: true, data: true };
};

export const deleteMakeupRecord = async (id: string): Promise<ApiResult<boolean>> => {
  console.log('[deleteMakeupRecord] D1 API 구현 대기:', { id });
  return { success: true, data: true };
};

// ========== DM (쪽지) 함수 ==========

export const fetchDMMessages = async (
  userId: string,
  partnerId: string
): Promise<DirectMessage[]> => {
  try {
    console.log('[fetchDMMessages] D1 API:', { userId, partnerId });
    const messages = await apiClient.get(`/api/message/conversation/${partnerId}`);
    return Array.isArray(messages) ? messages : [];
  } catch (error) {
    console.error('[fetchDMMessages] 실패:', error);
    return [];
  }
};

export const sendDMMessage = async (
  senderId: string,
  receiverId: string,
  content: string
): Promise<ApiResult<DirectMessage>> => {
  try {
    console.log('[sendDMMessage] D1 API:', { senderId, receiverId });
    const result = await apiClient.post('/api/message/', {
      recipientId: receiverId,
      content,
    });
    return { success: true, data: result as DirectMessage };
  } catch (error) {
    return {
      success: false,
      error: { message: error instanceof Error ? error.message : '메시지 전송 실패' },
    };
  }
};

export const fetchRecentDMForUser = async (userId: string): Promise<DirectMessage[]> => {
  try {
    console.log('[fetchRecentDMForUser] D1 API:', { userId });
    const messages = await apiClient.get('/api/message/inbox');
    return Array.isArray(messages) ? messages : [];
  } catch (error) {
    console.error('[fetchRecentDMForUser] 실패:', error);
    return [];
  }
};

export const markDMAsRead = async (messageIds: string[]): Promise<ApiResult<boolean>> => {
  try {
    console.log('[markDMAsRead] D1 API:', { count: messageIds.length });
    await Promise.all(messageIds.map(id => apiClient.patch(`/api/message/${id}/read`, {})));
    return { success: true, data: true };
  } catch (error) {
    return {
      success: false,
      error: { message: error instanceof Error ? error.message : '메시지 읽음 표시 실패' },
    };
  }
};

// ========== 알림 함수 ==========

export const fetchNotifications = async (teacherId: string): Promise<AppNotification[]> => {
  console.log('[fetchNotifications] D1 API 구현 대기:', { teacherId });
  return [];
};

export const updateNotificationStatus = async (
  id: string,
  status: string
): Promise<ApiResult<boolean>> => {
  console.log('[updateNotificationStatus] D1 API 구현 대기:', { id, status });
  return { success: true, data: true };
};

export const createNotification = async (notif: Omit<
  AppNotification,
  'id' | 'createdAt' | 'status'
>): Promise<ApiResult<boolean>> => {
  console.log('[createNotification] D1 API 구현 대기:', { teacherId: notif.teacherId });
  return { success: true, data: true };
};

// ========== 결시이력 함수 ==========

export const createAbsenceRecordSimplified = async (record: {
  studentId: string;
  absentDate: string;
  reason: string;
}): Promise<ApiResult<AbsenceHistory>> => {
  console.log('[createAbsenceRecordSimplified] D1 API 구현 대기:', {
    studentId: record.studentId,
  });
  const id = crypto.randomUUID();
  return {
    success: true,
    data: {
      id,
      studentId: record.studentId,
      absentDate: record.absentDate,
      reason: record.reason,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  };
};

// ========== 리포트 전송 완료 함수 ==========

export const markReportSent = async (
  studentId: string,
  yearMonth: string
): Promise<ApiResult<boolean>> => {
  try {
    console.log('[markReportSent] D1 API:', { studentId, yearMonth });
    await apiClient.patch(`/api/report/${studentId}/mark-sent`, { yearMonth });
    return { success: true, data: true };
  } catch (error) {
    console.error('[markReportSent] 실패:', error);
    return {
      success: false,
      error: {
        message: error instanceof Error ? error.message : '전송 완료 표시 실패',
      },
    };
  }
};

// ========== 기타 함수 ==========

export const testNotionConnection = async (apiKey: string, dbIds: any) => {
  console.log('[testNotionConnection] D1 API 사용 중 - Notion 연결 테스트 불필요');
  return {
    success: true,
    message: '연결 성공 (D1 API)',
    details: {
      teachers: true,
      students: true,
      scores: true,
      exams: true,
      absenceHistory: true,
      enrollment: true,
      makeup: true,
      dmMessages: true,
      notifications: true,
    },
  };
};

export const fetchStudentExams = async (studentId: string): Promise<Exam[]> => {
  console.log('[fetchStudentExams] D1 API 구현 대기:', { studentId });
  return [];
};

export const bulkSetExamDate = async (
  examIds: string[],
  date: string
): Promise<ApiResult<boolean>> => {
  console.log('[bulkSetExamDate] D1 API 구현 대기:', { count: examIds.length, date });
  return { success: true, data: true };
};

export const markExamCompleted = async (examId: string): Promise<ApiResult<boolean>> => {
  console.log('[markExamCompleted] D1 API 구현 대기:', { examId });
  return { success: true, data: true };
};

// Default export for backward compatibility
const notionClient = {
  fetchTeachers,
  fetchStudents,
  createStudent,
  updateStudent,
  deleteStudent,
  getStudents,
  saveScore,
  fetchScores,
  fetchExams,
  createExamEntry,
  updateExamDifficulty,
  fetchEnrollments,
  fetchEnrollmentsByStudent,
  updateStudentEnrollments,
  fetchMakeupRecords,
  createMakeupRecord,
  updateMakeupRecord,
  deleteMakeupRecord,
  fetchDMMessages,
  sendDMMessage,
  fetchRecentDMForUser,
  markDMAsRead,
  fetchNotifications,
  updateNotificationStatus,
  createNotification,
  createAbsenceRecordSimplified,
  markReportSent,
  testNotionConnection,
  fetchStudentExams,
  bulkSetExamDate,
  markExamCompleted,
};

export default notionClient;
