import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Teacher, Student, MonthlyReport, SendHistory, CurrentUser, Exam, AppSettings, AbsenceHistory } from '../types';

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

    // 초기화
    reset: () => void;

    // 데이터 로딩 상태
    isLoading: boolean;
    setIsLoading: (isLoading: boolean) => void;

    // 비동기 액션
    fetchAllData: () => Promise<void>;
}

const getCurrentYearMonth = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const defaultAppSettings: AppSettings = {
    notionApiKey: '',
    notionTeachersDb: '',
    notionStudentsDb: '',
    notionScoresDb: '',
    notionExamsDb: '',
    notionAbsenceHistoryDb: '',
    notionDmMessagesDb: '',
    kakaoJsKey: '',
    academyName: '',
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
            }),

            // 로딩 상태
            isLoading: false,
            setIsLoading: (isLoading) => set({ isLoading }),

            // 비동기 액션 - 중복 호출 방지용 lock
            fetchAllData: async () => {
                const state = useReportStore.getState();
                const { setIsLoading, setTeachers, setStudents, setExams, setReports, currentYearMonth, appSettings, isLoading } = state;

                // 이미 로딩 중이면 중복 호출 방지
                if (isLoading) {
                    console.log('[fetchAllData] Already loading, skipping...');
                    return;
                }

                console.log('[fetchAllData] Starting...', { currentYearMonth, hasApiKey: !!appSettings.notionApiKey });

                if (!appSettings.notionApiKey) {
                    console.warn('[fetchAllData] No API key configured, skipping fetch');
                    return;
                }

                setIsLoading(true);
                try {
                    const notion = await import('../services/notion');

                    console.log('[fetchAllData] Fetching from Notion...');
                    const [teachers, students, exams, reports] = await Promise.all([
                        notion.fetchTeachers(),
                        notion.fetchStudents(),
                        notion.fetchExams(currentYearMonth),
                        notion.fetchScores(currentYearMonth),
                    ]);

                    console.log('[fetchAllData] Results:', {
                        teachers: teachers.length,
                        students: students.length,
                        exams: exams.length,
                        reports: reports.length,
                    });

                    const reportsWithNames = reports.map(r => {
                        const student = students.find(s => s.id === r.studentId);
                        return { ...r, studentName: student?.name || '알 수 없음' };
                    });

                    setTeachers(teachers);
                    setStudents(students);
                    setExams(exams);
                    setReports(reportsWithNames);
                    console.log('✅ Data fetched and stored successfully');
                } catch (error) {
                    console.error('❌ Failed to fetch data:', error);
                } finally {
                    setIsLoading(false);
                }
            },
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
            }),
        }
    )
);

// 컴포넌트에서 사용하기 쉬운 필터링된 데이터 훅/셀렉터
export const useFilteredData = () => {
    const { students, reports, exams, currentUser } = useReportStore();

    // 로그인하지 않았거나 관리자인 경우 전체 데이터 반환
    if (!currentUser || currentUser.teacher.isAdmin) {
        return { students, reports, exams };
    }

    // 일반 선생님인 경우 담당 과목 학생만 필터링
    const teacherSubjects = currentUser.teacher.subjects;

    const filteredStudents = students.filter(student =>
        student.subjects.some(sub => teacherSubjects.includes(sub))
    );

    const filteredReports = reports.filter(report =>
        filteredStudents.some(s => s.id === report.studentId)
    ).map(report => ({
        ...report,
        scores: report.scores.filter(s => teacherSubjects.includes(s.subject))
    }));

    const filteredExams = exams.filter(exam =>
        teacherSubjects.includes(exam.subject)
    );

    return {
        students: filteredStudents,
        reports: filteredReports,
        exams: filteredExams
    };
};
