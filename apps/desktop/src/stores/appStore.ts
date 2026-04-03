import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Student, FilterState, RealtimeSession, AttendanceRecord, PauseRecord, DayType, GradeType, Enrollment } from '../types';
import notionClient from '../services/notion';
import { includesHangul } from '../utils/hangulUtils';
import { getTodayDay } from '../constants/common';

// 일시정지 총 시간 계산 (분)
export function calculatePausedMinutes(pauseHistory: PauseRecord[], now: Date): number {
  let total = 0;
  for (const pause of pauseHistory) {
    const start = new Date(pause.pausedAt);
    const end = pause.resumedAt ? new Date(pause.resumedAt) : now;
    total += (end.getTime() - start.getTime()) / 1000 / 60;
  }
  return Math.floor(total);
}

// 순수 수업시간 계산 (분)
export function calculateNetMinutes(checkInTime: string, pauseHistory: PauseRecord[], now: Date): number {
  const checkIn = new Date(checkInTime);
  const totalElapsed = (now.getTime() - checkIn.getTime()) / 1000 / 60;
  const totalPaused = calculatePausedMinutes(pauseHistory, now);
  return Math.floor(totalElapsed - totalPaused);
}

interface AppState {
  // Timer 모듈 데이터
  students: Student[];
  enrollments: Enrollment[];
  realtimeSessions: RealtimeSession[];
  attendanceRecords: AttendanceRecord[];
  timerFilters: FilterState;
  tempStudents: Student[];  // 세션 전용 임시 학생 (DB 저장 안 함)

  // Timer 액션
  fetchStudents: () => Promise<void>;
  fetchEnrollments: () => Promise<void>;
  setEnrollments: (enrollments: Enrollment[]) => void;
  addStudent: (student: Omit<Student, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateStudent: (id: string, updates: Partial<Student>) => void;
  deleteStudent: (id: string) => void;
  setTimerDayFilter: (day: DayType) => void;
  setTimerDayFilterAll: (days: DayType[]) => void;
  setTimerGradeFilter: (grade: GradeType) => void;
  setTimerGradeFilterAll: (grades: GradeType[]) => void;
  setTimerSearchFilter: (search: string) => void;
  clearFilters: () => void;
  checkIn: (studentId: string, enrollment?: { startTime: string; endTime: string; subject?: string }) => void;
  checkOut: (studentId: string, note?: string) => void;
  pauseSession: (studentId: string, reason?: string) => void;
  resumeSession: (studentId: string) => void;
  clearSessions: () => void;
  addTempStudent: (data: { name: string; grade: string; startTime: string; endTime: string; subject?: string }) => void;
  removeTempStudent: (id: string) => void;
  clearTempStudents: () => void;

  // 출석 기록 액션
  getAttendanceByDate: (date: string) => AttendanceRecord[];

  // 유틸리티
  getFilteredStudents: () => Student[];
  getTodayStudents: () => Student[];
}

export const useAppStore = create<AppState>()(
  (set, get) => ({
    // 초기 상태
    students: [],
    realtimeSessions: [],
    attendanceRecords: JSON.parse(localStorage.getItem('wawa-attendance-records') || '[]'),
    timerFilters: {
      days: [],
      grades: [],
      search: '',
    },
    tempStudents: [],

    enrollments: [],
    setEnrollments: (enrollments) => set({ enrollments }),

    fetchEnrollments: async () => {
      try {
        const enrollments = await notionClient.fetchEnrollments();
        set({ enrollments });
      } catch (error) {
        console.error('[appStore] fetchEnrollments failed:', error);
      }
    },

    fetchStudents: async () => {
      try {
        const students = await notionClient.fetchStudents();
        set({ students });
        get().fetchEnrollments();
      } catch (error) {
        console.error('[appStore] fetchStudents failed:', error);
      }
    },

    // 학생 추가
    addStudent: async (studentData) => {
      try {
        const response: any = await notionClient.createStudent({
          name: studentData.name,
          grade: studentData.grade,
          subjects: [],
        });

        await notionClient.updateStudent(response.id, {
          // Update additional properties if needed that createStudent might not handle
        });

        const newStudent: Student = {
          id: response.id,
          ...studentData,
          createdAt: response.created_time,
          updatedAt: response.last_edited_time,
        };

        set((state) => ({
          students: [...state.students, newStudent],
        }));
      } catch (error) {
        console.error('Failed to add student to Notion:', error);
      }
    },

    // 학생 수정
    updateStudent: async (id, updates) => {
      try {
        await notionClient.updateStudent(id, {
          name: updates.name,
          grade: updates.grade as string,
        });

        set((state) => ({
          students: state.students.map((s) => (s.id === id ? { ...s, ...updates } : s)),
        }));
      } catch (error) {
        console.error('Failed to update student in Notion:', error);
      }
    },

    // 학생 삭제
    deleteStudent: async (id) => {
      try {
        await notionClient.deleteStudent(id);
        set((state) => ({
          students: state.students.filter((s) => s.id !== id),
        }));
      } catch (error) {
        console.error('Failed to delete student from Notion:', error);
      }
    },

    // 요일 필터 (토글)
    setTimerDayFilter: (day) => {
      set((state) => {
        const days = state.timerFilters.days.includes(day)
          ? state.timerFilters.days.filter((d) => d !== day)
          : [...state.timerFilters.days, day];
        return { timerFilters: { ...state.timerFilters, days } };
      });
    },

    // 요일 필터 (일괄 설정)
    setTimerDayFilterAll: (days) => {
      set((state) => ({
        timerFilters: { ...state.timerFilters, days },
      }));
    },

    // 학년 필터 (토글)
    setTimerGradeFilter: (grade) => {
      set((state) => {
        const grades = state.timerFilters.grades.includes(grade)
          ? state.timerFilters.grades.filter((g) => g !== grade)
          : [...state.timerFilters.grades, grade];
        return { timerFilters: { ...state.timerFilters, grades } };
      });
    },

    // 학년 필터 (일괄 설정)
    setTimerGradeFilterAll: (grades) => {
      set((state) => ({
        timerFilters: { ...state.timerFilters, grades },
      }));
    },

    // 검색 필터
    setTimerSearchFilter: (search) => {
      set((state) => ({
        timerFilters: { ...state.timerFilters, search },
      }));
    },

    // 필터 초기화
    clearFilters: () => {
      set((state) => ({
        timerFilters: { days: [], grades: [], search: '' },
      }));
    },

    // 체크인
    checkIn: (studentId, enrollment) => {
      const student = [...get().students, ...get().tempStudents].find((s) => s.id === studentId);
      if (!student) return;

      // enrollment 파라미터가 있으면 사용, 없으면 enrollments에서 오늘 수업 검색
      let startTime = enrollment?.startTime;
      let endTime = enrollment?.endTime;

      if (!startTime || !endTime) {
        const todayDay = getTodayDay();
        const todayEnrollment = get().enrollments
          .filter(e => e.studentId === studentId && e.day === todayDay)
          .sort((a, b) => a.startTime.localeCompare(b.startTime))[0];
        if (todayEnrollment) {
          startTime = todayEnrollment.startTime;
          endTime = todayEnrollment.endTime;
        }
      }

      const [startH, startM] = (startTime || '00:00').split(':').map(Number);
      const [endH, endM] = (endTime || '00:00').split(':').map(Number);
      const scheduledMinutes = (endH * 60 + endM) - (startH * 60 + startM);

      const now = new Date();
      const session: RealtimeSession = {
        id: `sess_${Date.now()}`,
        studentId,
        student,
        checkInTime: now.toISOString(),
        status: 'active',
        elapsedMinutes: 0,
        scheduledMinutes: Math.max(scheduledMinutes, 0),
        pauseHistory: [],
        date: now.toISOString().split('T')[0],
      };

      set((state) => ({
        realtimeSessions: [...state.realtimeSessions, session],
      }));
    },

    // 일시정지
    pauseSession: (studentId, reason) => {
      set((state) => ({
        realtimeSessions: state.realtimeSessions.map((s) =>
          s.studentId === studentId && s.status === 'active'
            ? {
                ...s,
                status: 'paused' as const,
                pauseHistory: [
                  ...s.pauseHistory,
                  { pausedAt: new Date().toISOString(), reason },
                ],
              }
            : s
        ),
      }));
    },

    // 재개
    resumeSession: (studentId) => {
      set((state) => ({
        realtimeSessions: state.realtimeSessions.map((s) =>
          s.studentId === studentId && s.status === 'paused'
            ? {
                ...s,
                status: 'active' as const,
                pauseHistory: s.pauseHistory.map((p, i) =>
                  i === s.pauseHistory.length - 1 && !p.resumedAt
                    ? { ...p, resumedAt: new Date().toISOString() }
                    : p
                ),
              }
            : s
        ),
      }));
    },

    // 체크아웃 → 출석기록 자동 생성
    checkOut: (studentId, note) => {
      const state = get();
      const session = state.realtimeSessions.find((s) => s.studentId === studentId);
      if (!session) return;

      const now = new Date();

      // 일시정지 중이었다면 마지막 pause 종료
      const finalPauseHistory = session.pauseHistory.map((p, i) =>
        i === session.pauseHistory.length - 1 && !p.resumedAt
          ? { ...p, resumedAt: now.toISOString() }
          : p
      );

      const totalPausedMins = calculatePausedMinutes(finalPauseHistory, now);
      const netMins = calculateNetMinutes(session.checkInTime, finalPauseHistory, now);

      const record: AttendanceRecord = {
        id: `att_${Date.now()}`,
        studentId: session.studentId,
        studentName: session.student.name,
        grade: session.student.grade,
        subject: session.student.subject,
        date: session.date || now.toISOString().split('T')[0],
        checkInTime: session.checkInTime,
        checkOutTime: now.toISOString(),
        scheduledStartTime: session.student.startTime,
        scheduledEndTime: session.student.endTime,
        scheduledMinutes: session.scheduledMinutes,
        netMinutes: netMins,
        totalPausedMinutes: totalPausedMins,
        pauseCount: finalPauseHistory.length,
        pauseHistory: finalPauseHistory,
        wasLate: false,
        wasOvertime: netMins > session.scheduledMinutes,
        note,
      };

      const newRecords = [...state.attendanceRecords, record];
      localStorage.setItem('wawa-attendance-records', JSON.stringify(newRecords));

      set((state) => ({
        realtimeSessions: state.realtimeSessions.map((s) =>
          s.studentId === studentId
            ? { ...s, checkOutTime: now.toISOString(), status: 'completed' as const, pauseHistory: finalPauseHistory }
            : s
        ),
        attendanceRecords: newRecords,
      }));
    },

    // 세션 초기화
    clearSessions: () => {
      set({ realtimeSessions: [] });
    },

    // 임시 학생 추가 (DB 저장 안 함, 세션 전용)
    addTempStudent: (data) => {
      const now = new Date().toISOString();
      const tempStudent: Student = {
        id: `temp_${Date.now()}`,
        name: data.name,
        grade: data.grade,
        subjects: data.subject ? [data.subject] : [],
        subject: data.subject,
        startTime: data.startTime,
        endTime: data.endTime,
        isTemp: true,
        createdAt: now,
        updatedAt: now,
      };
      set((state) => ({ tempStudents: [...state.tempStudents, tempStudent] }));
    },

    // 임시 학생 제거
    removeTempStudent: (id) => {
      set((state) => ({
        tempStudents: state.tempStudents.filter((s) => s.id !== id),
        realtimeSessions: state.realtimeSessions.filter((sess) => sess.studentId !== id),
      }));
    },

    // 임시 학생 전체 초기화
    clearTempStudents: () => {
      set((state) => ({
        tempStudents: [],
        realtimeSessions: state.realtimeSessions.filter((sess) => !sess.student.isTemp),
      }));
    },

    // 출석 기록 조회
    getAttendanceByDate: (date) => {
      return get().attendanceRecords.filter((r) => r.date === date);
    },

    // 필터된 학생 목록
    getFilteredStudents: () => {
      const { students, timerFilters } = get();
      return students.filter((student) => {
        if (timerFilters.days.length > 0 && !timerFilters.days.includes(student.day as DayType)) return false;
        if (timerFilters.grades.length > 0 && !timerFilters.grades.includes(student.grade as GradeType)) return false;
        if (timerFilters.search && !includesHangul(student.name, timerFilters.search)) return false;
        return true;
      });
    },

    // 오늘 학생 목록
    getTodayStudents: () => {
      const { students } = get();
      const dayMap: { [key: number]: DayType } = { 2: '화', 4: '목', 6: '토' };
      const today = dayMap[new Date().getDay()];
      if (!today) return [];
      return students.filter((s) => s.day === today);
    },
  })
);

export default useAppStore;
