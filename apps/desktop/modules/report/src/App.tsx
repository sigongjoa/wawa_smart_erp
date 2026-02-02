import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useReportStore } from './stores/reportStore';
import LoginPage from './pages/LoginPage';
import SetupPage from './pages/SetupPage';
import TeacherInputPage from './pages/TeacherInputPage';
import AdminPage from './pages/AdminPage';
import PreviewPage from './pages/PreviewPage';
import SendPage from './pages/SendPage';
import BulkSendPage from './pages/BulkSendPage';
import SettingsPage from './pages/SettingsPage';
import ExamManagePage from './pages/ExamManagePage';
import StudentManagePage from './pages/StudentManagePage';
import ExamSchedulePage from './pages/ExamSchedulePage';

// 설정 완료 여부 체크 훅 (Notion 설정이 있으면 완료)
function useIsSetupComplete() {
  const { appSettings } = useReportStore();
  const hasNotionConfig = !!(appSettings.notionApiKey && appSettings.notionTeachersDb);
  return hasNotionConfig;
}

// 초기 설정이 필요한 페이지용 래퍼
function ProtectedRoute({ element }: { element: React.ReactElement }) {
  const isSetupComplete = useIsSetupComplete();

  if (!isSetupComplete) {
    return <Navigate to="/setup" replace />;
  }

  return element;
}

// 홈 라우트 - 설정 완료 시 로그인, 아니면 설정 페이지
function HomeRoute() {
  const isSetupComplete = useIsSetupComplete();

  if (!isSetupComplete) {
    return <Navigate to="/setup" replace />;
  }

  return <LoginPage />;
}

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/setup" element={<SetupPage />} />
        <Route path="/" element={<HomeRoute />} />
        <Route path="/teacher" element={<ProtectedRoute element={<TeacherInputPage />} />} />
        <Route path="/admin" element={<ProtectedRoute element={<AdminPage />} />} />
        <Route path="/preview" element={<ProtectedRoute element={<PreviewPage />} />} />
        <Route path="/send" element={<ProtectedRoute element={<SendPage />} />} />
        <Route path="/bulk-send" element={<ProtectedRoute element={<BulkSendPage />} />} />
        <Route path="/settings" element={<ProtectedRoute element={<SettingsPage />} />} />
        <Route path="/exams" element={<ProtectedRoute element={<ExamManagePage />} />} />
        <Route path="/students" element={<ProtectedRoute element={<StudentManagePage />} />} />
        <Route path="/schedule" element={<ProtectedRoute element={<ExamSchedulePage />} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
