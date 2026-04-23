import { useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store';
import AcademyInfoForm from '../components/academy/AcademyInfoForm';
import TeacherList from '../components/academy/TeacherList';
import InvitePendingList, { type InvitePendingHandle } from '../components/academy/InvitePendingList';

export default function AcademyPage() {
  const user = useAuthStore((s) => s.user);
  const inviteRef = useRef<InvitePendingHandle>(null);

  if (user?.role !== 'admin') {
    return <Navigate to="/timer" replace />;
  }

  const handleCreateInvite = () => {
    inviteRef.current?.create();
    document.getElementById('invite-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="settings-page">
      <h2 className="page-title">학원 관리</h2>

      <AcademyInfoForm />

      <div style={{ marginTop: 24 }}>
        <TeacherList onCreateInvite={handleCreateInvite} />
      </div>

      <div id="invite-section" style={{ marginTop: 24 }}>
        <InvitePendingList ref={inviteRef} />
      </div>
    </div>
  );
}
