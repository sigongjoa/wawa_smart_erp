import { useState } from 'react';
import Modal from '../Modal';
import { api, type TeacherOption } from '../../api';
import { toast } from '../Toast';
import { useAuthStore } from '../../store';

interface Props {
  teacher: TeacherOption;
  onClose: () => void;
  onChanged: () => void;
}

export default function TeacherEditModal({ teacher, onClose, onChanged }: Props) {
  const me = useAuthStore((s) => s.user);
  const isSelf = me?.id === teacher.id;

  const [name, setName] = useState(teacher.name);
  const [role, setRole] = useState<'admin' | 'instructor'>(teacher.role);
  const [status, setStatus] = useState<'active' | 'disabled'>(teacher.status || 'active');
  const [subjects, setSubjects] = useState((teacher.subjects || []).join(', '));
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [newPin, setNewPin] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('이름을 입력하세요');
      return;
    }
    setSaving(true);
    try {
      const subjectList = subjects
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const payload: Record<string, unknown> = {
        name: name.trim(),
        subjects: subjectList,
      };
      if (!isSelf) {
        payload.role = role;
        payload.status = status;
      }
      await api.updateTeacher(teacher.id, payload as any);
      toast.success('선생님 정보가 저장되었습니다');
      onChanged();
      onClose();
    } catch (err: any) {
      toast.error(err.message || '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  const handleResetPin = async () => {
    if (!window.confirm(`${teacher.name} 선생님의 PIN을 재설정합니다. 계속하시겠습니까?`)) return;
    setResetting(true);
    setNewPin(null);
    try {
      const res = await api.resetTeacherPin(teacher.id);
      setNewPin(res.tempPin);
      toast.success('임시 PIN이 발급되었습니다');
    } catch (err: any) {
      toast.error(err.message || 'PIN 재설정 실패');
    } finally {
      setResetting(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`${teacher.name} 선생님을 비활성화합니다. 로그인이 차단되며, 기존 수업·성적 기록은 유지됩니다. 계속하시겠습니까?`)) return;
    setSaving(true);
    try {
      await api.deleteTeacher(teacher.id);
      toast.success(`${teacher.name} 선생님이 비활성화되었습니다`);
      onChanged();
      onClose();
    } catch (err: any) {
      toast.error(err.message || '비활성화 실패');
      setSaving(false);
    }
  };

  return (
    <Modal onClose={onClose}>
      <Modal.Header>선생님 정보 수정</Modal.Header>
      <form onSubmit={handleSubmit}>
        <Modal.Body>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {isSelf && (
              <p style={{ fontSize: 12, color: 'var(--warning-text)', background: '#fef3c7', padding: '8px 12px', borderRadius: 6, margin: 0 }}>
                본인 계정입니다. 권한과 상태는 본인이 변경할 수 없습니다.
              </p>
            )}

            <div>
              <label htmlFor="edit-name" style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>이름 *</label>
              <input
                id="edit-name"
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={50}
              />
            </div>

            <div>
              <label htmlFor="edit-subjects" style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>담당 과목 (쉼표로 구분)</label>
              <input
                id="edit-subjects"
                className="input"
                value={subjects}
                onChange={(e) => setSubjects(e.target.value)}
                placeholder="수학, 물리"
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label htmlFor="edit-role" style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>권한</label>
                <select
                  id="edit-role"
                  className="input"
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  disabled={isSelf}
                >
                  <option value="instructor">강사</option>
                  <option value="admin">관리자</option>
                </select>
              </div>
              <div>
                <label htmlFor="edit-status" style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>상태</label>
                <select
                  id="edit-status"
                  className="input"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  disabled={isSelf}
                >
                  <option value="active">활성</option>
                  <option value="disabled">비활성</option>
                </select>
              </div>
            </div>

            <div style={{ borderTop: '1px solid #eee', paddingTop: 12, marginTop: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleResetPin}
                  disabled={resetting || saving}
                >
                  {resetting ? '발급 중...' : 'PIN 재설정'}
                </button>
                {newPin && (
                  <div style={{ background: '#f0f7ff', padding: '6px 12px', borderRadius: 6, display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 13, color: '#555' }}>임시 PIN:</span>
                    <strong style={{ fontFamily: 'monospace', fontSize: 18, letterSpacing: 2 }}>{newPin}</strong>
                    <button
                      type="button"
                      onClick={() => { navigator.clipboard.writeText(newPin); toast.info('복사됨'); }}
                      style={{ padding: '2px 8px', fontSize: 12, background: '#4a90d9', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                    >
                      복사
                    </button>
                  </div>
                )}
              </div>
              {newPin && (
                <p style={{ fontSize: 12, color: 'var(--warning-text)', marginTop: 8, marginBottom: 0 }}>
                  이 창을 닫으면 PIN을 다시 볼 수 없습니다. 반드시 본인에게 전달하세요.
                </p>
              )}
            </div>

            <div style={{ fontSize: 12, color: '#888', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {teacher.last_login_at && (
                <span>마지막 로그인: {new Date(teacher.last_login_at).toLocaleString('ko-KR')}</span>
              )}
              {teacher.created_at && (
                <span>가입: {new Date(teacher.created_at).toLocaleDateString('ko-KR')}</span>
              )}
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          {!isSelf && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleDelete}
              disabled={saving}
              style={{ color: '#e53e3e', borderColor: '#fecaca', marginRight: 'auto' }}
            >
              비활성화
            </button>
          )}
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>취소</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? '저장 중...' : '저장'}
          </button>
        </Modal.Footer>
      </form>
    </Modal>
  );
}
