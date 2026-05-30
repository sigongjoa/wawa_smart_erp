import { useEffect, useRef } from 'react';
import './ConfirmSheet.css';

interface Props {
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * 학생앱 공용 확인 모달 — native confirm() 대체 (IMPECCABLE: 게임 폴리시 유지).
 * role="dialog" + aria-modal + Escape + 오버레이 클릭 닫기 + 진입 시 확인 버튼 포커스.
 */
export default function ConfirmSheet({
  message,
  confirmLabel = '확인',
  cancelLabel = '취소',
  danger = false,
  onConfirm,
  onCancel,
}: Props) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div className="confirm-sheet-overlay" role="dialog" aria-modal="true" aria-label="확인" onClick={onCancel}>
      <div className="confirm-sheet" onClick={(e) => e.stopPropagation()}>
        <p className="confirm-sheet-message">{message}</p>
        <div className="confirm-sheet-actions">
          <button type="button" className="confirm-sheet-btn confirm-sheet-btn--ghost" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            className={`confirm-sheet-btn ${danger ? 'confirm-sheet-btn--danger' : 'confirm-sheet-btn--primary'}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
