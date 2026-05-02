import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, GachaCard, GachaStudent } from '../api';
import { toast, useConfirm } from '../components/Toast';

const GRADE_OPTIONS = ['중1', '중2', '중3', '고1', '고2', '고3'];

export default function GachaCardPage() {
  const [cards, setCards] = useState<GachaCard[]>([]);
  const [students, setStudents] = useState<GachaStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [studentFilter, setStudentFilter] = useState('');
  const [topicFilter, setTopicFilter] = useState('');

  // 추가/편집 폼
  const [showForm, setShowForm] = useState(false);
  const [editCard, setEditCard] = useState<GachaCard | null>(null);
  const [formType, setFormType] = useState<'text' | 'image'>('text');
  const [formStudentId, setFormStudentId] = useState('');
  const [formQuestion, setFormQuestion] = useState('');
  const [formAnswer, setFormAnswer] = useState('');
  const [formTopic, setFormTopic] = useState('');
  const [formChapter, setFormChapter] = useState('');
  const [formGrade, setFormGrade] = useState('');
  const [formImage, setFormImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const { confirm: confirmDialog, ConfirmDialog } = useConfirm();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (studentFilter) params.student_id = studentFilter;
      if (topicFilter) params.topic = topicFilter;
      const data = await api.getGachaCards(params);
      // 서버 응답이 paginated({items}) 형태일 수도 있어 배열로 정규화
      const arr = Array.isArray(data) ? data : ((data as any)?.items ?? []);
      setCards(arr);
    } catch {
      setCards([]);
    } finally {
      setLoading(false);
    }
  }, [studentFilter, topicFilter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    api.getGachaStudents()
      .then((d) => setStudents(Array.isArray(d) ? d : ((d as any)?.items ?? [])))
      .catch(() => {});
  }, []);

  const topics = useMemo(() => {
    const set = new Set(cards.map(c => c.topic).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [cards]);

  const studentName = (id: string | null) => {
    if (!id) return '공용';
    return students.find(s => s.id === id)?.name || id;
  };

  const resetForm = () => {
    setEditCard(null); setFormType('text'); setFormStudentId('');
    setFormQuestion(''); setFormAnswer(''); setFormTopic('');
    setFormChapter(''); setFormGrade(''); setFormImage(null);
  };

  const openAdd = () => { resetForm(); setShowForm(true); };

  const openEdit = (c: GachaCard) => {
    setEditCard(c);
    setFormType(c.type);
    setFormStudentId(c.student_id || '');
    setFormQuestion(c.question || '');
    setFormAnswer(c.answer);
    setFormTopic(c.topic || '');
    setFormChapter(c.chapter || '');
    setFormGrade(c.grade || '');
    setFormImage(c.question_image || null);
    setShowForm(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const result = await api.uploadGachaCardImage(file);
      setFormImage(result.key);
      toast.success('이미지 업로드 완료');
    } catch (err) {
      toast.error('업로드 실패: ' + (err as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!formAnswer.trim()) { toast.error('정답은 필수입니다'); return; }
    setSaving(true);
    try {
      if (editCard) {
        await api.updateGachaCard(editCard.id, {
          type: formType,
          student_id: formStudentId || null,
          question: formType === 'text' ? formQuestion : null,
          question_image: formType === 'image' ? formImage : null,
          answer: formAnswer.trim(),
          topic: formTopic || null,
          chapter: formChapter || null,
          grade: formGrade || null,
        });
        toast.success('카드 수정 완료');
      } else {
        await api.createGachaCard({
          type: formType,
          student_id: formStudentId || undefined,
          question: formType === 'text' ? formQuestion : undefined,
          question_image: formType === 'image' ? (formImage || undefined) : undefined,
          answer: formAnswer.trim(),
          topic: formTopic || undefined,
          chapter: formChapter || undefined,
          grade: formGrade || undefined,
        });
        toast.success('카드 추가 완료');
      }
      setShowForm(false);
      resetForm();
      load();
    } catch (err) {
      toast.error('저장 실패: ' + (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (c: GachaCard) => {
    const ok = await confirmDialog('이 카드를 삭제하시겠습니까?');
    if (!ok) return;
    try {
      await api.deleteGachaCard(c.id);
      toast.success('삭제 완료');
      load();
    } catch (err) {
      toast.error('삭제 실패: ' + (err as Error).message);
    }
  };

  const API_BASE = import.meta.env.VITE_API_URL || '';

  return (
    <div className="gacha-page">
      {ConfirmDialog}

      <div className="gacha-page-header">
        <h1>가차 카드 관리</h1>
        <button className="btn-primary" onClick={openAdd}>+ 카드 추가</button>
      </div>

      {/* 필터 */}
      <div className="gacha-filters">
        <select value={studentFilter} onChange={e => setStudentFilter(e.target.value)} className="gacha-select">
          <option value="">전체 학생</option>
          {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={topicFilter} onChange={e => setTopicFilter(e.target.value)} className="gacha-select">
          <option value="">전체 주제</option>
          {topics.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {/* 추가/편집 폼 */}
      {showForm && (
        <div className="gacha-form-card">
          <h3>{editCard ? '카드 수정' : '카드 추가'}</h3>

          <div className="gacha-form-row">
            <label>
              <input type="radio" checked={formType === 'text'} onChange={() => setFormType('text')} /> 텍스트
            </label>
            <label>
              <input type="radio" checked={formType === 'image'} onChange={() => setFormType('image')} /> 이미지
            </label>
          </div>

          <div className="gacha-form-row">
            <select value={formStudentId} onChange={e => setFormStudentId(e.target.value)}>
              <option value="">공용 (전체 학생)</option>
              {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select value={formGrade} onChange={e => setFormGrade(e.target.value)}>
              <option value="">학년</option>
              {GRADE_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>

          {formType === 'text' ? (
            <textarea
              placeholder="문제 (KaTeX 수식 가능: $\frac{1}{3}$)"
              value={formQuestion}
              onChange={e => setFormQuestion(e.target.value)}
              rows={3}
              className="gacha-textarea"
            />
          ) : (
            <div className="gacha-image-upload">
              <input type="file" accept="image/*" onChange={handleImageUpload} disabled={uploading} />
              {uploading && <span>업로드 중...</span>}
              {formImage && <img src={`${API_BASE}/api/gacha/image/${formImage}`} alt="preview" className="gacha-image-preview" />}
            </div>
          )}

          <input
            placeholder="정답"
            value={formAnswer}
            onChange={e => setFormAnswer(e.target.value)}
            className="gacha-input"
          />

          <div className="gacha-form-row">
            <input placeholder="주제" value={formTopic} onChange={e => setFormTopic(e.target.value)} />
            <input placeholder="단원" value={formChapter} onChange={e => setFormChapter(e.target.value)} />
          </div>

          <div className="gacha-form-actions">
            <button className="btn-secondary" onClick={() => { setShowForm(false); resetForm(); }}>취소</button>
            <button className="btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? '저장 중...' : editCard ? '수정' : '추가'}
            </button>
          </div>
        </div>
      )}

      {/* 카드 목록 */}
      {loading ? (
        <div className="gacha-loading">불러오는 중...</div>
      ) : cards.length === 0 ? (
        <div className="gacha-empty">카드가 없습니다.</div>
      ) : (
        <div className="gacha-card-list">
          {cards.map(c => (
            <div key={c.id} className="gacha-card-item">
              <div className="gacha-card-question">
                {c.type === 'image' && c.question_image ? (
                  <img src={`${API_BASE}/api/gacha/image/${c.question_image}`} alt="question" className="gacha-card-img" />
                ) : (
                  <span className="gacha-card-text">{c.question}</span>
                )}
              </div>
              <div className="gacha-card-answer">A: {c.answer}</div>
              <div className="gacha-card-meta">
                <span className="gacha-card-student">{studentName(c.student_id)}</span>
                {c.topic && <span className="gacha-card-topic">{c.topic}</span>}
                {c.grade && <span className="gacha-card-grade">{c.grade}</span>}
                <span className={`gacha-card-box gacha-card-box--${c.box}`}>Box {c.box}</span>
                <span className="gacha-card-score">O{c.success_count} X{c.fail_count}</span>
              </div>
              <div className="gacha-card-actions">
                <button className="btn-sm" onClick={() => openEdit(c)}>수정</button>
                <button className="btn-sm btn-danger" onClick={() => handleDelete(c)}>삭제</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="gacha-summary">총 {cards.length}장</div>
    </div>
  );
}
