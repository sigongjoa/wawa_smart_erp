import { useState, useEffect, useMemo } from 'react';
import { useMakeupStore } from '../../stores/makeupStore';
import { useReportStore } from '../../stores/reportStore';
import { getTeacherName } from '../../constants/common';
import type { MakeupRecord } from '../../types';
import PageHeader from '../../components/common/PageHeader';

export const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export function getMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();

  const days: Array<{ date: number; month: 'prev' | 'current' | 'next'; fullDate: string }> = [];

  // 이전 달
  for (let i = firstDay - 1; i >= 0; i--) {
    const d = prevMonthDays - i;
    const m = month === 0 ? 11 : month - 1;
    const y = month === 0 ? year - 1 : year;
    days.push({ date: d, month: 'prev', fullDate: `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}` });
  }

  // 현재 달
  for (let d = 1; d <= daysInMonth; d++) {
    days.push({ date: d, month: 'current', fullDate: `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}` });
  }

  // 다음 달 (6줄 맞추기)
  const remaining = 42 - days.length;
  for (let d = 1; d <= remaining; d++) {
    const m = month === 11 ? 0 : month + 1;
    const y = month === 11 ? year + 1 : year;
    days.push({ date: d, month: 'next', fullDate: `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}` });
  }

  return days;
}

export const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  '시작 전': { bg: '#fef3c7', text: '#92400e', dot: '#f59e0b' },
  '진행 중': { bg: '#dbeafe', text: '#1e40af', dot: '#3b82f6' },
  '완료': { bg: '#d1fae5', text: '#065f46', dot: '#10b981' },
};

export default function MakeupCalendar() {
  const { records, isLoading, fetchRecords } = useMakeupStore();
  const { teachers, currentUser } = useReportStore();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const days = useMemo(() => getMonthDays(year, month), [year, month]);

  // 날짜별 보강 기록 맵
  const recordsByDate = useMemo(() => {
    const map = new Map<string, MakeupRecord[]>();
    for (const r of records) {
      // makeupDate가 있으면 그 날짜에, 없으면 absentDate에 표시
      const dateKey = r.makeupDate || r.absentDate;
      if (!dateKey) continue;
      const normalized = dateKey.slice(0, 10); // YYYY-MM-DD
      if (!map.has(normalized)) map.set(normalized, []);
      map.get(normalized)!.push(r);
    }
    return map;
  }, [records]);

  const todayStr = new Date().toISOString().slice(0, 10);

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToday = () => setCurrentDate(new Date());

  const selectedRecords = selectedDate ? (recordsByDate.get(selectedDate) || []) : [];

  return (
    <div>
      <PageHeader title="보강 캘린더" description="월별 보강 일정을 캘린더로 확인합니다" />

      {/* 캘린더 네비게이션 */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button className="btn btn-ghost btn-sm" onClick={prevMonth}>
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>chevron_left</span>
            </button>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, minWidth: '140px', textAlign: 'center' }}>
              {year}년 {month + 1}월
            </h2>
            <button className="btn btn-ghost btn-sm" onClick={nextMonth}>
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>chevron_right</span>
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button className="btn btn-secondary btn-sm" onClick={goToday}>오늘</button>
            <div style={{ display: 'flex', gap: '1rem', marginLeft: '1rem', fontSize: '0.75rem' }}>
              {Object.entries(STATUS_COLORS).map(([status, colors]) => (
                <span key={status} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: colors.dot }} />
                  {status}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 캘린더 그리드 */}
      <div className="card">
        <div style={{ padding: '0.5rem' }}>
          {/* 요일 헤더 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--border)' }}>
            {WEEKDAYS.map((day, i) => (
              <div key={day} style={{
                padding: '0.5rem',
                textAlign: 'center',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: i === 0 ? 'var(--danger)' : i === 6 ? '#3b82f6' : 'var(--text-secondary)',
              }}>
                {day}
              </div>
            ))}
          </div>

          {/* 날짜 셀 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
            {days.map((day, idx) => {
              const dayRecords = recordsByDate.get(day.fullDate) || [];
              const isToday = day.fullDate === todayStr;
              const isSelected = day.fullDate === selectedDate;
              const dayOfWeek = idx % 7;

              return (
                <div
                  key={idx}
                  onClick={() => setSelectedDate(day.fullDate === selectedDate ? null : day.fullDate)}
                  style={{
                    minHeight: '90px',
                    padding: '4px 6px',
                    borderBottom: idx < 35 ? '1px solid var(--border)' : 'none',
                    borderRight: dayOfWeek < 6 ? '1px solid var(--border)' : 'none',
                    backgroundColor: isSelected ? 'var(--primary-light, #eef2ff)' : day.month !== 'current' ? '#fafafa' : 'transparent',
                    cursor: 'pointer',
                    transition: 'background-color 0.15s',
                  }}
                >
                  <div style={{
                    fontSize: '0.8rem',
                    fontWeight: isToday ? 700 : 400,
                    color: day.month !== 'current' ? '#cbd5e1' : dayOfWeek === 0 ? 'var(--danger)' : dayOfWeek === 6 ? '#3b82f6' : 'var(--text-primary)',
                    marginBottom: '2px',
                  }}>
                    {isToday ? (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: 24, height: 24, borderRadius: '50%',
                        backgroundColor: 'var(--primary)', color: '#fff', fontSize: '0.75rem',
                      }}>
                        {day.date}
                      </span>
                    ) : day.date}
                  </div>

                  {/* 보강 이벤트 뱃지 */}
                  {dayRecords.slice(0, 3).map((r) => {
                    const colors = STATUS_COLORS[r.status] || STATUS_COLORS['시작 전'];
                    const isOwner = currentUser?.teacher.id === r.teacherId;
                    const isAdmin = currentUser?.teacher.isAdmin;
                    const canEdit = isAdmin || isOwner;

                    return (
                      <div key={r.id} style={{
                        fontSize: '0.65rem',
                        padding: '1px 4px',
                        marginBottom: '1px',
                        borderRadius: '3px',
                        backgroundColor: colors.bg,
                        color: colors.text,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        opacity: canEdit ? 1 : 0.6,
                        border: isOwner ? '1px solid currentColor' : 'none',
                      }}>
                        {r.studentName} · {r.subject}
                      </div>
                    );
                  })}
                  {dayRecords.length > 3 && (
                    <div style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                      +{dayRecords.length - 3}건 더
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 선택된 날짜의 상세 정보 */}
      {selectedDate && (
        <div className="card" style={{ marginTop: '1rem' }}>
          <div style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 18, verticalAlign: 'middle', marginRight: 6 }}>event</span>
              {selectedDate} 보강 일정 ({selectedRecords.length}건)
            </h3>
            {selectedRecords.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>해당 날짜에 보강 일정이 없습니다</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>학생</th>
                    <th>과목</th>
                    <th>담당</th>
                    <th>결석일</th>
                    <th>보강시간</th>
                    <th>상태</th>
                    <th>메모</th>
                    <th>권한</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedRecords.map((r) => {
                    const colors = STATUS_COLORS[r.status] || STATUS_COLORS['시작 전'];
                    const isOwner = currentUser?.teacher.id === r.teacherId;
                    const isAdmin = currentUser?.teacher.isAdmin;
                    const canEdit = isAdmin || isOwner;

                    return (
                      <tr key={r.id} style={{ opacity: canEdit ? 1 : 0.8 }}>
                        <td style={{ fontWeight: 500 }}>{r.studentName}</td>
                        <td>{r.subject}</td>
                        <td style={{ fontWeight: isOwner ? 600 : 400 }}>
                          {getTeacherName(teachers, r.teacherId || '')}
                          {isOwner && <span style={{ marginLeft: '4px', fontSize: '10px', color: 'var(--primary)' }}>(나)</span>}
                        </td>
                        <td>{r.absentDate}</td>
                        <td>{r.makeupTime || '-'}</td>
                        <td>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem',
                            backgroundColor: colors.bg, color: colors.text,
                          }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: colors.dot }} />
                            {r.status}
                          </span>
                        </td>
                        <td style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{r.memo || '-'}</td>
                        <td style={{ fontSize: '11px' }}>
                          {canEdit ? (
                            <span style={{ color: 'var(--success)' }}>편집 가능</span>
                          ) : (
                            <span style={{ color: '#94a3b8' }}>읽기 전용</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {isLoading && (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
          로딩 중...
        </div>
      )}
    </div>
  );
}
