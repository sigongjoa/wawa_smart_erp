import { useEffect, useState } from 'react';
import { api } from '../../api';
import { toast } from '../Toast';

interface AcademyInfo {
  id: string;
  slug: string;
  name: string;
  phone?: string;
  address?: string;
  plan?: string;
  logo_url?: string | null;
}

interface Usage {
  students: { current: number; max: number };
  teachers: { current: number; max: number };
  plan: string;
}

export default function AcademyInfoForm() {
  const [academy, setAcademy] = useState<AcademyInfo | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getAcademy().then((a: any) => {
      setAcademy(a);
      setName(a.name || '');
      setPhone(a.phone || '');
      setAddress(a.address || '');
    }).catch(() => {});
    api.getAcademyUsage().then(setUsage).catch(() => {});
  }, []);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('학원 이름을 입력하세요');
      return;
    }
    setSaving(true);
    try {
      await api.updateAcademy({
        name: name.trim(),
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
      });
      toast.success('학원 정보가 저장되었습니다');
      if (academy) setAcademy({ ...academy, name: name.trim(), phone, address });
    } catch (err: any) {
      toast.error(err.message || '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  if (!academy) {
    return <div className="settings-section"><p>학원 정보 로딩 중...</p></div>;
  }

  const dirty =
    name.trim() !== (academy.name || '') ||
    phone.trim() !== (academy.phone || '') ||
    address.trim() !== (academy.address || '');

  return (
    <div className="settings-section">
      <h3>학원 정보</h3>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 13, color: '#888', marginBottom: 16, flexWrap: 'wrap' }}>
        <span>학원코드: <strong style={{ fontFamily: 'monospace' }}>{academy.slug}</strong></span>
        <span>|</span>
        <span>요금제: <strong>{academy.plan?.toUpperCase() || 'FREE'}</strong></span>
        {usage && (
          <>
            <span>|</span>
            <span>학생 <strong>{usage.students.current}</strong>/{usage.students.max}</span>
            <span>·</span>
            <span>선생님 <strong>{usage.teachers.current}</strong>/{usage.teachers.max}</span>
          </>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 12 }}>
        <div>
          <label htmlFor="academy-name" style={{ display: 'block', fontSize: 13, color: '#555', marginBottom: 4 }}>학원 이름 *</label>
          <input
            id="academy-name"
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
          />
        </div>
        <div>
          <label htmlFor="academy-phone" style={{ display: 'block', fontSize: 13, color: '#555', marginBottom: 4 }}>연락처</label>
          <input
            id="academy-phone"
            className="input"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="02-000-0000"
          />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label htmlFor="academy-address" style={{ display: 'block', fontSize: 13, color: '#555', marginBottom: 4 }}>주소</label>
          <input
            id="academy-address"
            className="input"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </div>
      </div>

      <button
        className="btn btn-primary"
        onClick={handleSave}
        disabled={saving || !dirty}
      >
        {saving ? '저장 중...' : '저장'}
      </button>
    </div>
  );
}
