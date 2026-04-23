import { useState } from 'react';
import { api, StudentProfile } from '../api';

interface Props {
  profile: StudentProfile;
  onChanged: () => void;
}

export default function HomeroomSelector({ profile, onChanged }: Props) {
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState(profile.homeroom_teacher?.id || '');

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.setHomeroom(profile.id, selected || null);
      onChanged();
    } catch (err: any) {
      alert(err.message || '담임 지정 실패');
    } finally {
      setSaving(false);
    }
  };

  const currentId = profile.homeroom_teacher?.id || '';
  const dirty = selected !== currentId;

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <select
        className="form-select"
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        disabled={saving}
        style={{ minWidth: 180 }}
      >
        <option value="">담임 미지정</option>
        {profile.teachers.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <button
        className="btn btn-primary btn-sm"
        onClick={handleSave}
        disabled={saving || !dirty}
      >
        {saving ? '저장 중...' : '담임 지정'}
      </button>
      {profile.teachers.length === 0 && (
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
          담당 선생님부터 배정해 주세요
        </span>
      )}
    </div>
  );
}
