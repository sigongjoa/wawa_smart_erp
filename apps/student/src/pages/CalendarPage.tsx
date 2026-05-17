import { useEffect, useMemo, useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Plus, X, Check, Trash2, Pencil } from 'lucide-react';
import { calendarApi, CalendarEvent, CalendarEventInput, EventCategory } from '../api';
import './CalendarPage.css';

const CATEGORY_META: Record<EventCategory, { label: string; color: string; surface: string }> = {
  performance: { label: '수행평가', color: 'var(--type-electric)', surface: 'var(--type-electric-surface)' },
  school_exam: { label: '학교시험', color: 'var(--type-ground)', surface: 'var(--type-ground-surface)' },
  external_exam: { label: '검정고시', color: 'var(--type-dragon)', surface: 'var(--type-dragon-surface)' },
  academy: { label: '학원', color: 'var(--type-water)', surface: 'var(--type-water-surface)' },
  personal: { label: '개인', color: 'var(--type-psychic)', surface: 'var(--type-psychic-surface)' },
};

const CATEGORY_ORDER: EventCategory[] = ['performance', 'school_exam', 'external_exam', 'academy', 'personal'];
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function buildMonthGrid(year: number, month: number): { date: Date; inMonth: boolean }[] {
  const first = new Date(year, month, 1);
  const startDayOfWeek = first.getDay();
  const gridStart = new Date(year, month, 1 - startDayOfWeek);
  const cells: { date: Date; inMonth: boolean }[] = [];
  for (let i = 0; i < 42; i += 1) {
    const d = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
    cells.push({ date: d, inMonth: d.getMonth() === month });
  }
  return cells;
}

function eventCoversDate(ev: CalendarEvent, date: string): boolean {
  const end = ev.end_date ?? ev.start_date;
  return ev.start_date <= date && end >= date;
}

interface EditorState {
  mode: 'create' | 'edit';
  existing?: CalendarEvent;
  initialDate: string;
}

export default function CalendarPage() {
  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState<{ year: number; month: number }>({
    year: today.getFullYear(),
    month: today.getMonth(),
  });
  const [selectedDate, setSelectedDate] = useState<string>(ymd(today));
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [filter, setFilter] = useState<EventCategory | 'all'>('all');

  const monthCells = useMemo(() => buildMonthGrid(cursor.year, cursor.month), [cursor]);
  const rangeFrom = useMemo(() => ymd(monthCells[0].date), [monthCells]);
  const rangeTo = useMemo(() => ymd(monthCells[monthCells.length - 1].date), [monthCells]);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await calendarApi.list(rangeFrom, rangeTo);
      setEvents(res.events);
      setError(null);
    } catch (e) {
      setError((e as Error).message || '일정을 불러오지 못했습니다');
    } finally {
      setLoading(false);
    }
  }, [rangeFrom, rangeTo]);

  useEffect(() => { void reload(); }, [reload]);

  const filteredEvents = useMemo(
    () => (filter === 'all' ? events : events.filter((e) => e.category === filter)),
    [events, filter],
  );

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const cell of monthCells) {
      const key = ymd(cell.date);
      map.set(key, filteredEvents.filter((e) => eventCoversDate(e, key)));
    }
    return map;
  }, [filteredEvents, monthCells]);

  const selectedDayEvents = filteredEvents.filter((e) => eventCoversDate(e, selectedDate));

  const moveMonth = (delta: number) => {
    setCursor((c) => {
      const nm = c.month + delta;
      const year = c.year + Math.floor(nm / 12);
      const month = ((nm % 12) + 12) % 12;
      return { year, month };
    });
  };

  const handleAck = async (ev: CalendarEvent) => {
    try {
      const next = ev.completed_at ? false : true;
      const res = await calendarApi.ack(ev.id, next);
      setEvents((prev) => prev.map((e) => (e.id === ev.id ? { ...e, completed_at: res.completed_at, read_at: e.read_at ?? Date.now() } : e)));
    } catch (e) {
      setError((e as Error).message || '저장 실패');
    }
  };

  const handleDelete = async (ev: CalendarEvent) => {
    try {
      await calendarApi.remove(ev.id);
      setEvents((prev) => prev.filter((e) => e.id !== ev.id));
    } catch (e) {
      setError((e as Error).message || '삭제 실패');
    }
  };

  const monthLabel = `${cursor.year}년 ${cursor.month + 1}월`;
  const todayKey = ymd(today);

  return (
    <div className="cal-page">
      <header className="cal-header">
        <h1 className="cal-title">캘린더</h1>
        <div className="cal-month-nav">
          <button type="button" className="cal-nav-btn" onClick={() => moveMonth(-1)} aria-label="이전 달">
            <ChevronLeft size={20} aria-hidden />
          </button>
          <span className="cal-month-label">{monthLabel}</span>
          <button type="button" className="cal-nav-btn" onClick={() => moveMonth(1)} aria-label="다음 달">
            <ChevronRight size={20} aria-hidden />
          </button>
        </div>
      </header>

      <div className="cal-filters" role="tablist" aria-label="카테고리 필터">
        <button
          type="button"
          role="tab"
          aria-selected={filter === 'all'}
          className={`cal-chip${filter === 'all' ? ' cal-chip--active' : ''}`}
          onClick={() => setFilter('all')}
        >
          전체
        </button>
        {CATEGORY_ORDER.map((c) => (
          <button
            key={c}
            type="button"
            role="tab"
            aria-selected={filter === c}
            className={`cal-chip${filter === c ? ' cal-chip--active' : ''}`}
            onClick={() => setFilter(c)}
            style={filter === c ? { borderColor: CATEGORY_META[c].color, color: CATEGORY_META[c].color } : undefined}
          >
            <span className="cal-chip-dot" style={{ background: CATEGORY_META[c].color }} aria-hidden />
            {CATEGORY_META[c].label}
          </button>
        ))}
      </div>

      {error && (
        <div role="alert" className="cal-error" onClick={() => setError(null)}>
          {error}
        </div>
      )}

      <div className="cal-grid" aria-label="월간 캘린더">
        {WEEKDAYS.map((w, i) => (
          <div key={w} className={`cal-weekday${i === 0 ? ' cal-weekday--sun' : ''}${i === 6 ? ' cal-weekday--sat' : ''}`}>
            {w}
          </div>
        ))}
        {monthCells.map((cell) => {
          const key = ymd(cell.date);
          const dayEvents = eventsByDate.get(key) ?? [];
          const isToday = key === todayKey;
          const isSelected = key === selectedDate;
          const dow = cell.date.getDay();
          return (
            <button
              key={key}
              type="button"
              className={[
                'cal-cell',
                cell.inMonth ? '' : 'cal-cell--dim',
                isToday ? 'cal-cell--today' : '',
                isSelected ? 'cal-cell--selected' : '',
              ].filter(Boolean).join(' ')}
              onClick={() => setSelectedDate(key)}
              aria-label={`${cell.date.getMonth() + 1}월 ${cell.date.getDate()}일${dayEvents.length ? `, 일정 ${dayEvents.length}건` : ''}`}
            >
              <span className={`cal-cell-num${dow === 0 ? ' cal-cell-num--sun' : ''}${dow === 6 ? ' cal-cell-num--sat' : ''}`}>
                {cell.date.getDate()}
              </span>
              <span className="cal-cell-dots">
                {dayEvents.slice(0, 3).map((e) => (
                  <span key={e.id} className="cal-cell-dot" style={{ background: CATEGORY_META[e.category].color }} aria-hidden />
                ))}
                {dayEvents.length > 3 && <span className="cal-cell-more">+{dayEvents.length - 3}</span>}
              </span>
            </button>
          );
        })}
      </div>

      <section className="cal-day" aria-label={`${selectedDate} 일정`}>
        <header className="cal-day-header">
          <h2 className="cal-day-title">{selectedDate.slice(5).replace('-', '월 ')}일</h2>
          <span className="cal-day-count">{selectedDayEvents.length}건</span>
        </header>
        {loading && <div className="cal-day-empty">불러오는 중…</div>}
        {!loading && selectedDayEvents.length === 0 && (
          <div className="cal-day-empty">등록된 일정이 없습니다</div>
        )}
        <ul className="cal-day-list">
          {selectedDayEvents.map((ev) => {
            const meta = CATEGORY_META[ev.category];
            const isMine = ev.owner_type === 'student';
            const isCompleted = !!ev.completed_at;
            return (
              <li key={ev.id} className="cal-event" style={{ borderLeftColor: meta.color }}>
                <div className="cal-event-main">
                  <div className="cal-event-meta">
                    <span className="cal-event-tag" style={{ background: meta.surface, color: meta.color }}>
                      {meta.label}
                    </span>
                    <span className="cal-event-date">
                      {ev.start_date.slice(5)}{ev.end_date && ev.end_date !== ev.start_date ? ` ~ ${ev.end_date.slice(5)}` : ''}
                    </span>
                  </div>
                  <h3 className="cal-event-title">{ev.title}</h3>
                  {ev.memo && <p className="cal-event-memo">{ev.memo}</p>}
                  {ev.link && (
                    <a className="cal-event-link" href={ev.link} target="_blank" rel="noreferrer">
                      링크 열기
                    </a>
                  )}
                </div>
                <div className="cal-event-actions">
                  {!isMine && (
                    <button
                      type="button"
                      className={`cal-event-ack${isCompleted ? ' cal-event-ack--done' : ''}`}
                      onClick={() => handleAck(ev)}
                      aria-pressed={isCompleted}
                    >
                      <Check size={16} aria-hidden />
                      {isCompleted ? '제출함' : '확인'}
                    </button>
                  )}
                  {isMine && (
                    <>
                      <button
                        type="button"
                        className="cal-icon-btn"
                        onClick={() => setEditor({ mode: 'edit', existing: ev, initialDate: ev.start_date })}
                        aria-label="수정"
                      >
                        <Pencil size={16} aria-hidden />
                      </button>
                      <button
                        type="button"
                        className="cal-icon-btn cal-icon-btn--danger"
                        onClick={() => handleDelete(ev)}
                        aria-label="삭제"
                      >
                        <Trash2 size={16} aria-hidden />
                      </button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <button
        type="button"
        className="cal-fab"
        onClick={() => setEditor({ mode: 'create', initialDate: selectedDate })}
        aria-label="일정 추가"
      >
        <Plus size={24} aria-hidden />
      </button>

      {editor && (
        <EditorModal
          state={editor}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
            void reload();
          }}
          onError={(msg) => setError(msg)}
        />
      )}
    </div>
  );
}

interface EditorModalProps {
  state: EditorState;
  onClose: () => void;
  onSaved: () => void;
  onError: (msg: string) => void;
}

function EditorModal({ state, onClose, onSaved, onError }: EditorModalProps) {
  const existing = state.existing;
  const [category, setCategory] = useState<EventCategory>(existing?.category ?? 'personal');
  const [title, setTitle] = useState<string>(existing?.title ?? '');
  const [memo, setMemo] = useState<string>(existing?.memo ?? '');
  const [link, setLink] = useState<string>(existing?.link ?? '');
  const [startDate, setStartDate] = useState<string>(existing?.start_date ?? state.initialDate);
  const [endDate, setEndDate] = useState<string>(existing?.end_date ?? '');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!title.trim()) { onError('제목을 입력해주세요'); return; }
    if (!startDate) { onError('시작 날짜를 입력해주세요'); return; }
    if (endDate && endDate < startDate) { onError('종료일은 시작일 이후여야 합니다'); return; }
    const payload: CalendarEventInput = {
      category,
      title: title.trim(),
      memo: memo.trim() ? memo.trim() : null,
      link: link.trim() ? link.trim() : null,
      start_date: startDate,
      end_date: endDate || null,
    };
    setSaving(true);
    try {
      if (state.mode === 'edit' && existing) {
        await calendarApi.update(existing.id, payload);
      } else {
        await calendarApi.create(payload);
      }
      onSaved();
    } catch (e) {
      onError((e as Error).message || '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="cal-modal-overlay" role="dialog" aria-modal="true" aria-label="일정 편집" onClick={onClose}>
      <div className="cal-modal" onClick={(e) => e.stopPropagation()}>
        <header className="cal-modal-header">
          <h2 className="cal-modal-title">{state.mode === 'edit' ? '일정 수정' : '새 일정'}</h2>
          <button type="button" className="cal-icon-btn" onClick={onClose} aria-label="닫기">
            <X size={20} aria-hidden />
          </button>
        </header>
        <div className="cal-modal-body">
          <label className="cal-field">
            <span className="cal-field-label">카테고리</span>
            <div className="cal-category-grid">
              {CATEGORY_ORDER.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`cal-category-btn${category === c ? ' cal-category-btn--active' : ''}`}
                  style={category === c ? { borderColor: CATEGORY_META[c].color, background: CATEGORY_META[c].surface, color: CATEGORY_META[c].color } : undefined}
                  onClick={() => setCategory(c)}
                  aria-pressed={category === c}
                >
                  <span className="cal-chip-dot" style={{ background: CATEGORY_META[c].color }} aria-hidden />
                  {CATEGORY_META[c].label}
                </button>
              ))}
            </div>
          </label>

          <label className="cal-field">
            <span className="cal-field-label">제목</span>
            <input
              type="text"
              className="cal-input"
              value={title}
              maxLength={200}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예) 사회 수행평가 제출"
            />
          </label>

          <div className="cal-field-row">
            <label className="cal-field">
              <span className="cal-field-label">시작</span>
              <input type="date" className="cal-input" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </label>
            <label className="cal-field">
              <span className="cal-field-label">종료 (선택)</span>
              <input type="date" className="cal-input" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </label>
          </div>

          <label className="cal-field">
            <span className="cal-field-label">메모 (선택)</span>
            <textarea
              className="cal-textarea"
              value={memo}
              maxLength={2000}
              rows={3}
              onChange={(e) => setMemo(e.target.value)}
            />
          </label>

          <label className="cal-field">
            <span className="cal-field-label">링크 (선택)</span>
            <input type="url" className="cal-input" value={link} maxLength={500} onChange={(e) => setLink(e.target.value)} placeholder="https://" />
          </label>
        </div>
        <footer className="cal-modal-footer">
          <button type="button" className="cal-btn cal-btn--ghost" onClick={onClose} disabled={saving}>취소</button>
          <button type="button" className="cal-btn cal-btn--primary" onClick={submit} disabled={saving}>
            {saving ? '저장 중…' : '저장'}
          </button>
        </footer>
      </div>
    </div>
  );
}
