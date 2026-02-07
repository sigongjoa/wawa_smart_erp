import { useDMStore } from '../../stores/dmStore';

export default function DMFloatingButton() {
  const { toggleWidget, unreadTotal, isOpen } = useDMStore();

  return (
    <button
      className={`dm-floating-btn ${isOpen ? 'active' : ''}`}
      onClick={toggleWidget}
      title="쪽지"
    >
      <span className="material-symbols-outlined">
        {isOpen ? 'close' : 'chat'}
      </span>
      {!isOpen && unreadTotal > 0 && (
        <span className="dm-badge">{unreadTotal > 99 ? '99+' : unreadTotal}</span>
      )}
    </button>
  );
}
