import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuthStore } from '../store';
import { errorMessage } from '../utils/errors';
import { PageHeader, Panel } from '../components/v2';
import './SettingsPage.css';

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin';

  const [activeMonth, setActiveMonth] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [theme, setTheme] = useState<string>(() => {
    if (typeof document !== 'undefined') {
      return document.documentElement.getAttribute('data-theme') || 'white';
    }
    return 'white';
  });

  const applyTheme = (next: string) => {
    setTheme(next);
    try { localStorage.setItem('theme', next); } catch { /* ignore */ }
    document.documentElement.setAttribute('data-theme', next);
  };

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

      <div className="settings-grid">
      <Panel title="화면 테마">
        <p className="settings-panel-desc">
          앱 전체에 적용할 색상 테마입니다. 화이트(미니멀)가 기본입니다.
        </p>
        <div className="month-selector">
          <label htmlFor="app-theme" className="sr-only">테마 선택</label>
          <select
            id="app-theme"
            className="form-select form-select--sm"
            value={theme}
            onChange={(e) => applyTheme(e.target.value)}
          >
            <option value="white">화이트 (미니멀)</option>
            <option value="default">기본 (인디고)</option>
          </select>
        </div>
      </Panel>

      <Panel title="성적 입력 활성 월">
        <p className="settings-panel-desc">
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
          <p className="settings-panel-desc">
            학원 정보 수정, 선생님 초대·추가·권한 관리는 <strong>학원 관리</strong> 페이지에서 할 수 있습니다.
          </p>
          <Link to="/academy" className="btn btn-primary settings-link-btn">
            학원 관리 페이지 열기
          </Link>
        </Panel>
      )}
      </div>
    </div>
  );
}
