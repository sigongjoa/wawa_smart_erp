import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import './LoginPage.css';

type Phase = 'form' | 'done';

interface PinSlotsProps {
  value: string;
  onChange: (v: string) => void;
  inputRef: React.RefObject<HTMLInputElement>;
  ariaLabel: string;
}

function PinField({ value, onChange, inputRef, ariaLabel }: PinSlotsProps) {
  return (
    <div className="lg-pin" onClick={() => inputRef.current?.focus()}>
      <input
        ref={inputRef}
        type="tel"
        inputMode="numeric"
        pattern="\d{4}"
        maxLength={4}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 4))}
        className="lg-pin-input"
        autoComplete="off"
        aria-label={ariaLabel}
      />
      <div className="lg-pin-slots" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => {
          const filled = i < value.length;
          const active = i === Math.min(value.length, 3) && !filled;
          return (
            <div key={i} className="lg-pin-slot" data-state={filled ? 'filled' : active ? 'active' : 'empty'}>
              {filled ? '•' : ''}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ChangePinPage() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>('form');
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [newPinConfirm, setNewPinConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const curRef = useRef<HTMLInputElement>(null);
  const newRef = useRef<HTMLInputElement>(null);
  const confRef = useRef<HTMLInputElement>(null);

  const canSubmit =
    currentPin.length === 4 &&
    newPin.length === 4 &&
    newPinConfirm.length === 4 &&
    !loading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError('');
    if (newPin !== newPinConfirm) {
      setError('새 PIN이 일치하지 않습니다');
      setNewPinConfirm('');
      confRef.current?.focus();
      return;
    }
    if (currentPin === newPin) {
      setError('새 PIN은 기존 PIN과 달라야 합니다');
      setNewPin('');
      setNewPinConfirm('');
      newRef.current?.focus();
      return;
    }
    setLoading(true);
    try {
      await api.changePin(currentPin, newPin);
      setPhase('done');
    } catch (err) {
      setError((err as Error).message);
      setCurrentPin('');
      curRef.current?.focus();
    } finally {
      setLoading(false);
    }
  };

  if (phase === 'done') {
    return (
      <div className="lg">
        <header className="lg-wordmark">
          <span className="lg-wordmark-kicker">WAWA · PIN</span>
          <h1 className="lg-wordmark-title">UPDATED<span>.</span></h1>
          <span className="lg-wordmark-sub">PIN이 변경되었습니다</span>
        </header>
        <div style={{ padding: '24px 0', textAlign: 'center', lineHeight: 1.7, color: 'var(--ink-60)' }}>
          다음 로그인부터 새 PIN을 사용해주세요.
        </div>
        <button type="button" className="lg-submit" onClick={() => navigate('/me', { replace: true })}>
          나로 돌아가기 <span className="lg-submit-arrow" aria-hidden="true">→</span>
        </button>
      </div>
    );
  }

  return (
    <div className="lg">
      <header className="lg-wordmark">
        <span className="lg-wordmark-kicker">WAWA · PIN</span>
        <h1 className="lg-wordmark-title">CHANGE<span>.</span></h1>
        <span className="lg-wordmark-sub">PIN 변경</span>
      </header>

      <form className="lg-form" onSubmit={handleSubmit} noValidate>
        <div className="lg-field">
          <span className="lg-field-label">
            <span>현재 PIN</span>
            <span className="lg-field-index">01</span>
          </span>
          <PinField value={currentPin} onChange={setCurrentPin} inputRef={curRef} ariaLabel="현재 PIN" />
        </div>

        <div className="lg-field">
          <span className="lg-field-label">
            <span>새 PIN · 4자리</span>
            <span className="lg-field-index">02</span>
          </span>
          <PinField value={newPin} onChange={setNewPin} inputRef={newRef} ariaLabel="새 PIN" />
        </div>

        <div className="lg-field">
          <span className="lg-field-label">
            <span>새 PIN 재확인</span>
            <span className="lg-field-index">03</span>
          </span>
          <PinField value={newPinConfirm} onChange={setNewPinConfirm} inputRef={confRef} ariaLabel="새 PIN 재확인" />
        </div>

        {error && <div className="lg-error" role="alert">{error}</div>}

        <button type="submit" className="lg-submit" disabled={!canSubmit}>
          {loading ? 'UPDATING' : 'PIN 변경'}
          <span className="lg-submit-arrow" aria-hidden="true">→</span>
        </button>

        <Link
          to="/me"
          style={{
            display: 'block',
            textAlign: 'center',
            marginTop: 12,
            fontSize: 13,
            color: 'var(--ink-60)',
            textDecoration: 'none',
          }}
        >
          ← 취소
        </Link>
      </form>
    </div>
  );
}
