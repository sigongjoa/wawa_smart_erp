import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';
import { useReportStore } from '../stores/reportStore';
import Setup from '../modules/report/Setup';
import Login from '../modules/auth/Login';

export default function AppShell() {
  const { appSettings, currentUser, fetchAllData } = useReportStore();
  const isConfigured = !!appSettings.notionApiKey;

  useEffect(() => {
    if (isConfigured) {
      fetchAllData();
      // appStore는 Timer 모듈에서 필요할 때 직접 fetch하므로 여기서는 호출하지 않음
    }
  }, [isConfigured]);

  // 1. 초기 설정이 안 된 경우 (API Key 없음)
  if (!isConfigured) {
    return (
      <div className="app-shell">
        <Header />
        <div className="app-body" style={{ paddingTop: 'var(--header-height)' }}>
          <main className="app-content" style={{ marginLeft: 0, maxWidth: '100%' }}>
            <Setup />
          </main>
        </div>
      </div>
    );
  }

  // 2. 로그인이 안 된 경우
  if (!currentUser) {
    return <Login />;
  }

  // 3. 정상 사이클
  return (
    <div className="app-shell">
      <Header />
      <div className="app-body">
        <Sidebar />
        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
