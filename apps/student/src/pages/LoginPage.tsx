import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, Academy } from '../api';
import { useAuthStore } from '../store';
import './LoginPage.css';

export default function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);

  const [academies, setAcademies] = useState<Academy[]>([]);
  const [selectedAcademy, setSelectedAcademy] = useState<Academy | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const pinInputRef = useRef<HTMLInputElement>(null);

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
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = !!selectedAcademy && name.trim().length > 0 && pin.length === 4 && !loading;
  const activeSlotIndex = Math.min(pin.length, 3);
  const visibleAcademies = academies.filter((a) => !a.slug.startsWith('test-') && a.slug !== 'e2e-test');

  return (
    <div className="lg">
      {/* ─ 상단 워드마크 ────────────────────────────── */}
      <header className="lg-wordmark">
        <span className="lg-wordmark-kicker">WAWA · PRESS START</span>
        <h1 className="lg-wordmark-title">
          LEARN<span>.</span>
        </h1>
        <span className="lg-wordmark-sub">오늘의 학습을 시작하세요</span>
      </header>

      {/* ─ 등록 폼 ──────────────────────────────────── */}
      <form className="lg-form" onSubmit={handleSubmit} noValidate>
        <div className="lg-field">
          <span className="lg-field-label">
            <span>학원</span>
            <span className="lg-field-index">01</span>
          </span>
          <button
            type="button"
            className="lg-academy"
            data-empty={!selectedAcademy}
            onClick={() => setSheetOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={sheetOpen}
          >
            <span className="lg-academy-name">
              {selectedAcademy ? selectedAcademy.name : '학원을 선택하세요'}
            </span>
            <span className="lg-academy-arrow" aria-hidden="true">›</span>
          </button>
        </div>

        <div className="lg-field">
          <span className="lg-field-label">
            <span>이름</span>
            <span className="lg-field-index">02</span>
          </span>
          <input
            type="text"
            className="lg-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: 강은서"
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        <div className="lg-field">
          <span className="lg-field-label">
            <span>PIN · 4자리</span>
            <span className="lg-field-index">03</span>
          </span>
          <div
            className="lg-pin"
            onClick={() => pinInputRef.current?.focus()}
          >
            <input
              ref={pinInputRef}
              type="tel"
              inputMode="numeric"
              pattern="\d{4}"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              className="lg-pin-input"
              autoComplete="off"
              aria-label="PIN 4자리"
            />
            <div className="lg-pin-slots" aria-hidden="true">
              {[0, 1, 2, 3].map((i) => {
                const filled = i < pin.length;
                const active = i === activeSlotIndex && !filled;
                return (
                  <div
                    key={i}
                    className="lg-pin-slot"
                    data-state={filled ? 'filled' : active ? 'active' : 'empty'}
                  >
                    {filled ? '•' : ''}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {error && (
          <div className="lg-error" role="alert">
            {error}
          </div>
        )}

        <button type="submit" className="lg-submit" disabled={!canSubmit}>
          {loading ? 'LOADING' : 'START'}
          <span className="lg-submit-arrow" aria-hidden="true">→</span>
        </button>
      </form>

      <footer className="lg-footer">
        <span>WAWA ACADEMY</span>
        <span>V.1</span>
      </footer>

      {/* ─ Academy Picker Sheet ─────────────────────── */}
      {sheetOpen && (
        <div
          className="lg-sheet-scrim"
          onClick={() => setSheetOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="학원 선택"
        >
          <div className="lg-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="lg-sheet-header">
              <h2 className="lg-sheet-title">학원 선택</h2>
              <button
                type="button"
                className="lg-sheet-close"
                onClick={() => setSheetOpen(false)}
                aria-label="닫기"
              >
                ×
              </button>
            </div>
            {visibleAcademies.length === 0 ? (
              <div className="lg-sheet-empty">등록된 학원이 없습니다</div>
            ) : (
              <ul className="lg-sheet-list">
                {visibleAcademies.map((a) => (
                  <li
                    key={a.slug}
                    role="button"
                    tabIndex={0}
                    className="lg-sheet-item"
                    aria-selected={selectedAcademy?.slug === a.slug}
                    onClick={() => {
                      setSelectedAcademy(a);
                      setSheetOpen(false);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedAcademy(a);
                        setSheetOpen(false);
                      }
                    }}
                  >
                    <span className="lg-sheet-item-name">{a.name}</span>
                    <span className="lg-sheet-item-meta">{a.slug.toUpperCase()}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
