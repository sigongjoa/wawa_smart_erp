import { useEffect, useState } from 'react';
import Modal from '../Modal';
import { api, type GachaStudent } from '../../api';
import { toast } from '../Toast';

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

const KIND_OPTIONS: { value: 'perf_eval' | 'exam_paper' | 'general'; label: string }[] = [
  { value: 'perf_eval', label: '수행평가' },
  { value: 'exam_paper', label: '시험지' },
  { value: 'general', label: '일반과제' },
];

export default function AssignmentCreateModal({ onClose, onCreated }: Props) {
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [kind, setKind] = useState<'perf_eval' | 'exam_paper' | 'general'>('perf_eval');
  const [dueDate, setDueDate] = useState('');
  const [students, setStudents] = useState<GachaStudent[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [attached, setAttached] = useState<{ key: string; fileName: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getGachaStudents('all').then(setStudents).catch(() => toast.error('학생 목록 로딩 실패'));
  }, []);

  const filtered = students.filter((s) =>
    !search || s.name.toLowerCase().includes(search.toLowerCase()) || (s.grade || '').toLowerCase().includes(search.toLowerCase())
  );

  const toggleStudent = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  const selectAll = () => setSelectedIds(new Set(filtered.map((s) => s.id)));
  const clearAll = () => setSelectedIds(new Set());

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await api.uploadAssignmentFile(file, 'attachment');
      setAttached({ key: res.key, fileName: res.fileName });
    } catch (err: any) {
      toast.error(err.message || '파일 업로드 실패');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return toast.error('제목을 입력하세요');
    if (selectedIds.size === 0) return toast.error('대상 학생을 1명 이상 선택하세요');
    setSaving(true);
    try {
      const dueAtIso = dueDate ? new Date(dueDate).toISOString() : null;
      const res = await api.createAssignment({
        title: title.trim(),
        instructions: instructions.trim() || undefined,
        kind,
        due_at: dueAtIso,
        attached_file_key: attached?.key,
        attached_file_name: attached?.fileName,
        student_ids: Array.from(selectedIds),
      });
      toast.success(`과제가 발행되었습니다 (${res.target_count}명)`);
      onCreated();
      onClose();
    } catch (err: any) {
      toast.error(err.message || '발행 실패');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal onClose={onClose} className="modal-content--lg">
      <Modal.Header>새 과제 발행</Modal.Header>
      <form onSubmit={handleSubmit}>
        <Modal.Body>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px 200px', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>제목 *</label>
                <input
                  className="input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={200}
                  autoFocus
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>종류 *</label>
                <select className="input" value={kind} onChange={(e) => setKind(e.target.value as any)}>
                  {KIND_OPTIONS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>마감 (선택)</label>
                <input
                  type="datetime-local"
                  className="input"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>지시문 (선택)</label>
              <textarea
                className="input"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                rows={3}
                maxLength={5000}
                placeholder="어떻게 풀어서 제출하면 되는지 알려주세요"
                style={{ resize: 'vertical', fontFamily: 'inherit' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>첨부 파일 (선택, 양식·시험지 등)</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {attached ? (
                  <>
                    <span style={{ fontSize: 13, color: '#2563eb' }}>📎 {attached.fileName}</span>
                    <button type="button" onClick={() => setAttached(null)} style={{ padding: '2px 8px', fontSize: 12, background: '#fff', border: '1px solid #fecaca', color: '#e53e3e', borderRadius: 4, cursor: 'pointer' }}>제거</button>
                  </>
                ) : (
                  <input type="file" onChange={handleFile} disabled={uploading} accept=".pdf,.png,.jpg,.jpeg,.heic,.docx,.hwp" />
                )}
                {uploading && <span style={{ fontSize: 12, color: '#888' }}>업로드 중...</span>}
              </div>
            </div>

            <div style={{ borderTop: '1px solid #eee', paddingTop: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label style={{ fontSize: 13, fontWeight: 600 }}>대상 학생 * <span style={{ color: '#888', fontWeight: 400 }}>({selectedIds.size}명 선택)</span></label>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button type="button" onClick={selectAll} style={{ padding: '2px 8px', fontSize: 12, background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 4, cursor: 'pointer' }}>전체</button>
                  <button type="button" onClick={clearAll} style={{ padding: '2px 8px', fontSize: 12, background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 4, cursor: 'pointer' }}>해제</button>
                </div>
              </div>
              <input
                className="input"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="이름·학년 검색"
                style={{ marginBottom: 8 }}
              />
              <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid #eee', borderRadius: 6, padding: 4 }}>
                {filtered.length === 0 ? (
                  <p style={{ fontSize: 13, color: '#888', padding: 12, margin: 0 }}>학생이 없습니다 (먼저 가차 학생을 등록해야 합니다)</p>
                ) : (
                  filtered.map((s) => (
                    <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', cursor: 'pointer', borderRadius: 4, fontSize: 14 }}>
                      <input type="checkbox" checked={selectedIds.has(s.id)} onChange={() => toggleStudent(s.id)} />
                      <span><strong>{s.name}</strong></span>
                      {s.grade && <span style={{ fontSize: 12, color: '#888' }}>{s.grade}</span>}
                    </label>
                  ))
                )}
              </div>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>취소</button>
          <button type="submit" className="btn btn-primary" disabled={saving || uploading}>
            {saving ? '발행 중...' : '발행'}
          </button>
        </Modal.Footer>
      </form>
    </Modal>
  );
}
