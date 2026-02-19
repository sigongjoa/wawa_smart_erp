import { useState, useEffect, useMemo } from 'react';
import { useMakeupStore } from '../../stores/makeupStore';
import type { MakeupRecord } from '../../types';
import PageHeader from '../../components/common/PageHeader';
import KakaoShareModal from './components/KakaoShareModal';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

interface DayInfo {
  fullDate: string;  // YYYY-MM-DD
  date: number;
  weekdayIndex: number;
  isToday: boolean;
}

function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function MakeupShare() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const { records, isLoading, fetchRecords } = useMakeupStore();

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const todayStr = useMemo(() => toLocalDateStr(new Date()), []);

  // 이번 주 일요일 기준으로 2주(14일) 배열 생성
  const twoWeekDays = useMemo<DayInfo[]>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // 이번 주 일요일 구하기
    const thisSunday = new Date(today);
    thisSunday.setDate(today.getDate() - today.getDay());
    // weekOffset 적용 (단위: 2주)
    thisSunday.setDate(thisSunday.getDate() + weekOffset * 14);

    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date(thisSunday);
      d.setDate(thisSunday.getDate() + i);
      return {
        fullDate: toLocalDateStr(d),
        date: d.getDate(),
        weekdayIndex: d.getDay(),
        isToday: toLocalDateStr(d) === todayStr,
      };
    });
  }, [weekOffset, todayStr]);

  // makeupDate 기준으로 보강 그룹핑
  const recordsByDate = useMemo(() => {
    const map = new Map<string, MakeupRecord[]>();
    for (const r of records) {
      if (!r.makeupDate) continue;
      const key = r.makeupDate.slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return map;
  }, [records]);

  // 기간 텍스트
  const dateRangeText = useMemo(() => {
    if (twoWeekDays.length < 14) return '';
    const fmt = (fullDate: string) => {
      const [, m, d] = fullDate.split('-');
      return `${parseInt(m)}월 ${parseInt(d)}일`;
    };
    const [sy, sm] = twoWeekDays[0].fullDate.split('-');
    const [ey] = twoWeekDays[13].fullDate.split('-');
    const yearPrefix = sy !== ey ? `${sy}년 ` : `${sy}년 `;
    return `${yearPrefix}${fmt(twoWeekDays[0].fullDate)} ~ ${fmt(twoWeekDays[13].fullDate)}`;
  }, [twoWeekDays]);

  return (
    <div>
      <PageHeader title="카톡 공유" description="보강 일정을 선택하여 카카오톡으로 공유합니다" />

      {/* 네비게이션 */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{
          padding: '1rem 1.5rem',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setWeekOffset(prev => prev - 1)}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>chevron_left</span>
            이전 2주
          </button>
          <span style={{ fontWeight: 600, fontSize: '1rem' }}>{dateRangeText}</span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => { setWeekOffset(0); setSelectedDate(null); }}
            >
              오늘
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setWeekOffset(prev => prev + 1)}>
              다음 2주
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>chevron_right</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2주 그리드 */}
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

          {/* 날짜 셀 (2행 x 7열) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
            {twoWeekDays.map((day, idx) => {
              const dayRecords = recordsByDate.get(day.fullDate) || [];
              const isSelected = day.fullDate === selectedDate;
              const isWeekend = day.weekdayIndex === 0 || day.weekdayIndex === 6;
              const isSunday = day.weekdayIndex === 0;

              return (
                <div
                  key={day.fullDate}
                  onClick={() => setSelectedDate(day.fullDate)}
                  style={{
                    minHeight: '80px',
                    padding: '8px',
                    borderBottom: idx < 7 ? '1px solid var(--border)' : 'none',
                    borderRight: day.weekdayIndex < 6 ? '1px solid var(--border)' : 'none',
                    backgroundColor: isSelected ? 'var(--primary-light, #eef2ff)' : 'transparent',
                    cursor: 'pointer',
                    transition: 'background-color 0.15s',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  {/* 날짜 숫자 */}
                  <div style={{
                    fontSize: '0.875rem',
                    fontWeight: day.isToday ? 700 : 400,
                    color: isSunday ? 'var(--danger)' : isWeekend ? '#3b82f6' : 'var(--text-primary)',
                  }}>
                    {day.isToday ? (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: 26, height: 26, borderRadius: '50%',
                        backgroundColor: 'var(--primary)', color: '#fff', fontSize: '0.8rem',
                      }}>
                        {day.date}
                      </span>
                    ) : day.date}
                  </div>

                  {/* 보강 건수 뱃지 */}
                  {dayRecords.length > 0 && (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.7rem', fontWeight: 600,
                      padding: '2px 6px', borderRadius: '10px',
                      backgroundColor: '#fef3c7', color: '#92400e',
                    }}>
                      {dayRecords.length}건
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {isLoading && (
        <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
          보강 데이터 로딩 중...
        </div>
      )}

      {/* 안내 문구 */}
      {!selectedDate && !isLoading && (
        <div style={{
          marginTop: '1rem', padding: '1.5rem', textAlign: 'center',
          color: 'var(--text-secondary)', fontSize: '0.875rem',
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: 32, marginBottom: '0.5rem', display: 'block' }}>
            touch_app
          </span>
          날짜를 클릭하면 보강 일정을 카카오톡으로 공유할 수 있습니다
        </div>
      )}

      {/* KakaoShareModal */}
      {selectedDate && (
        <KakaoShareModal
          date={selectedDate}
          records={recordsByDate.get(selectedDate) || []}
          onClose={() => setSelectedDate(null)}
        />
      )}
    </div>
  );
}
