import { useState } from 'react';
import Modal from '../Modal';
import { api } from '../../api';
import { toast } from '../Toast';

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

export default function TeacherAddModal({ onClose, onCreated }: Props) {
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [subjects, setSubjects] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('이름을 입력하세요');
      return;
    }
    if (!/^\d{4,6}$/.test(pin)) {
      toast.error('PIN은 4~6자리 숫자여야 합니다');
      return;
    }
    setSaving(true);
    try {
      const subjectList = subjects
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      await api.createTeacher({
        name: name.trim(),
        pin,
        subjects: subjectList,
        isAdmin,
      });
      toast.success(`${name.trim()} 선생님이 추가되었습니다`);
      onCreated();
      onClose();
    } catch (err: any) {
      toast.error(err.message || '선생님 추가 실패');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal onClose={onClose}>
      <Modal.Header>선생님 직접 추가</Modal.Header>
      <form onSubmit={handleSubmit}>
        <Modal.Body>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: 0 }}>
              초대 코드 없이 직접 계정을 만듭니다. 생성된 PIN을 본인에게 전달하세요.
            </p>

            <div>
              <label htmlFor="add-name" style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>이름 *</label>
              <input
                id="add-name"
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={50}
                autoFocus
              />
            </div>

            <div>
              <label htmlFor="add-pin" style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>PIN (4~6자리 숫자) *</label>
              <input
                id="add-pin"
                className="input"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                maxLength={6}
                inputMode="numeric"
                pattern="\d{4,6}"
              />
            </div>

            <div>
              <label htmlFor="add-subjects" style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>담당 과목 (쉼표로 구분)</label>
              <input
                id="add-subjects"
                className="input"
                value={subjects}
                onChange={(e) => setSubjects(e.target.value)}
                placeholder="수학, 물리"
              />
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
              <input
                type="checkbox"
                checked={isAdmin}
                onChange={(e) => setIsAdmin(e.target.checked)}
              />
              관리자 권한 부여
            </label>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>취소</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? '추가 중...' : '추가'}
          </button>
        </Modal.Footer>
      </form>
    </Modal>
  );
}
