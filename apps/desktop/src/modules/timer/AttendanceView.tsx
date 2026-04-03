import { useState, useMemo } from 'react';
import { useAppStore } from '../../stores/appStore';
import type { AttendanceRecord, PauseRecord } from '../../types';

function formatTime(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} (${days[d.getDay()]})`;
}

function TimelineItem({ time, label, type }: { time: string; label: string; type: 'active' | 'pause' | 'end' | 'default' }) {
  return (
    <div className={`att-timeline-item att-timeline-${type}`}>
      <span className="att-timeline-time">{time}</span>
      <span className="att-timeline-label">{label}</span>
    </div>
  );
}

function buildTimeline(record: AttendanceRecord) {
  const items: { time: string; label: string; type: 'active' | 'pause' | 'end' | 'default' }[] = [];

  items.push({ time: formatTime(record.checkInTime), label: '등원 (수업 시작)', type: 'active' });

  // Interleave class segments and pauses
  let lastTime = record.checkInTime;
  for (const pause of record.pauseHistory) {
    const classMin = Math.round((new Date(pause.pausedAt).getTime() - new Date(lastTime).getTime()) / 60000);
    items.push({ time: `${formatTime(lastTime)} ~ ${formatTime(pause.pausedAt)}`, label: `수업 (${classMin}분)`, type: 'default' });
    const resumeTime = pause.resumedAt || record.checkOutTime;
    const pauseMin = Math.round((new Date(resumeTime).getTime() - new Date(pause.pausedAt).getTime()) / 60000);
    items.push({ time: `${formatTime(pause.pausedAt)} ~ ${formatTime(resumeTime)}`, label: `일시정지 (${pauseMin}분)${pause.reason ? ` — ${pause.reason}` : ''}`, type: 'pause' });
    lastTime = resumeTime;
  }

  // Final class segment
  const finalMin = Math.round((new Date(record.checkOutTime).getTime() - new Date(lastTime).getTime()) / 60000);
  if (finalMin > 0) {
    items.push({ time: `${formatTime(lastTime)} ~ ${formatTime(record.checkOutTime)}`, label: `수업 (${finalMin}분)`, type: 'default' });
  }

  items.push({ time: formatTime(record.checkOutTime), label: '하원 (수업 완료)', type: 'end' });

  return items;
}

function RecordCard({ record, expanded, onToggle }: { record: AttendanceRecord; expanded: boolean; onToggle: () => void }) {
  const timeline = useMemo(() => buildTimeline(record), [record]);

  return (
    <div className="att-record-card">
      <div className="att-record-header" onClick={onToggle}>
        <div className="att-record-top">
          <span className="att-record-name">{record.studentName}</span>
          <span className="att-record-grade">{record.grade}</span>
          {record.subject && <span className="att-record-subject">{record.subject}</span>}
        </div>
        <div className="att-record-summary">
          <span>{formatTime(record.checkInTime)} ~ {formatTime(record.checkOutTime)}</span>
          <span className="att-record-net">순수 {record.netMinutes}분 / 예정 {record.scheduledMinutes}분</span>
          {record.totalPausedMinutes > 0 && (
            <span className="att-record-paused">정지 {record.totalPausedMinutes}분 ({record.pauseCount}회)</span>
          )}
          {record.wasOvertime && <span className="att-record-overtime">초과</span>}
        </div>
        <span className="material-symbols-outlined att-record-chevron">{expanded ? 'expand_less' : 'expand_more'}</span>
      </div>

      {expanded && (
        <div className="att-record-detail">
          <div className="att-timeline">
            {timeline.map((item, i) => (
              <TimelineItem key={i} {...item} />
            ))}
          </div>

          <div className="att-summary-grid">
            <div className="att-summary-row">
              <span>순수 수업시간</span>
              <strong>{record.netMinutes}분</strong>
            </div>
            <div className="att-summary-row">
              <span>총 정지시간</span>
              <span style={{ color: 'var(--warning)', fontWeight: 600 }}>
                {record.totalPausedMinutes}분 ({record.pauseCount}회)
              </span>
            </div>
            <div className="att-summary-row">
              <span>예정 대비</span>
              <span style={{ color: record.wasOvertime ? 'var(--danger)' : 'var(--success)', fontWeight: 600 }}>
                {record.wasOvertime ? `+${record.netMinutes - record.scheduledMinutes}분 초과` : '정상 완료'}
              </span>
            </div>
            {record.note && (
              <div className="att-summary-row">
                <span>메모</span>
                <span>{record.note}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AttendanceView() {
  const attendanceRecords = useAppStore((s) => s.attendanceRecords);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Group records by date
  const recordsByDate = useMemo(() => {
    const map = new Map<string, AttendanceRecord[]>();
    for (const r of attendanceRecords) {
      const list = map.get(r.date) || [];
      list.push(r);
      map.set(r.date, list);
    }
    return map;
  }, [attendanceRecords]);

  const dates = useMemo(() => {
    return Array.from(recordsByDate.keys()).sort().reverse();
  }, [recordsByDate]);

  const currentRecords = recordsByDate.get(selectedDate) || [];

  // Date navigation
  const goDate = (offset: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + offset);
    setSelectedDate(d.toISOString().split('T')[0]);
    setExpandedId(null);
  };

  return (
    <div className="att-container">
      <div className="page-header">
        <h1 className="page-title">출석 기록</h1>
        <p className="page-subtitle">수업 완료 후 자동 생성된 출석 기록을 확인합니다</p>
      </div>

      {/* Date picker */}
      <div className="att-date-nav">
        <button className="att-date-btn" onClick={() => goDate(-1)}>
          <span className="material-symbols-outlined">chevron_left</span>
        </button>
        <input
          type="date"
          className="att-date-input"
          value={selectedDate}
          onChange={(e) => { setSelectedDate(e.target.value); setExpandedId(null); }}
        />
        <span className="att-date-display">{formatDate(selectedDate)}</span>
        <button className="att-date-btn" onClick={() => goDate(1)}>
          <span className="material-symbols-outlined">chevron_right</span>
        </button>
        <button className="att-date-btn att-date-today" onClick={() => { setSelectedDate(new Date().toISOString().split('T')[0]); setExpandedId(null); }}>
          오늘
        </button>
      </div>

      {/* Stats */}
      <div className="att-stats">
        <div className="att-stat">
          <span className="att-stat-value">{currentRecords.length}</span>
          <span className="att-stat-label">총 수업</span>
        </div>
        <div className="att-stat">
          <span className="att-stat-value">{currentRecords.filter(r => r.totalPausedMinutes > 0).length}</span>
          <span className="att-stat-label">정지 있음</span>
        </div>
        <div className="att-stat">
          <span className="att-stat-value">{currentRecords.filter(r => r.wasOvertime).length}</span>
          <span className="att-stat-label">초과</span>
        </div>
      </div>

      {/* Records */}
      {currentRecords.length === 0 ? (
        <div className="att-empty">
          <span className="material-symbols-outlined" style={{ fontSize: 48, color: 'var(--text-tertiary)' }}>event_busy</span>
          <p>이 날짜에 출석 기록이 없습니다</p>
          {dates.length > 0 && (
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 8 }}>
              최근 기록: {dates.slice(0, 3).map(d => formatDate(d)).join(', ')}
            </p>
          )}
        </div>
      ) : (
        <div className="att-records">
          {currentRecords.map((record) => (
            <RecordCard
              key={record.id}
              record={record}
              expanded={expandedId === record.id}
              onToggle={() => setExpandedId(expandedId === record.id ? null : record.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
