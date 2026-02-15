import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon: string;
  title: string;
  description?: string;
  children?: ReactNode;
}

export default function EmptyState({ icon, title, description, children }: EmptyStateProps) {
  return (
    <div className="empty-state" style={{ padding: '40px 20px' }}>
      <span className="material-symbols-outlined" style={{ fontSize: '48px', color: 'var(--text-muted)' }}>{icon}</span>
      <div className="empty-state-title">{title}</div>
      {description && <p style={{ color: 'var(--text-muted)', marginBottom: children ? '16px' : 0 }}>{description}</p>}
      {children}
    </div>
  );
}
