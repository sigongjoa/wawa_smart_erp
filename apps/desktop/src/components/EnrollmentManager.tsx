import { useState, useEffect } from 'react';
import { api } from '../api';

interface Enrollment {
  id: string;
  studentId: string;
  day: string;
  startTime: string;
  endTime: string;
  subject?: string | null;
}

const DAYS = ['월', '화', '수', '목', '금', '토', '일'];

interface Props {
  studentId: string;
  studentName: string;
}

export default function EnrollmentManager({ studentId, studentName }: Props) {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  // 새 시간표 입력
  const [newDay, setNewDay] = useState('');
  const [newStart, setNewStart] = useState('');
  const [newEnd, setNewEnd] = useState('');
  const [newSubject, setNewSubject] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadEnrollments();
  }, [studentId]);

  const loadEnrollments = () => {
    setLoading(true);
    api.listEnrollments(studentId).then((data) => {
      setEnrollments(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  const handleAdd = async () => {
    if (!newDay || !newStart || !newEnd) return;
    setSaving(true);
    try {
      await api.createEnrollment({
        studentId,
        day: newDay,
        startTime: newStart,
        endTime: newEnd,
        subject: newSubject.trim() || undefined,
      });
      setShowAdd(false);
      setNewDay('');
      setNewStart('');
      setNewEnd('');
      setNewSubject('');
      loadEnrollments();
    } catch (err: any) {
      alert(err.message || '시간표 추가 실패');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteEnrollment(id);
      loadEnrollments();
    } catch (err: any) {
      alert(err.message || '삭제 실패');
    }
  };

  // 요일별로 그룹화
  const grouped = DAYS.map((day) => ({
    day,
    items: enrollments.filter((e) => e.day === day).sort((a, b) => a.startTime.localeCompare(b.startTime)),
  })).filter((g) => g.items.length > 0);

  return (
    <section className="dashboard-section enroll-section">
      <div className="section-title-row">
        <h3>수강 시간표</h3>
        <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(!showAdd)}>
          {showAdd ? '닫기' : '+ 시간표 추가'}
        </button>
      </div>

      {/* 추가 폼 (인라인) */}
      {showAdd && (
        <div className="enroll-add-form">
          <select
            className="form-select form-select--sm"
            value={newDay}
            onChange={(e) => setNewDay(e.target.value)}
          >
            <option value="">요일</option>
            {DAYS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <input
            className="form-input form-input--sm"
            type="time"
            value={newStart}
            onChange={(e) => setNewStart(e.target.value)}
            placeholder="시작"
          />
          <input
            className="form-input form-input--sm"
            type="time"
            value={newEnd}
            onChange={(e) => setNewEnd(e.target.value)}
            placeholder="종료"
          />
          <input
            className="form-input form-input--sm"
            placeholder="과목"
            value={newSubject}
            onChange={(e) => setNewSubject(e.target.value)}
            style={{ maxWidth: 100 }}
          />
          <button
            className="btn btn-accent btn-sm"
            onClick={handleAdd}
            disabled={saving || !newDay || !newStart || !newEnd}
          >
            {saving ? '...' : '추가'}
          </button>
        </div>
      )}

      {/* 시간표 목록 */}
      {loading ? (
        <p className="no-data">불러오는 중...</p>
      ) : grouped.length === 0 ? (
        <div className="enroll-empty">
          <p>등록된 시간표가 없습니다</p>
          {!showAdd && (
            <button className="btn btn-ghost btn-sm" onClick={() => setShowAdd(true)}>
              시간표 등록하기
            </button>
          )}
        </div>
      ) : (
        <div className="enroll-grid">
          {grouped.map(({ day, items }) => (
            <div key={day} className="enroll-day-group">
              <div className="enroll-day-label">{day}</div>
              <div className="enroll-day-items">
                {items.map((e) => (
                  <div key={e.id} className="enroll-item">
                    <span className="enroll-item-time">{e.startTime}~{e.endTime}</span>
                    {e.subject && <span className="enroll-item-subject">{e.subject}</span>}
                    <button
                      className="enroll-item-delete"
                      onClick={() => handleDelete(e.id)}
                      title="삭제"
                      aria-label={`${day} ${e.startTime} 시간표 삭제`}
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
