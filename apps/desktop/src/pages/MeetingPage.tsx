import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../api';

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

  // 녹음 상태
  const [recording, setRecording] = useState(false);
  const [recorded, setRecorded] = useState(false);  // 녹음 완료 후 대기
  const [recordingTime, setRecordingTime] = useState(0);
  const [newTitle, setNewTitle] = useState('');
  const [newParticipants, setNewParticipants] = useState('');
  const [processing, setProcessing] = useState(false);
  const [processStatus, setProcessStatus] = useState('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordedBlobRef = useRef<Blob | null>(null);
  const timerRef = useRef<number>(0);

  // 텍스트 입력 모드
  const [textMode, setTextMode] = useState(false);
  const [manualTranscript, setManualTranscript] = useState('');

  // 상세 보기
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

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm',
      });
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.start(1000); // 1초 간격으로 데이터
      mediaRecorderRef.current = mediaRecorder;
      setRecording(true);
      setRecordingTime(0);

      timerRef.current = window.setInterval(() => {
        setRecordingTime((t) => t + 1);
      }, 1000);
    } catch (err: any) {
      alert('마이크 접근 실패: ' + (err.message || '권한을 허용해주세요'));
    }
  };

  const stopRecording = useCallback(() => {
    const mr = mediaRecorderRef.current;
    if (!mr) return;

    mr.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mr.mimeType });
      mr.stream.getTracks().forEach((t) => t.stop());
      recordedBlobRef.current = blob;
      setRecorded(true);
    };
    mr.stop();
    clearInterval(timerRef.current);
    setRecording(false);
  }, []);

  const handleSubmitRecording = async () => {
    if (!newTitle.trim()) {
      alert('회의 제목을 입력해주세요');
      return;
    }

    setProcessing(true);
    const participants = newParticipants.split(',').map((p) => p.trim()).filter(Boolean);

    try {
      setProcessStatus('회의 생성 중...');
      const { id } = await api.createMeeting({ title: newTitle.trim(), participants });

      if (textMode) {
        if (!manualTranscript.trim()) {
          alert('녹취록을 입력해주세요');
          setProcessing(false);
          return;
        }
        setProcessStatus('AI 요약 생성 중...');
        await api.transcribeMeetingText(id, manualTranscript.trim());
      } else {
        // 녹음 모드 — 이미 stopRecording으로 blob 저장됨
        const blob = recordedBlobRef.current;
        if (!blob) {
          alert('녹음 데이터가 없습니다');
          setProcessing(false);
          return;
        }

        setProcessStatus('녹음 업로드 중...');
        const arrayBuffer = await blob.arrayBuffer();
        const uint8 = new Uint8Array(arrayBuffer);
        let binary = '';
        for (let i = 0; i < uint8.length; i++) {
          binary += String.fromCharCode(uint8[i]);
        }
        const base64 = btoa(binary);

        setProcessStatus('음성인식 + AI 요약 중... (1~2분 소요)');
        await api.uploadMeetingAudio(id, {
          audioBase64: base64,
          mimeType: blob.type || 'audio/webm',
        });
      }

      setProcessStatus('완료!');
      setNewTitle('');
      setNewParticipants('');
      setManualTranscript('');
      setTextMode(false);
      setRecorded(false);
      recordedBlobRef.current = null;
      setViewMode('list');
      loadMeetings();
    } catch (err: any) {
      alert('처리 실패: ' + (err.message || '오류 발생'));
    } finally {
      setProcessing(false);
      setProcessStatus('');
    }
  };

  const handleCancelRecording = () => {
    if (recording) {
      const mr = mediaRecorderRef.current;
      if (mr) {
        mr.onstop = null;
        mr.stop();
        mr.stream.getTracks().forEach((t) => t.stop());
      }
      clearInterval(timerRef.current);
      setRecording(false);
    }
    setNewTitle('');
    setNewParticipants('');
    setManualTranscript('');
    setTextMode(false);
    setRecorded(false);
    recordedBlobRef.current = null;
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
      // 상세 새로고침
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
    } catch (err: any) {
      alert('게시 실패: ' + (err.message || '오류'));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('이 회의록을 삭제하시겠습니까?')) return;
    try {
      await api.deleteMeeting(id);
      if (viewMode === 'detail') setViewMode('list');
      loadMeetings();
    } catch (err: any) {
      alert('삭제 실패: ' + (err.message || '오류'));
    }
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  // ─── 목록 뷰 ───
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
            <div className="meeting-empty-icon">&#127908;</div>
            <p>등록된 회의록이 없습니다</p>
            <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 4 }}>
              회의를 녹음하거나 텍스트를 입력하면 AI가 자동으로 요약합니다
            </p>
            <button className="btn btn-primary" onClick={() => setViewMode('record')} style={{ marginTop: 12 }}>
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

  // ─── 녹음/입력 뷰 ───
  if (viewMode === 'record') {
    return (
      <div className="meeting-page">
        <div className="meeting-header">
          <button className="back-btn" onClick={handleCancelRecording}>&larr; 목록</button>
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

          <div className="meeting-mode-toggle">
            <button
              className={`btn btn-sm ${!textMode ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setTextMode(false)}
              disabled={processing}
            >
              녹음
            </button>
            <button
              className={`btn btn-sm ${textMode ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setTextMode(true)}
              disabled={processing || recording}
            >
              텍스트 입력
            </button>
          </div>

          {textMode ? (
            <>
              <label className="form-label">녹취록 / 회의 내용</label>
              <textarea
                className="form-input meeting-transcript-input"
                placeholder="회의 내용을 붙여넣거나 직접 입력하세요..."
                value={manualTranscript}
                onChange={(e) => setManualTranscript(e.target.value)}
                rows={8}
              />
              <button
                className="btn btn-primary meeting-submit-btn"
                onClick={handleSubmitRecording}
                disabled={processing || !newTitle.trim() || !manualTranscript.trim()}
              >
                {processing ? processStatus : 'AI 요약 생성'}
              </button>
            </>
          ) : (
            <div className="meeting-recorder">
              {/* 녹음 전 */}
              {!recording && !recorded && !processing && (
                <button className="meeting-rec-btn" onClick={startRecording}>
                  <span className="meeting-rec-icon" />
                  녹음 시작
                </button>
              )}

              {/* 녹음 중 — 정지 버튼만 */}
              {recording && (
                <div className="meeting-recording-active">
                  <div className="meeting-rec-pulse" />
                  <span className="meeting-rec-time">{formatTime(recordingTime)}</span>
                  <button
                    className="meeting-stop-btn"
                    onClick={stopRecording}
                  >
                    녹음 정지
                  </button>
                </div>
              )}

              {/* 녹음 완료 — 제출 버튼 */}
              {recorded && !processing && (
                <div className="meeting-recorded-ready">
                  <p className="meeting-recorded-label">녹음 완료 ({formatTime(recordingTime)})</p>
                  <button
                    className="btn btn-primary meeting-submit-btn"
                    onClick={handleSubmitRecording}
                    disabled={!newTitle.trim()}
                  >
                    AI 분석 시작
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => { setRecorded(false); recordedBlobRef.current = null; setRecordingTime(0); }}
                    style={{ marginTop: 8 }}
                  >
                    다시 녹음
                  </button>
                </div>
              )}

              {/* 처리 중 */}
              {processing && (
                <div className="meeting-processing">
                  <div className="meeting-spinner" />
                  <p>{processStatus}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── 상세 뷰 ───
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
          {/* 메타 */}
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

          {/* 요약 */}
          {m.summary && (
            <section className="meeting-section">
              <h3>요약</h3>
              <p className="meeting-summary-text">{m.summary}</p>
            </section>
          )}

          {/* 주요 결정사항 */}
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

          {/* 액션 아이템 */}
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
                      {a.status === 'done' ? '&#10003;' : ''}
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

          {/* 녹취록 */}
          {m.transcript && (
            <section className="meeting-section">
              <details>
                <summary>녹취록 원문</summary>
                <pre className="meeting-transcript">{m.transcript}</pre>
              </details>
            </section>
          )}

          {/* 버튼 */}
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
