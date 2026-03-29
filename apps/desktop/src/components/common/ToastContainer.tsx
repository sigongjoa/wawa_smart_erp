import { useToastStore } from '../../stores/toastStore';

export default function ToastContainer() {
    const { toasts, removeToast } = useToastStore();

    return (
        <div
            role="region"
            aria-label="알림"
            aria-live="polite"
            aria-atomic="false"
            style={{
                position: 'fixed',
                top: '24px',
                right: '24px',
                zIndex: 9999,
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                pointerEvents: 'none'
            }}
        >
            {toasts.map((toast) => (
                <div
                    key={toast.id}
                    role={toast.type === 'error' ? 'alert' : 'status'}
                    aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
                    onClick={() => removeToast(toast.id)}
                    onKeyDown={(e) => e.key === 'Enter' || e.key === ' ' ? removeToast(toast.id) : undefined}
                    tabIndex={0}
                    aria-label={`${toast.type === 'error' ? '오류' : toast.type === 'success' ? '성공' : '알림'}: ${toast.message}. 클릭하여 닫기`}
                    style={{
                        padding: '16px 24px',
                        borderRadius: '12px',
                        background: toast.type === 'error' ? 'var(--danger)' : toast.type === 'success' ? 'var(--success)' : 'var(--primary)',
                        color: 'white',
                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        cursor: 'pointer',
                        pointerEvents: 'auto',
                        animation: 'slideIn 0.3s ease-out forwards',
                        minWidth: '300px'
                    }}
                >
                    <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: '20px' }}>
                        {toast.type === 'error' ? 'error' : toast.type === 'success' ? 'check_circle' : 'info'}
                    </span>
                    <div style={{ fontSize: '14px', fontWeight: 500 }}>{toast.message}</div>
                </div>
            ))}
            <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
        </div>
    );
}
