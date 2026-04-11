import { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import TimerPage from './pages/TimerPage';
import ReportPage from './pages/ReportPage';
import SettingsPage from './pages/SettingsPage';
import AbsencePage from './pages/AbsencePage';
import BoardPage from './pages/BoardPage';
import StudentListPage from './pages/StudentListPage';
import StudentProfilePage from './pages/StudentProfilePage';

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
          <Route path="/board" element={<BoardPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/timer" replace />} />
      </Routes>
    </HashRouter>
  );
}
