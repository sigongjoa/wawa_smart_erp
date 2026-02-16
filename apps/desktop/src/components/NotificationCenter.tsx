import React, { useState, useEffect, useRef } from 'react';
import { useNotificationStore } from '../stores/notificationStore';
import { useDMStore } from '../stores/dmStore';
import { useReportStore } from '../stores/reportStore';

const NotificationCenter: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const { currentUser } = useReportStore();
    const { notifications, unreadCount, fetchNotifications, markAsRead, markAllAsRead } = useNotificationStore();
    const { unreadTotal: unreadDMs, toggleWidget: toggleDM } = useDMStore();
    const popoverRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (currentUser?.teacher.id) {
            useNotificationStore.getState().startPolling(currentUser.teacher.id);
        }
        return () => useNotificationStore.getState().stopPolling();
    }, [currentUser?.teacher.id]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const totalUnread = unreadCount + unreadDMs;

    const formatDate = (dateString: string) => {
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('ko-KR', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            });
        } catch (e) {
            return dateString;
        }
    };

    return (
        <div className="relative" ref={popoverRef} style={{ position: 'relative' }}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="header-icon-btn"
                title="알림"
            >
                <span className="material-symbols-outlined">notifications</span>
                {totalUnread > 0 && (
                    <span className="notification-dot" style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '9px',
                        color: 'white',
                        fontWeight: '700',
                        width: 'auto',
                        minWidth: '14px',
                        height: '14px',
                        padding: '0 3px',
                        top: '4px',
                        right: '4px'
                    }}>
                        {totalUnread > 99 ? '99+' : totalUnread}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="card" style={{
                    position: 'absolute',
                    right: 0,
                    marginTop: '8px',
                    width: '360px',
                    zIndex: 100,
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    maxHeight: '480px'
                }}>
                    {/* Header */}
                    <div style={{
                        padding: '16px',
                        background: 'var(--primary-light)',
                        borderBottom: '1px solid var(--border)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}>
                        <h3 className="sidebar-title" style={{ margin: 0, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>notifications</span>
                            알림 센터
                        </h3>
                        {unreadCount > 0 && (
                            <button
                                onClick={() => currentUser && markAllAsRead(currentUser.teacher.id)}
                                className="btn btn-ghost btn-sm"
                                style={{ padding: '4px 8px', fontSize: '11px' }}
                            >
                                모두 읽음
                            </button>
                        )}
                    </div>

                    {/* Content */}
                    <div style={{ overflowY: 'auto' }}>
                        {/* DM Alert */}
                        {unreadDMs > 0 && (
                            <div
                                onClick={() => {
                                    toggleDM();
                                    setIsOpen(false);
                                }}
                                style={{
                                    padding: '12px 16px',
                                    borderBottom: '1px solid var(--border)',
                                    background: 'var(--background)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px'
                                }}
                            >
                                <div className="stat-icon blue" style={{ width: '32px', height: '32px' }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>chat_bubble</span>
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div className="header-user-name">새로운 쪽지가 있습니다</div>
                                    <div className="header-user-role" style={{ fontSize: '12px' }}>읽지 않은 쪽지 {unreadDMs}개가 있습니다.</div>
                                </div>
                                <span className="material-symbols-outlined" style={{ color: 'var(--text-muted)', fontSize: '18px' }}>chevron_right</span>
                            </div>
                        )}

                        {/* System Alarms */}
                        {notifications.length === 0 ? (
                            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '48px', opacity: 0.2, display: 'block', marginBottom: '12px' }}>check_circle</span>
                                <p style={{ fontSize: '13px' }}>새로운 알림이 없습니다.</p>
                            </div>
                        ) : (
                            notifications.map((notif) => (
                                <div
                                    key={notif.id}
                                    style={{
                                        padding: '16px',
                                        borderBottom: '1px solid var(--border-light)',
                                        background: notif.status === 'unread' ? 'var(--primary-light)' : 'transparent',
                                        transition: 'background var(--transition-fast)',
                                        position: 'relative'
                                    }}
                                >
                                    <div style={{ display: 'flex', gap: '12px' }}>
                                        <div className={`stat-icon ${notif.type === '성적' ? 'rose' : notif.type === '보강' ? 'amber' : 'blue'}`}
                                            style={{ width: '32px', height: '32px', flexShrink: 0 }}>
                                            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                                                {notif.type === '성적' || notif.type === '보강' ? 'priority_high' : 'notifications'}
                                            </span>
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                                <span className="sidebar-title" style={{ fontSize: '10px' }}>{notif.type}</span>
                                                <span className="header-user-role" style={{ fontSize: '10px' }}>{formatDate(notif.createdAt)}</span>
                                            </div>
                                            <div className="header-user-name" style={{ fontSize: '13px', marginBottom: '4px' }}>{notif.title}</div>
                                            <div className="header-user-role" style={{
                                                fontSize: '12px',
                                                display: '-webkit-box',
                                                WebkitLineClamp: 2,
                                                WebkitBoxOrient: 'vertical',
                                                overflow: 'hidden',
                                                marginBottom: '8px'
                                            }}>{notif.content}</div>

                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                {notif.status === 'unread' && (
                                                    <button
                                                        onClick={() => markAsRead(notif.id)}
                                                        className="btn btn-ghost btn-sm"
                                                        style={{ padding: '0', height: 'auto', fontSize: '11px', color: 'var(--primary)' }}
                                                    >
                                                        읽음 표시
                                                    </button>
                                                )}
                                                {notif.path && (
                                                    <button
                                                        onClick={() => {
                                                            window.location.hash = notif.path!;
                                                            markAsRead(notif.id);
                                                            setIsOpen(false);
                                                        }}
                                                        className="btn btn-ghost btn-sm"
                                                        style={{ padding: '0', height: 'auto', fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}
                                                    >
                                                        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>open_in_new</span>
                                                        이동
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    {notif.status === 'unread' && (
                                        <div style={{
                                            position: 'absolute',
                                            top: '16px',
                                            right: '16px',
                                            width: '6px',
                                            height: '6px',
                                            background: 'var(--primary)',
                                            borderRadius: '50%'
                                        }}></div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>

                    {/* Footer */}
                    <div style={{
                        padding: '12px',
                        textAlign: 'center',
                        borderTop: '1px solid var(--border)',
                        background: 'var(--background)'
                    }}>
                        <button onClick={() => setIsOpen(false)} className="btn btn-ghost btn-sm">닫기</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default NotificationCenter;
