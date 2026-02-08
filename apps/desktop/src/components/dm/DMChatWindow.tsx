import { useState, useEffect, useRef } from 'react';
import { useDMStore } from '../../stores/dmStore';
import { useReportStore } from '../../stores/reportStore';
import { useToastStore } from '../../stores/toastStore';
import { formatTimeOnly } from '../../constants/common';

interface Props {
  userId: string;
  partnerId: string;
}

export default function DMChatWindow({ userId, partnerId }: Props) {
  const { messages, isLoading, goBackToContacts, closeWidget, fetchMessages, sendMessage } = useDMStore();
  const { teachers } = useReportStore();
  const { addToast } = useToastStore();

  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const partner = teachers.find((t) => t.id === partnerId);
  const partnerName = partner?.name || '알 수 없음';

  useEffect(() => {
    fetchMessages(userId, partnerId);
  }, [userId, partnerId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || isSending) return;

    setInputText('');
    setIsSending(true);
    const success = await sendMessage(userId, partnerId, text);
    setIsSending(false);

    if (!success) {
      addToast('메시지 전송에 실패했습니다.', 'error');
      setInputText(text);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };


  return (
    <>
      {/* Header */}
      <div className="dm-widget-header">
        <button className="dm-header-btn" onClick={goBackToContacts}>
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h3 className="dm-widget-title">{partnerName}</h3>
        <button className="dm-header-btn" onClick={closeWidget}>
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>

      {/* Messages */}
      <div className="dm-messages">
        {isLoading && messages.length === 0 ? (
          <div className="dm-empty">로딩 중...</div>
        ) : messages.length === 0 ? (
          <div className="dm-empty">아직 대화 내용이 없습니다</div>
        ) : (
          messages.map((msg) => {
            const isMine = msg.senderId === userId;
            return (
              <div key={msg.id} className={`dm-message ${isMine ? 'sent' : 'received'}`}>
                <div className="dm-bubble">
                  {msg.content}
                </div>
                <div className="dm-message-time">{formatTimeOnly(msg.createdAt)}</div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="dm-input-area">
        <input
          className="dm-input"
          placeholder="메시지를 입력하세요..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isSending}
        />
        <button
          className="dm-send-btn"
          onClick={handleSend}
          disabled={!inputText.trim() || isSending}
        >
          <span className="material-symbols-outlined">send</span>
        </button>
      </div>
    </>
  );
}
