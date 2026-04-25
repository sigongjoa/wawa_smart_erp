import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, VocabExamAvailability } from '../api';
import './VocabExamCard.css';

export default function VocabExamCard() {
  const navigate = useNavigate();
  const [avail, setAvail] = useState<VocabExamAvailability | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    refresh();
  }, []);

  // 쿨다운 카운트다운용 1초 틱
  useEffect(() => {
    if (avail?.available || !avail?.retryAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [avail?.available, avail?.retryAt]);

  // retryAt 도달하면 자동 새로고침
  useEffect(() => {
    if (!avail?.retryAt || avail.available) return;
    const ms = new Date(avail.retryAt).getTime() - Date.now();
    if (ms > 0 && ms < 60_000 * 60) {
      const t = setTimeout(refresh, ms + 500);
      return () => clearTimeout(t);
    }
  }, [avail?.retryAt, avail?.available]);

  function refresh() {
    setLoading(true);
    api.getVocabExamAvailability()
      .then(setAvail)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  async function handleStart() {
    if (!avail) return;
    if (avail.inProgressId) {
      navigate(`/vocab/exam/${avail.inProgressId}`);
      return;
    }
    setStarting(true);
    setError(null);
    try {
      const res = await api.startVocabSelfExam();
      navigate(`/vocab/exam/${res.id}`);
    } catch (e: any) {
      setError(e.message ?? '시험을 시작할 수 없어요');
      setStarting(false);
      refresh();
    }
  }

  if (loading) {
    return <div className="vcard vcard-loading">단어 시험 준비 중…</div>;
  }
  if (!avail) {
    return null;
  }

  const remainingMs = avail.retryAt ? new Date(avail.retryAt).getTime() - now : 0;
  const remainSec = Math.max(0, Math.ceil(remainingMs / 1000));
  const remainStr = remainSec >= 3600
    ? `${Math.floor(remainSec / 3600)}시간 ${Math.floor((remainSec % 3600) / 60)}분`
    : remainSec >= 60
    ? `${Math.floor(remainSec / 60)}분 ${remainSec % 60}초`
    : `${remainSec}초`;

  const inProgress = !!avail.inProgressId;

  return (
    <div className="vcard">
      <div className="vcard-head">
        <span className="vcard-title">📖 단어 시험</span>
        {avail.policy.daily_limit > 0 && (
          <span className="vcard-quota">
            오늘 {avail.todayCount}/{avail.policy.daily_limit}회
          </span>
        )}
      </div>

      <div className="vcard-meta">
        <span>문항 {avail.policy.vocab_count}개</span>
        {avail.policy.time_limit_sec > 0 && (
          <span>· 제한 {Math.floor(avail.policy.time_limit_sec / 60)}분</span>
        )}
      </div>

      {error && <div className="vcard-error">{error}</div>}

      {inProgress ? (
        <button className="vcard-btn vcard-btn-resume" onClick={handleStart}>
          이어서 풀기 →
        </button>
      ) : avail.available ? (
        <button className="vcard-btn vcard-btn-start" onClick={handleStart} disabled={starting}>
          {starting ? '시작 중…' : '시험 시작'}
        </button>
      ) : (
        <>
          <button className="vcard-btn vcard-btn-disabled" disabled>
            {avail.reason === 'cooldown' && remainSec > 0
              ? `${remainStr} 후 가능`
              : avail.reason === 'daily_limit'
              ? '오늘 한도 도달'
              : avail.reason === 'inactive_hours'
              ? `시험 시간 아님`
              : '응시 불가'}
          </button>
          {avail.message && <div className="vcard-msg">{avail.message}</div>}
        </>
      )}

      {avail.policy.active_from && avail.policy.active_to && (
        <div className="vcard-hours">
          응시 시간: {avail.policy.active_from} ~ {avail.policy.active_to}
        </div>
      )}
    </div>
  );
}
