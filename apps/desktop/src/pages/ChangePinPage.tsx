import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuthStore } from '../store';
import './ChangePinPage.css';

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
    <div className="change-pin-page">
      <h1 className="change-pin-title">PIN 변경</h1>
      {user?.passwordMustChange ? (
        <p className="change-pin-intro change-pin-intro--warn">
          관리자가 발급한 임시 PIN으로 로그인하셨습니다.
          계속 사용하려면 PIN을 변경해주세요.
        </p>
      ) : (
        <p className="change-pin-intro change-pin-intro--muted">
          현재 PIN과 새 PIN을 입력하세요.
        </p>
      )}

      <form onSubmit={handleSubmit} className="change-pin-form">
        <label>
          <span className="input-label">현재 PIN</span>
          <input
            type="password"
            className="input"
            value={currentPin}
            onChange={(e) => setCurrentPin(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>

        <label>
          <span className="input-label">새 PIN (4~20자)</span>
          <input
            type="password"
            className="input"
            value={newPin}
            onChange={(e) => setNewPin(e.target.value)}
            autoComplete="new-password"
            minLength={4}
            maxLength={20}
            required
          />
        </label>

        <label>
          <span className="input-label">새 PIN 확인</span>
          <input
            type="password"
            className="input"
            value={confirmPin}
            onChange={(e) => setConfirmPin(e.target.value)}
            autoComplete="new-password"
            required
          />
        </label>

        {error && <div className="change-pin-error">{error}</div>}

        <button
          type="submit"
          className="btn btn-primary btn-block"
          disabled={loading || !currentPin || !newPin || !confirmPin}
        >
          {loading ? '변경 중...' : 'PIN 변경'}
        </button>
      </form>
    </div>
  );
}
