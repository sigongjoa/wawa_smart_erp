import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, LiveSessionState, LiveStroke } from '../api';
import SimpleCanvas from '../components/SimpleCanvas';

const POLL_INTERVAL = 3000;
const PATCH_DEBOUNCE = 600;
const CANVAS_W = 600;
const CANVAS_H = 400;

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
  const navigate = useNavigate();

  const [state, setState] = useState<LiveSessionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [text, setText] = useState('');
  const [strokes, setStrokes] = useState<LiveStroke[]>([]);
  const [mode, setMode] = useState<'text' | 'canvas'>('text');
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const initialLoad = useCallback(async () => {
    if (!id) return;
    try {
      const st = await api.getLiveState(id);
      setState(st);
      setText(st.student?.text || '');
      setStrokes(st.student?.strokes || []);
      setLoading(false);
    } catch (e: any) {
      setError(e?.message || '세션 로드 실패');
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { initialLoad(); }, [initialLoad]);

  // poll teacher state every 3s
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const st = await api.getLiveState(id);
        if (cancelled) return;
        setState(st);
        if (st.status === 'ended') {
          setTimeout(() => {
            if (!cancelled) navigate('/');
          }, 2500);
        }
      } catch { /* ignore */ }
    };
    const interval = setInterval(tick, POLL_INTERVAL);
    return () => { cancelled = true; clearInterval(interval); };
  }, [id, navigate]);

  const push = useCallback(
    (newText: string, newStrokes: LiveStroke[]) => {
      if (!id) return;
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        api
          .patchLiveStudent(id, { text: newText, strokes: newStrokes })
          .then(() => setSavedAt(Date.now()))
          .catch(() => {});
      }, PATCH_DEBOUNCE);
    },
    [id]
  );

  const onPhotoUpload = async (file: File) => {
    if (!id) return;
    if (file.size > 1 * 1024 * 1024) {
      alert('사진은 1MB 이내만 가능');
      return;
    }
    const dataUrl = await fileToDataUrl(file);
    try {
      await api.patchLiveStudent(id, { append_photo_data_url: dataUrl });
      const st = await api.getLiveState(id);
      setState(st);
      setSavedAt(Date.now());
    } catch (e: any) {
      alert(e.message || '업로드 실패');
    }
  };

  if (loading) return <div style={{ padding: 16 }}>불러오는 중...</div>;
  if (error || !state) return <div style={{ padding: 16, color: '#dc2626' }}>{error || '세션 없음'}</div>;

  const ended = state.status === 'ended';

  if (ended) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <h2>수고했어요!</h2>
        <p>선생님이 라이브 세션을 종료했습니다.</p>
        <p style={{ color: '#64748b', fontSize: 13 }}>잠시 후 홈으로 돌아갑니다...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 8, minHeight: '100vh' }}>
      {/* 상단: 선생님이 띄운 문제 */}
      <section
        style={{
          background: '#fff',
          border: '1px solid #cbd5e1',
          borderRadius: 8,
          padding: 10,
        }}
      >
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>선생님이 띄운 문제</div>
        {state.problem.text && (
          <div style={{ whiteSpace: 'pre-wrap', fontSize: 14, marginBottom: 6 }}>
            {state.problem.text}
          </div>
        )}
        {state.problem.image_data_url && (
          <img
            src={state.problem.image_data_url}
            alt="문제"
            style={{ maxWidth: '100%', maxHeight: 280, borderRadius: 6 }}
          />
        )}
        {!state.problem.text && !state.problem.image_data_url && (
          <div style={{ color: '#94a3b8', fontSize: 13 }}>(선생님이 곧 문제를 띄울 거예요)</div>
        )}
      </section>

      {/* 하단: 내 풀이 */}
      <section
        style={{
          background: '#fff',
          border: '1px solid #cbd5e1',
          borderRadius: 8,
          padding: 10,
          flex: 1,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <div style={{ fontWeight: 600, fontSize: 13 }}>내 풀이</div>
          <div style={{ flex: 1 }} />
          <button
            type="button"
            onClick={() => setMode('text')}
            aria-pressed={mode === 'text'}
            style={{
              padding: '10px 14px', minHeight: 40,
              background: mode === 'text' ? '#2563eb' : '#fff',
              color: mode === 'text' ? '#fff' : '#000',
              border: '1px solid #94a3b8', borderRadius: 4,
              fontWeight: 600,
            }}
          >텍스트</button>
          <button
            type="button"
            onClick={() => setMode('canvas')}
            aria-pressed={mode === 'canvas'}
            style={{
              padding: '10px 14px', minHeight: 40,
              background: mode === 'canvas' ? '#2563eb' : '#fff',
              color: mode === 'canvas' ? '#fff' : '#000',
              border: '1px solid #94a3b8', borderRadius: 4,
              fontWeight: 600,
            }}
          >캔버스</button>
          <label
            style={{
              padding: '10px 14px', minHeight: 40, display: 'inline-flex', alignItems: 'center',
              background: '#fff',
              border: '1px solid #94a3b8', borderRadius: 4,
              cursor: 'pointer', fontWeight: 600,
            }}
          >
            사진
            <input
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onPhotoUpload(f);
              }}
            />
          </label>
        </div>

        {mode === 'text' ? (
          <textarea
            style={{
              width: '100%', minHeight: 200,
              padding: 8, border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 15,
              boxSizing: 'border-box',
            }}
            placeholder="여기에 풀이를 적어주세요. 자동 저장됩니다."
            value={text}
            onChange={(e) => { setText(e.target.value); push(e.target.value, strokes); }}
          />
        ) : (
          <SimpleCanvas
            width={CANVAS_W}
            height={CANVAS_H}
            strokes={strokes}
            onChange={(s) => { setStrokes(s); push(text, s); }}
          />
        )}

        {state.student.photo_data_urls && state.student.photo_data_urls.length > 0 && (
          <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {state.student.photo_data_urls.map((u, i) => (
              <img key={i} src={u} alt={`사진 ${i + 1}`}
                style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 6, border: '1px solid #cbd5e1' }}
              />
            ))}
          </div>
        )}

        <div style={{ marginTop: 6, fontSize: 12, color: '#64748b', textAlign: 'right' }}>
          {savedAt ? `저장됨 · ${Math.round((Date.now() - savedAt) / 1000)}초 전` : '입력 시 자동 저장'}
        </div>
      </section>
    </div>
  );
}
