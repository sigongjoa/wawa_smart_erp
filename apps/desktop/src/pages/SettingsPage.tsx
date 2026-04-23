import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuthStore } from '../store';

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
    } catch (err: any) {
      setMessage(`오류: ${err.message}`);
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
      <h2 className="page-title">설정</h2>

      <div className="settings-section">
        <h3>성적 입력 활성 월</h3>
        <div className="month-selector">
          <label htmlFor="active-month" className="sr-only">활성 월 선택</label>
          <select
            id="active-month"
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
      </div>

      {isAdmin && (
        <div className="settings-section" style={{ marginTop: 24 }}>
          <h3>학원 · 선생님 관리</h3>
          <p style={{ fontSize: 13, color: '#888', margin: '0 0 12px' }}>
            학원 정보 수정, 선생님 초대·추가·권한 관리는 <strong>학원 관리</strong> 페이지에서 할 수 있습니다.
          </p>
          <Link to="/academy" className="btn btn-primary" style={{ textDecoration: 'none', display: 'inline-block' }}>
            학원 관리 페이지 열기
          </Link>
        </div>
      )}
    </div>
  );
}
