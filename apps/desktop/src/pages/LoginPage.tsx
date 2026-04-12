import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuthStore } from '../store';

export default function LoginPage() {
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.login(name, pin);
      login(res.user, res.accessToken, res.refreshToken);
      navigate('/timer');
    } catch (err: any) {
      setError(err.message || '로그인에 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <h2>WAWA</h2>
        <p className="login-subtitle">학습 관리 시스템에 로그인하세요</p>

        {error && <div className="error">{error}</div>}

        <label htmlFor="login-name">이름</label>
        <input
          id="login-name"
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="이름을 입력하세요"
          autoFocus
          autoComplete="username"
        />

        <label htmlFor="login-pin">PIN</label>
        <input
          id="login-pin"
          className="input"
          type="password"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="PIN을 입력하세요"
          autoComplete="current-password"
        />

        <button type="submit" disabled={loading || !name || !pin}>
          {loading ? '로그인 중...' : '로그인'}
        </button>
      </form>
    </div>
  );
}
