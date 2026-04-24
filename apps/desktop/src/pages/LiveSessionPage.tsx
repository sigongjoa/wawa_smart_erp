import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { api, LiveSessionState, LiveSessionRow, Stroke } from '../api';
import SimpleCanvas, { strokesToPngDataUrl } from '../components/SimpleCanvas';
import Modal from '../components/Modal';
import { toast } from '../components/Toast';

const POLL_INTERVAL = 3000;
const PATCH_DEBOUNCE = 600;
const CANVAS_W = 800;
const CANVAS_H = 500;

function fmtElapsed(startIso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(startIso + 'Z').getTime()) / 1000));
  const hh = String(Math.floor(s / 3600)).padStart(2, '0');
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function LiveSessionPage() {
  const { id } = useParams<{ id: string }>();
  const [search] = useSearchParams();
  const navigate = useNavigate();

  const [session, setSession] = useState<LiveSessionRow | null>(null);
  const [state, setState] = useState<LiveSessionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  // 교사 입력 (로컬)
  const [problemText, setProblemText] = useState('');
  const [teacherText, setTeacherText] = useState('');
  const [teacherStrokes, setTeacherStrokes] = useState<Stroke[]>([]);
  const [problemImageDataUrl, setProblemImageDataUrl] = useState<string | undefined>(undefined);

  // End modal
  const [endOpen, setEndOpen] = useState(false);
  const [endSummary, setEndSummary] = useState('');
  const [endSentiment, setEndSentiment] = useState<'positive' | 'neutral' | 'concern'>('neutral');
  const [endSubmitting, setEndSubmitting] = useState(false);

  const debounceRef = useRef<{
    teacher?: ReturnType<typeof setTimeout>;
    problem?: ReturnType<typeof setTimeout>;
  }>({});

  const initialLoad = useCallback(async () => {
    if (!id) return;
    try {
      const [sess, st] = await Promise.all([
        api.getLiveSession(id),
        api.getLiveState(id),
      ]);
      setSession(sess);
      setState(st);
      setProblemText(st.problem?.text || sess.problem_text || '');
      setTeacherText(st.teacher?.text || '');
      setTeacherStrokes(st.teacher?.strokes || []);
      setProblemImageDataUrl(st.problem?.image_data_url);
      setLoading(false);
    } catch (e: any) {
      setError(e?.message || '세션 로드 실패');
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    initialLoad();
  }, [initialLoad]);

  // tick clock
  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // poll student side every 3s
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const st = await api.getLiveState(id);
        if (cancelled) return;
        setState(st);
        if (st.status === 'ended') {
          toast.success('세션이 종료되었습니다');
        }
      } catch { /* ignore */ }
    };
    const interval = setInterval(tick, POLL_INTERVAL);
    return () => { cancelled = true; clearInterval(interval); };
  }, [id]);

  // 교사 입력 → 디바운스 PATCH
  const pushTeacher = useCallback(
    (text: string, strokes: Stroke[]) => {
      if (!id) return;
      clearTimeout(debounceRef.current.teacher);
      debounceRef.current.teacher = setTimeout(() => {
        api.patchLiveState(id, { side: 'teacher', text, strokes }).catch(() => {});
      }, PATCH_DEBOUNCE);
    },
    [id]
  );
  const pushProblem = useCallback(
    (text: string) => {
      if (!id) return;
      clearTimeout(debounceRef.current.problem);
      debounceRef.current.problem = setTimeout(() => {
        api.patchLiveState(id, { side: 'problem', text }).catch(() => {});
      }, PATCH_DEBOUNCE);
    },
    [id]
  );

  const onProblemImageUpload = async (file: File) => {
    if (!id) return;
    if (file.size > 1 * 1024 * 1024) {
      alert('이미지는 1MB 이내로 업로드해 주세요');
      return;
    }
    const dataUrl = await fileToDataUrl(file);
    setProblemImageDataUrl(dataUrl);
    try {
      await api.patchLiveState(id, { side: 'problem', image_data_url: dataUrl });
      toast.success('문제 이미지 전송됨');
    } catch (e: any) {
      alert(e.message || '이미지 전송 실패');
    }
  };

  const handleEnd = async () => {
    if (!id || !session) return;
    setEndSubmitting(true);
    try {
      const teacherImg = await strokesToPngDataUrl(
        CANVAS_W, CANVAS_H, teacherStrokes
      );
      const studentImg = state?.student?.strokes
        ? await strokesToPngDataUrl(CANVAS_W, CANVAS_H, state.student.strokes)
        : undefined;
      const result = await api.endLiveSession(id, {
        teacher_solution_image: teacherImg,
        student_answer_image: studentImg,
        create_note: endSummary.trim()
          ? { sentiment: endSentiment, summary: endSummary.trim() }
          : undefined,
      });
      toast.success('세션 종료' + (result.note_id ? ' · 메모 자동 생성됨' : ''));
      navigate(`/student/${session.student_id}`);
    } catch (e: any) {
      alert(e.message || '종료 실패');
    } finally {
      setEndSubmitting(false);
    }
  };

  if (loading) return <div style={{ padding: 16 }}>불러오는 중...</div>;
  if (error || !session || !state) return <div style={{ padding: 16, color: '#dc2626' }}>{error || '세션 없음'}</div>;

  const studentName = search.get('student_name') || session.student_id;
  const ended = state.status === 'ended' || session.status === 'ended';

  return (
    <div style={{ padding: 12, height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/student/${session.student_id}`)}>
          ← 학생 프로필
        </button>
        <h2 style={{ margin: 0, fontSize: 18 }}>
          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#dc2626', marginRight: 8, verticalAlign: 'middle' }} aria-hidden="true" />
          라이브 — {studentName} <span style={{ color: 'var(--text-tertiary)' }}>· {session.subject}</span>
        </h2>
        <span style={{ fontSize: 14, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
          ⏱ {fmtElapsed(session.started_at)} <span style={{ visibility: 'hidden' }}>{tick}</span>
        </span>
        <span
          style={{
            fontSize: 12,
            color: state.student.updated_at && Date.now() - state.student.updated_at < 6000 ? '#16a34a' : '#94a3b8',
          }}
        >
          ● 학생 {state.student.updated_at ? `${Math.round((Date.now() - state.student.updated_at) / 1000)}초 전 활동` : '연결 대기'}
        </span>
        <div style={{ flex: 1 }} />
        {!ended && (
          <button className="btn btn-danger btn-sm" onClick={() => setEndOpen(true)}>
            세션 종료
          </button>
        )}
        {ended && (
          <span className="badge" style={{ background: '#94a3b8', color: '#fff' }}>종료됨</span>
        )}
      </div>

      {/* 분할 뷰 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 12,
          flex: 1,
          minHeight: 0,
        }}
      >
        {/* 좌: 교사 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0, overflow: 'auto' }}>
          <section className="dashboard-section" style={{ padding: 10 }}>
            <h3 style={{ margin: '0 0 6px', fontSize: 14 }}>문제</h3>
            <textarea
              className="form-input"
              rows={2}
              placeholder="문제 텍스트 (학생 화면에 즉시 표시)"
              value={problemText}
              onChange={(e) => { setProblemText(e.target.value); pushProblem(e.target.value); }}
              disabled={ended}
            />
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onProblemImageUpload(f);
                }}
                disabled={ended}
              />
              {problemImageDataUrl && (
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                  ✔ 이미지 전송됨
                </span>
              )}
            </div>
            {problemImageDataUrl && (
              <img
                src={problemImageDataUrl}
                alt="문제"
                style={{ marginTop: 6, maxWidth: '100%', maxHeight: 180, border: '1px solid var(--border)', borderRadius: 6 }}
              />
            )}
          </section>

          <section className="dashboard-section" style={{ padding: 10, flex: 1, display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ margin: '0 0 6px', fontSize: 14 }}>✏️ 내 풀이</h3>
            <textarea
              className="form-input"
              rows={2}
              placeholder="텍스트 풀이"
              value={teacherText}
              onChange={(e) => {
                setTeacherText(e.target.value);
                pushTeacher(e.target.value, teacherStrokes);
              }}
              disabled={ended}
            />
            <div style={{ marginTop: 6 }}>
              <SimpleCanvas
                width={CANVAS_W}
                height={CANVAS_H}
                strokes={teacherStrokes}
                onChange={(s) => {
                  setTeacherStrokes(s);
                  pushTeacher(teacherText, s);
                }}
                readOnly={ended}
              />
            </div>
          </section>
        </div>

        {/* 우: 학생 미러 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0, overflow: 'auto' }}>
          <section className="dashboard-section" style={{ padding: 10 }}>
            <h3 style={{ margin: '0 0 6px', fontSize: 14 }}>학생 화면 (실시간)</h3>
            {state.student.text ? (
              <div style={{
                whiteSpace: 'pre-wrap',
                background: 'var(--bg-secondary)',
                padding: 8, borderRadius: 6, fontSize: 13,
                marginBottom: 6,
              }}>
                {state.student.text}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>(학생 텍스트 없음)</div>
            )}
            {state.student.photo_data_urls && state.student.photo_data_urls.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                {state.student.photo_data_urls.map((u, i) => (
                  <img key={i} src={u} alt={`학생 사진 ${i + 1}`}
                    style={{ width: 100, height: 100, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)' }}
                    onClick={() => window.open(u, '_blank')}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="dashboard-section" style={{ padding: 10, flex: 1 }}>
            <h3 style={{ margin: '0 0 6px', fontSize: 14 }}>학생 캔버스</h3>
            <SimpleCanvas
              width={CANVAS_W}
              height={CANVAS_H}
              strokes={state.student.strokes || []}
              readOnly
              toolbar={false}
            />
          </section>
        </div>
      </div>

      {endOpen && (
        <Modal onClose={() => !endSubmitting && setEndOpen(false)}>
          <h3 className="modal-title">세션 종료 + 자동 메모</h3>
          <div className="modal-body">
            <p style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--text-secondary)' }}>
              종료하면 양쪽 풀이가 R2에 저장되고, 요약을 입력하면 학생 프로필에 교과 메모로 자동 등록됩니다.
            </p>
            <label className="form-label">상태</label>
            <select
              className="form-select"
              value={endSentiment}
              onChange={(e) => setEndSentiment(e.target.value as any)}
            >
              <option value="positive">긍정</option>
              <option value="neutral">보통</option>
              <option value="concern">우려</option>
            </select>
            <label className="form-label" style={{ marginTop: 8 }}>
              요약 메모 <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>(비우면 메모 자동생성 안 함)</span>
            </label>
            <textarea
              className="form-input"
              rows={3}
              placeholder="예: 인수분해 응용 문제 → 풀이 패턴 이해는 OK, 계산 실수 잦음."
              value={endSummary}
              onChange={(e) => setEndSummary(e.target.value)}
              maxLength={1000}
            />
          </div>
          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={() => setEndOpen(false)} disabled={endSubmitting}>
              취소
            </button>
            <button className="btn btn-danger" onClick={handleEnd} disabled={endSubmitting}>
              {endSubmitting ? '종료 중...' : '세션 종료'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
