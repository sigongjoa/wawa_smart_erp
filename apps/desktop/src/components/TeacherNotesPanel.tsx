import { useEffect, useMemo, useState } from 'react';
import { api, TeacherNote, TeacherNoteInput } from '../api';
import { useAuthStore } from '../store';
import { toast } from './Toast';

interface Props {
  studentId: string;
}

const CATEGORY_LABEL: Record<TeacherNote['category'], string> = {
  attitude: '태도',
  understanding: '이해도',
  homework: '숙제',
  exam: '시험',
  etc: '기타',
};

const SENTIMENT_LABEL: Record<TeacherNote['sentiment'], string> = {
  positive: '긍정',
  neutral: '보통',
  concern: '우려',
};

const SENTIMENT_COLOR: Record<TeacherNote['sentiment'], string> = {
  positive: '#16a34a',
  neutral: '#64748b',
  concern: '#dc2626',
};

const VISIBILITY_LABEL: Record<TeacherNote['visibility'], string> = {
  staff: '전 교강사',
  homeroom_only: '담임만',
  parent_share: '학부모 공유',
};

function currentPeriodTag(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatRelative(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

export default function TeacherNotesPanel({ studentId }: Props) {
  const user = useAuthStore((s) => s.user);
  const [items, setItems] = useState<TeacherNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filterSubject, setFilterSubject] = useState<string>('');
  const [filterPeriod, setFilterPeriod] = useState<string>('');

  // form state
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState<TeacherNote['category']>('understanding');
  const [sentiment, setSentiment] = useState<TeacherNote['sentiment']>('neutral');
  const [tagsInput, setTagsInput] = useState('');
  const [content, setContent] = useState('');
  const [visibility, setVisibility] = useState<TeacherNote['visibility']>('staff');
  const [saving, setSaving] = useState(false);

  const canCreate = user?.role === 'instructor' || user?.role === 'admin';

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.listTeacherNotes(studentId, {
        subject: filterSubject || undefined,
        period: filterPeriod || undefined,
        limit: 100,
      });
      setItems(data);
    } catch (err: any) {
      toast.error(err?.message || '교과 메모 조회 실패');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (studentId) load();
  }, [studentId, filterSubject, filterPeriod]);

  const subjectOptions = useMemo(() => {
    const set = new Set<string>();
    items.forEach((n) => set.add(n.subject));
    return Array.from(set).sort();
  }, [items]);

  const resetForm = () => {
    setSubject('');
    setCategory('understanding');
    setSentiment('neutral');
    setTagsInput('');
    setContent('');
    setVisibility('staff');
  };

  const handleSubmit = async () => {
    if (!subject.trim()) {
      alert('과목을 입력해 주세요');
      return;
    }
    if (!content.trim()) {
      alert('메모 내용을 입력해 주세요');
      return;
    }
    if (content.length > 1000) {
      alert('메모는 최대 1000자까지 입력할 수 있습니다');
      return;
    }
    setSaving(true);
    try {
      const tags = tagsInput
        .split(/[,，\s]+/)
        .map((t) => t.trim())
        .filter(Boolean);
      const payload: TeacherNoteInput = {
        subject: subject.trim(),
        category,
        sentiment,
        tags: tags.length > 0 ? tags : undefined,
        content: content.trim(),
        visibility,
      };
      await api.createTeacherNote(studentId, payload);
      resetForm();
      setShowForm(false);
      await load();
    } catch (err: any) {
      alert(err.message || '메모 저장 실패');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('이 메모를 삭제하시겠습니까?')) return;
    try {
      await api.deleteTeacherNote(studentId, id);
      await load();
    } catch (err: any) {
      alert(err.message || '삭제 실패');
    }
  };

  return (
    <section className="dashboard-section">
      <div className="section-title-row">
        <h3>교과 선생님 메모</h3>
        {canCreate && (
          <button className="btn btn-primary btn-sm" onClick={() => setShowForm((v) => !v)}>
            {showForm ? '취소' : '+ 메모'}
          </button>
        )}
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: -4, marginBottom: 12 }}>
        교과 선생님이 일상적으로 남기는 학생 상태 메모. 담임 대시보드에서 종합 조회됩니다.
      </p>

      {/* 필터 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <select
          className="form-select"
          style={{ width: 140 }}
          value={filterSubject}
          onChange={(e) => setFilterSubject(e.target.value)}
        >
          <option value="">과목 전체</option>
          {subjectOptions.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <input
          type="month"
          className="form-input"
          style={{ width: 160 }}
          value={filterPeriod}
          onChange={(e) => setFilterPeriod(e.target.value)}
          placeholder="기간"
        />
        {(filterSubject || filterPeriod) && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => { setFilterSubject(''); setFilterPeriod(''); }}
          >
            필터 초기화
          </button>
        )}
        <div style={{ marginLeft: 'auto', alignSelf: 'center', fontSize: 12, color: 'var(--text-tertiary)' }}>
          총 {items.length}건
        </div>
      </div>

      {showForm && canCreate && (
        <div
          style={{
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: 12,
            marginBottom: 16,
            background: 'var(--bg-secondary)',
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
            <div>
              <label className="form-label">과목 *</label>
              <input
                className="form-input"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="수학 / 영어 / ..."
                list="teacher-note-subject-options"
              />
              <datalist id="teacher-note-subject-options">
                {subjectOptions.map((s) => <option key={s} value={s} />)}
              </datalist>
            </div>
            <div>
              <label className="form-label">분류</label>
              <select
                className="form-select"
                value={category}
                onChange={(e) => setCategory(e.target.value as TeacherNote['category'])}
              >
                {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">상태</label>
              <select
                className="form-select"
                value={sentiment}
                onChange={(e) => setSentiment(e.target.value as TeacherNote['sentiment'])}
              >
                {Object.entries(SENTIMENT_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">공개 범위</label>
              <select
                className="form-select"
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as TeacherNote['visibility'])}
              >
                {Object.entries(VISIBILITY_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>

          <label className="form-label" style={{ marginTop: 8 }}>
            태그 (콤마/공백 구분)
          </label>
          <input
            className="form-input"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="예: 보강필요, 집중부족"
          />

          <label className="form-label" style={{ marginTop: 8 }}>
            메모 * <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>({content.length}/1000)</span>
          </label>
          <textarea
            className="form-input"
            rows={3}
            placeholder="1~3줄 권장. 담임이 종합 조회합니다."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            maxLength={1000}
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleSubmit}
              disabled={saving || !subject.trim() || !content.trim()}
            >
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="no-data">불러오는 중...</p>
      ) : items.length === 0 ? (
        <p className="no-data">등록된 메모가 없습니다</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {items.map((n) => {
            const canDelete = user?.role === 'admin' || user?.id === n.author_id;
            return (
              <li
                key={n.id}
                style={{
                  borderLeft: `3px solid ${SENTIMENT_COLOR[n.sentiment]}`,
                  padding: '10px 12px',
                  marginBottom: 10,
                  background: 'var(--bg-secondary)',
                  borderRadius: 4,
                }}
              >
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <strong>{n.subject}</strong>
                  <span className="badge">{CATEGORY_LABEL[n.category]}</span>
                  <span
                    className="badge"
                    style={{ background: SENTIMENT_COLOR[n.sentiment], color: '#fff' }}
                  >
                    {SENTIMENT_LABEL[n.sentiment]}
                  </span>
                  {n.visibility !== 'staff' && (
                    <span className="badge">{VISIBILITY_LABEL[n.visibility]}</span>
                  )}
                  {n.source === 'live_session' && (
                    <span className="badge" style={{ background: '#dc2626', color: '#fff' }}>
                      LIVE
                    </span>
                  )}
                  {n.tags && n.tags.length > 0 && n.tags.map((t) => (
                    <span key={t} className="badge" style={{ background: 'var(--bg-primary)' }}>
                      #{t}
                    </span>
                  ))}
                  <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-tertiary)' }}>
                    {n.author_name || n.author_id} · {formatRelative(n.created_at)}
                  </span>
                  {canDelete && (
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => handleDelete(n.id)}
                      style={{ padding: '2px 8px' }}
                    >
                      삭제
                    </button>
                  )}
                </div>
                <p style={{ margin: '6px 0 0', whiteSpace: 'pre-wrap' }}>{n.content}</p>
              </li>
            );
          })}
        </ul>
      )}

      <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-tertiary)' }}>
        현재 기간: {currentPeriodTag()}
      </div>
    </section>
  );
}
