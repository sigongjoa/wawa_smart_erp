import { useEffect } from 'react';
import { useDMStore } from '../../stores/dmStore';
import { useReportStore } from '../../stores/reportStore';
import DMFloatingButton from './DMFloatingButton';
import DMContactList from './DMContactList';
import DMChatWindow from './DMChatWindow';

export default function DMWidget() {
  const { isOpen, currentChatPartnerId, closeWidget, startPolling, stopPolling } = useDMStore();
  const { currentUser, teachers } = useReportStore();

  // 유저 변경 시 DM 상태 초기화 (로그아웃 → 재로그인 시 이전 채팅방 잔류 방지)
  useEffect(() => {
    closeWidget();
  }, [currentUser?.teacher.id]);

  useEffect(() => {
    if (currentUser) {
      startPolling(currentUser.teacher.id, teachers);
    }
    return () => stopPolling();
  }, [currentUser?.teacher.id, teachers.length]);

  if (!currentUser) return null;

  return (
    <>
      <DMFloatingButton />
      {isOpen && (
        <div className="dm-widget">
          {currentChatPartnerId ? (
            <DMChatWindow
              userId={currentUser.teacher.id}
              partnerId={currentChatPartnerId}
            />
          ) : (
            <DMContactList />
          )}
        </div>
      )}
    </>
  );
}
