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
    <div>
      <h2 className="page-title">설정</h2>

      <div className="settings-section">
        <h3>성적 입력 활성 월</h3>
        <div className="month-selector">
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
          {message && <span style={{ fontSize: 13, color: message.startsWith('오류') ? '#d32f2f' : '#2e7d32' }}>{message}</span>}
        </div>
        {activeMonth && (
          <p style={{ marginTop: 12, fontSize: 13, color: '#666' }}>
            현재 활성 월: <strong>{activeMonth}</strong>
          </p>
        )}
      </div>

      <div className="settings-section">
        <h3>학생 관리</h3>
        <div className="wireframe-box">학생 목록 / 등록 — 추후 구현</div>
      </div>
    </div>
  );
}
