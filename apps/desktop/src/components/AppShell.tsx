import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';
import DMWidget from './dm/DMWidget';
import { useReportStore } from '../stores/reportStore';
import CloudflareLogin from '../modules/auth/CloudflareLogin';

export default function AppShell() {
  const { currentUser, fetchAllData, unsentAlert } = useReportStore();
  const isAdmin = currentUser?.teacher?.isAdmin;
  const [showAlert, setShowAlert] = useState(true);

  useEffect(() => {
    if (currentUser) {
      fetchAllData();
      // appStore는 Timer 모듈에서 필요할 때 직접 fetch하므로 여기서는 호출하지 않음
    }
  }, [currentUser]);

  useEffect(() => {
    if (unsentAlert) {
      setShowAlert(true);
      const timer = setTimeout(() => setShowAlert(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [unsentAlert]);

  // 1. 로그인이 안 된 경우
  if (!currentUser) {
    return <CloudflareLogin />;
  }

  // 3. 정상 사이클
  return (
    <div className="app-shell">
      <Header />
      {isAdmin && unsentAlert && showAlert && (
        <div role="alert" aria-live="polite" style={{
          position: 'fixed',
          top: 'var(--header-height)',
          left: 0,
          right: 0,
          zIndex: 100,
          background: 'var(--warning)',
          color: 'var(--text-primary)',
          padding: '8px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '14px',
          fontWeight: 600,
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>warning</span>
          {unsentAlert.yearMonth} 리포트 미전송 {unsentAlert.count}건이 남아있습니다. 전송 후 이번 달로 넘어갑니다.
        </div>
      )}
      <div className="app-body" style={isAdmin && unsentAlert && showAlert ? { paddingTop: '36px' } : undefined}>
        <Sidebar />
        <main className="app-content">
          <Outlet />
        </main>
      </div>
      <DMWidget />
    </div>
  );
}
