import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { api, type NotificationItem } from '../api';
import './NotificationsPage.css';

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
    <div className="page-container notif-page">
      <header className="page-header page-header-row">
        <h1 className="page-title">알림</h1>
        <button
          type="button"
          onClick={handleReadAll}
          className="btn-secondary"
          disabled={!items.some((x) => !x.is_read)}
        >
          모두 읽음
        </button>
      </header>

      <div role="tablist" aria-label="알림 필터" className="chip-group" style={{ marginBottom: 'var(--sp-4)' }}>
        {(['unread', 'read', 'all'] as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            role="tab"
            aria-selected={filter === f}
            onClick={() => setFilter(f)}
            className={`filter-btn${filter === f ? ' active' : ''}`}
          >
            {f === 'unread' ? '미확인' : f === 'read' ? '확인됨' : '전체'}
          </button>
        ))}
      </div>

      {error && (
        <div role="alert" className="error-message with-icon">
          <AlertCircle size={16} aria-hidden />
          {error}
        </div>
      )}

      {items.length === 0 && !loading ? (
        <div className="empty-state">
          <div className="empty-state-desc">
            {filter === 'unread' ? '확인하지 않은 알림이 없습니다' : '알림이 없습니다'}
          </div>
        </div>
      ) : (
        <ul className="notif-list">
          {items.map((it) => (
            <li key={it.id}>
              <button
                type="button"
                onClick={() => handleClick(it)}
                className={`notif-item${it.is_read ? ' notif-item--read' : ''}`}
              >
                <div className="notif-item-head">
                  {!it.is_read && <span aria-hidden className="notif-dot" />}
                  <span className="notif-title">{it.title}</span>
                </div>
                {it.body && (
                  <div className="notif-body">
                    {it.body}
                  </div>
                )}
                <div className="notif-time">
                  {formatFull(it.created_at)}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {loading && (
        <div className="loading-state">
          <span className="spinner" aria-hidden />
          불러오는 중...
        </div>
      )}

      {!loading && !reachedEnd && cursor && (
        <div className="notif-more">
          <button type="button" className="btn-secondary" onClick={() => load(false)}>
            더 보기
          </button>
        </div>
      )}
    </div>
  );
}
