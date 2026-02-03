import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Student, FilterState, ViewMode, NotionSettings, RealtimeSession, DayType, GradeType } from '../types';
import { fetchSchedules, testConnection } from '../services/notion';

interface ScheduleState {
  // 데이터
  students: Student[];
  realtimeSessions: RealtimeSession[];

  // UI 상태
  viewMode: ViewMode;
  filters: FilterState;
  selectedStudentId: string | null;
  isLoading: boolean;
  error: string | null;

  // 설정
  notionSettings: NotionSettings;

  // 학생 액션
  addStudent: (student: Omit<Student, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateStudent: (id: string, updates: Partial<Student>) => void;
  deleteStudent: (id: string) => void;

  // 필터 액션
  setViewMode: (mode: ViewMode) => void;
  setDayFilter: (day: DayType | 'all') => void;
  setGradeFilter: (grade: GradeType | 'all') => void;
  setSearchFilter: (search: string) => void;

  // 실시간 세션 액션
  checkIn: (studentId: string) => void;
  checkOut: (studentId: string) => void;
  clearSessions: () => void;

  // 설정 액션
  setNotionSettings: (settings: NotionSettings) => void;

  // Notion 연동 액션
  loadFromNotion: () => Promise<void>;
  testNotionConnection: () => Promise<{ success: boolean; message: string }>;

  // 유틸리티
  getFilteredStudents: () => Student[];
  getTodayStudents: () => Student[];
}

const generateId = () => Math.random().toString(36).substring(2, 15);

export const useScheduleStore = create<ScheduleState>()(
  persist(
    (set, get) => ({
      // 초기 상태
      students: [],
      realtimeSessions: [],
      viewMode: 'day',
      filters: {
        day: 'all',
        grade: 'all',
        search: '',
      },
      selectedStudentId: null,
      isLoading: false,
      error: null,
      notionSettings: {
        apiKey: '',
        studentsDbId: '',
        attendanceDbId: '',
        pdfsDbId: '',
        isConnected: false,
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
            s.id === id
              ? { ...s, ...updates, updatedAt: new Date().toISOString() }
              : s
          ),
        }));
      },

      // 학생 삭제
      deleteStudent: (id) => {
        set((state) => ({
          students: state.students.filter((s) => s.id !== id),
        }));
      },

      // 뷰 모드 변경
      setViewMode: (mode) => {
        set({ viewMode: mode });
      },

      // 요일 필터
      setDayFilter: (day) => {
        set((state) => ({
          filters: { ...state.filters, day },
        }));
      },

      // 학년 필터
      setGradeFilter: (grade) => {
        set((state) => ({
          filters: { ...state.filters, grade },
        }));
      },

      // 검색 필터
      setSearchFilter: (search) => {
        set((state) => ({
          filters: { ...state.filters, search },
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

      // Notion 설정
      setNotionSettings: (settings) => {
        set({ notionSettings: settings });
      },

      // Notion에서 데이터 로드
      loadFromNotion: async () => {
        set({ isLoading: true, error: null });
        try {
          const students = await fetchSchedules();
          set({
            students,
            isLoading: false,
            notionSettings: { ...get().notionSettings, isConnected: true }
          });
        } catch (error) {
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : '데이터 로드 실패'
          });
        }
      },

      // Notion 연결 테스트
      testNotionConnection: async () => {
        const result = await testConnection();
        if (result.success) {
          set({ notionSettings: { ...get().notionSettings, isConnected: true } });
        }
        return result;
      },

      // 필터된 학생 목록
      getFilteredStudents: () => {
        const { students, filters } = get();
        return students.filter((student) => {
          if (filters.day !== 'all' && student.day !== filters.day) return false;
          if (filters.grade !== 'all' && student.grade !== filters.grade) return false;
          if (filters.search && !student.name.includes(filters.search)) return false;
          return true;
        });
      },

      // 오늘 학생 목록
      getTodayStudents: () => {
        const { students } = get();
        const dayMap: { [key: number]: DayType } = {
          2: '화',
          4: '목',
          6: '토',
        };
        const today = dayMap[new Date().getDay()];
        if (!today) return [];
        return students.filter((s) => s.day === today);
      },
    }),
    {
      name: 'timer-schedule-storage',
      partialize: (state) => ({
        students: state.students,
        notionSettings: state.notionSettings,
      }),
    }
  )
);
