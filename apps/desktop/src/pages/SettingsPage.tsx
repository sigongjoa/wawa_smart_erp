import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuthStore } from '../store';
import { errorMessage } from '../utils/errors';
import { PageHeader, Panel } from '../components/v2';

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin';

  const [activeMonth, setActiveMonth] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    api.getActiveMonth().then((res) => {
      if (res.activeExamMonth) {
        setActiveMonth(res.activeExamMonth);
        setSelectedMonth(res.activeExamMonth);
      }
    }).catch(() => {});
  }, []);

  const handleSaveMonth = async () => {
    if (!selectedMonth) return;
    setSaving(true);
    setMessage('');
    try {
      await api.setActiveMonth(selectedMonth);
      setActiveMonth(selectedMonth);
      setMessage('저장 완료');
    } catch (err: unknown) {
      setMessage(`오류: ${errorMessage(err)}`);
    } finally {
      setSaving(false);
    }
  };

  const months = [];
  const now = new Date();
  for (let i = -2; i <= 2; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    months.push(ym);
  }

  return (
    <div className="settings-page">
      <PageHeader crumb="시스템 · 설정" title="설정" sub="성적 입력 기준 월과 학원 운영 설정을 관리합니다." />

      <Panel title="성적 입력 활성 월">
        <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: '0 0 var(--sp-4)' }}>
          리포트·성적 입력에 사용할 기준 월입니다. 선택한 월의 성적만 입력·집계됩니다.
        </p>
        <div className="month-selector">
          <label htmlFor="active-month" className="sr-only">활성 월 선택</label>
          <select
            id="active-month"
            className="form-select form-select--sm"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
          >
            <option value="">월 선택</option>
            {months.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <button className="btn btn-primary" onClick={handleSaveMonth} disabled={saving}>
            {saving ? '저장 중...' : '저장'}
          </button>
          {message && (
            <span className={`settings-message ${message.startsWith('오류') ? 'settings-message--error' : 'settings-message--success'}`}>
              {message}
            </span>
          )}
        </div>
        {activeMonth && (
          <p className="settings-active-month">
            현재 활성 월: <strong>{activeMonth}</strong>
          </p>
        )}
      </Panel>

      {isAdmin && (
        <Panel title="학원 · 선생님 관리">
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: '0 0 var(--sp-4)' }}>
            학원 정보 수정, 선생님 초대·추가·권한 관리는 <strong>학원 관리</strong> 페이지에서 할 수 있습니다.
          </p>
          <Link to="/academy" className="btn btn-primary" style={{ textDecoration: 'none', display: 'inline-block' }}>
            학원 관리 페이지 열기
          </Link>
        </Panel>
      )}
    </div>
  );
}
