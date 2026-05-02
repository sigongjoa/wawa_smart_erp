import { useState } from 'react';
import Modal from '../../components/Modal';
import { api } from '../../api';
import { toast } from '../../components/Toast';

type GachaStudentLite = { id: string; name: string };

interface Props {
  students: GachaStudentLite[];
  onClose: () => void;
  onSaved: () => void;
}

export default function VocabWordModal({ students, onClose, onSaved }: Props) {
  const [studentId, setStudentId] = useState('');
  const [english, setEnglish] = useState('');
  const [korean, setKorean] = useState('');
  const [category, setCategory] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = studentId && english.trim() && korean.trim() && !saving;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setError(null);
    setSaving(true);
    try {
      await api.createVocabWord({
        student_id: studentId,
        english: english.trim(),
        korean: korean.trim(),
        category: category.trim() || null,
      });
      toast.success('단어가 추가되었습니다');
      onSaved();
    } catch (e: any) {
      setError(e?.message || '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal onClose={onClose} className="vocab-modal">
      <Modal.Header>단어 추가</Modal.Header>
      <Modal.Body>
        <div className="vocab-modal-body">
          <label className="form-field">
            <span className="form-label">학생<span className="form-required" aria-label="필수"> *</span></span>
            <select value={studentId} onChange={e => setStudentId(e.target.value)} className="form-input">
              <option value="">선택하세요</option>
              {students.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span className="form-label">영어<span className="form-required" aria-label="필수"> *</span></span>
            <input
              className="form-input"
              value={english}
              onChange={e => setEnglish(e.target.value)}
              placeholder="예: apple"
              autoFocus
            />
          </label>
          <label className="form-field">
            <span className="form-label">한글<span className="form-required" aria-label="필수"> *</span></span>
            <input
              className="form-input"
              value={korean}
              onChange={e => setKorean(e.target.value)}
              placeholder="예: 사과"
            />
          </label>
          <label className="form-field">
            <span className="form-label">유형 <span style={{ color: '#94a3b8', fontWeight: 400 }}>(선택)</span></span>
            <input
              className="form-input"
              value={category}
              list="vocab-category-suggest"
              onChange={e => setCategory(e.target.value)}
              placeholder="예: 기초/숙어/파생어/동사구"
            />
            <datalist id="vocab-category-suggest">
              <option value="기초" />
              <option value="숙어" />
              <option value="파생어" />
              <option value="동사구" />
              <option value="형용사" />
              <option value="부사" />
            </datalist>
          </label>
          {error && <div className="form-error" role="alert">{error}</div>}
        </div>
      </Modal.Body>
      <Modal.Footer>
        <button className="btn btn-secondary" onClick={onClose} disabled={saving}>취소</button>
        <button
          className="btn btn-primary"
          onClick={handleSubmit}
          disabled={!canSubmit}
        >
          {saving ? '추가 중...' : '추가'}
        </button>
      </Modal.Footer>
    </Modal>
  );
}
