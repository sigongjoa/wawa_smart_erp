import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Teacher, Student, MonthlyReport, SendHistory, CurrentUser, Exam, AppSettings, AbsenceHistory, ExamSchedule } from '../types';

interface ReportState {
  // 로그인
  currentUser: CurrentUser | null;
  setCurrentUser: (user: CurrentUser | null) => void;
  logout: () => void;

  // 선생님 목록
  teachers: Teacher[];
  setTeachers: (teachers: Teacher[]) => void;

  // 학생 목록
  students: Student[];
  setStudents: (students: Student[]) => void;

  // 리포트 관련
  reports: MonthlyReport[];
  currentReport: MonthlyReport | null;
  setReports: (reports: MonthlyReport[]) => void;
  setCurrentReport: (report: MonthlyReport | null) => void;
  updateReport: (report: MonthlyReport) => void;
  addReport: (report: MonthlyReport) => void;
  updateReportPdfUrl: (reportId: string, pdfUrl: string) => void;

  // 전송 이력
  sendHistories: SendHistory[];
  addSendHistory: (history: SendHistory) => void;

  // 현재 선택된 월
  currentYearMonth: string;
  setCurrentYearMonth: (yearMonth: string) => void;

  // 시험지 목록
  exams: Exam[];
  setExams: (exams: Exam[]) => void;
  addExam: (exam: Exam) => void;
  updateExam: (exam: Exam) => void;

  // 앱 설정
  appSettings: AppSettings;
  setAppSettings: (settings: Partial<AppSettings>) => void;

  // 결시 이력
  absenceHistories: AbsenceHistory[];
  setAbsenceHistories: (histories: AbsenceHistory[]) => void;
  addAbsenceHistory: (history: AbsenceHistory) => void;
  updateAbsenceHistory: (history: AbsenceHistory) => void;

  // 월별 시험 일정
  examSchedules: ExamSchedule[];
  setExamSchedules: (schedules: ExamSchedule[]) => void;
  upsertExamSchedule: (schedule: ExamSchedule) => void;

  // 초기화
  reset: () => void;
}

const getCurrentYearMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const defaultAppSettings: AppSettings = {
  notionDbId: '',
  notionApiKey: '',
  kakaoJsKey: '',
  academyName: '',
  academyLogo: undefined,
  kakaoBizChannelId: undefined,
  kakaoBizSenderKey: undefined,
  kakaoBizTemplateId: undefined,
};

export const useReportStore = create<ReportState>()(
  persist(
    (set) => ({
      // 로그인
      currentUser: null,
      setCurrentUser: (user) => set({ currentUser: user }),
      logout: () => set({ currentUser: null }),

      // 선생님
      teachers: [],
      setTeachers: (teachers) => set({ teachers }),

      // 학생
      students: [],
      setStudents: (students) => set({ students }),

      // 리포트
      reports: [],
      currentReport: null,
      setReports: (reports) => set({ reports }),
      setCurrentReport: (report) => set({ currentReport: report }),
      updateReport: (report) => set((state) => ({
        reports: state.reports.map((r) => r.id === report.id ? report : r),
        currentReport: state.currentReport?.id === report.id ? report : state.currentReport,
      })),
      addReport: (report) => set((state) => ({ reports: [...state.reports, report] })),
      updateReportPdfUrl: (reportId, pdfUrl) => set((state) => ({
        reports: state.reports.map((r) =>
          r.id === reportId ? { ...r, pdfUrl, pdfUploadedAt: new Date().toISOString() } : r
        ),
        currentReport: state.currentReport?.id === reportId
          ? { ...state.currentReport, pdfUrl, pdfUploadedAt: new Date().toISOString() }
          : state.currentReport,
      })),

      // 전송
      sendHistories: [],
      addSendHistory: (history) => set((state) => ({
        sendHistories: [history, ...state.sendHistories]
      })),

      // 현재 월
      currentYearMonth: getCurrentYearMonth(),
      setCurrentYearMonth: (yearMonth) => set({ currentYearMonth: yearMonth }),

      // 시험지
      exams: [],
      setExams: (exams) => set({ exams }),
      addExam: (exam) => set((state) => ({ exams: [...state.exams, exam] })),
      updateExam: (exam) => set((state) => ({
        exams: state.exams.map((e) => e.id === exam.id ? exam : e),
      })),

      // 앱 설정
      appSettings: defaultAppSettings,
      setAppSettings: (settings) => set((state) => ({
        appSettings: { ...state.appSettings, ...settings },
      })),

      // 결시 이력
      absenceHistories: [],
      setAbsenceHistories: (histories) => set({ absenceHistories: histories }),
      addAbsenceHistory: (history) => set((state) => ({
        absenceHistories: [history, ...state.absenceHistories],
      })),
      updateAbsenceHistory: (history) => set((state) => ({
        absenceHistories: state.absenceHistories.map((h) =>
          h.id === history.id ? history : h
        ),
      })),

      // 월별 시험 일정
      examSchedules: [],
      setExamSchedules: (schedules) => set({ examSchedules: schedules }),
      upsertExamSchedule: (schedule) => set((state) => {
        const existing = state.examSchedules.find(
          s => s.studentId === schedule.studentId && s.yearMonth === schedule.yearMonth
        );
        if (existing) {
          return {
            examSchedules: state.examSchedules.map(s =>
              s.studentId === schedule.studentId && s.yearMonth === schedule.yearMonth
                ? schedule
                : s
            ),
          };
        }
        return {
          examSchedules: [...state.examSchedules, schedule],
        };
      }),

      // 초기화
      reset: () => set({
        currentUser: null,
        teachers: [],
        students: [],
        reports: [],
        currentReport: null,
        sendHistories: [],
        currentYearMonth: getCurrentYearMonth(),
        exams: [],
        appSettings: defaultAppSettings,
        absenceHistories: [],
        examSchedules: [],
      }),
    }),
    {
      name: 'wawa-report-storage',
      partialize: (state) => ({
        currentUser: state.currentUser,
        teachers: state.teachers,
        students: state.students,
        reports: state.reports,
        sendHistories: state.sendHistories,
        currentYearMonth: state.currentYearMonth,
        exams: state.exams,
        appSettings: state.appSettings,
        absenceHistories: state.absenceHistories,
        examSchedules: state.examSchedules,
      }),
    }
  )
);
