import { useToastStore } from '../../stores/toastStore';

export default function ToastContainer() {
    const { toasts, removeToast } = useToastStore();

    return (
        <div style={{
            position: 'fixed',
            top: '24px',
            right: '24px',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            pointerEvents: 'none'
        }}>
            {toasts.map((toast) => (
                <div
                    key={toast.id}
                    onClick={() => removeToast(toast.id)}
                    style={{
                        padding: '16px 24px',
                        borderRadius: '12px',
                        background: toast.type === 'error' ? '#ef4444' : toast.type === 'success' ? '#10b981' : '#3b82f6',
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
                    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
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
