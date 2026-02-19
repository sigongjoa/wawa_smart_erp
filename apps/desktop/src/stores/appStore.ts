import { create } from 'zustand';
import type { Student, FilterState, RealtimeSession, DayType, GradeType, Enrollment } from '../types';
import notionClient from '../services/notion';
import { includesHangul } from '../utils/hangulUtils';
import { getTodayDay } from '../constants/common';

interface AppState {
  // Timer 모듈 데이터
  students: Student[];
  enrollments: Enrollment[];
  realtimeSessions: RealtimeSession[];
  timerFilters: FilterState;

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
  checkOut: (studentId: string) => void;
  clearSessions: () => void;

  // 유틸리티
  getFilteredStudents: () => Student[];
  getTodayStudents: () => Student[];
}

export const useAppStore = create<AppState>()(
  (set, get) => ({
    // 초기 상태
    students: [],
    realtimeSessions: [],
    timerFilters: {
      days: [],
      grades: [],
      search: '',
    },

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
      const student = get().students.find((s) => s.id === studentId);
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

      const session: RealtimeSession = {
        studentId,
        student,
        checkInTime: new Date().toISOString(),
        status: 'active',
        elapsedMinutes: 0,
        scheduledMinutes: Math.max(scheduledMinutes, 0),
      };

      set((state) => ({
        realtimeSessions: [...state.realtimeSessions, session],
      }));
    },

    // 체크아웃
    checkOut: (studentId) => {
      set((state) => ({
        realtimeSessions: state.realtimeSessions.map((s) =>
          s.studentId === studentId
            ? { ...s, checkOutTime: new Date().toISOString(), status: 'completed' as const }
            : s
        ),
      }));
    },

    // 세션 초기화
    clearSessions: () => {
      set({ realtimeSessions: [] });
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
