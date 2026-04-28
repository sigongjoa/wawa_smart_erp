import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ExamAttemptDto } from '../api';
import { useAuthStore } from '../store';
import { useVisiblePolling } from '../lib/useVisiblePolling';

const POLL_INTERVAL_MS = 5000;
const MAX_POLL_FAILURES = 3;

function formatMMSS(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')} : ${String(sec).padStart(2, '0')}`;
}

export default function ExamTimerPage() {
  const navigate = useNavigate();
  const auth = useAuthStore((s) => s.auth);

  const [attempt, setAttempt] = useState<ExamAttemptDto | null>(null);
  const [localRemaining, setLocalRemaining] = useState<number>(0);
  const [pollFailCount, setPollFailCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const attemptIdRef = useRef<string | null>(null);
  const autoSubmitTriedRef = useRef(false);
  const cancelBtnRef = useRef<HTMLButtonElement | null>(null);

  // 최초 진입 — 본인 active attempt 로드
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const active = await api.getActiveExamAttempt();
        if (cancelled) return;
        if (!active) {
          // 활성 시험이 없으면 홈으로 복귀
          navigate('/', { replace: true });
          return;
        }
        attemptIdRef.current = active.id;
        setAttempt(active);
        setLocalRemaining(active.remainingSeconds);
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message || '시험 정보를 불러오지 못했어요');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [navigate]);

  // 5초 폴링 (visibility-aware)
  const tick = useCallback(async () => {
    const id = attemptIdRef.current;
    if (!id) return;
    try {
      const fresh = await api.getExamAttempt(id);
      setAttempt(fresh);
      setLocalRemaining(fresh.remainingSeconds);
      setPollFailCount(0);
      // 종료 상태면 자동 복귀
      if (['submitted', 'expired', 'voided'].includes(fresh.status)) {
        navigate('/', { replace: true });
      }
    } catch {
      setPollFailCount((c) => c + 1);
    }
  }, [navigate]);

  useVisiblePolling(tick, POLL_INTERVAL_MS, !!attempt);

  // 1초 카운트다운 (paused 가 아닐 때만)
  useEffect(() => {
    if (!attempt) return;
    if (attempt.isPaused || attempt.status === 'paused') return;
    const t = window.setInterval(() => {
      setLocalRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => window.clearInterval(t);
  }, [attempt?.isPaused, attempt?.status, attempt?.id]);

  // remainingSeconds <= 0 시 자동 제출 1회 시도
  useEffect(() => {
    if (!attempt) return;
    if (autoSubmitTriedRef.current) return;
    if (localRemaining > 0) return;
    if (!['running', 'paused'].includes(attempt.status)) return;

    autoSubmitTriedRef.current = true;
    (async () => {
      try {
        await api.submitExamAttempt(attempt.id);
      } catch {
        // 서버에서 expired 로 처리될 수 있음 — 폴링이 종료 상태 잡으면 복귀
      }
    })();
  }, [localRemaining, attempt?.status, attempt?.id]);

  // 모달 열릴 때 취소 버튼 포커스 + Escape 닫기
  useEffect(() => {
    if (!confirmOpen) return;
    cancelBtnRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) setConfirmOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirmOpen, submitting]);

  const handleSubmit = async () => {
    if (!attempt || submitting) return;
    setSubmitting(true);
    try {
      await api.submitExamAttempt(attempt.id);
      navigate('/', { replace: true });
    } catch (e: any) {
      setError(e?.message || '제출에 실패했어요. 다시 시도해주세요');
      setSubmitting(false);
      setConfirmOpen(false);
    }
  };

  if (loading) {
    return (
      <div className="page-center">
        <div className="loading">시험 정보를 불러오는 중...</div>
      </div>
    );
  }

  if (!attempt) {
    return (
      <div className="page-center">
        <div className="loading">활성 시험이 없습니다</div>
      </div>
    );
  }

  const isPaused = attempt.isPaused || attempt.status === 'paused';
  const isLowTime = localRemaining > 0 && localRemaining <= 60;
  const studentName = attempt.studentName || auth?.student.name || '';
  const examTitle =
    attempt.examTitle ||
    [attempt.periodTitle, attempt.paperTitle].filter(Boolean).join(' · ') ||
    '시험';

  const showCallTeacher = pollFailCount >= MAX_POLL_FAILURES;

  return (
    <div
      className="exam-timer-page"
      style={{
        position: 'fixed',
        inset: 0,
        background: '#0f172a',
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 9999,
        padding: '32px 24px',
        boxSizing: 'border-box',
      }}
    >
      <header style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: 24, fontWeight: 600 }}>{studentName} 학생</div>
        <div style={{ fontSize: 18, color: '#94a3b8', marginTop: 4 }}>{examTitle}</div>
      </header>

      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
        }}
      >
        <div
          style={{
            fontSize: 'clamp(96px, 22vw, 240px)',
            fontWeight: 800,
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: '0.05em',
            color: isLowTime ? '#ef4444' : isPaused ? '#facc15' : '#fff',
            transition: 'color 0.3s',
            lineHeight: 1,
          }}
        >
          {formatMMSS(localRemaining)}
        </div>
        <div style={{ fontSize: 20, color: '#cbd5e1' }}>남은 시간</div>
      </div>

      {isPaused && (
        <div
          style={{
            background: '#facc15',
            color: '#1f2937',
            padding: '16px 20px',
            borderRadius: 12,
            textAlign: 'center',
            fontSize: 18,
            fontWeight: 600,
            marginBottom: 16,
          }}
        >
          <div>일시정지 중이에요</div>
          {attempt.pauseReason && (
            <div style={{ fontSize: 15, fontWeight: 400, marginTop: 6 }}>
              사유: {attempt.pauseReason}
            </div>
          )}
        </div>
      )}

      {showCallTeacher && (
        <div
          style={{
            background: '#dc2626',
            color: '#fff',
            padding: '12px 16px',
            borderRadius: 12,
            textAlign: 'center',
            fontSize: 16,
            fontWeight: 600,
            marginBottom: 16,
          }}
        >
          연결이 불안정해요. 교사를 부르세요!
        </div>
      )}

      {error && (
        <div
          style={{
            background: '#7f1d1d',
            color: '#fff',
            padding: '10px 14px',
            borderRadius: 8,
            textAlign: 'center',
            marginBottom: 12,
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <button
          onClick={() => setConfirmOpen(true)}
          disabled={submitting || !['running', 'paused'].includes(attempt.status)}
          style={{
            background: '#22c55e',
            color: '#fff',
            border: 'none',
            borderRadius: 12,
            padding: '18px 48px',
            fontSize: 20,
            fontWeight: 700,
            cursor: 'pointer',
            opacity: submitting ? 0.6 : 1,
          }}
        >
          ✓ 제출
        </button>
      </div>

      {confirmOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="exam-submit-title"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
          }}
        >
          <div
            style={{
              background: '#fff',
              color: '#1f2937',
              padding: 28,
              borderRadius: 16,
              minWidth: 320,
              maxWidth: '90vw',
              textAlign: 'center',
            }}
          >
            <div id="exam-submit-title" style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>
              시험을 제출할까요?
            </div>
            <div style={{ fontSize: 15, color: '#4b5563', marginBottom: 24 }}>
              제출하면 다시 풀 수 없어요.
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button
                ref={cancelBtnRef}
                onClick={() => setConfirmOpen(false)}
                disabled={submitting}
                style={{
                  background: '#e5e7eb',
                  color: '#1f2937',
                  border: 'none',
                  borderRadius: 8,
                  padding: '12px 24px',
                  fontSize: 16,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                취소
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                style={{
                  background: '#22c55e',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  padding: '12px 24px',
                  fontSize: 16,
                  fontWeight: 700,
                  cursor: 'pointer',
                  opacity: submitting ? 0.6 : 1,
                }}
              >
                {submitting ? '제출 중...' : '제출하기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
