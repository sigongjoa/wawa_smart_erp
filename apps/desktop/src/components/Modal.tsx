import { createContext, useContext, useEffect, useId, useRef, type ReactNode } from 'react';

type ModalContextValue = { titleId: string; onClose: () => void };
const ModalContext = createContext<ModalContextValue | null>(null);

interface ModalProps {
  children: ReactNode;
  onClose: () => void;
  className?: string;
  labelledBy?: string;
}

function ModalRoot({ children, onClose, className, labelledBy }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'Tab' && contentRef.current) {
        const focusable = contentRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    const timer = setTimeout(() => {
      const first = contentRef.current?.querySelector<HTMLElement>(
        'button, input, select, textarea'
      );
      first?.focus();
    }, 50);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      clearTimeout(timer);
    };
  }, [onClose]);

  return (
    <ModalContext.Provider value={{ titleId, onClose }}>
      <div
        ref={overlayRef}
        className="modal-overlay"
        onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
      >
        <div
          ref={contentRef}
          className={`modal-content ${className || ''}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby={labelledBy || titleId}
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      </div>
    </ModalContext.Provider>
  );
}

interface ModalHeaderProps {
  children: ReactNode;
  showClose?: boolean;
  closeDisabled?: boolean;
}

function ModalHeader({ children, showClose = true, closeDisabled = false }: ModalHeaderProps) {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error('Modal.Header must be used inside Modal');
  return (
    <div className="modal-header">
      <h3 id={ctx.titleId} className="modal-title">{children}</h3>
      {showClose && (
        <button
          type="button"
          className="modal-close"
          onClick={ctx.onClose}
          disabled={closeDisabled}
          aria-label="닫기"
        >
          ×
        </button>
      )}
    </div>
  );
}

function ModalBody({ children }: { children: ReactNode }) {
  return <div className="modal-body">{children}</div>;
}

function ModalFooter({ children }: { children: ReactNode }) {
  return <div className="modal-footer">{children}</div>;
}

const Modal = Object.assign(ModalRoot, {
  Header: ModalHeader,
  Body: ModalBody,
  Footer: ModalFooter,
});

export default Modal;
