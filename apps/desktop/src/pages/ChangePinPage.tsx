import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuthStore } from '../store';

/**
 * SEC-AUTH-PWMC: 임시 PIN 첫 로그인 후 강제 변경 화면.
 * passwordMustChange=true면 LoginPage가 이 화면으로 라우팅.
 * 변경 성공 시 모든 세션 폐기 → 재로그인.
 */
export default function ChangePinPage() {
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);

  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPin.length < 4 || newPin.length > 20) {
      setError('새 PIN은 4~20자여야 합니다');
      return;
    }
    if (newPin !== confirmPin) {
      setError('새 PIN이 일치하지 않습니다');
      return;
    }
    if (currentPin === newPin) {
      setError('새 PIN은 기존과 달라야 합니다');
      return;
    }

    setLoading(true);
    try {
      await api.changePin(currentPin, newPin);
      // 서버가 모든 세션 폐기 + 쿠키 clear → 재로그인 필요
      logout();
      navigate('/login', { replace: true });
    } catch (err: any) {
      setError(err.message || 'PIN 변경에 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: '60px auto', padding: 24 }}>
      <h1 style={{ marginBottom: 8 }}>PIN 변경</h1>
      {user?.passwordMustChange ? (
        <p style={{ color: 'var(--danger)', fontSize: 14, marginBottom: 24 }}>
          관리자가 발급한 임시 PIN으로 로그인하셨습니다.
          계속 사용하려면 PIN을 변경해주세요.
        </p>
      ) : (
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24 }}>
          현재 PIN과 새 PIN을 입력하세요.
        </p>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <label>
          <span style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>현재 PIN</span>
          <input
            type="password"
            value={currentPin}
            onChange={(e) => setCurrentPin(e.target.value)}
            autoComplete="current-password"
            required
            style={{ width: '100%', padding: 8, fontSize: 16 }}
          />
        </label>

        <label>
          <span style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>새 PIN (4~20자)</span>
          <input
            type="password"
            value={newPin}
            onChange={(e) => setNewPin(e.target.value)}
            autoComplete="new-password"
            minLength={4}
            maxLength={20}
            required
            style={{ width: '100%', padding: 8, fontSize: 16 }}
          />
        </label>

        <label>
          <span style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>새 PIN 확인</span>
          <input
            type="password"
            value={confirmPin}
            onChange={(e) => setConfirmPin(e.target.value)}
            autoComplete="new-password"
            required
            style={{ width: '100%', padding: 8, fontSize: 16 }}
          />
        </label>

        {error && <div style={{ color: 'var(--danger)', fontSize: 14 }}>{error}</div>}

        <button
          type="submit"
          disabled={loading || !currentPin || !newPin || !confirmPin}
          style={{ padding: 12, fontSize: 16, marginTop: 8 }}
        >
          {loading ? '변경 중...' : 'PIN 변경'}
        </button>
      </form>
    </div>
  );
}
