/**
 * DialogShell — modal-overlay/click-out-close 패턴의 ARIA + Escape 자동화 래퍼.
 *
 * 기존 마크업 그대로 둔 채 role="dialog" + aria-modal + Escape 키만 추가.
 * 풀 Modal 컴포넌트(Header/Body/Footer 구조)가 부담스러운 단순 시트·확인창에 사용.
 *
 * 사용:
 *   <DialogShell ariaLabel="PIN 재설정" onClose={() => setOpen(false)}>
 *     <div className="modal-content">...</div>
 *   </DialogShell>
 *
 * children 안의 최상위 노드가 modal-content 컨테이너 — onClick stopPropagation은 이 컴포넌트가 처리.
 * 다른 클래스(gacha-modal-overlay 등) 사용 시 overlayClassName 지정.
 */
import { useEffect, useRef, type ReactNode } from 'react';

interface Props {
  ariaLabel: string;
  onClose: () => void;
  children: ReactNode;
  overlayClassName?: string; // default: 'modal-overlay'
}

export default function DialogShell({ ariaLabel, onClose, children, overlayClassName = 'modal-overlay' }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      ref={overlayRef}
      className={overlayClassName}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      {children}
    </div>
  );
}
