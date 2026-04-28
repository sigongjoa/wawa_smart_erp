import { useState, useEffect } from 'react';
import { api } from '../api';
import { errorMessage } from '../utils/errors';

interface Meeting {
  id: string;
  title: string;
  status: string;
  summary?: string;
  transcript?: string;
  participants: string[];
  key_decisions?: string[];
  keyDecisions?: string[];
  actions?: MeetingAction[];
  duration_seconds?: number;
  error_message?: string;
  created_at: string;
}

interface MeetingAction {
  id: string;
  title: string;
  assignee_name?: string;
  assigneeName?: string;
  due_date?: string;
  dueDate?: string;
  status: string;
}

type ViewMode = 'list' | 'record' | 'detail';

export default function MeetingPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  const [newTitle, setNewTitle] = useState('');
  const [newParticipants, setNewParticipants] = useState('');
  const [manualTranscript, setManualTranscript] = useState('');
  const [saving, setSaving] = useState(false);

  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);

  useEffect(() => {
    loadMeetings();
  }, []);

  const loadMeetings = async () => {
    setLoading(true);
    try {
      const data = await api.getMeetings();
      setMeetings(data);
    } catch { /* ignore */ }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!newTitle.trim()) {
      alert('회의 제목을 입력해주세요');
      return;
    }
    if (!manualTranscript.trim()) {
      alert('회의 내용을 입력해주세요');
      return;
    }

    setSaving(true);
    const participants = newParticipants.split(',').map((p) => p.trim()).filter(Boolean);

    try {
      const { id } = await api.createMeeting({ title: newTitle.trim(), participants });
      await api.transcribeMeetingText(id, manualTranscript.trim());

      setNewTitle('');
      setNewParticipants('');
      setManualTranscript('');
      setViewMode('list');
      loadMeetings();
    } catch (err: unknown) {
      alert('저장 실패: ' + errorMessage(err, '오류 발생'));
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setNewTitle('');
    setNewParticipants('');
    setManualTranscript('');
    setViewMode('list');
  };

  const openDetail = async (id: string) => {
    try {
      const detail = await api.getMeeting(id);
      setSelectedMeeting(detail);
      setViewMode('detail');
    } catch {
      alert('상세 정보 로딩 실패');
    }
  };

  const handleToggleAction = async (actionId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'done' ? 'pending' : 'done';
    try {
      await api.updateMeetingAction(actionId, newStatus);
      if (selectedMeeting) {
        const detail = await api.getMeeting(selectedMeeting.id);
        setSelectedMeeting(detail);
      }
    } catch { /* ignore */ }
  };

  const handlePublish = async (id: string) => {
    if (!confirm('보드에 회의록을 게시하시겠습니까?')) return;
    try {
      await api.publishMeeting(id);
      alert('보드에 게시되었습니다');
    } catch (err: unknown) {
      alert('게시 실패: ' + errorMessage(err, '오류'));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('이 회의록을 삭제하시겠습니까?')) return;
    try {
      await api.deleteMeeting(id);
      if (viewMode === 'detail') setViewMode('list');
      loadMeetings();
    } catch (err: unknown) {
      alert('삭제 실패: ' + errorMessage(err, '오류'));
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  if (viewMode === 'list') {
    return (
      <div className="meeting-page">
        <div className="meeting-header">
          <h2>회의록</h2>
          <button className="btn btn-primary" onClick={() => setViewMode('record')}>
            + 새 회의
          </button>
        </div>

        {loading ? (
          <p className="no-data">불러오는 중...</p>
        ) : meetings.length === 0 ? (
          <div className="meeting-empty">
            <div className="meeting-empty-icon">&#128221;</div>
            <p>등록된 회의록이 없습니다</p>
            <p className="meeting-empty-hint">
              회의 내용을 텍스트로 입력하고 저장하세요
            </p>
            <button className="btn btn-primary meeting-empty-cta" onClick={() => setViewMode('record')}>
              첫 회의 기록하기
            </button>
          </div>
        ) : (
          <div className="meeting-list">
            {meetings.map((m) => (
              <div key={m.id} className="meeting-card" onClick={() => openDetail(m.id)}>
                <div className="meeting-card-header">
                  <span className="meeting-card-title">{m.title}</span>
                  <span className={`meeting-status meeting-status--${m.status}`}>
                    {m.status === 'done' ? '완료' : m.status === 'error' ? '오류' : '처리중'}
                  </span>
                </div>
                {m.summary && (
                  <p className="meeting-card-summary">
                    {m.summary.length > 80 ? m.summary.slice(0, 80) + '...' : m.summary}
                  </p>
                )}
                <div className="meeting-card-meta">
                  <span>{formatDate(m.created_at)}</span>
                  {m.participants.length > 0 && (
                    <span>{m.participants.join(', ')}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (viewMode === 'record') {
    return (
      <div className="meeting-page">
        <div className="meeting-header">
          <button className="back-btn" onClick={handleCancel}>&larr; 목록</button>
          <h2>새 회의</h2>
        </div>

        <div className="meeting-record-form">
          <label className="form-label">회의 제목</label>
          <input
            className="form-input"
            placeholder="예: 4월 학습 방향 논의"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />

          <label className="form-label">참석자 (쉼표 구분)</label>
          <input
            className="form-input"
            placeholder="예: 서재용, 김선생, 박선생"
            value={newParticipants}
            onChange={(e) => setNewParticipants(e.target.value)}
          />

          <label className="form-label">회의 내용</label>
          <textarea
            className="form-input meeting-transcript-input"
            placeholder="회의 내용을 붙여넣거나 직접 입력하세요..."
            value={manualTranscript}
            onChange={(e) => setManualTranscript(e.target.value)}
            rows={10}
          />
          <button
            className="btn btn-primary meeting-submit-btn"
            onClick={handleSave}
            disabled={saving || !newTitle.trim() || !manualTranscript.trim()}
          >
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    );
  }

  if (viewMode === 'detail' && selectedMeeting) {
    const m = selectedMeeting;
    const decisions = m.keyDecisions || m.key_decisions || [];
    const actions = m.actions || [];

    return (
      <div className="meeting-page">
        <div className="meeting-header">
          <button className="back-btn" onClick={() => { setViewMode('list'); setSelectedMeeting(null); }}>
            &larr; 목록
          </button>
          <h2>{m.title}</h2>
        </div>

        <div className="meeting-detail">
          <div className="meeting-detail-meta">
            <span>{formatDate(m.created_at)}</span>
            {m.participants.length > 0 && <span>참석: {m.participants.join(', ')}</span>}
            <span className={`meeting-status meeting-status--${m.status}`}>
              {m.status === 'done' ? '완료' : m.status === 'error' ? '오류' : '처리중'}
            </span>
          </div>

          {m.error_message && (
            <div className="meeting-error">{m.error_message}</div>
          )}

          {m.summary && (
            <section className="meeting-section">
              <h3>요약</h3>
              <p className="meeting-summary-text">{m.summary}</p>
            </section>
          )}

          {decisions.length > 0 && (
            <section className="meeting-section">
              <h3>주요 결정사항</h3>
              <ul className="meeting-decisions">
                {decisions.map((d: string, i: number) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            </section>
          )}

          {actions.length > 0 && (
            <section className="meeting-section">
              <h3>할일 목록</h3>
              <div className="meeting-actions-list">
                {actions.map((a: MeetingAction) => (
                  <div key={a.id} className={`meeting-action-item ${a.status === 'done' ? 'done' : ''}`}>
                    <button
                      className="meeting-action-check"
                      onClick={() => handleToggleAction(a.id, a.status)}
                    >
                      {a.status === 'done' ? '\u2713' : ''}
                    </button>
                    <div className="meeting-action-content">
                      <span className="meeting-action-title">{a.title}</span>
                      <div className="meeting-action-meta">
                        {(a.assignee_name || a.assigneeName) && (
                          <span>담당: {a.assignee_name || a.assigneeName}</span>
                        )}
                        {(a.due_date || a.dueDate) && (
                          <span>기한: {a.due_date || a.dueDate}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {m.transcript && (
            <section className="meeting-section">
              <details>
                <summary>회의 내용 원문</summary>
                <pre className="meeting-transcript">{m.transcript}</pre>
              </details>
            </section>
          )}

          <div className="meeting-detail-actions">
            {m.status === 'done' && m.summary && (
              <button className="btn btn-primary" onClick={() => handlePublish(m.id)}>
                보드에 게시
              </button>
            )}
            <button className="btn btn-danger" onClick={() => handleDelete(m.id)}>
              삭제
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
