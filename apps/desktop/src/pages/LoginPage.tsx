import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuthStore } from '../store';
import { Icon } from '../components/icons/Icon';
import './LoginPage.css';

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
  logo?: string | null;
}

export default function LoginPage() {
  const urlSlug = getSlugFromUrl();
  const [slug, setSlug] = useState(urlSlug || localStorage.getItem('lastSlug') || '');
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [academies, setAcademies] = useState<AcademyItem[]>([]);
  const [selectedAcademy, setSelectedAcademy] = useState<AcademyItem | null>(null);
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();

  // 학원 목록 로드 — subdomain 모드 vs 일반
  useEffect(() => {
    if (urlSlug) {
      api.getAcademyInfo(urlSlug)
        .then((data) => setSelectedAcademy({ slug: urlSlug, name: data.name, logo: data.logo }))
        .catch(() => {});
    } else {
      api.getAcademyList()
        .then((list) => {
          setAcademies(list);
          // lastSlug 가 있어도 자동 로고 노출은 안 함 (사회공학 차단)
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
    if (!selectedSlug) { setSelectedAcademy(null); return; }
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
      // SEC-LOGIN-M3: 표시·라우팅 필드만 추출
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
        passwordMustChange: !!u.passwordMustChange,
      };
      login(safeUser);
      localStorage.setItem('lastSlug', slug);
      // SEC-AUTH-PWMC: 임시 PIN 으로 로그인 시 PIN 변경 화면 강제
      if (u.passwordMustChange) navigate('/change-pin');
      else navigate('/timer');
    } catch (err: any) {
      setError(err.message || '로그인에 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  // 통계 (mockup 표시용 정적값 — 실제 데이터 연동은 별도)
  // TODO: 실제 학원 수, 활성 학생/강사 수, 이번달 리포트 발송 통계 API 연동
  const stats = useMemo(() => ({ students: 324, teachers: 18, monthlyReports: 214 }), []);

  const canSubmit = !!slug && !!name && !!pin && !loading;

  return (
    <div className="login-shell">
      {/* ════ LEFT: brand ════ */}
      <div className="login-left">
        <div className="login-brand">
          <div className="login-brand__mark">W</div>
          WAWA ERP
        </div>

        <div className="login-hero">
          <div className="login-hero__crumb">WAWA Smart ERP · Desktop</div>
          <h1 className="login-hero__title">
            학원 운영,<br/>제대로 한 곳에서.
          </h1>
          <p className="login-hero__lede">
            정기고사 · 출결 · 단어 시험 · 리포트까지. 강사 한 명이 학생들을 깔끔하게 운영합니다.
          </p>
        </div>

        <div className="login-stats">
          <div>
            <div className="login-stat__label">학생</div>
            <div className="login-stat__value">{stats.students}</div>
          </div>
          <div>
            <div className="login-stat__label">강사</div>
            <div className="login-stat__value">{stats.teachers}</div>
          </div>
          <div>
            <div className="login-stat__label">이번달 리포트</div>
            <div className="login-stat__value">{stats.monthlyReports}</div>
          </div>
        </div>
      </div>

      {/* ════ RIGHT: form ════ */}
      <div className="login-right">
        <form className="login-form" onSubmit={handleSubmit}>
          <h1 className="login-form__h">로그인</h1>
          <p className="login-form__sub">
            {selectedAcademy
              ? `${selectedAcademy.name} · 이름과 PIN을 입력하세요`
              : '학원 선택 후 이름과 PIN을 입력하세요'}
          </p>

          {/* subdomain 모드 — 학원 카드만 표시 */}
          {urlSlug && selectedAcademy && (
            <div className="login-academy-card">
              {selectedAcademy.logo && <img src={selectedAcademy.logo} alt="학원 로고" />}
              <div>
                <div className="login-academy-card__name">{selectedAcademy.name}</div>
                <div className="login-academy-card__sub">{selectedAcademy.slug}.wawa.app</div>
              </div>
            </div>
          )}

          {error && <div className="login-form__error">{error}</div>}

          {/* 학원 선택 (일반 모드만) */}
          {!urlSlug && (
            <div className="login-field">
              <label className="login-field__label" htmlFor="login-academy">학원</label>
              <div className="login-input-group">
                <Icon name="School" size={16} />
                <select
                  id="login-academy"
                  value={slug}
                  onChange={(e) => handleAcademySelect(e.target.value)}
                  aria-label="학원 선택"
                >
                  <option value="">학원을 선택하세요</option>
                  {academies.map((a) => (
                    <option key={a.slug} value={a.slug}>{a.name}</option>
                  ))}
                </select>
              </div>
              <span className="login-field__hint">subdomain (예: mathplus.wawa.app) 접속 시 자동 선택됨</span>
            </div>
          )}

          <div className="login-field">
            <label className="login-field__label" htmlFor="login-name">이름</label>
            <div className="login-input-group">
              <Icon name="User" size={16} />
              <input
                id="login-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="이름을 입력하세요"
                autoFocus={!!slug}
                autoComplete="username"
              />
            </div>
          </div>

          <div className="login-field">
            <label className="login-field__label" htmlFor="login-pin">PIN</label>
            <div className="login-input-group">
              <Icon name="KeyRound" size={16} />
              <input
                id="login-pin"
                type={showPin ? 'text' : 'password'}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="PIN을 입력하세요"
                autoComplete="current-password"
                inputMode="numeric"
              />
              <button
                type="button"
                onClick={() => setShowPin((v) => !v)}
                aria-label={showPin ? 'PIN 숨기기' : 'PIN 보기'}
              >
                <Icon name={showPin ? 'EyeOff' : 'Eye'} size={16} />
              </button>
            </div>
          </div>

          {!urlSlug && (
            <div className="login-row">
              <span className="login-row__hint">최근 학원이 자동 선택됩니다 · 공용 단말은 해제 권장</span>
              <button type="button" className="login-row__action" onClick={clearLastSlug}>
                최근 학원 지우기
              </button>
            </div>
          )}

          <button type="submit" className="btn btn-primary login-submit" disabled={!canSubmit}>
            {loading ? (
              <>
                <Icon name="Loader" size={18} /> 로그인 중...
              </>
            ) : (
              <>
                로그인 <Icon name="ArrowRight" size={18} />
              </>
            )}
          </button>

          <div className="login-or">또는</div>

          <div className="login-sso">
            <a className="btn btn-secondary with-icon" href="#/register">
              <Icon name="UserRoundSearch" size={16} /> 학원 등록
            </a>
            <a className="btn btn-secondary with-icon" href="#/student-signup">
              <Icon name="QrCode" size={16} /> 학생 가입
            </a>
          </div>

          <div className="login-foot">
            PIN을 잊으셨나요? <a href="#/help">담임 강사에게 재설정 요청</a>
          </div>
        </form>
      </div>
    </div>
  );
}
