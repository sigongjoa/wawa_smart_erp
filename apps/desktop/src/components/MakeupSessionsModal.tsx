import { useEffect, useState } from 'react';
import { api } from '../api';
import { toast, useConfirm } from './Toast';

interface Session {
  id: string;
  session_index: number;
  scheduled_date: string;
  scheduled_start_time: string;
  scheduled_end_time: string;
  duration_minutes: number;
  status: 'scheduled' | 'completed' | 'cancelled';
  completed_at: string | null;
  notes: string;
}

interface MakeupSummary {
  id: string;
  required_minutes: number;
  completed_minutes: number;
  progress: number;
}

interface Props {
  makeupId: string;
  studentName: string;
  absenceDate: string;
  onClose: () => void;
  onChanged?: () => void;
}

const todayStr = () => new Date().toISOString().split('T')[0];

export default function MakeupSessionsModal({ makeupId, studentName, absenceDate, onClose, onChanged }: Props) {
  const [summary, setSummary] = useState<MakeupSummary | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { confirm: confirmDialog, ConfirmDialog } = useConfirm();

  const [form, setForm] = useState({
    date: todayStr(),
    start: '15:00',
    end: '15:30',
  });

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.listMakeupSessions(makeupId) as any;
      setSummary(res.makeup);
      setSessions(res.sessions || []);
    } catch (e) {
      toast.error('회차 조회 실패');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [makeupId]);

  const activeMinutes = sessions
    .filter((s) => s.status !== 'cancelled')
    .reduce((sum, s) => sum + s.duration_minutes, 0);
  const remaining = Math.max((summary?.required_minutes || 0) - activeMinutes, 0);

  const calcDuration = () => {
    try {
      const [sh, sm] = form.start.split(':').map(Number);
      const [eh, em] = form.end.split(':').map(Number);
      return (eh * 60 + em) - (sh * 60 + sm);
    } catch { return 0; }
  };
  const newDuration = calcDuration();

  const handleAdd = async () => {
    if (newDuration <= 0) { toast.error('종료 시각이 시작보다 빨라요'); return; }
    setSaving(true);
    try {
      await api.addMakeupSession(makeupId, {
        scheduled_date: form.date,
        scheduled_start_time: form.start,
        scheduled_end_time: form.end,
      });
      toast.success('회차 추가 완료');
      await load();
      onChanged?.();
    } catch (e: any) {
      toast.error('회차 추가 실패: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async (s: Session) => {
    try {
      await api.completeMakeupSession(makeupId, s.id);
      toast.success(`${s.session_index}회차 완료`);
      await load();
      onChanged?.();
    } catch (e: any) {
      toast.error('완료 실패: ' + e.message);
    }
  };

  const handleCancel = async (s: Session) => {
    const ok = await confirmDialog(`${s.session_index}회차를 취소합니다.`);
    if (!ok) return;
    try {
      await api.cancelMakeupSession(makeupId, s.id);
      toast.success('회차 취소');
      await load();
      onChanged?.();
    } catch (e: any) {
      toast.error('취소 실패: ' + e.message);
    }
  };

  const progress = summary?.required_minutes
    ? Math.min(((summary.completed_minutes / summary.required_minutes) * 100), 100)
    : 0;
  const progressClass = progress >= 100 ? 'ms-bar--done'
                       : progress > 0 ? 'ms-bar--progress' : 'ms-bar--idle';

  return (
    <div className="modal-overlay" onClick={onClose}>
      {ConfirmDialog}
      <div className="modal-content ms-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>보강 회차 — {studentName} ({absenceDate})</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {loading ? (
          <div className="rpt-loading"><div className="rpt-spinner" /><span>로딩 중...</span></div>
        ) : (
          <div className="ms-body">
            {/* 진행률 */}
            <div className="ms-summary">
              <div className="ms-summary-row">
                <span className="ms-label">진행률</span>
                <span className="ms-value">
                  <strong>{summary?.completed_minutes || 0}</strong> / {summary?.required_minutes || 0}분
                  ({Math.round(progress)}%)
                </span>
              </div>
              <div className="ms-bar">
                <div className={`ms-bar-fill ${progressClass}`} style={{ width: `${progress}%` }} />
              </div>
              <div className="ms-summary-row ms-summary-sub">
                <span>예약됨: {activeMinutes}분</span>
                <span>남은 필요: {remaining}분</span>
              </div>
            </div>

            {/* 회차 목록 */}
            <div className="ms-list">
              <div className="ms-list-title">회차 {sessions.length}개</div>
              {sessions.length === 0 ? (
                <div className="ms-empty">아직 등록된 회차가 없습니다. 아래에서 추가하세요.</div>
              ) : (
                <ul>
                  {sessions.map((s) => (
                    <li key={s.id} className={`ms-item ms-item--${s.status}`}>
                      <span className="ms-item-icon">
                        {s.status === 'completed' ? '✅' : s.status === 'cancelled' ? '❌' : '⏳'}
                      </span>
                      <span className="ms-item-idx">{s.session_index}회차</span>
                      <span className="ms-item-date">
                        {s.scheduled_date} {s.scheduled_start_time}~{s.scheduled_end_time}
                        <em> ({s.duration_minutes}분)</em>
                      </span>
                      <div className="ms-item-actions">
                        {s.status === 'scheduled' && (
                          <>
                            <button className="btn btn-sm btn-present" onClick={() => handleComplete(s)}>완료</button>
                            <button className="btn btn-sm btn-danger-ghost" onClick={() => handleCancel(s)}>취소</button>
                          </>
                        )}
                        {s.status === 'completed' && s.completed_at && (
                          <span className="ms-completed-at">{s.completed_at.split('T')[0]}</span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* 회차 추가 */}
            <div className="ms-add">
              <div className="ms-add-title">+ 회차 추가</div>
              <div className="ms-add-row">
                <label>
                  <span>날짜</span>
                  <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                </label>
                <label>
                  <span>시작</span>
                  <input type="time" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} />
                </label>
                <label>
                  <span>종료</span>
                  <input type="time" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} />
                </label>
                <span className="ms-duration-hint">
                  = {newDuration > 0 ? `${newDuration}분` : '—'}
                </span>
                <button
                  className="btn btn-primary btn-sm"
                  disabled={saving || newDuration <= 0}
                  onClick={handleAdd}
                >추가</button>
              </div>
              {remaining > 0 && newDuration > remaining && (
                <div className="ms-warn">⚠ 남은 필요 시간({remaining}분)보다 많이 예약됩니다.</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
