/**
 * ExamTimerPage — 시험 결시 학생 개별 타이머
 *
 * 설계: docs/EXAM_MAKEUP_TIMER_DESIGN.md §4.1
 *
 * 좌측: 결시 학생 체크리스트 (시험 종류 드롭다운으로 필터)
 * 우측: 활성 타이머 카드 그리드
 *
 * 폴링: 5초 — `/api/exam-attempts/today`
 * 카운트다운: 1초 (클라이언트 자체 계산)
 */
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ExamAttempt, ExamAttemptPendingAssignment } from '../api';
import { useAuthStore } from '../store';
import { toast, useConfirm } from '../components/Toast';

const PAUSE_REASONS = ['화장실', '몸이 안 좋음', '교사 호출', '기타'] as const;
const POLL_INTERVAL_MS = 5000;

const GRADE_CLASS_MAP: Record<string, string> = {
  초1: 'm1', 초2: 'm1', 초3: 'm1', 초4: 'm2', 초5: 'm2', 초6: 'm2',
  중1: 'm1', 중2: 'm2', 중3: 'm3',
  고1: 'h1', 고2: 'h2', 고3: 'h3',
  검정고시: 'etc',
};
const gradeClass = (g?: string) => (g && GRADE_CLASS_MAP[g]) || 'etc';

function formatMMSS(totalSec: number): string {
  const sec = Math.max(0, Math.floor(totalSec));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// 서버에서 받은 attempt를 기준으로 클라이언트 카운트다운 계산
function computeRemaining(attempt: ExamAttempt, baseFetchedAt: number, now: number): number {
  if (attempt.status === 'submitted' || attempt.status === 'expired' || attempt.status === 'voided') {
    return 0;
  }
  if (attempt.status === 'paused') {
    // paused 상태에서는 서버가 멈춘 시점의 remainingSeconds 그대로 사용
    return attempt.remainingSeconds;
  }
  // running/ready: 서버 응답 시점부터 흐른 시간을 차감
  const elapsedSinceFetch = Math.floor((now - baseFetchedAt) / 1000);
  return Math.max(0, attempt.remainingSeconds - elapsedSinceFetch);
}

interface AttemptCardProps {
  attempt: ExamAttempt;
  remaining: number;
  onPause: (attempt: ExamAttempt) => void;
  onResume: (attempt: ExamAttempt) => void;
  onSubmit: (attempt: ExamAttempt) => void;
  onGoGrade: () => void;
}

const AttemptCard = memo(function AttemptCard({
  attempt, remaining, onPause, onResume, onSubmit, onGoGrade,
}: AttemptCardProps) {
  const status = attempt.status;
  const isExpired = status === 'expired' || (status === 'running' && remaining <= 0);
  const effectiveStatus: ExamAttempt['status'] = isExpired && status === 'running' ? 'expired' : status;
  const isWarning = effectiveStatus === 'running' && remaining > 0 && remaining <= 60;
  const isSubmitted = effectiveStatus === 'submitted';
  const isPaused = effectiveStatus === 'paused';
  const isReady = effectiveStatus === 'ready';

  const cardClass = [
    'exam-timer-card',
    `exam-timer-card--${effectiveStatus}`,
    isWarning ? 'exam-timer-card--warning' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={cardClass} data-testid={`attempt-card-${attempt.id}`}>
      <div className="exam-timer-card__top">
        <div className="exam-timer-card__identity">
          <span className="exam-timer-card__name">{attempt.studentName || '학생'}</span>
          {attempt.paperTitle && (
            <span className="exam-timer-card__paper">· {attempt.paperTitle}</span>
          )}
        </div>
        <span className={`exam-timer-card__status exam-timer-card__status--${effectiveStatus}`}>
          {effectiveStatus === 'ready' && '대기'}
          {effectiveStatus === 'running' && '진행 중'}
          {effectiveStatus === 'paused' && '일시정지'}
          {effectiveStatus === 'expired' && '시간 종료'}
          {effectiveStatus === 'submitted' && '제출 완료'}
          {effectiveStatus === 'voided' && '무효'}
        </span>
      </div>

      <div className="exam-timer-card__display">
        {isExpired ? (
          <span className="exam-timer-card__display-value">─ : ─</span>
        ) : (
          <span className="exam-timer-card__display-value">{formatMMSS(remaining)}</span>
        )}
        <span className="exam-timer-card__display-label">
          {isExpired ? '시간 종료' : isPaused ? '정지 중' : isSubmitted ? '제출됨' : '남은 시간'}
        </span>
      </div>

      <div className="exam-timer-card__meta">
        <span>총 {attempt.durationMinutes}분</span>
        {attempt.pausedSeconds > 0 && (
          <>
            <span className="exam-timer-card__meta-divider">|</span>
            <span>정지 누적 {Math.floor(attempt.pausedSeconds / 60)}분 {attempt.pausedSeconds % 60}초</span>
          </>
        )}
      </div>

      <div className="exam-timer-card__actions">
        {isExpired && !isSubmitted && (
          <button type="button" className="btn btn-primary exam-timer-card__btn-grade" onClick={onGoGrade}>
            채점하러 가기
          </button>
        )}
        {effectiveStatus === 'running' && (
          <>
            <button type="button" className="btn btn-secondary" onClick={() => onPause(attempt)}>
              ⏸ 정지
            </button>
            <button type="button" className="btn btn-primary" onClick={() => onSubmit(attempt)}>
              ✓ 제출
            </button>
          </>
        )}
        {effectiveStatus === 'paused' && (
          <>
            <button type="button" className="btn btn-secondary" onClick={() => onResume(attempt)}>
              ▶ 재개
            </button>
            <button type="button" className="btn btn-primary" onClick={() => onSubmit(attempt)}>
              ✓ 제출
            </button>
          </>
        )}
        {isReady && (
          <span className="exam-timer-card__hint">곧 시작됩니다</span>
        )}
        {isSubmitted && (
          <button type="button" className="btn btn-secondary" onClick={onGoGrade}>
            채점 페이지로
          </button>
        )}
      </div>
    </div>
  );
});

export default function ExamTimerPage() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const { confirm: confirmDialog, ConfirmDialog } = useConfirm();

  const [attempts, setAttempts] = useState<ExamAttempt[]>([]);
  const [pending, setPending] = useState<ExamAttemptPendingAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchedAt, setFetchedAt] = useState<number>(Date.now());
  const [now, setNow] = useState<number>(Date.now());

  const [periodFilter, setPeriodFilter] = useState<string>('');
  const [selectedAssignments, setSelectedAssignments] = useState<Set<string>>(new Set());
  const [defaultDuration, setDefaultDuration] = useState<number>(50);
  const [starting, setStarting] = useState(false);

  // 일시정지 모달
  const [pauseTarget, setPauseTarget] = useState<ExamAttempt | null>(null);
  const [pauseReason, setPauseReason] = useState<string>('');
  const [pauseCustom, setPauseCustom] = useState<string>('');
  const [pauseSaving, setPauseSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.getExamAttemptsToday();
      setAttempts(res.attempts || []);
      setPending(res.pendingAssignments || []);
      setFetchedAt(Date.now());
    } catch (err) {
      toast.error('목록 조회 실패: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  // 초기 + 5초 폴링 — 배경 탭이면 pause
  useEffect(() => {
    load();
    let t: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (t !== null) return;
      t = setInterval(load, POLL_INTERVAL_MS);
    };
    const stop = () => {
      if (t !== null) {
        clearInterval(t);
        t = null;
      }
    };
    const onVisibility = () => {
      if (document.hidden) stop();
      else {
        load();
        start();
      }
    };
    if (!document.hidden) start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [load]);

  // 1초 카운트다운 (now만 갱신) — 배경 탭이면 pause
  useEffect(() => {
    let t: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (t !== null) return;
      t = setInterval(() => setNow(Date.now()), 1000);
    };
    const stop = () => {
      if (t !== null) {
        clearInterval(t);
        t = null;
      }
    };
    const onVisibility = () => {
      if (document.hidden) stop();
      else {
        setNow(Date.now());
        start();
      }
    };
    if (!document.hidden) start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  // 시험 종류 옵션 (pending + attempts에서 추출)
  const periodOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of pending) {
      if (p.exam_period_id) map.set(p.exam_period_id, p.period_title || '시험');
    }
    for (const a of attempts) {
      // attempts는 examAssignmentId만 있어 period 추적은 paperTitle만 있음
      // periodTitle이 있으면 키로 paperTitle을 사용 (그룹핑 보조)
    }
    return Array.from(map.entries()).map(([id, title]) => ({ id, title }));
  }, [pending, attempts]);

  // 좌측 리스트: 필터 + 진행 중 학생 표시
  const filteredPending = useMemo(() => {
    if (!periodFilter) return pending;
    return pending.filter(p => p.exam_period_id === periodFilter);
  }, [pending, periodFilter]);

  const toggleSelect = (assignmentId: string) => {
    setSelectedAssignments(prev => {
      const next = new Set(prev);
      if (next.has(assignmentId)) next.delete(assignmentId);
      else next.add(assignmentId);
      return next;
    });
  };

  const handleStartSelected = async () => {
    if (selectedAssignments.size === 0) {
      toast.info('학생을 선택하세요');
      return;
    }
    if (!Number.isFinite(defaultDuration) || defaultDuration <= 0) {
      toast.error('시험 시간(분)을 1 이상으로 입력하세요');
      return;
    }
    const ok = await confirmDialog(
      `${selectedAssignments.size}명의 시험을 ${defaultDuration}분으로 시작합니다. 진행할까요?`
    );
    if (!ok) return;

    setStarting(true);
    let success = 0;
    let failed = 0;
    for (const assignmentId of selectedAssignments) {
      try {
        await api.startExamAttempt({
          examAssignmentId: assignmentId,
          durationMinutes: defaultDuration,
        });
        success++;
      } catch (err) {
        failed++;
        toast.error(`시작 실패: ${(err as Error).message}`);
      }
    }
    setStarting(false);
    setSelectedAssignments(new Set());
    if (success > 0) toast.success(`${success}명 시험 시작 완료${failed > 0 ? ` (실패 ${failed})` : ''}`);
    await load();
  };

  const handlePauseClick = (attempt: ExamAttempt) => {
    setPauseTarget(attempt);
    setPauseReason('');
    setPauseCustom('');
  };

  const confirmPause = async () => {
    if (!pauseTarget) return;
    const reason = pauseReason === '기타' ? pauseCustom.trim() : pauseReason;
    if (!reason) {
      toast.error('일시정지 사유를 선택하거나 입력해주세요');
      return;
    }
    setPauseSaving(true);
    try {
      await api.pauseExamAttempt(pauseTarget.id, reason);
      setPauseTarget(null);
      await load();
    } catch (err) {
      toast.error('일시정지 실패: ' + (err as Error).message);
    } finally {
      setPauseSaving(false);
    }
  };

  const handleResume = async (attempt: ExamAttempt) => {
    try {
      await api.resumeExamAttempt(attempt.id);
      await load();
    } catch (err) {
      toast.error('재개 실패: ' + (err as Error).message);
    }
  };

  const handleSubmit = async (attempt: ExamAttempt) => {
    const ok = await confirmDialog(`${attempt.studentName || '학생'}의 시험을 제출 처리할까요?`);
    if (!ok) return;
    try {
      await api.submitExamAttempt(attempt.id);
      toast.success('제출 완료');
      await load();
    } catch (err) {
      toast.error('제출 실패: ' + (err as Error).message);
    }
  };

  const handleGoGrade = () => {
    navigate('/exams');
  };

  return (
    <div className="exam-timer-root">
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1 className="page-title">시험 타이머 ({user?.name || ''})</h1>
            <p className="page-description">
              결시 학생을 선택해 개별 시험 타이머를 시작합니다. 5초마다 자동 새로고침됩니다.
            </p>
          </div>
        </div>
      </div>

      {/* 상단 필터/시간 설정 바 */}
      <div className="filter-bar exam-timer-filter">
        <select
          className="exam-filter-select"
          value={periodFilter}
          onChange={(e) => setPeriodFilter(e.target.value)}
          aria-label="시험 종류 필터"
        >
          <option value="">전체 시험</option>
          {periodOptions.map(p => (
            <option key={p.id} value={p.id}>{p.title}</option>
          ))}
        </select>
        <label className="exam-timer-duration">
          시험 시간(분)
          <input
            type="number"
            min={1}
            max={600}
            className="exam-input"
            value={defaultDuration}
            onChange={(e) => setDefaultDuration(parseInt(e.target.value, 10) || 0)}
            style={{ width: 80, marginLeft: 6 }}
          />
        </label>
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleStartSelected}
          disabled={starting || selectedAssignments.size === 0}
          data-testid="start-selected-btn"
        >
          {starting ? '시작 중...' : `선택 시작 (${selectedAssignments.size})`}
        </button>
      </div>

      {loading ? (
        <div className="rpt-loading" role="status">
          <div className="rpt-spinner" />
          <span>로딩 중...</span>
        </div>
      ) : (
        <div className="exam-timer-columns">
          {/* 좌측: 결시 학생 체크리스트 */}
          <div className="exam-timer-col exam-timer-col--list">
            <div className="exam-timer-col-label">
              <span>응시 가능 학생</span>
              <span className="exam-timer-col-count">{filteredPending.length}</span>
            </div>
            <div className="exam-timer-col-body">
              {filteredPending.length === 0 ? (
                <div className="exam-timer-empty">결시/재시험 대기 학생이 없습니다</div>
              ) : (
                filteredPending.map(p => {
                  const checked = selectedAssignments.has(p.assignment_id);
                  return (
                    <label
                      key={p.assignment_id}
                      className={`exam-timer-pending-card rt-grade-${gradeClass(p.student_grade)} ${checked ? 'is-checked' : ''}`}
                      data-testid={`pending-${p.assignment_id}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleSelect(p.assignment_id)}
                      />
                      <div className="exam-timer-pending-info">
                        <div className="exam-timer-pending-top">
                          <span className="exam-timer-pending-name">{p.student_name}</span>
                          {p.student_grade && (
                            <span className={`grade-badge ${gradeClass(p.student_grade)}`}>{p.student_grade}</span>
                          )}
                          <span className={`exam-timer-pending-status exam-timer-pending-status--${p.exam_status}`}>
                            {p.exam_status === 'absent' ? '결시' : '재시험 예정'}
                          </span>
                        </div>
                        <div className="exam-timer-pending-meta">
                          {p.paper_title || p.period_title || '시험'}
                          {p.absence_reason && ` · 사유: ${p.absence_reason}`}
                        </div>
                      </div>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          {/* 우측: 활성 타이머 카드 그리드 */}
          <div className="exam-timer-col exam-timer-col--cards">
            <div className="exam-timer-col-label">
              <span>진행 중인 시험</span>
              <span className="exam-timer-col-count">{attempts.length}</span>
            </div>
            <div className="exam-timer-grid">
              {attempts.length === 0 ? (
                <div className="exam-timer-empty">진행 중인 시험이 없습니다</div>
              ) : (
                attempts.map(a => {
                  const remaining = computeRemaining(a, fetchedAt, now);
                  return (
                    <AttemptCard
                      key={a.id}
                      attempt={a}
                      remaining={remaining}
                      onPause={handlePauseClick}
                      onResume={handleResume}
                      onSubmit={handleSubmit}
                      onGoGrade={handleGoGrade}
                    />
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* 일시정지 사유 입력 모달 */}
      {pauseTarget && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="일시정지 사유 입력"
          onClick={() => !pauseSaving && setPauseTarget(null)}
          onKeyDown={(e) => { if (e.key === 'Escape' && !pauseSaving) setPauseTarget(null); }}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 600 }}>
              일시정지 — {pauseTarget.studentName || '학생'}
            </h3>
            <p style={{ fontSize: 13, color: '#666', margin: '0 0 12px' }}>
              사유는 필수입니다. 재개 시까지 시계가 멈춥니다.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {PAUSE_REASONS.map(r => (
                <label key={r} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="pause-reason"
                    value={r}
                    checked={pauseReason === r}
                    onChange={() => setPauseReason(r)}
                  />
                  {r}
                </label>
              ))}
              {pauseReason === '기타' && (
                <input
                  type="text"
                  className="exam-input"
                  placeholder="사유를 직접 입력"
                  value={pauseCustom}
                  onChange={(e) => setPauseCustom(e.target.value)}
                  autoFocus
                  style={{ width: '100%', marginTop: 4 }}
                />
              )}
            </div>
            <div className="modal-footer" style={{ marginTop: 16 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setPauseTarget(null)}
                disabled={pauseSaving}
              >
                취소
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={confirmPause}
                disabled={pauseSaving}
                data-testid="confirm-pause-btn"
              >
                {pauseSaving ? '처리 중...' : '일시정지'}
              </button>
            </div>
          </div>
        </div>
      )}

      {ConfirmDialog}
    </div>
  );
}
