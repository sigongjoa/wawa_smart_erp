import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api';
import { useAuthStore } from '../store';
import { toast, useConfirm } from '../components/Toast';
import Modal from '../components/Modal';

type Kind = 'unit' | 'type';

interface StudentLite { id: string; name: string; grade?: string }
interface Textbook { textbook: string; unit_count: number }
interface Unit { id: string; textbook: string; name: string; kind: string; order_idx: number }
interface ProgressRow {
  unit_id: string;
  name: string;
  order_idx: number;
  kind: string;
  understanding: number | null;
  status: string | null;
  note: string | null;
  updated_at: string | null;
}

function understandingColor(v: number | null): string {
  if (v == null) return 'var(--bg-tertiary)';
  if (v < 40) return 'var(--danger)';
  if (v < 70) return 'var(--warning)';
  return 'var(--success)';
}

function deriveStatus(v: number | null): 'not_started' | 'in_progress' | 'done' {
  if (v == null) return 'not_started';
  if (v >= 80) return 'done';
  return 'in_progress';
}

const STATUS_LABEL: Record<string, string> = {
  not_started: '미시작',
  in_progress: '진행중',
  done: '완료',
};

export default function ProgressPage() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin';

  const [students, setStudents] = useState<StudentLite[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<string>('');
  const [studentFilter, setStudentFilter] = useState('');

  const [textbooks, setTextbooks] = useState<Textbook[]>([]);
  const [selectedTextbook, setSelectedTextbook] = useState<string>('');
  const [kind, setKind] = useState<Kind>('type');

  const [progress, setProgress] = useState<ProgressRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [showTextbookAdd, setShowTextbookAdd] = useState(false);
  const [newTextbookName, setNewTextbookName] = useState('');

  const [showUnitEditor, setShowUnitEditor] = useState(false);
  const [units, setUnits] = useState<Unit[]>([]);
  const [newUnitName, setNewUnitName] = useState('');
  const [editingNote, setEditingNote] = useState<{ unitId: string; note: string } | null>(null);

  const debounceRef = useRef<Record<string, number>>({});
  const kindToggleRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const { confirm: confirmDialog, ConfirmDialog } = useConfirm();

  // Close overflow menu on outside click / ESC
  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  // Cleanup pending debounced saves on unmount
  useEffect(() => {
    return () => {
      Object.values(debounceRef.current).forEach(id => clearTimeout(id));
      debounceRef.current = {};
    };
  }, []);

  useEffect(() => {
    api.getStudents('mine')
      .then(rows => {
        const mapped = rows.map(s => ({ id: s.id, name: s.name, grade: s.grade }));
        setStudents(mapped);
        if (mapped.length > 0) setSelectedStudent(prev => prev || mapped[0].id);
      })
      .catch(() => setStudents([]));
    loadTextbooks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadTextbooks = useCallback(async () => {
    try {
      const rows = await api.progressTextbooks();
      setTextbooks(rows);
      if (rows.length > 0 && !selectedTextbook) {
        setSelectedTextbook(rows[0].textbook);
      }
    } catch { setTextbooks([]); }
  }, [selectedTextbook]);

  const loadProgress = useCallback(async () => {
    if (!selectedStudent || !selectedTextbook) { setProgress([]); return; }
    setLoading(true);
    try {
      const rows = await api.getStudentProgress(selectedStudent, selectedTextbook, kind);
      setProgress(rows);
    } catch {
      setProgress([]);
    } finally {
      setLoading(false);
    }
  }, [selectedStudent, selectedTextbook, kind]);

  useEffect(() => { loadProgress(); }, [loadProgress]);

  const loadUnits = useCallback(async () => {
    if (!selectedTextbook) { setUnits([]); return; }
    try {
      const rows = await api.progressUnits(selectedTextbook, kind);
      setUnits(rows);
    } catch { setUnits([]); }
  }, [selectedTextbook, kind]);

  useEffect(() => { if (showUnitEditor) loadUnits(); }, [showUnitEditor, loadUnits]);

  const filteredStudents = useMemo(() => {
    const q = studentFilter.trim().toLowerCase();
    if (!q) return students;
    return students.filter(s => s.name.toLowerCase().includes(q));
  }, [students, studentFilter]);

  const averageUnderstanding = useMemo(() => {
    const vals = progress.map(p => p.understanding).filter((v): v is number => v != null);
    if (vals.length === 0) return null;
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  }, [progress]);

  const handleUnderstandingChange = (unitId: string, value: number) => {
    setProgress(prev => prev.map(p =>
      p.unit_id === unitId
        ? { ...p, understanding: value, status: deriveStatus(value) }
        : p
    ));

    if (!selectedStudent) return;
    const key = `u-${unitId}`;
    if (debounceRef.current[key]) clearTimeout(debounceRef.current[key]);
    debounceRef.current[key] = window.setTimeout(() => {
      api.patchStudentProgress(selectedStudent, unitId, {
        understanding: value,
        status: deriveStatus(value),
      }).catch(() => toast.error('저장 실패'));
    }, 350);
  };

  const handleClear = (unitId: string) => {
    setProgress(prev => prev.map(p =>
      p.unit_id === unitId
        ? { ...p, understanding: null, status: 'not_started' }
        : p
    ));
    if (selectedStudent) {
      api.patchStudentProgress(selectedStudent, unitId, {
        understanding: null,
        status: 'not_started',
      }).catch(() => toast.error('초기화 실패'));
    }
  };

  const handleAddTextbook = async () => {
    const name = newTextbookName.trim();
    if (!name) return;
    setNewTextbookName('');
    setSelectedTextbook(name);
    setShowTextbookAdd(false);
    setShowUnitEditor(true);
  };

  const handleDeleteTextbook = async () => {
    if (!selectedTextbook) return;
    const ok = await confirmDialog(`"${selectedTextbook}" 교재와 모든 단원·진도를 삭제하시겠습니까?`);
    if (!ok) return;
    try {
      await api.deleteProgressTextbook(selectedTextbook);
      toast.success('삭제 완료');
      setSelectedTextbook('');
      loadTextbooks();
      setProgress([]);
    } catch (err) {
      toast.error('삭제 실패: ' + (err as Error).message);
    }
  };

  const handleAddUnit = async () => {
    const name = newUnitName.trim();
    if (!name || !selectedTextbook) return;
    try {
      await api.createProgressUnit({ textbook: selectedTextbook, name, kind });
      setNewUnitName('');
      loadUnits();
      loadTextbooks();
      loadProgress();
    } catch (err) {
      toast.error('추가 실패: ' + (err as Error).message);
    }
  };

  const handleRenameUnit = async (id: string, name: string) => {
    try {
      await api.updateProgressUnit(id, { name });
      loadUnits();
      loadProgress();
    } catch { /* ignore */ }
  };

  const handleDeleteUnit = async (id: string, name: string) => {
    const ok = await confirmDialog(`"${name}" 단원을 삭제할까요? 이 단원의 모든 학생 진도가 함께 삭제됩니다.`);
    if (!ok) return;
    try {
      await api.deleteProgressUnit(id);
      loadUnits();
      loadTextbooks();
      loadProgress();
    } catch (err) {
      toast.error('삭제 실패: ' + (err as Error).message);
    }
  };

  const saveNote = async () => {
    if (!editingNote || !selectedStudent) return;
    try {
      await api.patchStudentProgress(selectedStudent, editingNote.unitId, { note: editingNote.note });
      setProgress(prev => prev.map(p =>
        p.unit_id === editingNote.unitId ? { ...p, note: editingNote.note } : p
      ));
      setEditingNote(null);
    } catch {
      toast.error('메모 저장 실패');
    }
  };

  const selectedStudentName = students.find(s => s.id === selectedStudent)?.name;

  return (
    <div className="page-container progress-page">
      <div className="page-header">
        <h1 className="page-title">진도 관리</h1>
      </div>

      <div className="progress-controls">
        <div className="progress-field">
          <label className="progress-field-label" htmlFor="progress-student">학생</label>
          <div className="progress-field-row">
            <select
              id="progress-student"
              className="form-select"
              value={selectedStudent}
              onChange={e => setSelectedStudent(e.target.value)}
            >
              <option value="">학생 선택</option>
              {filteredStudents.map(s => (
                <option key={s.id} value={s.id}>{s.name} {s.grade ? `(${s.grade})` : ''}</option>
              ))}
            </select>
            <input
              id="progress-student-filter"
              className="form-input progress-field-search"
              placeholder="검색"
              value={studentFilter}
              onChange={e => setStudentFilter(e.target.value)}
              aria-label="학생 검색"
            />
          </div>
        </div>

        <div className="progress-field">
          <label className="progress-field-label" htmlFor="progress-textbook">교재</label>
          <div className="progress-field-row">
            <select
              id="progress-textbook"
              className="form-select"
              value={selectedTextbook}
              onChange={e => setSelectedTextbook(e.target.value)}
            >
              <option value="">교재 선택</option>
              {textbooks.map(t => (
                <option key={t.textbook} value={t.textbook}>{t.textbook} · {t.unit_count}항목</option>
              ))}
            </select>
            {isAdmin && (
              <div className="progress-menu" ref={menuRef}>
                <button
                  type="button"
                  className="progress-menu-trigger"
                  aria-label="교재 관리 메뉴"
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  onClick={() => setMenuOpen(o => !o)}
                >⋯</button>
                {menuOpen && (
                  <div className="progress-menu-panel" role="menu">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => { setMenuOpen(false); setShowTextbookAdd(true); }}
                    >새 교재 추가</button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => { setMenuOpen(false); setShowUnitEditor(true); }}
                      disabled={!selectedTextbook}
                    >단원·유형 편집</button>
                    <button
                      type="button"
                      role="menuitem"
                      className="danger"
                      onClick={() => { setMenuOpen(false); handleDeleteTextbook(); }}
                      disabled={!selectedTextbook}
                    >교재 삭제</button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div
          className="progress-kind-toggle"
          role="radiogroup"
          aria-label="단원/유형 전환"
          ref={kindToggleRef}
          onKeyDown={(e) => {
            if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'Home' && e.key !== 'End') return;
            e.preventDefault();
            const next: Kind = (e.key === 'ArrowLeft' || e.key === 'Home')
              ? 'unit'
              : (e.key === 'ArrowRight' || e.key === 'End')
                ? 'type'
                : kind;
            setKind(next);
            const btns = kindToggleRef.current?.querySelectorAll<HTMLButtonElement>('button[role="radio"]');
            btns?.[next === 'unit' ? 0 : 1]?.focus();
          }}
        >
          <button
            role="radio"
            aria-checked={kind === 'unit'}
            tabIndex={kind === 'unit' ? 0 : -1}
            className={kind === 'unit' ? 'active' : ''}
            onClick={() => setKind('unit')}
          >단원별</button>
          <button
            role="radio"
            aria-checked={kind === 'type'}
            tabIndex={kind === 'type' ? 0 : -1}
            className={kind === 'type' ? 'active' : ''}
            onClick={() => setKind('type')}
          >유형별</button>
        </div>
      </div>

      {!selectedStudent ? (
        <div className="progress-empty">
          <p>좌측에서 학생과 교재를 선택하면 진도/이해도 차트가 표시됩니다.</p>
        </div>
      ) : !selectedTextbook ? (
        <div className="progress-empty">
          <p>교재를 선택하거나 {isAdmin && '"+ 교재"로 추가'}하세요.</p>
        </div>
      ) : progress.length === 0 && !loading ? (
        <div className="progress-empty">
          <p>등록된 {kind === 'type' ? '문제 유형' : '단원'}이 없습니다.</p>
          {isAdmin && (
            <button className="btn btn-primary" onClick={() => setShowUnitEditor(true)}>단원 편집 열기</button>
          )}
        </div>
      ) : (
        <>
          {/* Chart */}
          <section className="progress-chart-card" aria-label="이해도 차트">
            <div className="progress-chart-head">
              <div>
                <strong>{selectedStudentName}</strong>
                <span className="progress-chart-sub">{selectedTextbook} · {kind === 'type' ? '유형별' : '단원별'}</span>
              </div>
              {averageUnderstanding != null && (
                <div
                  className="progress-chart-stat"
                  style={{ ['--accent' as string]: understandingColor(averageUnderstanding) }}
                >
                  평균 <strong>{averageUnderstanding}</strong>
                </div>
              )}
            </div>

            <div
              className={`progress-chart ${loading ? 'is-loading' : ''}`}
              role="img"
              aria-label={`${selectedStudentName} ${selectedTextbook} 이해도`}
              aria-describedby="progress-chart-table"
              aria-busy={loading}
            >
              <div className="progress-chart-yaxis" aria-hidden="true">
                <span>100</span><span>75</span><span>50</span><span>25</span><span>0</span>
              </div>
              <div className="progress-chart-bars" aria-hidden="true">
                {progress.map((p) => {
                  const v = p.understanding;
                  const scale = v == null ? 0 : Math.max(0.02, v / 100);
                  const barStyle = v == null
                    ? { ['--bar-scale' as string]: '0' }
                    : { ['--bar-scale' as string]: String(scale), ['--bar-bg' as string]: understandingColor(v) };
                  return (
                    <div key={p.unit_id} className="progress-chart-col" title={`${p.name}${v != null ? ` · ${v}점` : ''}`}>
                      <div
                        className={`progress-chart-bar ${v == null ? 'empty' : ''}`}
                        style={barStyle as React.CSSProperties}
                      >
                        <span className="progress-chart-bar-fill" aria-hidden="true" />
                        {v != null && <span className="progress-chart-bar-value">{v}</span>}
                      </div>
                      <div className="progress-chart-xlabel">
                        <span className="progress-chart-xlabel-idx">{p.order_idx + 1}</span>
                        <span className="progress-chart-xlabel-name">{p.name}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 접근성용 테이블 */}
            <table id="progress-chart-table" className="sr-only">
              <caption>이해도 데이터</caption>
              <thead><tr><th>단원</th><th>이해도</th><th>상태</th></tr></thead>
              <tbody>
                {progress.map(p => (
                  <tr key={p.unit_id}>
                    <td>{p.name}</td>
                    <td>{p.understanding ?? '-'}</td>
                    <td>{STATUS_LABEL[p.status || 'not_started']}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* List */}
          <section className="progress-list-card">
            <h2 className="progress-list-title">{kind === 'type' ? '유형별 편집' : '단원별 편집'}</h2>
            <ul className="progress-list">
              {progress.map(p => {
                const v = p.understanding;
                const status = p.status || 'not_started';
                return (
                  <li key={p.unit_id} className="progress-list-item">
                    <div className="progress-list-item-head">
                      <span className="progress-list-item-order">{String(p.order_idx + 1).padStart(2, '0')}</span>
                      <span className="progress-list-item-name">{p.name}</span>
                      <span className={`progress-list-status progress-list-status--${status}`}>
                        {STATUS_LABEL[status]}
                      </span>
                    </div>
                    <div
                      className="progress-list-item-slider"
                      style={{ ['--accent' as string]: understandingColor(v) }}
                    >
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={v ?? 0}
                        onChange={e => handleUnderstandingChange(p.unit_id, Number(e.target.value))}
                        className={`progress-slider ${v == null ? 'is-empty' : ''}`}
                        aria-label={`${p.name} 이해도`}
                        aria-valuetext={v == null ? '미시작' : `${v}점`}
                      />
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={v ?? ''}
                        placeholder="—"
                        className="form-input progress-input-num"
                        onChange={e => {
                          const raw = e.target.value;
                          if (raw === '') { handleClear(p.unit_id); return; }
                          const n = Number(raw);
                          if (Number.isFinite(n)) handleUnderstandingChange(p.unit_id, Math.max(0, Math.min(100, n)));
                        }}
                        aria-label={`${p.name} 이해도 숫자 입력`}
                      />
                    </div>
                    <div className="progress-list-item-actions">
                      <button
                        type="button"
                        className={`progress-list-action ${p.note ? 'has-note' : ''}`}
                        onClick={() => setEditingNote({ unitId: p.unit_id, note: p.note || '' })}
                      >
                        <span aria-hidden="true">✎</span> 메모{p.note ? ' ●' : ''}
                      </button>
                      {v != null && (
                        <button
                          type="button"
                          className="progress-list-action"
                          onClick={() => handleClear(p.unit_id)}
                        >
                          <span aria-hidden="true">↺</span> 초기화
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}

      {/* 교재 추가 모달 */}
      {showTextbookAdd && (
        <Modal onClose={() => setShowTextbookAdd(false)}>
          <Modal.Header>교재 추가</Modal.Header>
          <Modal.Body>
            <label className="form-label" htmlFor="new-textbook">교재명</label>
            <input
              id="new-textbook"
              className="form-input"
              placeholder="예: 쎈 고등수학 1"
              value={newTextbookName}
              onChange={e => setNewTextbookName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAddTextbook(); }}
            />
            <p className="form-hint">추가 후 바로 단원 편집 화면이 열립니다.</p>
          </Modal.Body>
          <Modal.Footer>
            <button className="btn btn-ghost" onClick={() => setShowTextbookAdd(false)}>취소</button>
            <button className="btn btn-primary" onClick={handleAddTextbook} disabled={!newTextbookName.trim()}>
              추가
            </button>
          </Modal.Footer>
        </Modal>
      )}

      {/* 단원 편집 모달 */}
      {showUnitEditor && selectedTextbook && (
        <Modal onClose={() => setShowUnitEditor(false)} className="modal-content--wide">
          <Modal.Header>{selectedTextbook} · {kind === 'type' ? '유형' : '단원'} 편집</Modal.Header>
          <Modal.Body>
            <div className="progress-unit-add">
              <input
                className="form-input"
                placeholder={kind === 'type' ? '예: 이차함수 응용' : '예: 1-1 집합'}
                value={newUnitName}
                onChange={e => setNewUnitName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddUnit(); }}
                aria-label={`${kind === 'type' ? '유형' : '단원'}명`}
              />
              <button className="btn btn-primary" onClick={handleAddUnit} disabled={!newUnitName.trim()}>
                추가
              </button>
            </div>

            {units.length === 0 ? (
              <p className="form-hint">등록된 항목이 없습니다.</p>
            ) : (
              <ul className="progress-unit-list">
                {units.map((u, i) => (
                  <li key={u.id} className="progress-unit-row">
                    <span className="progress-unit-idx">{i + 1}</span>
                    <input
                      className="form-input"
                      defaultValue={u.name}
                      onBlur={e => {
                        const v = e.target.value.trim();
                        if (v && v !== u.name) handleRenameUnit(u.id, v);
                      }}
                    />
                    <button
                      className="btn btn-sm btn-danger-ghost"
                      onClick={() => handleDeleteUnit(u.id, u.name)}
                    >
                      삭제
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Modal.Body>
          <Modal.Footer>
            <button className="btn btn-primary" onClick={() => setShowUnitEditor(false)}>완료</button>
          </Modal.Footer>
        </Modal>
      )}

      {/* 메모 편집 모달 */}
      {editingNote && (
        <Modal onClose={() => setEditingNote(null)}>
          <Modal.Header>단원 메모</Modal.Header>
          <Modal.Body>
            <label className="form-label" htmlFor="progress-note">메모</label>
            <textarea
              id="progress-note"
              className="form-textarea"
              rows={5}
              value={editingNote.note}
              onChange={e => setEditingNote(n => n ? { ...n, note: e.target.value } : n)}
              placeholder="수업 중 특이사항, 약한 유형 등"
            />
          </Modal.Body>
          <Modal.Footer>
            <button className="btn btn-ghost" onClick={() => setEditingNote(null)}>취소</button>
            <button className="btn btn-primary" onClick={saveNote}>저장</button>
          </Modal.Footer>
        </Modal>
      )}

      {ConfirmDialog}
    </div>
  );
}
