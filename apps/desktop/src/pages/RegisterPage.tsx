import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

type Step = 'slug' | 'info' | 'done';

export default function RegisterPage() {
  const [step, setStep] = useState<Step>('slug');
  const [slug, setSlug] = useState('');
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [slugChecking, setSlugChecking] = useState(false);
  const [academyName, setAcademyName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ slug: string; academyName: string } | null>(null);
  const navigate = useNavigate();

  const checkSlug = async () => {
    if (slug.length < 3) {
      setError('학원코드는 3자 이상이어야 합니다');
      return;
    }
    setError('');
    setSlugChecking(true);
    try {
      const res = await api.verifySlug(slug);
      setSlugAvailable(res.available);
      if (!res.available) {
        setError(res.reason || '이미 사용 중인 학원코드입니다');
      }
    } catch {
      setError('확인에 실패했습니다');
    } finally {
      setSlugChecking(false);
    }
  };

  const handleSlugNext = () => {
    if (!slugAvailable) return;
    setStep('info');
    setError('');
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!academyName.trim()) { setError('학원 이름을 입력해주세요'); return; }
    if (!ownerName.trim()) { setError('대표 이름을 입력해주세요'); return; }
    if (pin.length < 4) { setError('PIN은 4자 이상이어야 합니다'); return; }
    if (pin !== pinConfirm) { setError('PIN이 일치하지 않습니다'); return; }

    setLoading(true);
    try {
      await api.registerAcademy({
        academyName: academyName.trim(),
        slug,
        ownerName: ownerName.trim(),
        pin,
        phone: phone.trim() || undefined,
      });
      setResult({ slug, academyName: academyName.trim() });
      setStep('done');
    } catch (err: any) {
      setError(err.message || '등록에 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  const goToLogin = () => {
    localStorage.setItem('lastSlug', slug);
    navigate('/login');
  };

  return (
    <div className="login-page">
      <div className="login-card" style={{ maxWidth: 420 }}>
        <h2>새 학원 등록</h2>
        <p className="login-subtitle">WAWA 학습 관리 시스템에 학원을 등록하세요</p>

        {error && <div className="error">{error}</div>}

        {step === 'slug' && (
          <>
            <label htmlFor="reg-slug">학원코드</label>
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: '0 0 8px' }}>
              영문 소문자, 숫자, 하이픈만 가능 (3~30자). 로그인 시 사용됩니다.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                id="reg-slug"
                className="input"
                value={slug}
                onChange={(e) => {
                  setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
                  setSlugAvailable(null);
                }}
                placeholder="예: mathking"
                autoFocus
                style={{ flex: 1 }}
              />
              <button
                type="button"
                onClick={checkSlug}
                disabled={slugChecking || slug.length < 3}
                style={{ whiteSpace: 'nowrap', padding: '8px 16px' }}
              >
                {slugChecking ? '...' : '확인'}
              </button>
            </div>

            {slugAvailable === true && (
              <p style={{ color: 'var(--success)', fontSize: 13, margin: '8px 0' }}>
                사용 가능한 학원코드입니다
              </p>
            )}

            <button
              type="button"
              onClick={handleSlugNext}
              disabled={!slugAvailable}
              style={{ marginTop: 16 }}
            >
              다음
            </button>

            <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 16, textAlign: 'center' }}>
              이미 학원이 있나요?{' '}
              <a href="#/login" style={{ color: 'var(--info)' }}>로그인</a>
            </p>
          </>
        )}

        {step === 'info' && (
          <form onSubmit={handleRegister}>
            <p style={{ fontSize: 13, color: 'var(--info)', margin: '0 0 16px' }}>
              학원코드: <strong>{slug}</strong>
              <button type="button" onClick={() => setStep('slug')} style={{ marginLeft: 8, fontSize: 12, color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>변경</button>
            </p>

            <label htmlFor="reg-academy">학원 이름</label>
            <input
              id="reg-academy"
              className="input"
              value={academyName}
              onChange={(e) => setAcademyName(e.target.value)}
              placeholder="예: 수학의 정석 학원"
              autoFocus
            />

            <label htmlFor="reg-owner">대표(원장) 이름</label>
            <input
              id="reg-owner"
              className="input"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              placeholder="로그인 시 사용할 이름"
            />

            <label htmlFor="reg-phone">연락처 (선택)</label>
            <input
              id="reg-phone"
              className="input"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="010-1234-5678"
            />

            <label htmlFor="reg-pin">PIN (비밀번호)</label>
            <input
              id="reg-pin"
              className="input"
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="4자 이상"
            />

            <label htmlFor="reg-pin-confirm">PIN 확인</label>
            <input
              id="reg-pin-confirm"
              className="input"
              type="password"
              value={pinConfirm}
              onChange={(e) => setPinConfirm(e.target.value)}
              placeholder="PIN을 한 번 더 입력"
            />

            <button type="submit" disabled={loading} style={{ marginTop: 16 }}>
              {loading ? '등록 중...' : '학원 등록'}
            </button>
          </form>
        )}

        {step === 'done' && result && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>&#10003;</div>
            <h3 style={{ marginBottom: 8 }}>{result.academyName}</h3>
            <p style={{ color: 'var(--text-tertiary)', marginBottom: 24 }}>학원이 성공적으로 등록되었습니다!</p>

            <div style={{ background: 'var(--bg-tertiary)', borderRadius: 8, padding: 16, marginBottom: 24, textAlign: 'left' }}>
              <p style={{ fontSize: 13, margin: '0 0 4px' }}><strong>학원코드:</strong> {result.slug}</p>
              <p style={{ fontSize: 13, margin: 0 }}>로그인 시 이 코드를 입력하세요.</p>
            </div>

            <button onClick={goToLogin} style={{ width: '100%' }}>
              로그인하기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
