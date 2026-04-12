import { useState, useEffect, lazy, Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import { ToastContainer } from './components/Toast';

const TimerPage = lazy(() => import('./pages/TimerPage'));
const ReportPage = lazy(() => import('./pages/ReportPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const AbsencePage = lazy(() => import('./pages/AbsencePage'));
const BoardPage = lazy(() => import('./pages/BoardPage'));
const StudentListPage = lazy(() => import('./pages/StudentListPage'));
const StudentProfilePage = lazy(() => import('./pages/StudentProfilePage'));
const MaterialsPage = lazy(() => import('./pages/MaterialsPage'));

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
      <ToastContainer />
      <Suspense fallback={<div className="page-loading">로딩 중...</div>}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/timer" element={<TimerPage />} />
            <Route path="/report" element={<ReportPage />} />
            <Route path="/absence" element={<AbsencePage />} />
            <Route path="/student" element={<StudentListPage />} />
            <Route path="/student/:id" element={<StudentProfilePage />} />
            <Route path="/materials" element={<MaterialsPage />} />
            <Route path="/board" element={<BoardPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/timer" replace />} />
        </Routes>
      </Suspense>
    </HashRouter>
  );
}
