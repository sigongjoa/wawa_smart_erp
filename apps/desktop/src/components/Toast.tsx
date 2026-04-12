import { useCallback, useEffect, useRef, useState } from 'react';

type ToastType = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

let toastId = 0;
const listeners: Array<(t: ToastItem) => void> = [];

export const toast = {
  success(message: string) { notify(message, 'success'); },
  error(message: string) { notify(message, 'error'); },
  info(message: string) { notify(message, 'info'); },
};

function notify(message: string, type: ToastType) {
  const item: ToastItem = { id: ++toastId, message, type };
  listeners.forEach((fn) => fn(item));
}

export function ToastContainer() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    const handler = (item: ToastItem) => {
      setItems((prev) => [...prev, item]);
      setTimeout(() => {
        setItems((prev) => prev.filter((t) => t.id !== item.id));
      }, 3000);
    };
    listeners.push(handler);
    return () => {
      const idx = listeners.indexOf(handler);
      if (idx >= 0) listeners.splice(idx, 1);
    };
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="toast-container" aria-live="polite">
      {items.map((item) => (
        <div key={item.id} className={`toast toast--${item.type}`} role="status">
          <span className="toast-icon">
            {item.type === 'success' ? '✓' : item.type === 'error' ? '!' : 'i'}
          </span>
          <span className="toast-message">{item.message}</span>
        </div>
      ))}
    </div>
  );
}

// Confirm dialog — replaces native confirm()
export function useConfirm() {
  const [state, setState] = useState<{
    message: string;
    resolve: (v: boolean) => void;
  } | null>(null);

  const resolveRef = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback((message: string): Promise<boolean> => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setState({ message, resolve });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    resolveRef.current?.(true);
    resolveRef.current = null;
    setState(null);
  }, []);

  const handleCancel = useCallback(() => {
    resolveRef.current?.(false);
    resolveRef.current = null;
    setState(null);
  }, []);

  const ConfirmDialog = state ? (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="확인"
      onClick={handleCancel}
      onKeyDown={(e) => { if (e.key === 'Escape') handleCancel(); }}
    >
      <div className="modal-content modal-confirm" onClick={(e) => e.stopPropagation()}>
        <p className="confirm-message">{state.message}</p>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={handleCancel} type="button">취소</button>
          <button className="btn btn-primary" onClick={handleConfirm} autoFocus type="button">확인</button>
        </div>
      </div>
    </div>
  ) : null;

  return { confirm, ConfirmDialog };
}
