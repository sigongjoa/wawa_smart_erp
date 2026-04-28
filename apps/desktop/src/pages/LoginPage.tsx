import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuthStore } from '../store';

/** subdomain에서 slug 추출 (예: mathplus.wawa.app → mathplus) */
function getSlugFromUrl(): string {
  const hostname = window.location.hostname;
  if (hostname === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) return '';
  if (hostname.endsWith('.wawa.app')) {
    const slug = hostname.replace('.wawa.app', '');
    if (slug && !slug.includes('.')) return slug;
  }
  return '';
}

interface AcademyItem {
  slug: string;
  name: string;
  logo?: string | null; // 드롭다운 응답에는 없음. subdomain 모드의 academy-info에서만 채워짐
}

export default function LoginPage() {
  const urlSlug = getSlugFromUrl();
  const [slug, setSlug] = useState(urlSlug || localStorage.getItem('lastSlug') || '');
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [academies, setAcademies] = useState<AcademyItem[]>([]);
  const [selectedAcademy, setSelectedAcademy] = useState<AcademyItem | null>(null);
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();

  // 학원 목록 로드
  useEffect(() => {
    if (urlSlug) {
      // subdomain 모드: 해당 학원 정보만 로드
      api.getAcademyInfo(urlSlug)
        .then((data) => setSelectedAcademy({ slug: urlSlug, name: data.name, logo: data.logo }))
        .catch(() => {});
    } else {
      // 일반 모드: 전체 학원 목록 로드
      api.getAcademyList()
        .then((list) => {
          setAcademies(list);
          // lastSlug가 있으면 드롭다운만 채우고, 학원 로고/이름의 자동 노출은 하지 않음
          // (공용 단말에서 직전 사용자의 학원이 자동 노출되는 사회공학 위험 차단)
          const last = localStorage.getItem('lastSlug');
          if (last && list.find((a) => a.slug === last)) {
            setSlug(last);
          }
        })
        .catch(() => {});
    }
  }, [urlSlug]);

  const clearLastSlug = () => {
    localStorage.removeItem('lastSlug');
    setSlug('');
    setSelectedAcademy(null);
    setError('');
  };

  const handleAcademySelect = (selectedSlug: string) => {
    setSlug(selectedSlug);
    setError('');
    if (!selectedSlug) {
      setSelectedAcademy(null);
      return;
    }
    const found = academies.find(a => a.slug === selectedSlug);
    if (found) setSelectedAcademy(found);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slug) { setError('학원을 선택해주세요'); return; }
    if (!name) { setError('이름을 입력해주세요'); return; }
    if (!pin) { setError('PIN을 입력해주세요'); return; }

    setError('');
    setLoading(true);
    try {
      const res = await api.login(slug, name, pin);
      // SEC-LOGIN-M3: 서버 응답에서 표시·라우팅에 필요한 필드만 추출.
      // 서버 응답 변경으로 의도치 않은 필드가 store에 흘러드는 것을 방지.
      const u = res.user || {};
      const safeUser = {
        id: u.id,
        name: u.name,
        role: u.role,
        academyId: u.academyId,
        defaultClassId: u.defaultClassId,
        academyName: u.academyName,
        academySlug: u.academySlug,
        academyLogo: u.academyLogo,
      };
      login(safeUser);
      localStorage.setItem('lastSlug', slug);
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
        {selectedAcademy ? (
          <>
            {selectedAcademy.logo && (
              <img src={selectedAcademy.logo} alt="학원 로고" style={{ width: 64, height: 64, objectFit: 'contain', margin: '0 auto 8px' }} />
            )}
            <h2>{selectedAcademy.name}</h2>
            {!urlSlug && (
              <button
                type="button"
                onClick={clearLastSlug}
                style={{ background: 'none', border: 'none', color: '#888', fontSize: 12, cursor: 'pointer', textDecoration: 'underline', marginBottom: 8 }}
              >
                다른 학원으로 로그인
              </button>
            )}
          </>
        ) : (
          <>
            <h2>WAWA</h2>
            <p className="login-subtitle">학습 관리 시스템</p>
          </>
        )}

        {error && <div className="error">{error}</div>}

        {/* 학원 선택 — subdomain 모드가 아니면 드롭다운 표시 */}
        {!urlSlug && (
          <div style={{ marginBottom: 4 }}>
            <label htmlFor="login-academy">학원 선택</label>
            <select
              id="login-academy"
              className="input"
              value={slug}
              onChange={(e) => handleAcademySelect(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', fontSize: 15 }}
            >
              <option value="">-- 학원을 선택하세요 --</option>
              {academies.map((a) => (
                <option key={a.slug} value={a.slug}>{a.name}</option>
              ))}
            </select>
          </div>
        )}

        <label htmlFor="login-name">이름</label>
        <input
          id="login-name"
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="이름을 입력하세요"
          autoFocus={!!slug}
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

        <button type="submit" disabled={loading || !slug || !name || !pin}>
          {loading ? '로그인 중...' : '로그인'}
        </button>

        <p style={{ fontSize: 13, color: '#888', marginTop: 12, textAlign: 'center' }}>
          학원이 없으신가요?{' '}
          <a href="#/register" style={{ color: '#4a90d9' }}>새 학원 등록</a>
        </p>
      </form>
    </div>
  );
}
