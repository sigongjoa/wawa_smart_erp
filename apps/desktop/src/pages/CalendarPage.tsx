import { useEffect, useMemo, useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Plus, Trash2, Pencil, Users, CalendarRange } from 'lucide-react';
import Modal from '../components/Modal';
import { useConfirm } from '../components/Toast';
import {
  calendarApi,
  type CalendarEvent,
  type CalendarEventInput,
  type CalendarCategory,
  type CalendarWidgetEvent,
} from '../api';
import './CalendarPage.css';

const CATEGORY_META: Record<CalendarCategory, { label: string; color: string }> = {
  performance: { label: '수행평가', color: 'var(--type-electric, #FAC000)' },
  school_exam: { label: '학교시험', color: 'var(--type-ground, #915121)' },
  external_exam: { label: '검정고시·공인시험', color: 'var(--type-dragon, #5060E1)' },
  academy: { label: '학원일정', color: 'var(--type-water, #2980EF)' },
  personal: { label: '학생 개인', color: 'var(--type-psychic, #F584A8)' },
};
const CATEGORY_ORDER: CalendarCategory[] = ['performance', 'school_exam', 'external_exam', 'academy', 'personal'];
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

function buildMonthGrid(year: number, month: number): { date: Date; inMonth: boolean }[] {
  const first = new Date(year, month, 1);
  const startDayOfWeek = first.getDay();
  const gridStart = addDays(first, -startDayOfWeek);
  const cells: { date: Date; inMonth: boolean }[] = [];
  for (let i = 0; i < 42; i += 1) {
    const d = addDays(gridStart, i);
    cells.push({ date: d, inMonth: d.getMonth() === month });
  }
  return cells;
}

function eventCoversDate(ev: { start_date: string; end_date: string | null }, date: string): boolean {
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
  const [widget, setWidget] = useState<CalendarWidgetEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const { confirm, ConfirmDialog } = useConfirm();

  const monthCells = useMemo(() => buildMonthGrid(cursor.year, cursor.month), [cursor]);
  const rangeFrom = useMemo(() => ymd(monthCells[0].date), [monthCells]);
  const rangeTo = useMemo(() => ymd(monthCells[monthCells.length - 1].date), [monthCells]);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [evRes, widRes] = await Promise.all([
        calendarApi.list(rangeFrom, rangeTo),
        calendarApi.widget(ymd(today), ymd(addDays(today, 7))),
      ]);
      setEvents(evRes.events);
      setWidget(widRes.events);
      setError(null);
    } catch (e) {
      setError((e as Error).message || '일정을 불러오지 못했습니다');
    } finally {
      setLoading(false);
    }
  }, [rangeFrom, rangeTo, today]);

  useEffect(() => { void reload(); }, [reload]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const cell of monthCells) {
      const key = ymd(cell.date);
      map.set(key, events.filter((e) => eventCoversDate(e, key)));
    }
    return map;
  }, [events, monthCells]);

  const selectedDayEvents = events.filter((e) => eventCoversDate(e, selectedDate));

  const moveMonth = (delta: number) => {
    setCursor((c) => {
      const nm = c.month + delta;
      const year = c.year + Math.floor(nm / 12);
      const month = ((nm % 12) + 12) % 12;
      return { year, month };
    });
  };

  const handleDelete = async (ev: CalendarEvent) => {
    if (!(await confirm('이 일정을 삭제할까요?'))) return;
    try {
      await calendarApi.remove(ev.id);
      setEvents((prev) => prev.filter((e) => e.id !== ev.id));
      void reload();
    } catch (e) {
      setError((e as Error).message || '삭제 실패');
    }
  };

  const monthLabel = `${cursor.year}년 ${cursor.month + 1}월`;
  const todayKey = ymd(today);

  // 위젯: 오늘/내일/이번 주
  const widgetBuckets = useMemo(() => {
    const tomorrowKey = ymd(addDays(today, 1));
    const weekEndKey = ymd(addDays(today, 7));
    const today_: CalendarWidgetEvent[] = [];
    const tomorrow_: CalendarWidgetEvent[] = [];
    const week_: CalendarWidgetEvent[] = [];
    for (const ev of widget) {
      if (eventCoversDate(ev, todayKey)) today_.push(ev);
      else if (eventCoversDate(ev, tomorrowKey)) tomorrow_.push(ev);
      else if (ev.start_date <= weekEndKey && (ev.end_date ?? ev.start_date) >= todayKey) week_.push(ev);
    }
    return { today: today_, tomorrow: tomorrow_, week: week_ };
  }, [widget, today, todayKey]);

  return (
    <div className="dcal-page">
      <header className="dcal-page-header">
        <div>
          <h1 className="dcal-page-title">캘린더</h1>
          <p className="dcal-page-sub">학원 공통 일정 등록 · 담당 학생 일정 확인</p>
        </div>
        <button type="button" className="dcal-btn dcal-btn--primary" onClick={() => setEditor({ mode: 'create', initialDate: selectedDate })}>
          <Plus size={16} aria-hidden />
          학원 공통 일정 등록
        </button>
      </header>

      {error && (
        <div role="alert" className="dcal-error" onClick={() => setError(null)}>
          {error}
        </div>
      )}

      <div className="dcal-grid-layout">
        <section className="dcal-main">
          <div className="dcal-month-nav">
            <button type="button" className="dcal-nav-btn" onClick={() => moveMonth(-1)} aria-label="이전 달">
              <ChevronLeft size={18} aria-hidden />
            </button>
            <span className="dcal-month-label">{monthLabel}</span>
            <button type="button" className="dcal-nav-btn" onClick={() => moveMonth(1)} aria-label="다음 달">
              <ChevronRight size={18} aria-hidden />
            </button>
            <button
              type="button"
              className="dcal-today-btn"
              onClick={() => {
                setCursor({ year: today.getFullYear(), month: today.getMonth() });
                setSelectedDate(ymd(today));
              }}
            >
              오늘
            </button>
          </div>

          <div className="dcal-legend">
            {CATEGORY_ORDER.map((c) => (
              <span key={c} className="dcal-legend-item">
                <span className="dcal-legend-dot" style={{ background: CATEGORY_META[c].color }} aria-hidden />
                {CATEGORY_META[c].label}
              </span>
            ))}
          </div>

          <div className="dcal-grid" aria-label="월간 캘린더">
            {WEEKDAYS.map((w, i) => (
              <div key={w} className={`dcal-weekday${i === 0 ? ' dcal-weekday--sun' : ''}${i === 6 ? ' dcal-weekday--sat' : ''}`}>
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
                    'dcal-cell',
                    cell.inMonth ? '' : 'dcal-cell--dim',
                    isToday ? 'dcal-cell--today' : '',
                    isSelected ? 'dcal-cell--selected' : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => setSelectedDate(key)}
                >
                  <span className={`dcal-cell-num${dow === 0 ? ' dcal-cell-num--sun' : ''}${dow === 6 ? ' dcal-cell-num--sat' : ''}`}>
                    {cell.date.getDate()}
                  </span>
                  <ul className="dcal-cell-events">
                    {dayEvents.slice(0, 3).map((e) => (
                      <li key={e.id} className="dcal-cell-event" style={{ borderLeftColor: CATEGORY_META[e.category].color }}>
                        {e.title}
                      </li>
                    ))}
                    {dayEvents.length > 3 && (
                      <li className="dcal-cell-more">+{dayEvents.length - 3}</li>
                    )}
                  </ul>
                </button>
              );
            })}
          </div>

          <section className="dcal-day" aria-label={`${selectedDate} 일정`}>
            <header className="dcal-day-header">
              <h2 className="dcal-day-title">{selectedDate} 일정</h2>
              <span className="dcal-day-count">{selectedDayEvents.length}건</span>
            </header>
            {loading && <div className="dcal-empty">불러오는 중…</div>}
            {!loading && selectedDayEvents.length === 0 && (
              <div className="dcal-empty">등록된 일정이 없습니다</div>
            )}
            <ul className="dcal-day-list">
              {selectedDayEvents.map((ev) => {
                const meta = CATEGORY_META[ev.category];
                const isAcademy = ev.owner_type === 'academy';
                return (
                  <li key={ev.id} className="dcal-event-row" style={{ borderLeftColor: meta.color }}>
                    <div className="dcal-event-row-main">
                      <div className="dcal-event-row-meta">
                        <span className="dcal-event-row-tag" style={{ background: meta.color }}>
                          {meta.label}
                        </span>
                        <span className="dcal-event-row-date">
                          {ev.start_date}{ev.end_date && ev.end_date !== ev.start_date ? ` ~ ${ev.end_date}` : ''}
                        </span>
                        {!isAcademy && (
                          <span className="dcal-event-row-owner">
                            <Users size={12} aria-hidden /> 학생 본인 일정
                          </span>
                        )}
                      </div>
                      <h3 className="dcal-event-row-title">{ev.title}</h3>
                      {ev.memo && <p className="dcal-event-row-memo">{ev.memo}</p>}
                      {ev.link && (
                        <a className="dcal-event-row-link" href={ev.link} target="_blank" rel="noreferrer">
                          링크 열기
                        </a>
                      )}
                    </div>
                    {isAcademy && (
                      <div className="dcal-event-row-actions">
                        <button type="button" className="dcal-icon-btn" onClick={() => setEditor({ mode: 'edit', existing: ev, initialDate: ev.start_date })} aria-label="수정">
                          <Pencil size={14} aria-hidden />
                        </button>
                        <button type="button" className="dcal-icon-btn dcal-icon-btn--danger" onClick={() => handleDelete(ev)} aria-label="삭제">
                          <Trash2 size={14} aria-hidden />
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        </section>

        <aside className="dcal-widget" aria-label="마감 임박 일정">
          <h2 className="dcal-widget-title">
            <CalendarRange size={16} aria-hidden /> 마감 임박
          </h2>
          <WidgetSection title="오늘" events={widgetBuckets.today} categoryMeta={CATEGORY_META} />
          <WidgetSection title="내일" events={widgetBuckets.tomorrow} categoryMeta={CATEGORY_META} />
          <WidgetSection title="이번 주" events={widgetBuckets.week} categoryMeta={CATEGORY_META} />
        </aside>
      </div>

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

      {ConfirmDialog}
    </div>
  );
}

interface WidgetSectionProps {
  title: string;
  events: CalendarWidgetEvent[];
  categoryMeta: Record<CalendarCategory, { label: string; color: string }>;
}

function WidgetSection({ title, events, categoryMeta }: WidgetSectionProps) {
  return (
    <div className="dcal-widget-section">
      <header className="dcal-widget-section-header">
        <span className="dcal-widget-section-title">{title}</span>
        <span className="dcal-widget-section-count">{events.length}건</span>
      </header>
      {events.length === 0 ? (
        <div className="dcal-widget-empty">예정된 일정 없음</div>
      ) : (
        <ul className="dcal-widget-list">
          {events.map((ev) => (
            <li key={ev.id} className="dcal-widget-row" style={{ borderLeftColor: categoryMeta[ev.category].color }}>
              <div className="dcal-widget-row-main">
                <span className="dcal-widget-row-tag" style={{ color: categoryMeta[ev.category].color }}>
                  {categoryMeta[ev.category].label}
                </span>
                <h3 className="dcal-widget-row-title">{ev.title}</h3>
                <span className="dcal-widget-row-date">
                  {ev.start_date}{ev.end_date && ev.end_date !== ev.start_date ? ` ~ ${ev.end_date}` : ''}
                </span>
              </div>
              {ev.total_students > 0 && (
                <span className={`dcal-widget-badge${ev.unconfirmed_count > 0 ? ' dcal-widget-badge--warn' : ' dcal-widget-badge--ok'}`}>
                  미확인 {ev.unconfirmed_count}/{ev.total_students}
                </span>
              )}
            </li>
          ))}
        </ul>
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
  const [category, setCategory] = useState<CalendarCategory>(existing?.category ?? 'academy');
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
    <Modal onClose={onClose} className="dcal-modal">
      <Modal.Header>{state.mode === 'edit' ? '학원 공통 일정 수정' : '학원 공통 일정 등록'}</Modal.Header>
      <Modal.Body>
        <div className="dcal-form">
          <div className="dcal-form-row">
            <label className="dcal-form-field">
              <span className="dcal-form-label">카테고리</span>
              <select
                className="dcal-select"
                value={category}
                onChange={(e) => setCategory(e.target.value as CalendarCategory)}
              >
                {CATEGORY_ORDER.map((c) => (
                  <option key={c} value={c}>{CATEGORY_META[c].label}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="dcal-form-field">
            <span className="dcal-form-label">제목</span>
            <input
              type="text"
              className="dcal-input"
              value={title}
              maxLength={200}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예) 5월 모의고사"
              autoFocus
            />
          </label>

          <div className="dcal-form-row">
            <label className="dcal-form-field">
              <span className="dcal-form-label">시작일</span>
              <input type="date" className="dcal-input" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </label>
            <label className="dcal-form-field">
              <span className="dcal-form-label">종료일 (선택)</span>
              <input type="date" className="dcal-input" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </label>
          </div>

          <label className="dcal-form-field">
            <span className="dcal-form-label">메모 (선택)</span>
            <textarea
              className="dcal-textarea"
              value={memo}
              maxLength={2000}
              rows={3}
              onChange={(e) => setMemo(e.target.value)}
            />
          </label>

          <label className="dcal-form-field">
            <span className="dcal-form-label">링크 (선택)</span>
            <input
              type="url"
              className="dcal-input"
              value={link}
              maxLength={500}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://"
            />
          </label>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <button type="button" className="dcal-btn dcal-btn--ghost" onClick={onClose} disabled={saving}>취소</button>
        <button type="button" className="dcal-btn dcal-btn--primary" onClick={submit} disabled={saving}>
          {saving ? '저장 중…' : '저장'}
        </button>
      </Modal.Footer>
    </Modal>
  );
}
