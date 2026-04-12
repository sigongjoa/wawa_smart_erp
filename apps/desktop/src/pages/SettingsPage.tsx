import { useEffect, useState } from 'react';
import { api } from '../api';

export default function SettingsPage() {
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

  const handleSave = async () => {
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
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
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
    </div>
  );
}
