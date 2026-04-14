import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, Academy } from '../api';
import { useAuthStore } from '../store';

export default function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);

  const [academies, setAcademies] = useState<Academy[]>([]);
  const [selectedAcademy, setSelectedAcademy] = useState<Academy | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.getAcademies().then(setAcademies).catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAcademy || !name.trim() || pin.length !== 4) return;

    setLoading(true);
    setError('');
    try {
      const result = await api.login(selectedAcademy.slug, name.trim(), pin);
      login({ token: result.token, student: result.student, academySlug: selectedAcademy.slug });
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
          <button
            type="button"
            className="login-input login-academy-select"
            onClick={() => setShowModal(true)}
          >
            {selectedAcademy ? selectedAcademy.name : '학원 선택'}
          </button>

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
            disabled={loading || !selectedAcademy || !name.trim() || pin.length !== 4}
          >
            {loading ? '로그인 중...' : '시작하기'}
          </button>
        </form>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>학원 선택</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <ul className="academy-list">
              {academies.filter(a => !a.slug.startsWith('test-')).map(a => (
                <li
                  key={a.slug}
                  className={`academy-item${selectedAcademy?.slug === a.slug ? ' selected' : ''}`}
                  onClick={() => { setSelectedAcademy(a); setShowModal(false); }}
                >
                  <span className="academy-icon">🏫</span>
                  <span className="academy-name">{a.name}</span>
                </li>
              ))}
              {academies.filter(a => !a.slug.startsWith('test-')).length === 0 && (
                <li className="academy-item academy-empty">등록된 학원이 없습니다</li>
              )}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
