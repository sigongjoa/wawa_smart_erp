interface Props {
  status: string;
  size?: 'sm' | 'md';
}

const STATUS_LABEL: Record<string, string> = {
  assigned: '미제출',
  submitted: '검토 대기',
  reviewed: '검토 중',
  needs_resubmit: '재제출 요청',
  completed: '완료',
};

const STATUS_COLOR: Record<string, string> = {
  assigned: '#9ca3af',
  submitted: '#2563eb',
  reviewed: '#7c3aed',
  needs_resubmit: '#dc2626',
  completed: '#16a34a',
};

export default function AssignmentStatusBadge({ status, size = 'md' }: Props) {
  const padding = size === 'sm' ? '2px 8px' : '2px 10px';
  const fontSize = size === 'sm' ? 11 : 12;
  return (
    <span
      style={{
        background: STATUS_COLOR[status] || '#888',
        color: '#fff',
        padding,
        borderRadius: 12,
        fontSize,
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      {STATUS_LABEL[status] || status}
    </span>
  );
}

export { STATUS_LABEL, STATUS_COLOR };
