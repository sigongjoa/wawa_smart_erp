import { AttendanceSummary as AttendanceData } from '../api';

interface Props {
  data: AttendanceData;
}

export default function AttendanceSummary({ data }: Props) {
  return (
    <div className="attendance-summary">
      <div className="attendance-rate">
        <span className="attendance-rate-value">{data.attendanceRate}%</span>
        <span className="attendance-rate-label">출석률</span>
      </div>

      <div className="attendance-stats">
        <div className="stat-item">
          <span className="stat-label">출석</span>
          <span className="stat-value stat-present">{data.present}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">결석</span>
          <span className="stat-value stat-absent">{data.absent}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">지각</span>
          <span className="stat-value stat-late">{data.late}</span>
        </div>
      </div>

      {(data.makeups.completed > 0 || data.makeups.pending > 0) && (
        <div className="attendance-makeups">
          <span>보강: 완료 {data.makeups.completed} / 대기 {data.makeups.pending}</span>
        </div>
      )}

      {data.recentAbsences.length > 0 && (
        <div className="attendance-absences">
          <strong>최근 결석</strong>
          {data.recentAbsences.slice(0, 3).map((a, i) => (
            <div key={i} className="absence-row">
              <span>{a.date}</span>
              {a.reason && <span className="absence-reason">{a.reason}</span>}
              {!a.reason && <span className="absence-reason">사유 없음</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
