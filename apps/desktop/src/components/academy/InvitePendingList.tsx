import { useEffect, useImperativeHandle, useState, forwardRef } from 'react';
import { api } from '../../api';
import { toast, useConfirm } from '../Toast';

interface Invite {
  id: string;
  code: string;
  role: 'admin' | 'instructor';
  expires_at: string;
  used_by?: string | null;
  created_at?: string;
}

export interface InvitePendingHandle {
  create: () => Promise<void>;
  reload: () => void;
}

function InvitePendingListInner(_props: {}, ref: React.Ref<InvitePendingHandle>) {
  const { confirm, ConfirmDialog } = useConfirm();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<'instructor' | 'admin'>('instructor');
  const [latestCode, setLatestCode] = useState<{ code: string; expiresAt: string } | null>(null);
  const [creating, setCreating] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    api.getInvites()
      .then((list: any) => setInvites(Array.isArray(list) ? list : []))
      .catch((err) => toast.error(err.message || '초대 목록 로딩 실패'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    setCreating(true);
    try {
      const res = await api.createInvite({ role, expiresInDays: 7 });
      setLatestCode({ code: res.code, expiresAt: res.expiresAt });
      toast.success('초대 코드가 생성되었습니다');
      load();
    } catch (err: any) {
      toast.error(err.message || '초대 코드 생성 실패');
    } finally {
      setCreating(false);
    }
  };

  useImperativeHandle(ref, () => ({
    create: async () => { await create(); },
    reload: load,
  }));

  const handleCancel = async (id: string) => {
    if (!(await confirm('이 초대 코드를 취소합니다. 계속하시겠습니까?'))) return;
    setCancellingId(id);
    try {
      await api.cancelInvite(id);
      toast.success('초대 코드가 취소되었습니다');
      load();
    } catch (err: any) {
      toast.error(err.message || '취소 실패');
    } finally {
      setCancellingId(null);
    }
  };

  const copy = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.info('복사되었습니다');
  };

  const pending = invites.filter((inv) => !inv.used_by && new Date(inv.expires_at) > new Date());
  const history = invites.filter((inv) => inv.used_by || new Date(inv.expires_at) <= new Date()).slice(0, 10);

  return (
    <div className="settings-section">
      <h3>초대 코드</h3>
      <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: '0 0 12px' }}>
        새 선생님이 직접 가입할 수 있는 코드를 생성합니다. 7일간 유효.
      </p>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as any)}
          style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border-primary)' }}
        >
          <option value="instructor">강사</option>
          <option value="admin">관리자</option>
        </select>
        <button className="btn btn-primary" onClick={create} disabled={creating}>
          {creating ? '생성 중...' : '초대 코드 생성'}
        </button>
      </div>

      {latestCode && (
        <div style={{ marginBottom: 16, background: 'var(--info-surface)', borderRadius: 8, padding: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 24, fontWeight: 700, letterSpacing: 4, fontFamily: 'monospace' }}>{latestCode.code}</span>
          <button
            type="button"
            onClick={() => copy(latestCode.code)}
            style={{ padding: '4px 12px', fontSize: 13, background: 'var(--info)', color: 'var(--text-on-primary)', border: 'none', borderRadius: 4, cursor: 'pointer' }}
          >
            복사
          </button>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
            만료: {new Date(latestCode.expiresAt).toLocaleDateString('ko-KR')}
          </span>
        </div>
      )}

      <h4 style={{ fontSize: 14, marginBottom: 8 }}>대기 중 ({pending.length})</h4>
      {loading ? (
        <p style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>로딩 중...</p>
      ) : pending.length === 0 ? (
        <p style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>대기 중인 초대 코드가 없습니다.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-secondary)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '6px 8px' }}>코드</th>
                <th style={{ padding: '6px 8px' }}>역할</th>
                <th style={{ padding: '6px 8px' }}>만료</th>
                <th style={{ padding: '6px 8px', width: 60 }}></th>
                <th style={{ padding: '6px 8px', width: 80 }}></th>
              </tr>
            </thead>
            <tbody>
              {pending.map((inv) => (
                <tr key={inv.id} style={{ borderBottom: '1px solid var(--border-secondary)' }}>
                  <td style={{ padding: '8px', fontFamily: 'monospace', letterSpacing: 1 }}>{inv.code}</td>
                  <td style={{ padding: '8px' }}>{inv.role === 'admin' ? '관리자' : '강사'}</td>
                  <td style={{ padding: '8px', color: 'var(--text-tertiary)' }}>{new Date(inv.expires_at).toLocaleDateString('ko-KR')}</td>
                  <td style={{ padding: '8px' }}>
                    <button
                      type="button"
                      onClick={() => copy(inv.code)}
                      style={{ padding: '2px 8px', fontSize: 12, background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)', borderRadius: 4, cursor: 'pointer' }}
                    >복사</button>
                  </td>
                  <td style={{ padding: '8px' }}>
                    <button
                      type="button"
                      onClick={() => handleCancel(inv.id)}
                      disabled={cancellingId === inv.id}
                      style={{ padding: '2px 8px', fontSize: 12, background: 'var(--bg-secondary)', border: '1px solid var(--danger-surface)', color: 'var(--danger)', borderRadius: 4, cursor: 'pointer' }}
                    >
                      {cancellingId === inv.id ? '취소 중...' : '취소'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {history.length > 0 && (
        <details style={{ marginTop: 16 }}>
          <summary style={{ cursor: 'pointer', fontSize: 13, color: 'var(--text-tertiary)' }}>
            이전 초대 이력 ({history.length})
          </summary>
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse', marginTop: 8 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-secondary)', textAlign: 'left', color: 'var(--text-tertiary)' }}>
                <th style={{ padding: '6px 8px' }}>코드</th>
                <th style={{ padding: '6px 8px' }}>역할</th>
                <th style={{ padding: '6px 8px' }}>상태</th>
                <th style={{ padding: '6px 8px' }}>만료</th>
              </tr>
            </thead>
            <tbody>
              {history.map((inv) => (
                <tr key={inv.id} style={{ borderBottom: '1px solid var(--border-secondary)', color: 'var(--text-tertiary)' }}>
                  <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>{inv.code}</td>
                  <td style={{ padding: '6px 8px' }}>{inv.role === 'admin' ? '관리자' : '강사'}</td>
                  <td style={{ padding: '6px 8px' }}>
                    {inv.used_by ? <span style={{ color: 'var(--success)' }}>사용됨</span> : <span>만료</span>}
                  </td>
                  <td style={{ padding: '6px 8px' }}>{new Date(inv.expires_at).toLocaleDateString('ko-KR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
      {ConfirmDialog}
    </div>
  );
}

const InvitePendingList = forwardRef(InvitePendingListInner);
export default InvitePendingList;
