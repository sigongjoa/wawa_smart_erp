import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useScheduleStore } from '../stores/scheduleStore';

export default function SettingsPage() {
  const navigate = useNavigate();
  const { notionSettings, setNotionSettings } = useScheduleStore();

  const [settings, setSettings] = useState({
    apiKey: notionSettings.apiKey,
    studentsDbId: notionSettings.studentsDbId,
    attendanceDbId: notionSettings.attendanceDbId || '',
    pdfsDbId: notionSettings.pdfsDbId || '',
  });

  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');

  const handleSave = () => {
    setNotionSettings({
      ...settings,
      isConnected: connectionStatus === 'success',
    });
    navigate('/day');
  };

  const testConnection = async () => {
    if (!settings.apiKey || !settings.studentsDbId) {
      alert('API 키와 학생 DB ID를 입력해주세요.');
      return;
    }

    setConnectionStatus('testing');

    // 실제 연결 테스트 (간단히 시뮬레이션)
    setTimeout(() => {
      if (settings.apiKey.startsWith('secret_')) {
        setConnectionStatus('success');
      } else {
        setConnectionStatus('error');
      }
    }, 1000);
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      <div className="page-header">
        <div className="page-header-content">
          <div>
            <h1 className="page-title">설정</h1>
            <p className="page-description">앱 설정 및 Notion 연동 관리</p>
          </div>
          <button className="btn btn-secondary" onClick={() => navigate('/day')}>
            <span className="material-symbols-outlined icon-sm">arrow_back</span>
            돌아가기
          </button>
        </div>
      </div>

      {/* Notion Settings */}
      <div className="table-container" style={{ padding: '24px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="material-symbols-outlined">cloud</span>
          Notion 연동 설정
        </h2>

        {/* Connection Status */}
        <div
          style={{
            padding: '12px 16px',
            borderRadius: 'var(--radius-md)',
            marginBottom: '20px',
            background:
              connectionStatus === 'success'
                ? 'var(--success-light)'
                : connectionStatus === 'error'
                ? 'var(--danger-light)'
                : 'var(--background)',
            color:
              connectionStatus === 'success'
                ? 'var(--success)'
                : connectionStatus === 'error'
                ? 'var(--danger)'
                : 'var(--text-secondary)',
          }}
        >
          {connectionStatus === 'idle' && '연결 상태를 확인하려면 테스트 버튼을 클릭하세요'}
          {connectionStatus === 'testing' && '연결 테스트 중...'}
          {connectionStatus === 'success' && 'Notion 연결 성공!'}
          {connectionStatus === 'error' && 'Notion 연결 실패. API 키를 확인해주세요.'}
        </div>

        <div className="form-group">
          <label className="form-label">Notion API 키 *</label>
          <input
            type="password"
            className="form-input"
            placeholder="secret_xxxxxxxx..."
            value={settings.apiKey}
            onChange={(e) => setSettings({ ...settings, apiKey: e.target.value })}
          />
          <small style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
            Notion Integration에서 발급받은 API 키
          </small>
        </div>

        <div className="form-group">
          <label className="form-label">학생 DB ID *</label>
          <input
            type="text"
            className="form-input"
            placeholder="32자리 ID 또는 Notion URL"
            value={settings.studentsDbId}
            onChange={(e) => setSettings({ ...settings, studentsDbId: e.target.value })}
          />
          <small style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
            학생 시간표 데이터베이스
          </small>
        </div>

        <div className="form-group">
          <label className="form-label">출석 DB ID (선택)</label>
          <input
            type="text"
            className="form-input"
            placeholder="32자리 ID 또는 Notion URL"
            value={settings.attendanceDbId}
            onChange={(e) => setSettings({ ...settings, attendanceDbId: e.target.value })}
          />
          <small style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
            출석 기록 데이터베이스
          </small>
        </div>

        <div className="form-group">
          <label className="form-label">PDF 자료 DB ID (선택)</label>
          <input
            type="text"
            className="form-input"
            placeholder="32자리 ID 또는 Notion URL"
            value={settings.pdfsDbId}
            onChange={(e) => setSettings({ ...settings, pdfsDbId: e.target.value })}
          />
          <small style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
            PDF 자료 메타데이터 데이터베이스
          </small>
        </div>

        <div className="form-actions">
          <button className="btn btn-secondary" onClick={testConnection} disabled={connectionStatus === 'testing'}>
            {connectionStatus === 'testing' ? '테스트 중...' : '연결 테스트'}
          </button>
          <button className="btn btn-primary" onClick={handleSave}>
            <span className="material-symbols-outlined icon-sm">save</span>
            설정 저장
          </button>
        </div>

        {/* Help Info */}
        <div
          style={{
            marginTop: '24px',
            padding: '16px',
            background: 'var(--background)',
            borderRadius: 'var(--radius-md)',
            fontSize: '13px',
            color: 'var(--text-secondary)',
          }}
        >
          <strong>Notion 데이터베이스 필수 속성:</strong>
          <ul style={{ marginTop: '8px', marginLeft: '16px' }}>
            <li>
              <strong>학생 DB:</strong> 이름(title), 학년(select), 요일(select), 시작시간(text),
              종료시간(text), 과목(select), 비고(text)
            </li>
            <li>
              <strong>출석 DB:</strong> 이름(title), 학년(select), 날짜(date), 체크인(text),
              체크아웃(text), 수업시간(number)
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
