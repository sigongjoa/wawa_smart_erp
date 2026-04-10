import { useEffect, useState } from 'react';
import { api } from '../api';

type MakeupStatus = '' | 'pending' | 'scheduled' | 'completed';

interface MakeupRow {
  id: string;
  absence_id: string;
  absence_date: string;
  reason: string;
  student_id: string;
  student_name: string;
  class_id: string;
  class_name: string;
  scheduled_date: string | null;
  completed_date: string | null;
  status: 'pending' | 'scheduled' | 'completed';
  notes: string;
}

const STATUS_LABELS: Record<string, string> = {
  pending: '미보강',
  scheduled: '보강예정',
  completed: '보강완료',
};

export default function AbsencePage() {
  const [makeups, setMakeups] = useState<MakeupRow[]>([]);
  const [filter, setFilter] = useState<MakeupStatus>('');
  const [loading, setLoading] = useState(true);
  const [scheduleDates, setScheduleDates] = useState<Record<string, string>>({});

  const loadMakeups = async (status?: MakeupStatus) => {
    setLoading(true);
    try {
      const data = await api.getMakeups(status || undefined);
      setMakeups(data || []);
    } catch {
      setMakeups([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMakeups(filter);
  }, [filter]);

  const handleSchedule = async (absenceId: string) => {
    const date = scheduleDates[absenceId];
    if (!date) return;
    try {
      await api.scheduleMakeup({ absenceId, scheduledDate: date });
      loadMakeups(filter);
    } catch (err) {
      alert('보강일 지정 실패: ' + (err as Error).message);
    }
  };

  const handleComplete = async (makeupId: string) => {
    try {
      await api.completeMakeup(makeupId);
      loadMakeups(filter);
    } catch (err) {
      alert('보강 완료 처리 실패: ' + (err as Error).message);
    }
  };

  const counts = {
    pending: makeups.filter((m) => m.status === 'pending').length,
    scheduled: makeups.filter((m) => m.status === 'scheduled').length,
    completed: makeups.filter((m) => m.status === 'completed').length,
  };

  // 전체 보기일 때는 전체 카운트를 위해 필터 없이 로드
  const displayMakeups = filter ? makeups.filter((m) => m.status === filter) : makeups;

  return (
    <div>
      <div className="absence-page-header">
        <h2 className="page-title">보강 관리</h2>
        <div className="absence-filters">
          {([
            { key: '', label: '전체' },
            { key: 'pending', label: '미보강' },
            { key: 'scheduled', label: '보강예정' },
            { key: 'completed', label: '완료' },
          ] as { key: MakeupStatus; label: string }[]).map(({ key, label }) => (
            <button
              key={key}
              className={`filter-btn ${filter === key ? 'filter-btn--active' : ''}`}
              onClick={() => setFilter(key)}
            >
              {label}
              {key && counts[key as keyof typeof counts] > 0 && (
                <span className="filter-count">{counts[key as keyof typeof counts]}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="rpt-loading" role="status">
          <div className="rpt-spinner" />
          <span>로딩 중...</span>
        </div>
      ) : displayMakeups.length === 0 ? (
        <div className="absence-empty">
          {filter ? `${STATUS_LABELS[filter]} 항목이 없습니다` : '보강 데이터가 없습니다'}
        </div>
      ) : (
        <table className="absence-table">
          <thead>
            <tr>
              <th>학생</th>
              <th>결석일</th>
              <th>수업</th>
              <th>사유</th>
              <th>보강일</th>
              <th>상태</th>
              <th>액션</th>
            </tr>
          </thead>
          <tbody>
            {displayMakeups.map((m) => (
              <tr key={m.id}>
                <td style={{ fontWeight: 600 }}>{m.student_name}</td>
                <td>{m.absence_date}</td>
                <td>{m.class_name}</td>
                <td>{m.reason || '-'}</td>
                <td>
                  {m.status === 'pending' ? (
                    <input
                      type="date"
                      className="date-input"
                      value={scheduleDates[m.absence_id] || ''}
                      onChange={(e) =>
                        setScheduleDates((prev) => ({ ...prev, [m.absence_id]: e.target.value }))
                      }
                    />
                  ) : (
                    m.scheduled_date || '-'
                  )}
                </td>
                <td>
                  <span className={`makeup-status makeup-status--${m.status}`}>
                    {STATUS_LABELS[m.status]}
                  </span>
                </td>
                <td>
                  <div className="action-cell">
                    {m.status === 'pending' && (
                      <button
                        className="btn btn-sm btn-present"
                        onClick={() => handleSchedule(m.absence_id)}
                        disabled={!scheduleDates[m.absence_id]}
                      >
                        지정
                      </button>
                    )}
                    {m.status === 'scheduled' && (
                      <button
                        className="btn btn-sm btn-present"
                        onClick={() => handleComplete(m.id)}
                      >
                        완료
                      </button>
                    )}
                    {m.status === 'completed' && (
                      <span style={{ color: '#2e7d32', fontSize: 12 }}>
                        {m.completed_date}
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
