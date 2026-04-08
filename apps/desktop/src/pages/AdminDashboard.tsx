import { useState } from 'react';
import PageHeader from '../components/common/PageHeader';
import AdminTabNavigation, { type AdminTab } from '../components/admin/AdminTabNavigation';
import AdminStudentManager from '../components/admin/AdminStudentManager';
import AdminSystemSettings from '../components/admin/AdminSystemSettings';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<AdminTab>('students');

  return (
    <div>
      <PageHeader
        title="관리자 대시보드"
        description="학생 관리와 시스템 설정을 한 곳에서 관리합니다"
      />

      <AdminTabNavigation activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === 'students' && <AdminStudentManager />}
      {activeTab === 'settings' && <AdminSystemSettings />}
    </div>
  );
}
