import { lazy, Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppShell from './components/AppShell';
import ErrorBoundary from './components/ErrorBoundary';
import ToastContainer from './components/common/ToastContainer';

// Lazy-loaded module pages
const TimerDayView = lazy(() => import('./modules/timer/DayView'));
const TimerRealtimeView = lazy(() => import('./modules/timer/RealtimeView'));
const TimerStudentView = lazy(() => import('./modules/timer/StudentView'));
const TimerTimeslotView = lazy(() => import('./modules/timer/TimeslotView'));
const TimerSettings = lazy(() => import('./modules/timer/Settings'));

const ReportDashboard = lazy(() => import('./modules/report/Dashboard'));
const ReportStudents = lazy(() => import('./modules/report/Students'));
const ReportExams = lazy(() => import('./modules/report/Exams'));
const ReportInput = lazy(() => import('./modules/report/Input'));
const ReportPreview = lazy(() => import('./modules/report/Preview'));
const ReportSend = lazy(() => import('./modules/report/Send'));
const ReportSettings = lazy(() => import('./modules/report/Settings'));
const ReportAISettings = lazy(() => import('./modules/report/AISettings'));

const GraderSingle = lazy(() => import('./modules/grader/Single'));
const GraderBatch = lazy(() => import('./modules/grader/Batch'));
const GraderHistory = lazy(() => import('./modules/grader/History'));
const GraderStats = lazy(() => import('./modules/grader/Stats'));
const GraderSettings = lazy(() => import('./modules/grader/Settings'));

const ScheduleToday = lazy(() => import('./modules/schedule/Today'));
const SchedulePending = lazy(() => import('./modules/schedule/Pending'));
const ScheduleUpcoming = lazy(() => import('./modules/schedule/Upcoming'));
const ScheduleHistory = lazy(() => import('./modules/schedule/History'));
const ScheduleSettings = lazy(() => import('./modules/schedule/Settings'));

const StudentList = lazy(() => import('./modules/student/List'));

const MakeupDashboard = lazy(() => import('./modules/makeup/Dashboard'));
const MakeupPending = lazy(() => import('./modules/makeup/Pending'));
const MakeupCompleted = lazy(() => import('./modules/makeup/Completed'));
const MakeupSettings = lazy(() => import('./modules/makeup/Settings'));

function PageLoader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem' }}>
      <div className="spinner" style={{ width: 32, height: 32, border: '3px solid var(--primary-light)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
    </div>
  );
}

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<AppShell />}>
          {/* 기본 리다이렉트 */}
          <Route index element={<Navigate to="/timer/day" replace />} />

          {/* Student 모듈 */}
          <Route path="student">
            <Route index element={<ErrorBoundary><Suspense fallback={<PageLoader />}><StudentList /></Suspense></ErrorBoundary>} />
          </Route>

          {/* Timer 모듈 */}
          <Route path="timer">
            <Route index element={<Navigate to="/timer/day" replace />} />
            <Route path="day" element={<ErrorBoundary><Suspense fallback={<PageLoader />}><TimerDayView /></Suspense></ErrorBoundary>} />
            <Route path="realtime" element={<ErrorBoundary><Suspense fallback={<PageLoader />}><TimerRealtimeView /></Suspense></ErrorBoundary>} />
            <Route path="student" element={<ErrorBoundary><Suspense fallback={<PageLoader />}><TimerStudentView /></Suspense></ErrorBoundary>} />
            <Route path="timeslot" element={<ErrorBoundary><Suspense fallback={<PageLoader />}><TimerTimeslotView /></Suspense></ErrorBoundary>} />
            <Route path="settings" element={<ErrorBoundary><Suspense fallback={<PageLoader />}><TimerSettings /></Suspense></ErrorBoundary>} />
          </Route>

          {/* Report 모듈 */}
          <Route path="report">
            <Route index element={<ErrorBoundary><Suspense fallback={<PageLoader />}><ReportDashboard /></Suspense></ErrorBoundary>} />
            <Route path="students" element={<ErrorBoundary><Suspense fallback={<PageLoader />}><ReportStudents /></Suspense></ErrorBoundary>} />
            <Route path="exams" element={<ErrorBoundary><Suspense fallback={<PageLoader />}><ReportExams /></Suspense></ErrorBoundary>} />
            <Route path="input" element={<ErrorBoundary><Suspense fallback={<PageLoader />}><ReportInput /></Suspense></ErrorBoundary>} />
            <Route path="preview" element={<ErrorBoundary><Suspense fallback={<PageLoader />}><ReportPreview /></Suspense></ErrorBoundary>} />
            <Route path="send" element={<ErrorBoundary><Suspense fallback={<PageLoader />}><ReportSend /></Suspense></ErrorBoundary>} />
            <Route path="ai-settings" element={<ErrorBoundary><Suspense fallback={<PageLoader />}><ReportAISettings /></Suspense></ErrorBoundary>} />
            <Route path="settings" element={<ErrorBoundary><Suspense fallback={<PageLoader />}><ReportSettings /></Suspense></ErrorBoundary>} />
          </Route>

          {/* Grader 모듈 */}
          <Route path="grader">
            <Route index element={<ErrorBoundary><Suspense fallback={<PageLoader />}><GraderSingle /></Suspense></ErrorBoundary>} />
            <Route path="batch" element={<ErrorBoundary><Suspense fallback={<PageLoader />}><GraderBatch /></Suspense></ErrorBoundary>} />
            <Route path="history" element={<ErrorBoundary><Suspense fallback={<PageLoader />}><GraderHistory /></Suspense></ErrorBoundary>} />
            <Route path="stats" element={<ErrorBoundary><Suspense fallback={<PageLoader />}><GraderStats /></Suspense></ErrorBoundary>} />
            <Route path="settings" element={<ErrorBoundary><Suspense fallback={<PageLoader />}><GraderSettings /></Suspense></ErrorBoundary>} />
          </Route>

          {/* Makeup 모듈 */}
          <Route path="makeup">
            <Route index element={<ErrorBoundary><Suspense fallback={<PageLoader />}><MakeupDashboard /></Suspense></ErrorBoundary>} />
            <Route path="pending" element={<ErrorBoundary><Suspense fallback={<PageLoader />}><MakeupPending /></Suspense></ErrorBoundary>} />
            <Route path="progress" element={<ErrorBoundary><Suspense fallback={<PageLoader />}><MakeupPending /></Suspense></ErrorBoundary>} />
            <Route path="completed" element={<ErrorBoundary><Suspense fallback={<PageLoader />}><MakeupCompleted /></Suspense></ErrorBoundary>} />
            <Route path="settings" element={<ErrorBoundary><Suspense fallback={<PageLoader />}><MakeupSettings /></Suspense></ErrorBoundary>} />
          </Route>

          {/* Schedule 모듈 */}
          <Route path="schedule">
            <Route index element={<ErrorBoundary><Suspense fallback={<PageLoader />}><ScheduleToday /></Suspense></ErrorBoundary>} />
            <Route path="pending" element={<ErrorBoundary><Suspense fallback={<PageLoader />}><SchedulePending /></Suspense></ErrorBoundary>} />
            <Route path="upcoming" element={<ErrorBoundary><Suspense fallback={<PageLoader />}><ScheduleUpcoming /></Suspense></ErrorBoundary>} />
            <Route path="history" element={<ErrorBoundary><Suspense fallback={<PageLoader />}><ScheduleHistory /></Suspense></ErrorBoundary>} />
            <Route path="settings" element={<ErrorBoundary><Suspense fallback={<PageLoader />}><ScheduleSettings /></Suspense></ErrorBoundary>} />
          </Route>
        </Route>
      </Routes>
      <ToastContainer />
    </HashRouter>
  );
}

export default App;
