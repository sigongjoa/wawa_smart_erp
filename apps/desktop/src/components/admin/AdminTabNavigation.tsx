type AdminTab = 'students' | 'settings';

interface AdminTabNavigationProps {
  activeTab: AdminTab;
  onTabChange: (tab: AdminTab) => void;
}

const ADMIN_TABS: { id: AdminTab; label: string; icon: string }[] = [
  { id: 'students', label: '학생 관리', icon: 'school' },
  { id: 'settings', label: '시스템 설정', icon: 'settings' },
];

export default function AdminTabNavigation({ activeTab, onTabChange }: AdminTabNavigationProps) {
  return (
    <div style={{ display: 'flex', gap: '0', borderBottom: '2px solid var(--border)', marginBottom: '24px' }}>
      {ADMIN_TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 24px',
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === tab.id ? '2px solid var(--primary)' : '2px solid transparent',
            color: activeTab === tab.id ? 'var(--primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === tab.id ? 600 : 400,
            cursor: 'pointer',
            marginBottom: '-2px',
            transition: 'all var(--transition-fast)',
            fontSize: '14px',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
            {tab.icon}
          </span>
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export type { AdminTab };
