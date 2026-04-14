import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuthStore } from '../store';

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin';

  // ── 성적 활성 월 ──
  const [activeMonth, setActiveMonth] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  // ── 학원 관리 (admin) ──
  const [academy, setAcademy] = useState<any>(null);
  const [usage, setUsage] = useState<any>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [academySaving, setAcademySaving] = useState(false);
  const [academyMsg, setAcademyMsg] = useState('');

  // ── 초대 코드 ──
  const [inviteRole, setInviteRole] = useState<'instructor' | 'admin'>('instructor');
  const [inviteCode, setInviteCode] = useState('');
  const [inviteExpires, setInviteExpires] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [invites, setInvites] = useState<any[]>([]);

  useEffect(() => {
    api.getActiveMonth().then((res) => {
      if (res.activeExamMonth) {
        setActiveMonth(res.activeExamMonth);
        setSelectedMonth(res.activeExamMonth);
      }
    }).catch(() => {});

    if (isAdmin) {
      api.getAcademy().then((a) => {
        setAcademy(a);
        setEditName(a.name || '');
        setEditPhone(a.phone || '');
        setEditAddress(a.address || '');
      }).catch(() => {});
      api.getAcademyUsage().then(setUsage).catch(() => {});
      api.getInvites().then(setInvites).catch(() => {});
    }
  }, [isAdmin]);

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

  const handleSaveAcademy = async () => {
    setAcademySaving(true);
    setAcademyMsg('');
    try {
      await api.updateAcademy({
        name: editName.trim() || undefined,
        phone: editPhone.trim() || undefined,
        address: editAddress.trim() || undefined,
      });
      setAcademyMsg('학원 정보 저장 완료');
    } catch (err: any) {
      setAcademyMsg(`오류: ${err.message}`);
    } finally {
      setAcademySaving(false);
    }
  };

  const handleCreateInvite = async () => {
    setInviteLoading(true);
    setInviteCode('');
    try {
      const res = await api.createInvite({ role: inviteRole, expiresInDays: 7 });
      setInviteCode(res.code);
      setInviteExpires(res.expiresAt);
      // 목록 새로고침
      api.getInvites().then(setInvites).catch(() => {});
    } catch (err: any) {
      setInviteCode(`오류: ${err.message}`);
    } finally {
      setInviteLoading(false);
    }
  };

  const copyInviteCode = () => {
    if (!inviteCode || inviteCode.startsWith('오류')) return;
    navigator.clipboard.writeText(inviteCode);
    setAcademyMsg('초대 코드가 복사되었습니다');
    setTimeout(() => setAcademyMsg(''), 2000);
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

      {/* 성적 입력 활성 월 */}
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

      {/* 학원 관리 (admin만) */}
      {isAdmin && (
        <>
          <div className="settings-section" style={{ marginTop: 32 }}>
            <h3>학원 정보</h3>
            {academy && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: '#888' }}>
                  <span>학원코드: <strong>{academy.slug}</strong></span>
                  <span>|</span>
                  <span>요금제: <strong>{academy.plan?.toUpperCase()}</strong></span>
                </div>

                <label htmlFor="academy-name">학원 이름</label>
                <input id="academy-name" className="input" value={editName} onChange={(e) => setEditName(e.target.value)} />

                <label htmlFor="academy-phone">연락처</label>
                <input id="academy-phone" className="input" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />

                <label htmlFor="academy-address">주소</label>
                <input id="academy-address" className="input" value={editAddress} onChange={(e) => setEditAddress(e.target.value)} />

                <button className="btn btn-primary" onClick={handleSaveAcademy} disabled={academySaving} style={{ alignSelf: 'flex-start' }}>
                  {academySaving ? '저장 중...' : '학원 정보 저장'}
                </button>
                {academyMsg && (
                  <span className={`settings-message ${academyMsg.startsWith('오류') ? 'settings-message--error' : 'settings-message--success'}`}>
                    {academyMsg}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* 사용량 */}
          {usage && (
            <div className="settings-section" style={{ marginTop: 24 }}>
              <h3>사용량</h3>
              <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                <div style={{ background: '#f5f5f5', borderRadius: 8, padding: '12px 20px', minWidth: 140 }}>
                  <div style={{ fontSize: 13, color: '#888' }}>학생</div>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>
                    {usage.students.current} <span style={{ fontSize: 13, color: '#888' }}>/ {usage.students.max}</span>
                  </div>
                </div>
                <div style={{ background: '#f5f5f5', borderRadius: 8, padding: '12px 20px', minWidth: 140 }}>
                  <div style={{ fontSize: 13, color: '#888' }}>선생님</div>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>
                    {usage.teachers.current} <span style={{ fontSize: 13, color: '#888' }}>/ {usage.teachers.max}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 선생님 초대 */}
          <div className="settings-section" style={{ marginTop: 24 }}>
            <h3>선생님 초대</h3>
            <p style={{ fontSize: 13, color: '#888', margin: '0 0 12px' }}>
              초대 코드를 생성하고 새 선생님에게 전달하세요. 선생님은 코드로 가입할 수 있습니다.
            </p>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as any)} style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #ddd' }}>
                <option value="instructor">강사</option>
                <option value="admin">관리자</option>
              </select>
              <button className="btn btn-primary" onClick={handleCreateInvite} disabled={inviteLoading}>
                {inviteLoading ? '생성 중...' : '초대 코드 생성'}
              </button>
            </div>

            {inviteCode && !inviteCode.startsWith('오류') && (
              <div style={{ marginTop: 12, background: '#f0f7ff', borderRadius: 8, padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 24, fontWeight: 700, letterSpacing: 4, fontFamily: 'monospace' }}>{inviteCode}</span>
                <button onClick={copyInviteCode} style={{ padding: '4px 12px', fontSize: 13, background: '#4a90d9', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
                  복사
                </button>
                {inviteExpires && (
                  <span style={{ fontSize: 12, color: '#888' }}>
                    만료: {new Date(inviteExpires).toLocaleDateString('ko-KR')}
                  </span>
                )}
              </div>
            )}
            {inviteCode && inviteCode.startsWith('오류') && (
              <p style={{ color: '#e53e3e', fontSize: 13, marginTop: 8 }}>{inviteCode}</p>
            )}

            {/* 초대 이력 */}
            {invites.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <h4 style={{ fontSize: 14, marginBottom: 8 }}>초대 이력</h4>
                <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #eee', textAlign: 'left' }}>
                      <th style={{ padding: '6px 8px' }}>코드</th>
                      <th style={{ padding: '6px 8px' }}>역할</th>
                      <th style={{ padding: '6px 8px' }}>상태</th>
                      <th style={{ padding: '6px 8px' }}>만료</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invites.slice(0, 10).map((inv) => (
                      <tr key={inv.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                        <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>{inv.code}</td>
                        <td style={{ padding: '6px 8px' }}>{inv.role === 'admin' ? '관리자' : '강사'}</td>
                        <td style={{ padding: '6px 8px' }}>
                          {inv.used_by ? (
                            <span style={{ color: '#22c55e' }}>사용됨</span>
                          ) : new Date(inv.expires_at) < new Date() ? (
                            <span style={{ color: '#888' }}>만료</span>
                          ) : (
                            <span style={{ color: '#4a90d9' }}>대기중</span>
                          )}
                        </td>
                        <td style={{ padding: '6px 8px', color: '#888' }}>
                          {new Date(inv.expires_at).toLocaleDateString('ko-KR')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
