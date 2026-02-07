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
        <h3 style={{ fontWeight: 600, marginBottom: '1rem' }}>Notion 데이터베이스 연결</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="material-symbols-outlined" style={{ color: appSettings.notionMakeupDb ? 'var(--success)' : 'var(--danger)' }}>
              {appSettings.notionMakeupDb ? 'check_circle' : 'cancel'}
            </span>
            <span>보강관리 DB: </span>
            <code style={{ fontSize: '0.8rem', background: 'var(--bg-secondary)', padding: '0.125rem 0.5rem', borderRadius: 'var(--radius-sm)' }}>
              {appSettings.notionMakeupDb || '미설정'}
            </code>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            보강관리 DB는 리포트 시스템 설정 페이지에서 설정할 수 있습니다.
          </p>
        </div>
      </div>
    </div>
  );
}
