import { useEffect, useState } from 'react';
import { api, Consultation } from '../api';
import { useAuthStore } from '../store';
import { toast } from './Toast';

interface Props {
  studentId: string;
}

const CHANNEL_LABEL: Record<Consultation['channel'], string> = {
  phone: '전화',
  sms: '문자',
  kakao: '카톡',
  in_person: '대면',
  other: '기타',
};

const CATEGORY_LABEL: Record<Consultation['category'], string> = {
  monthly: '월 1회 정기',
  pre_exam: '시험 전',
  post_exam: '시험 후',
  ad_hoc: '수시',
};

const SENTIMENT_LABEL: Record<NonNullable<Consultation['parent_sentiment']>, string> = {
  positive: '긍정',
  neutral: '보통',
  concerned: '우려',
};

function todayLocalDateTime(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export default function ConsultationPanel({ studentId }: Props) {
  const user = useAuthStore((s) => s.user);
  const [items, setItems] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [pasteBuf, setPasteBuf] = useState('');

  // form state
  const [channel, setChannel] = useState<Consultation['channel']>('phone');
  const [category, setCategory] = useState<Consultation['category']>('monthly');
  const [consultedAt, setConsultedAt] = useState(todayLocalDateTime());
  const [summary, setSummary] = useState('');
  const [sentiment, setSentiment] = useState<Consultation['parent_sentiment']>(null);
  const [followUp, setFollowUp] = useState('');
  const [followUpDue, setFollowUpDue] = useState('');
  const [saving, setSaving] = useState(false);

  const isPasteChannel = channel === 'kakao' || channel === 'sms';

  const mergePaste = () => {
    if (!pasteBuf.trim()) return;
    const tag = channel === 'kakao' ? '[카톡 대화]' : '[문자 대화]';
    setSummary((prev) => (prev ? prev + '\n\n' + tag + '\n' + pasteBuf : tag + '\n' + pasteBuf));
    setPasteBuf('');
  };

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.listConsultations(studentId, 50);
      setItems(data);
    } catch (err: any) {
      toast.error(err?.message || '상담 기록 조회 실패');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (studentId) load();
  }, [studentId]);

  const resetForm = () => {
    setChannel('phone');
    setCategory('monthly');
    setConsultedAt(todayLocalDateTime());
    setSummary('');
    setSentiment(null);
    setFollowUp('');
    setFollowUpDue('');
  };

  const handleSubmit = async () => {
    if (!summary.trim()) {
      alert('상담 내용을 입력해 주세요');
      return;
    }
    setSaving(true);
    try {
      await api.createConsultation(studentId, {
        channel,
        category,
        consulted_at: new Date(consultedAt).toISOString(),
        summary: summary.trim(),
        parent_sentiment: sentiment,
        follow_up: followUp.trim() || null,
        follow_up_due: followUpDue || null,
      });
      resetForm();
      setShowForm(false);
      await load();
    } catch (err: any) {
      alert(err.message || '상담 기록 저장 실패');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('이 상담 기록을 삭제하시겠습니까?')) return;
    try {
      await api.deleteConsultation(studentId, id);
      await load();
    } catch (err: any) {
      alert(err.message || '삭제 실패');
    }
  };

  return (
    <section className="dashboard-section">
      <div className="section-title-row">
        <h3>학부모 상담 기록</h3>
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm((v) => !v)}>
          {showForm ? '취소' : '+ 상담 기록'}
        </button>
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: -4, marginBottom: 12 }}>
        이 학생을 담당하는 모든 선생님이 함께 보고 기록합니다.
      </p>

      {showForm && (
        <div
          style={{
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: 12,
            marginBottom: 16,
            background: 'var(--bg-secondary)',
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <div>
              <label className="form-label">상담 일시</label>
              <input
                type="datetime-local"
                className="form-input"
                value={consultedAt}
                onChange={(e) => setConsultedAt(e.target.value)}
              />
            </div>
            <div>
              <label className="form-label">수단</label>
              <select
                className="form-select"
                value={channel}
                onChange={(e) => setChannel(e.target.value as Consultation['channel'])}
              >
                {Object.entries(CHANNEL_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">구분</label>
              <select
                className="form-select"
                value={category}
                onChange={(e) => setCategory(e.target.value as Consultation['category'])}
              >
                {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {isPasteChannel && (
            <div
              style={{
                marginTop: 8,
                padding: 8,
                border: '1px dashed var(--border)',
                borderRadius: 6,
                background: 'var(--bg-primary)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <strong style={{ fontSize: 12 }}>
                  {channel === 'kakao' ? '카톡' : '문자'} 붙여넣기
                </strong>
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                  대화 내용을 복사해 붙여넣고 [요약에 추가]를 눌러주세요
                </span>
                <div style={{ flex: 1 }} />
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={mergePaste}
                  disabled={!pasteBuf.trim()}
                >
                  요약에 추가
                </button>
              </div>
              <textarea
                className="form-input"
                rows={4}
                placeholder="[오후 2:14] 학부모님: ..."
                value={pasteBuf}
                onChange={(e) => setPasteBuf(e.target.value)}
              />
            </div>
          )}

          <label className="form-label" style={{ marginTop: 8 }}>
            상담 내용 *
          </label>
          <textarea
            className="form-input"
            rows={4}
            placeholder="학부모님과 나눈 대화 요점. 다른 선생님에게도 보입니다."
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 8 }}>
            <div>
              <label className="form-label">학부모 반응</label>
              <select
                className="form-select"
                value={sentiment ?? ''}
                onChange={(e) =>
                  setSentiment(
                    (e.target.value || null) as Consultation['parent_sentiment']
                  )
                }
              >
                <option value="">선택 안 함</option>
                {Object.entries(SENTIMENT_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label className="form-label">후속 액션 / 다음 상담 메모</label>
              <input
                className="form-input"
                value={followUp}
                onChange={(e) => setFollowUp(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
            <label className="form-label" style={{ margin: 0 }}>
              후속 일정
            </label>
            <input
              type="date"
              className="form-input"
              style={{ width: 180 }}
              value={followUpDue}
              onChange={(e) => setFollowUpDue(e.target.value)}
            />
            <div style={{ flex: 1 }} />
            <button
              className="btn btn-primary btn-sm"
              onClick={handleSubmit}
              disabled={saving || !summary.trim()}
            >
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="no-data">불러오는 중...</p>
      ) : items.length === 0 ? (
        <p className="no-data">상담 기록이 없습니다</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {items.map((c) => {
            const canDelete = user?.role === 'admin' || user?.id === c.author_id;
            const date = new Date(c.consulted_at);
            return (
              <li
                key={c.id}
                style={{
                  borderLeft: '3px solid var(--accent)',
                  padding: '10px 12px',
                  marginBottom: 10,
                  background: 'var(--bg-secondary)',
                  borderRadius: 4,
                }}
              >
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <strong>{date.toLocaleString('ko-KR')}</strong>
                  <span className="badge">{CATEGORY_LABEL[c.category]}</span>
                  <span className="badge">{CHANNEL_LABEL[c.channel]}</span>
                  {c.parent_sentiment && (
                    <span className="badge">
                      반응: {SENTIMENT_LABEL[c.parent_sentiment]}
                    </span>
                  )}
                  <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-tertiary)' }}>
                    작성: {c.author_name || c.author_id}
                  </span>
                  {canDelete && (
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => handleDelete(c.id)}
                      style={{ padding: '2px 8px' }}
                    >
                      삭제
                    </button>
                  )}
                </div>
                <p style={{ margin: '6px 0 0', whiteSpace: 'pre-wrap' }}>{c.summary}</p>
                {c.follow_up && (
                  <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
                    → 후속: {c.follow_up}
                    {c.follow_up_due && ` (${c.follow_up_due})`}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
