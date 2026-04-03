import { useState } from 'react';
import { useScheduleStore } from '../stores/scheduleStore';
import type { GradeType } from '../types';

const gradeClassMap: Record<GradeType, string> = {
  '중1': 'm1', '중2': 'm2', '중3': 'm3',
  '고1': 'h1', '고2': 'h2', '고3': 'h3',
  '검정고시': 'etc',
};

function formatDateKR(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
}

function formatTimeHM(isoStr: string): string {
  const d = new Date(isoStr);
  return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export default function AttendanceView() {
  const { attendanceRecords } = useScheduleStore();

  const today = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(today);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const dayRecords = attendanceRecords
    .filter((r) => r.date === selectedDate)
    .sort((a, b) => a.checkInTime.localeCompare(b.checkInTime));

  const totalNet = dayRecords.reduce((s, r) => s + r.netMinutes, 0);
  const totalPaused = dayRecords.reduce((s, r) => s + r.totalPausedMinutes, 0);
  const lateCount = dayRecords.filter((r) => r.wasLate).length;

  const shiftDate = (days: number) => {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  return (
    <div className="att-root">
      <div className="att-header">
        <div className="att-date-nav">
          <button className="att-date-btn" onClick={() => shiftDate(-1)} type="button">
            <span className="material-symbols-outlined icon-sm">chevron_left</span>
          </button>
          <span className="att-date-label">{formatDateKR(selectedDate)}</span>
          <button className="att-date-btn" onClick={() => shiftDate(1)} type="button">
            <span className="material-symbols-outlined icon-sm">chevron_right</span>
          </button>
          {selectedDate !== today && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setSelectedDate(today)}
              type="button"
            >
              오늘
            </button>
          )}
        </div>

        <div className="att-summary">
          <span>수업 <strong>{dayRecords.length}</strong>건</span>
          <span>총 순수수업 <strong>{totalNet}</strong>분</span>
          {totalPaused > 0 && <span>총 정지 <strong>{totalPaused}</strong>분</span>}
          {lateCount > 0 && <span style={{ color: 'var(--danger)' }}>지각 <strong>{lateCount}</strong></span>}
        </div>
      </div>

      <div className="att-table-wrap">
        <div className="att-row att-row--header">
          <div className="att-cell">이름</div>
          <div className="att-cell">학년</div>
          <div className="att-cell">등원</div>
          <div className="att-cell">하원</div>
          <div className="att-cell">순수수업</div>
          <div className="att-cell">예정</div>
          <div className="att-cell">정지</div>
          <div className="att-cell"></div>
        </div>

        {dayRecords.length === 0 ? (
          <div className="att-no-data">
            <span className="material-symbols-outlined" style={{ fontSize: '32px', opacity: 0.3, display: 'block', marginBottom: '8px' }}>
              event_busy
            </span>
            해당 날짜의 출석 기록이 없습니다
          </div>
        ) : (
          dayRecords.map((record) => (
            <div key={record.id}>
              <div className="att-row">
                <div className="att-cell att-cell--name">{record.studentName}</div>
                <div className="att-cell">
                  <span className={`grade-badge ${gradeClassMap[record.grade]}`}>{record.grade}</span>
                </div>
                <div className={`att-cell ${record.wasLate ? 'att-cell--late' : ''}`}>
                  {formatTimeHM(record.checkInTime)}
                </div>
                <div className="att-cell">{formatTimeHM(record.checkOutTime)}</div>
                <div className="att-cell" style={{ fontWeight: 600 }}>{record.netMinutes}분</div>
                <div className="att-cell">{record.scheduledMinutes}분</div>
                <div className={`att-cell ${record.totalPausedMinutes > 0 ? 'att-cell--paused' : ''}`}>
                  {record.totalPausedMinutes > 0 ? `${record.totalPausedMinutes}분` : '—'}
                </div>
                <div className="att-cell">
                  <button
                    className="att-detail-toggle"
                    onClick={() => setExpandedId(expandedId === record.id ? null : record.id)}
                    type="button"
                  >
                    <span className="material-symbols-outlined">
                      {expandedId === record.id ? 'expand_less' : 'expand_more'}
                    </span>
                    상세
                  </button>
                </div>
              </div>

              {expandedId === record.id && (
                <div className="att-detail-row">
                  <div>
                    예정 시간: {record.scheduledStartTime} — {record.scheduledEndTime} ({record.scheduledMinutes}분)
                  </div>
                  <div>
                    실제 등원: {formatTimeHM(record.checkInTime)}
                    {record.wasLate && <span style={{ color: 'var(--danger)', marginLeft: '8px' }}>지각</span>}
                  </div>
                  <div>
                    실제 하원: {formatTimeHM(record.checkOutTime)}
                    {record.wasOvertime && <span style={{ color: 'var(--danger)', marginLeft: '8px' }}>초과수업</span>}
                  </div>
                  <div>순수 수업시간: <strong>{record.netMinutes}분</strong></div>
                  {record.pauseCount > 0 && (
                    <div>
                      일시정지 {record.pauseCount}회 (총 {record.totalPausedMinutes}분):
                      <ul style={{ margin: '4px 0 0 20px', padding: 0 }}>
                        {record.pauseHistory.map((p, i) => (
                          <li key={i}>
                            {formatTimeHM(p.pausedAt)}
                            {p.resumedAt ? ` — ${formatTimeHM(p.resumedAt)}` : ' (종료 시 해제)'}
                            {p.reason && ` (${p.reason})`}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {record.note && <div>메모: {record.note}</div>}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
