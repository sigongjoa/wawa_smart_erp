import { useState, useEffect, lazy, Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const HomePage = lazy(() => import('./pages/HomePage'));
const GachaPage = lazy(() => import('./pages/GachaPage'));
const ProofOrderingPage = lazy(() => import('./pages/ProofOrderingPage'));
const ProofFillBlankPage = lazy(() => import('./pages/ProofFillBlankPage'));
const ExamTimerPage = lazy(() => import('./pages/ExamTimerPage'));
const AssignmentsPage = lazy(() => import('./pages/AssignmentsPage'));
const AssignmentDetailPage = lazy(() => import('./pages/AssignmentDetailPage'));
const LiveSessionPage = lazy(() => import('./pages/LiveSessionPage'));
const MyArchivePage = lazy(() => import('./pages/MyArchivePage'));

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
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
          <Route path="/gacha" element={<ProtectedRoute><GachaPage /></ProtectedRoute>} />
          <Route path="/proof/:proofId/ordering" element={<ProtectedRoute><ProofOrderingPage /></ProtectedRoute>} />
          <Route path="/proof/:proofId/fillblank" element={<ProtectedRoute><ProofFillBlankPage /></ProtectedRoute>} />
          <Route path="/exam-timer" element={<ProtectedRoute><ExamTimerPage /></ProtectedRoute>} />
          <Route path="/assignments" element={<ProtectedRoute><AssignmentsPage /></ProtectedRoute>} />
          <Route path="/assignments/:targetId" element={<ProtectedRoute><AssignmentDetailPage /></ProtectedRoute>} />
          <Route path="/live/:id" element={<ProtectedRoute><LiveSessionPage /></ProtectedRoute>} />
          <Route path="/archives" element={<ProtectedRoute><MyArchivePage /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </HashRouter>
  );
}
