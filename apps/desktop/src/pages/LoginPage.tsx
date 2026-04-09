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
      setError(err.message || '로그인 실패');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <h2>WAWA Smart ERP</h2>
        {error && <div className="error">{error}</div>}
        <label htmlFor="name">이름</label>
        <input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="이름 입력"
          autoFocus
        />
        <label htmlFor="pin">PIN</label>
        <input
          id="pin"
          type="password"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="PIN 입력"
        />
        <button type="submit" disabled={loading || !name || !pin}>
          {loading ? '로그인 중...' : '로그인'}
        </button>
      </form>
    </div>
  );
}
