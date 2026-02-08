import { useDMStore } from '../../stores/dmStore';
import { formatMessageTime } from '../../constants/common';

export default function DMContactList() {
  const { contacts, selectContact, closeWidget } = useDMStore();

  return (
    <>
      <div className="dm-widget-header">
        <h3 className="dm-widget-title">
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>chat</span>
          쪽지
        </h3>
        <button className="dm-header-btn" onClick={closeWidget}>
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>

      <div className="dm-contact-list">
        {contacts.length === 0 ? (
          <div className="dm-empty">대화 가능한 선생님이 없습니다</div>
        ) : (
          contacts.map((contact) => (
            <div
              key={contact.teacherId}
              className="dm-contact-item"
              onClick={() => selectContact(contact.teacherId)}
            >
              <div className="dm-contact-avatar">
                {contact.teacherName[0]}
              </div>
              <div className="dm-contact-info">
                <div className="dm-contact-name">
                  {contact.teacherName}
                  {contact.unreadCount > 0 && (
                    <span className="dm-contact-badge">{contact.unreadCount}</span>
                  )}
                </div>
                {contact.lastMessage && (
                  <div className="dm-contact-preview">
                    {contact.lastMessage.length > 30
                      ? contact.lastMessage.substring(0, 30) + '...'
                      : contact.lastMessage}
                  </div>
                )}
              </div>
              {contact.lastMessageAt && (
                <div className="dm-contact-time">{formatMessageTime(contact.lastMessageAt)}</div>
              )}
            </div>
          ))
        )}
      </div>
    </>
  );
}
