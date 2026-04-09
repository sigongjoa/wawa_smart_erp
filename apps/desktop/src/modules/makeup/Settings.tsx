import { useReportStore } from '../../stores/reportStore';

export default function MakeupSettings() {
  const { appSettings } = useReportStore();

  return (
    <div>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1 className="page-title">보강관리 설정</h1>
            <p className="page-description">보강관리 모듈 설정을 관리합니다</p>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: '1.5rem' }}>
        <h3 style={{ fontWeight: 600, marginBottom: '1rem' }}>D1 데이터베이스 연결</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="material-symbols-outlined" style={{ color: 'var(--success)' }}>
              check_circle
            </span>
            <span>보강관리: D1 API 연동됨</span>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            보강관리 데이터는 Cloudflare D1 데이터베이스를 통해 관리됩니다.
          </p>
        </div>
      </div>
    </div>
  );
}
