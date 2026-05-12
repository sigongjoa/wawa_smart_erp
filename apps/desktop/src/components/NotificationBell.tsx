import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { api, type NotificationItem } from '../api';
import './NotificationBell.css';

const POLL_INTERVAL_MS = 30_000;

function formatRelative(iso: string): string {
  const ts = new Date(iso.endsWith('Z') ? iso : iso + 'Z').getTime();
  const diff = Date.now() - ts;
  if (diff < 60_000) return '방금';
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}분 전`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}시간 전`;
  const days = Math.floor(diff / 86400_000);
  if (days < 7) return `${days}일 전`;
  return new Date(ts).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' });
}

export default function NotificationBell() {
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const fetchCount = useCallback(async () => {
    try {
      const data = await api.getUnreadNotificationCount();
      setUnreadCount(data.count ?? 0);
    } catch { /* ignore — 로그인 안 됐거나 일시적 오류 */ }
  }, []);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getNotifications({ status: 'unread', limit: 10 });
      setItems(data.items ?? []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // unread-count polling (탭이 visible 일 때만)
  useEffect(() => {
    fetchCount();
    let intervalId: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (intervalId !== null) return;
      intervalId = setInterval(fetchCount, POLL_INTERVAL_MS);
    };
    const stop = () => {
      if (intervalId !== null) { clearInterval(intervalId); intervalId = null; }
    };
    const onVis = () => {
      if (document.visibilityState === 'visible') { fetchCount(); start(); } else { stop(); }
    };
    if (document.visibilityState === 'visible') start();
    document.addEventListener('visibilitychange', onVis);
    return () => { stop(); document.removeEventListener('visibilitychange', onVis); };
  }, [fetchCount]);

  // 드롭다운 열 때 items fetch
  useEffect(() => {
    if (open) fetchItems();
  }, [open, fetchItems]);

  // 바깥 클릭 / Escape 로 닫기
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const handleItemClick = async (item: NotificationItem) => {
    setOpen(false);
    try { await api.markNotificationRead(item.id); } catch { /* 멱등 처리이므로 무시 */ }
    setItems((prev) => prev.filter((x) => x.id !== item.id));
    setUnreadCount((n) => Math.max(0, n - 1));
    if (item.link) navigate(item.link);
  };

  const handleReadAll = async () => {
    try { await api.markAllNotificationsRead(); } catch { /* ignore */ }
    setItems([]);
    setUnreadCount(0);
  };

  return (
    <div className="notif-bell-root" ref={rootRef}>
      <button
        type="button"
        className="notif-bell-trigger"
        onClick={() => setOpen((o) => !o)}
        aria-label={`알림 ${unreadCount > 0 ? `(${unreadCount}건 미확인)` : ''}`}
        aria-expanded={open}
      >
        <Bell size={20} aria-hidden />
        {unreadCount > 0 && (
          <span className="notif-bell-badge" aria-hidden>{unreadCount > 99 ? '99+' : unreadCount}</span>
        )}
      </button>

      {open && (
        <div className="notif-bell-panel" role="dialog" aria-label="알림 목록">
          <div className="notif-bell-panel-head">
            <h3>알림</h3>
            {items.length > 0 && (
              <button type="button" className="notif-bell-readall" onClick={handleReadAll}>모두 읽음</button>
            )}
          </div>

          <div className="notif-bell-list">
            {loading ? (
              <div className="notif-bell-empty">불러오는 중...</div>
            ) : items.length === 0 ? (
              <div className="notif-bell-empty">새 알림이 없습니다</div>
            ) : (
              items.map((it) => (
                <button
                  type="button"
                  key={it.id}
                  className="notif-bell-item"
                  onClick={() => handleItemClick(it)}
                >
                  <div className="notif-bell-item-title">{it.title}</div>
                  {it.body && <div className="notif-bell-item-body">{it.body}</div>}
                  <div className="notif-bell-item-meta">{formatRelative(it.created_at)}</div>
                </button>
              ))
            )}
          </div>

          <div className="notif-bell-foot">
            <button
              type="button"
              className="notif-bell-viewall"
              onClick={() => { setOpen(false); navigate('/notifications'); }}
            >
              전체 알림 보기 →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
