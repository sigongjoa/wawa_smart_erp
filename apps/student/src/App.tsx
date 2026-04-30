import { useState, useEffect, lazy, Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store';
import Layout from './components/Layout';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const HomePage = lazy(() => import('./pages/HomePage'));
const GachaPage = lazy(() => import('./pages/GachaPage'));
const ProofOrderingPage = lazy(() => import('./pages/ProofOrderingPage'));
const ProofFillBlankPage = lazy(() => import('./pages/ProofFillBlankPage'));
const ExamTimerPage = lazy(() => import('./pages/ExamTimerPage'));
const ExamPage = lazy(() => import('./pages/ExamPage'));
const AssignmentsPage = lazy(() => import('./pages/AssignmentsPage'));
const AssignmentDetailPage = lazy(() => import('./pages/AssignmentDetailPage'));
const LiveSessionPage = lazy(() => import('./pages/LiveSessionPage'));
const MyArchivePage = lazy(() => import('./pages/MyArchivePage'));
const DexPage = lazy(() => import('./pages/DexPage'));
const MePage = lazy(() => import('./pages/MePage'));
const VocabExamPage = lazy(() => import('./pages/VocabExamPage'));
const VocabExamResultPage = lazy(() => import('./pages/VocabExamResultPage'));
const MedTermPage = lazy(() => import('./pages/MedTermPage'));

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
    <HashRouter>
      <Suspense fallback={<div className="loading">로딩 중...</div>}>
        <Routes>
          {/* 풀스크린 (탭바 없음) */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/exam/:assignmentId" element={<ProtectedRoute><ExamPage /></ProtectedRoute>} />
          <Route path="/exam-timer" element={<ProtectedRoute><ExamTimerPage /></ProtectedRoute>} />
          <Route path="/live/:id" element={<ProtectedRoute><LiveSessionPage /></ProtectedRoute>} />
          <Route path="/proof/:proofId/ordering" element={<ProtectedRoute><ProofOrderingPage /></ProtectedRoute>} />
          <Route path="/proof/:proofId/fillblank" element={<ProtectedRoute><ProofFillBlankPage /></ProtectedRoute>} />
          <Route path="/vocab/exam/:jobId" element={<ProtectedRoute><VocabExamPage /></ProtectedRoute>} />
          <Route path="/vocab/exam/:jobId/result" element={<ProtectedRoute><VocabExamResultPage /></ProtectedRoute>} />
          <Route path="/gacha" element={<ProtectedRoute><GachaPage /></ProtectedRoute>} />

          {/* 탭바 있음 */}
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<HomePage />} />
            <Route path="/learn" element={<Navigate to="/assignments" replace />} />
            <Route path="/assignments" element={<AssignmentsPage />} />
            <Route path="/assignments/:targetId" element={<AssignmentDetailPage />} />
            <Route path="/dex" element={<DexPage />} />
            <Route path="/medterm" element={<MedTermPage />} />
            <Route path="/archives" element={<MyArchivePage />} />
            <Route path="/me" element={<MePage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </HashRouter>
  );
}
