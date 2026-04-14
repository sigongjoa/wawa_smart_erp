import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuthStore } from '../store';

export default function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);

  // URL에서 slug 추출: learn.wawa.app/academy-slug → hash 라우팅이므로 query param 사용
  const params = new URLSearchParams(window.location.search);
  const [slug, setSlug] = useState(params.get('academy') || '');
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slug.trim() || !name.trim() || pin.length !== 4) return;

    setLoading(true);
    setError('');
    try {
      const result = await api.login(slug.trim(), name.trim(), pin);
      login({ token: result.token, student: result.student, academySlug: slug.trim() });
      navigate('/');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <h1 className="login-title">WAWA Learn</h1>
        <p className="login-subtitle">학습을 시작하세요</p>

        <form onSubmit={handleSubmit} className="login-form">
          <input
            type="text"
            placeholder="학원 코드"
            value={slug}
            onChange={e => setSlug(e.target.value)}
            className="login-input"
            autoComplete="off"
          />
          <input
            type="text"
            placeholder="이름"
            value={name}
            onChange={e => setName(e.target.value)}
            className="login-input"
            autoComplete="off"
          />
          <input
            type="password"
            inputMode="numeric"
            placeholder="PIN (4자리)"
            value={pin}
            onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            maxLength={4}
            className="login-input login-input--pin"
            autoComplete="off"
          />

          {error && <div className="login-error">{error}</div>}

          <button
            type="submit"
            className="login-btn"
            disabled={loading || !slug.trim() || !name.trim() || pin.length !== 4}
          >
            {loading ? '로그인 중...' : '시작하기'}
          </button>
        </form>
      </div>
    </div>
  );
}
