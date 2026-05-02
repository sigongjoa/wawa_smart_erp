import { useEffect, useState } from 'react';
import { api, type TeacherOption } from '../../api';
import { toast } from '../Toast';
import TeacherEditModal from './TeacherEditModal';
import TeacherAddModal from './TeacherAddModal';

interface Props {
  onCreateInvite: () => void;
}

export default function TeacherList({ onCreateInvite }: Props) {
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'disabled'>('active');
  const [editing, setEditing] = useState<TeacherOption | null>(null);
  const [adding, setAdding] = useState(false);

  const load = () => {
    setLoading(true);
    api.getTeachers()
      .then(setTeachers)
      .catch((err) => toast.error(err.message || '선생님 목록 로딩 실패'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filtered = teachers.filter((t) => {
    const st = t.status || 'active';
    if (filter === 'all') return true;
    return st === filter;
  });

  const activeCount = teachers.filter((t) => (t.status || 'active') === 'active').length;
  const disabledCount = teachers.length - activeCount;

  return (
    <div className="settings-section">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 8, flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0 }}>선생님 목록 <span style={{ fontSize: 13, color: 'var(--text-tertiary)', fontWeight: 400 }}>({activeCount}명 활성)</span></h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={onCreateInvite}>초대 코드 생성</button>
          <button className="btn btn-primary" onClick={() => setAdding(true)}>직접 추가</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 12, fontSize: 13 }}>
        {(['active', 'all', 'disabled'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            style={{
              padding: '4px 12px',
              border: '1px solid ' + (filter === f ? '#4a90d9' : '#ddd'),
              background: filter === f ? '#4a90d9' : '#fff',
              color: filter === f ? '#fff' : '#555',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            {f === 'active' ? `활성 ${activeCount}` : f === 'disabled' ? `비활성 ${disabledCount}` : `전체 ${teachers.length}`}
          </button>
        ))}
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-tertiary)' }}>로딩 중...</p>
      ) : filtered.length === 0 ? (
        <p style={{ color: 'var(--text-tertiary)' }}>표시할 선생님이 없습니다.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: 14, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-secondary)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '8px 10px' }}>이름</th>
                <th style={{ padding: '8px 10px' }}>권한</th>
                <th style={{ padding: '8px 10px' }}>담당 과목</th>
                <th style={{ padding: '8px 10px' }}>상태</th>
                <th style={{ padding: '8px 10px' }}>마지막 로그인</th>
                <th style={{ padding: '8px 10px', width: 80 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => {
                const st = t.status || 'active';
                return (
                  <tr key={t.id} style={{ borderBottom: '1px solid var(--border-secondary)', opacity: st === 'disabled' ? 0.55 : 1 }}>
                    <td style={{ padding: '10px' }}>
                      <strong>{t.name}</strong>
                    </td>
                    <td style={{ padding: '10px' }}>
                      {t.role === 'admin' ? (
                        <span style={{ background: 'var(--primary-surface)', color: 'var(--primary)', padding: '2px 8px', borderRadius: 4, fontSize: 12 }}>관리자</span>
                      ) : (
                        <span style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', padding: '2px 8px', borderRadius: 4, fontSize: 12 }}>강사</span>
                      )}
                    </td>
                    <td style={{ padding: '10px', color: 'var(--text-secondary)' }}>
                      {(t.subjects && t.subjects.length > 0) ? t.subjects.join(', ') : '—'}
                    </td>
                    <td style={{ padding: '10px' }}>
                      {st === 'active' ? (
                        <span style={{ color: 'var(--success)', fontSize: 13 }}>● 활성</span>
                      ) : (
                        <span style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>● 비활성</span>
                      )}
                    </td>
                    <td style={{ padding: '10px', color: 'var(--text-tertiary)', fontSize: 13 }}>
                      {t.last_login_at ? new Date(t.last_login_at).toLocaleDateString('ko-KR') : '—'}
                    </td>
                    <td style={{ padding: '10px' }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ padding: '4px 12px', fontSize: 13 }}
                        onClick={() => setEditing(t)}
                      >
                        관리
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <TeacherEditModal
          teacher={editing}
          onClose={() => setEditing(null)}
          onChanged={load}
        />
      )}
      {adding && (
        <TeacherAddModal
          onClose={() => setAdding(false)}
          onCreated={load}
        />
      )}
    </div>
  );
}
