import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type NotificationItem } from '../api';

type Filter = 'unread' | 'read' | 'all';

function formatFull(iso: string): string {
  const ts = new Date(iso.endsWith('Z') ? iso : iso + 'Z');
  return ts.toLocaleString('ko-KR', {
    year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export default function NotificationsPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>('unread');
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reachedEnd, setReachedEnd] = useState(false);

  const load = useCallback(async (replace: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getNotifications({
        status: filter,
        limit: 30,
        cursor: replace ? undefined : (cursor ?? undefined),
      });
      const newItems = data.items ?? [];
      setItems((prev) => replace ? newItems : [...prev, ...newItems]);
      setCursor(data.next_cursor);
      setReachedEnd(data.next_cursor === null);
    } catch (e) {
      setError((e as Error).message || '알림을 불러오지 못했습니다');
    } finally {
      setLoading(false);
    }
  }, [filter, cursor]);

  // filter 변경 시 새로 로드
  useEffect(() => {
    setItems([]);
    setCursor(null);
    setReachedEnd(false);
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const handleClick = async (item: NotificationItem) => {
    if (!item.is_read) {
      try { await api.markNotificationRead(item.id); } catch { /* ignore */ }
      setItems((prev) => prev.map((x) => x.id === item.id ? { ...x, is_read: true } : x));
    }
    if (item.link) navigate(item.link);
  };

  const handleReadAll = async () => {
    try { await api.markAllNotificationsRead(); } catch { /* ignore */ }
    setItems((prev) => prev.map((x) => ({ ...x, is_read: true })));
  };

  return (
    <div className="page-container" style={{ padding: '24px 16px', maxWidth: 800 }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>알림</h1>
        <button
          type="button"
          onClick={handleReadAll}
          className="btn-secondary"
          disabled={!items.some((x) => !x.is_read)}
        >
          모두 읽음
        </button>
      </header>

      <div role="tablist" aria-label="알림 필터" style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {(['unread', 'read', 'all'] as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            role="tab"
            aria-selected={filter === f}
            onClick={() => setFilter(f)}
            style={{
              padding: '6px 14px',
              borderRadius: 18,
              border: '1px solid',
              borderColor: filter === f ? 'var(--accent, #1f7a4d)' : 'var(--border, #e3e6ea)',
              background: filter === f ? 'var(--accent, #1f7a4d)' : '#fff',
              color: filter === f ? '#fff' : 'var(--ink, #0a1f14)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {f === 'unread' ? '미확인' : f === 'read' ? '확인됨' : '전체'}
          </button>
        ))}
      </div>

      {error && (
        <div role="alert" style={{
          padding: 12, background: '#FEF2F2', color: '#B91C1C',
          borderRadius: 8, marginBottom: 12, fontSize: 13,
        }}>{error}</div>
      )}

      {items.length === 0 && !loading ? (
        <div style={{
          padding: 48, textAlign: 'center', color: 'var(--ink-60, #5a6068)',
          background: 'var(--surface-2, #fafbfc)', borderRadius: 12,
        }}>
          {filter === 'unread' ? '확인하지 않은 알림이 없습니다' : '알림이 없습니다'}
        </div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map((it) => (
            <li key={it.id}>
              <button
                type="button"
                onClick={() => handleClick(it)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '14px 16px',
                  border: '1px solid var(--border, #e3e6ea)',
                  background: it.is_read ? 'var(--surface-2, #fafbfc)' : '#fff',
                  borderRadius: 10,
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {!it.is_read && (
                    <span aria-hidden style={{
                      display: 'inline-block', width: 8, height: 8,
                      borderRadius: '50%', background: '#e23b3b',
                    }} />
                  )}
                  <span style={{ fontWeight: 600, color: 'var(--ink, #0a1f14)' }}>{it.title}</span>
                </div>
                {it.body && (
                  <div style={{ fontSize: 13, color: 'var(--ink-70, #41464d)', lineHeight: 1.45 }}>
                    {it.body}
                  </div>
                )}
                <div style={{ fontSize: 11.5, color: 'var(--ink-50, #6e7480)', marginTop: 2 }}>
                  {formatFull(it.created_at)}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {loading && (
        <div style={{ padding: 16, textAlign: 'center', color: 'var(--ink-60, #5a6068)' }}>
          불러오는 중...
        </div>
      )}

      {!loading && !reachedEnd && cursor && (
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <button type="button" className="btn-secondary" onClick={() => load(false)}>
            더 보기
          </button>
        </div>
      )}
    </div>
  );
}
