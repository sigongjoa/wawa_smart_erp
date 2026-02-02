import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Student, FilterState, RealtimeSession, DayType, GradeType } from '../types';

interface AppState {
  // Timer 모듈 데이터
  students: Student[];
  realtimeSessions: RealtimeSession[];
  timerFilters: FilterState;

  // Timer 액션
  addStudent: (student: Omit<Student, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateStudent: (id: string, updates: Partial<Student>) => void;
  deleteStudent: (id: string) => void;
  setTimerDayFilter: (day: DayType | 'all') => void;
  setTimerGradeFilter: (grade: GradeType | 'all') => void;
  setTimerSearchFilter: (search: string) => void;
  checkIn: (studentId: string) => void;
  checkOut: (studentId: string) => void;
  clearSessions: () => void;

  // 유틸리티
  getFilteredStudents: () => Student[];
  getTodayStudents: () => Student[];
}

const generateId = () => Math.random().toString(36).substring(2, 15);

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // 초기 상태
      students: [],
      realtimeSessions: [],
      timerFilters: {
        day: 'all',
        grade: 'all',
        search: '',
      },

      // 학생 추가
      addStudent: (studentData) => {
        const now = new Date().toISOString();
        const newStudent: Student = {
          ...studentData,
          id: generateId(),
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({
          students: [...state.students, newStudent],
        }));
      },

      // 학생 수정
      updateStudent: (id, updates) => {
        set((state) => ({
          students: state.students.map((s) =>
            s.id === id ? { ...s, ...updates, updatedAt: new Date().toISOString() } : s
          ),
        }));
      },

      // 학생 삭제
      deleteStudent: (id) => {
        set((state) => ({
          students: state.students.filter((s) => s.id !== id),
        }));
      },

      // 요일 필터
      setTimerDayFilter: (day) => {
        set((state) => ({
          timerFilters: { ...state.timerFilters, day },
        }));
      },

      // 학년 필터
      setTimerGradeFilter: (grade) => {
        set((state) => ({
          timerFilters: { ...state.timerFilters, grade },
        }));
      },

      // 검색 필터
      setTimerSearchFilter: (search) => {
        set((state) => ({
          timerFilters: { ...state.timerFilters, search },
        }));
      },

      // 체크인
      checkIn: (studentId) => {
        const student = get().students.find((s) => s.id === studentId);
        if (!student) return;

        const [startH, startM] = student.startTime.split(':').map(Number);
        const [endH, endM] = student.endTime.split(':').map(Number);
        const scheduledMinutes = (endH * 60 + endM) - (startH * 60 + startM);

        const session: RealtimeSession = {
          studentId,
          student,
          checkInTime: new Date().toISOString(),
          status: 'active',
          elapsedMinutes: 0,
          scheduledMinutes,
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
          if (timerFilters.day !== 'all' && student.day !== timerFilters.day) return false;
          if (timerFilters.grade !== 'all' && student.grade !== timerFilters.grade) return false;
          if (timerFilters.search && !student.name.includes(timerFilters.search)) return false;
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
    }),
    {
      name: 'wawa-erp-storage',
      partialize: (state) => ({
        students: state.students,
      }),
    }
  )
);
