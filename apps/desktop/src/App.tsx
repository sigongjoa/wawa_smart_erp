import { useState, useEffect, lazy, Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import { ToastContainer } from './components/Toast';
import ErrorBoundary from './components/ErrorBoundary';

const TimerPage = lazy(() => import('./pages/TimerPage'));
const ReportPage = lazy(() => import('./pages/ReportPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const AbsencePage = lazy(() => import('./pages/AbsencePage'));
const BoardPage = lazy(() => import('./pages/BoardPage'));
const StudentListPage = lazy(() => import('./pages/StudentListPage'));
const StudentProfilePage = lazy(() => import('./pages/StudentProfilePage'));
const LiveSessionPage = lazy(() => import('./pages/LiveSessionPage'));
const MaterialsPage = lazy(() => import('./pages/MaterialsPage'));
const MeetingPage = lazy(() => import('./pages/MeetingPage'));
const GachaStudentPage = lazy(() => import('./pages/GachaStudentPage'));
const GachaCardPage = lazy(() => import('./pages/GachaCardPage'));
const ProofEditorPage = lazy(() => import('./pages/ProofEditorPage'));
const GachaDashboardPage = lazy(() => import('./pages/GachaDashboardPage'));
const ExamManagementPage = lazy(() => import('./pages/ExamManagementPage'));
const ExamPapersPage = lazy(() => import('./pages/ExamPapersPage'));
const ExamTimerPage = lazy(() => import('./pages/ExamTimerPage'));
const ProgressPage = lazy(() => import('./pages/ProgressPage'));
const AcademyPage = lazy(() => import('./pages/AcademyPage'));
const AssignmentsPage = lazy(() => import('./pages/AssignmentsPage'));
const HomeroomPage = lazy(() => import('./pages/HomeroomPage'));
const HomeroomConsultationsPage = lazy(() => import('./pages/HomeroomConsultationsPage'));
const HomeroomFollowUpsPage = lazy(() => import('./pages/HomeroomFollowUpsPage'));
const HomeroomExamsPage = lazy(() => import('./pages/HomeroomExamsPage'));
const ParentReportPage = lazy(() => import('./pages/ParentReportPage'));
const ArchivePage = lazy(() => import('./pages/ArchivePage'));
const ParentArchivePage = lazy(() => import('./pages/ParentArchivePage'));

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  if (!isLoggedIn) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  const [ready, setReady] = useState(false);
  const restore = useAuthStore((s) => s.restore);

  useEffect(() => {
    restore();
    setReady(true);
  }, [restore]);

  if (!ready) return null;

  return (
    <ErrorBoundary>
    <HashRouter>
      <ToastContainer />
      <Suspense fallback={<div className="page-loading">로딩 중...</div>}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/parent-report/:studentId" element={<ParentReportPage />} />
          <Route path="/parent/archives/:studentId" element={<ParentArchivePage />} />
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/timer" element={<TimerPage />} />
            <Route path="/exam-timer" element={<ExamTimerPage />} />
            <Route path="/report" element={<ReportPage />} />
            <Route path="/absence" element={<AbsencePage />} />
            <Route path="/student" element={<StudentListPage />} />
            <Route path="/student/:id" element={<StudentProfilePage />} />
            <Route path="/live/:id" element={<LiveSessionPage />} />
            <Route path="/materials" element={<MaterialsPage />} />
            <Route path="/archives" element={<ArchivePage />} />
            <Route path="/meeting" element={<MeetingPage />} />
            <Route path="/board" element={<BoardPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/academy" element={<AcademyPage />} />
            <Route path="/gacha" element={<GachaStudentPage />} />
            <Route path="/gacha/cards" element={<GachaCardPage />} />
            <Route path="/gacha/proofs" element={<ProofEditorPage />} />
            <Route path="/gacha/dashboard" element={<GachaDashboardPage />} />
            <Route path="/exams" element={<ExamManagementPage />} />
            <Route path="/exam-papers" element={<ExamPapersPage />} />
            <Route path="/progress" element={<ProgressPage />} />
            <Route path="/assignments" element={<AssignmentsPage />} />
            <Route path="/homeroom" element={<HomeroomPage />} />
            <Route path="/homeroom/consultations" element={<HomeroomConsultationsPage />} />
            <Route path="/homeroom/follow-ups" element={<HomeroomFollowUpsPage />} />
            <Route path="/homeroom/exams" element={<HomeroomExamsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/timer" replace />} />
        </Routes>
      </Suspense>
    </HashRouter>
    </ErrorBoundary>
  );
}
