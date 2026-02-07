import { useEffect } from 'react';
import { useDMStore } from '../../stores/dmStore';
import { useReportStore } from '../../stores/reportStore';
import DMFloatingButton from './DMFloatingButton';
import DMContactList from './DMContactList';
import DMChatWindow from './DMChatWindow';

export default function DMWidget() {
  const { isOpen, currentChatPartnerId, startPolling, stopPolling } = useDMStore();
  const { currentUser, teachers } = useReportStore();

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
