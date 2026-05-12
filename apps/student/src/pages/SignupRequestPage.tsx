import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, type Academy } from '../api';
import './LoginPage.css';

type Phase = 'form' | 'submitted';

const GRADE_OPTIONS = [
  '초1', '초2', '초3', '초4', '초5', '초6',
  '중1', '중2', '중3',
  '고1', '고2', '고3',
];

export default function SignupRequestPage() {
  const navigate = useNavigate();

  const [academies, setAcademies] = useState<Academy[]>([]);
  const [selectedAcademy, setSelectedAcademy] = useState<Academy | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [name, setName] = useState('');
  const [grade, setGrade] = useState('');
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [teachers, setTeachers] = useState<string[]>([]);
  const [teacherName, setTeacherName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<Phase>('form');

  const pinRef = useRef<HTMLInputElement>(null);
  const pinConfirmRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.getAcademies().then(setAcademies).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedAcademy) {
      setTeachers([]);
      setTeacherName('');
      return;
    }
    api.getTeacherNames(selectedAcademy.slug).then(setTeachers).catch(() => setTeachers([]));
    setTeacherName('');
  }, [selectedAcademy?.slug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAcademy || !name.trim() || pin.length !== 4 || pinConfirm.length !== 4) return;
    if (pin !== pinConfirm) {
      setError('PIN이 일치하지 않습니다');
      setPinConfirm('');
      pinConfirmRef.current?.focus();
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api.submitSignupRequest({
        academy_slug: selectedAcademy.slug,
        name: name.trim(),
        grade: grade || undefined,
        pin,
        teacher_name: teacherName || undefined,
      });
      setPhase('submitted');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const canSubmit =
    !!selectedAcademy &&
    name.trim().length > 0 &&
    pin.length === 4 &&
    pinConfirm.length === 4 &&
    !loading;
  const visibleAcademies = academies.filter((a) => !a.slug.startsWith('test-') && a.slug !== 'e2e-test');

  if (phase === 'submitted') {
    return (
      <div className="lg">
        <header className="lg-wordmark">
          <span className="lg-wordmark-kicker">WAWA · SIGNUP</span>
          <h1 className="lg-wordmark-title">SUBMITTED<span>.</span></h1>
          <span className="lg-wordmark-sub">선생님 승인 대기 중</span>
        </header>
        <div style={{ padding: '24px 0', textAlign: 'center', lineHeight: 1.7, color: 'var(--ink-60)' }}>
          가입 요청이 접수되었습니다.<br />
          선생님 승인 후 로그인할 수 있어요.<br />
          승인이 늦어질 경우 학원 선생님께 문의해주세요.
        </div>
        <button type="button" className="lg-submit" onClick={() => navigate('/login', { replace: true })}>
          로그인 화면으로 <span className="lg-submit-arrow" aria-hidden="true">→</span>
        </button>
      </div>
    );
  }

  return (
    <div className="lg">
      <header className="lg-wordmark">
        <span className="lg-wordmark-kicker">WAWA · SIGNUP</span>
        <h1 className="lg-wordmark-title">JOIN<span>.</span></h1>
        <span className="lg-wordmark-sub">선생님 승인 후 로그인 가능</span>
      </header>

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
            maxLength={50}
          />
        </div>

        <div className="lg-field">
          <span className="lg-field-label">
            <span>학년 (선택)</span>
            <span className="lg-field-index">03</span>
          </span>
          <select
            className="lg-name"
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
            aria-label="학년"
          >
            <option value="">학년을 선택하세요</option>
            {GRADE_OPTIONS.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>

        <div className="lg-field">
          <span className="lg-field-label">
            <span>PIN · 4자리</span>
            <span className="lg-field-index">04</span>
          </span>
          <div className="lg-pin" onClick={() => pinRef.current?.focus()}>
            <input
              ref={pinRef}
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
                const active = i === Math.min(pin.length, 3) && !filled;
                return (
                  <div key={i} className="lg-pin-slot" data-state={filled ? 'filled' : active ? 'active' : 'empty'}>
                    {filled ? '•' : ''}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="lg-field">
          <span className="lg-field-label">
            <span>PIN 재확인</span>
            <span className="lg-field-index">05</span>
          </span>
          <div className="lg-pin" onClick={() => pinConfirmRef.current?.focus()}>
            <input
              ref={pinConfirmRef}
              type="tel"
              inputMode="numeric"
              pattern="\d{4}"
              maxLength={4}
              value={pinConfirm}
              onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, '').slice(0, 4))}
              className="lg-pin-input"
              autoComplete="off"
              aria-label="PIN 재확인"
            />
            <div className="lg-pin-slots" aria-hidden="true">
              {[0, 1, 2, 3].map((i) => {
                const filled = i < pinConfirm.length;
                const active = i === Math.min(pinConfirm.length, 3) && !filled;
                return (
                  <div key={i} className="lg-pin-slot" data-state={filled ? 'filled' : active ? 'active' : 'empty'}>
                    {filled ? '•' : ''}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="lg-field">
          <span className="lg-field-label">
            <span>담당 선생님 (선택)</span>
            <span className="lg-field-index">06</span>
          </span>
          <select
            className="lg-name"
            value={teacherName}
            onChange={(e) => setTeacherName(e.target.value)}
            disabled={!selectedAcademy || teachers.length === 0}
            aria-label="담당 선생님"
          >
            <option value="">
              {!selectedAcademy
                ? '먼저 학원을 선택하세요'
                : teachers.length === 0
                ? '등록된 선생님이 없습니다'
                : '담당 선생님을 선택하세요'}
            </option>
            {teachers.map((t) => (
              <option key={t} value={t}>{t} 선생님</option>
            ))}
          </select>
        </div>

        {error && <div className="lg-error" role="alert">{error}</div>}

        <button type="submit" className="lg-submit" disabled={!canSubmit}>
          {loading ? 'SUBMITTING' : '가입 요청 보내기'}
          <span className="lg-submit-arrow" aria-hidden="true">→</span>
        </button>

        <Link
          to="/login"
          style={{
            display: 'block',
            textAlign: 'center',
            marginTop: 12,
            fontSize: 13,
            color: 'var(--ink-60)',
            textDecoration: 'none',
          }}
        >
          ← 로그인 화면으로
        </Link>
      </form>

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
              <button type="button" className="lg-sheet-close" onClick={() => setSheetOpen(false)} aria-label="닫기">×</button>
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
                    onClick={() => { setSelectedAcademy(a); setSheetOpen(false); }}
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
