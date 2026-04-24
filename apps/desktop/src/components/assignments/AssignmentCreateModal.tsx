import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import Modal from '../Modal';
import { api, type GachaStudent } from '../../api';
import { toast } from '../Toast';
import './assignment-create-modal.css';

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

type Kind = 'perf_eval' | 'exam_paper' | 'general';

const KIND_OPTIONS: { value: Kind; label: string }[] = [
  { value: 'perf_eval', label: '수행평가' },
  { value: 'exam_paper', label: '시험지' },
  { value: 'general', label: '일반과제' },
];

// 학년 정렬 우선순위 (낮을수록 위쪽)
const GRADE_ORDER: Record<string, number> = {
  초1: 1, 초2: 2, 초3: 3, 초4: 4, 초5: 5, 초6: 6,
  중1: 11, 중2: 12, 중3: 13,
  고1: 21, 고2: 22, 고3: 23,
};

function gradeWeight(g: string): number {
  if (!g || g === '미지정') return 999;
  return GRADE_ORDER[g] ?? 500;
}

function isNoiseGrade(g: string): boolean {
  return !g || g === '미지정';
}

interface StudentRowProps {
  student: GachaStudent;
  checked: boolean;
  onToggle: (id: string) => void;
}

const StudentRow = ({ student, checked, onToggle }: StudentRowProps) => {
  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      onToggle(student.id);
    }
  };
  return (
    <label
      className="asn-create__row"
      role="option"
      aria-selected={checked}
      tabIndex={0}
      onKeyDown={handleKey}
    >
      <input
        type="checkbox"
        className="asn-create__checkbox"
        checked={checked}
        onChange={() => onToggle(student.id)}
        tabIndex={-1}
        aria-label={`${student.name} 선택`}
      />
      <span className="asn-create__row-name">{student.name}</span>
      {!isNoiseGrade(student.grade) && (
        <span className="asn-create__row-meta">{student.grade}</span>
      )}
    </label>
  );
};

export default function AssignmentCreateModal({ onClose, onCreated }: Props) {
  const titleId = useId();
  const kindLabelId = useId();
  const dueId = useId();
  const instrId = useId();
  const fileId = useId();
  const searchId = useId();

  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [kind, setKind] = useState<Kind>('perf_eval');
  const [dueDate, setDueDate] = useState('');
  const [students, setStudents] = useState<GachaStudent[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [attached, setAttached] = useState<{ key: string; fileName: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [titleTouched, setTitleTouched] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setStudentsLoading(true);
    api.getGachaStudents('all')
      .then((rows) => setStudents(rows.filter((s) => s.status === 'active')))
      .catch(() => toast.error('학생 목록 로딩 실패'))
      .finally(() => setStudentsLoading(false));
  }, []);

  const filteredByGrade = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matched = q
      ? students.filter(
          (s) => s.name.toLowerCase().includes(q) || (s.grade || '').toLowerCase().includes(q)
        )
      : students;
    const byGrade = new Map<string, GachaStudent[]>();
    for (const s of matched) {
      const key = isNoiseGrade(s.grade) ? '미지정' : s.grade;
      if (!byGrade.has(key)) byGrade.set(key, []);
      byGrade.get(key)!.push(s);
    }
    const grades = Array.from(byGrade.keys()).sort((a, b) => gradeWeight(a) - gradeWeight(b));
    return grades.map((g) => ({
      grade: g,
      list: byGrade.get(g)!.sort((a, b) => a.name.localeCompare(b.name, 'ko')),
    }));
  }, [students, search]);

  const selectedStudents = useMemo(
    () => students.filter((s) => selectedIds.has(s.id)),
    [students, selectedIds]
  );

  const toggleStudent = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectGrade = useCallback((gradeRows: GachaStudent[]) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const s of gradeRows) next.add(s.id);
      return next;
    });
  }, []);

  const clearAll = useCallback(() => setSelectedIds(new Set()), []);

  const selectAllFiltered = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const g of filteredByGrade) for (const s of g.list) next.add(s.id);
      return next;
    });
  }, [filteredByGrade]);

  const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await api.uploadAssignmentFile(file, 'attachment');
      setAttached({ key: res.key, fileName: res.fileName });
    } catch (err: any) {
      toast.error(err.message || '파일 업로드 실패');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }, []);

  const titleError = titleTouched && !title.trim();
  const hasSelection = selectedIds.size > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTitleTouched(true);
    if (!title.trim()) {
      toast.error('제목을 입력하세요');
      return;
    }
    if (!hasSelection) {
      toast.error('대상 학생을 1명 이상 선택하세요');
      return;
    }
    setSaving(true);
    try {
      const dueAtIso = dueDate ? new Date(dueDate).toISOString() : null;
      const res = await api.createAssignment({
        title: title.trim(),
        instructions: instructions.trim() || undefined,
        kind,
        due_at: dueAtIso,
        attached_file_key: attached?.key,
        attached_file_name: attached?.fileName,
        student_ids: Array.from(selectedIds),
      });
      toast.success(`과제가 발행되었습니다 (${res.target_count}명)`);
      onCreated();
      onClose();
    } catch (err: any) {
      toast.error(err.message || '발행 실패');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal onClose={onClose} className="modal-content--lg">
      <Modal.Header>새 과제 발행</Modal.Header>
      <form
        onSubmit={handleSubmit}
        noValidate
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        <Modal.Body>
          <div className="asn-create__body">
            {/* 상단 3필드 */}
            <div className="asn-create__top">
              <div className="asn-create__field">
                <label htmlFor={titleId} className="asn-create__label asn-create__label--required">제목</label>
                <input
                  id={titleId}
                  className={`input${titleError ? ' asn-create__input--error' : ''}`}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={() => setTitleTouched(true)}
                  maxLength={200}
                  required
                  aria-required="true"
                  aria-invalid={titleError}
                  aria-describedby={titleError ? `${titleId}-err` : undefined}
                  autoFocus
                />
                {titleError && (
                  <span id={`${titleId}-err`} className="asn-create__field-error">제목을 입력해 주세요</span>
                )}
              </div>

              <div className="asn-create__field">
                <span id={kindLabelId} className="asn-create__label asn-create__label--required">종류</span>
                <div className="asn-create__pills" role="radiogroup" aria-labelledby={kindLabelId}>
                  {KIND_OPTIONS.map((k) => (
                    <button
                      key={k.value}
                      type="button"
                      className="asn-create__pill"
                      aria-pressed={kind === k.value}
                      role="radio"
                      aria-checked={kind === k.value}
                      onClick={() => setKind(k.value)}
                    >
                      {k.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="asn-create__field">
                <label htmlFor={dueId} className="asn-create__label">마감 <span className="asn-create__count">(선택)</span></label>
                <input
                  id={dueId}
                  type="datetime-local"
                  className="input"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            </div>

            {/* 지시문 */}
            <div className="asn-create__field">
              <label htmlFor={instrId} className="asn-create__label">지시문 <span className="asn-create__count">(선택)</span></label>
              <textarea
                id={instrId}
                className="input"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                rows={3}
                maxLength={5000}
                placeholder="예: 아래 첨부 파일을 풀어서 사진 찍어 올려주세요"
                style={{ resize: 'vertical', fontFamily: 'inherit' }}
              />
            </div>

            {/* 첨부 파일 */}
            <div className="asn-create__field">
              <label htmlFor={fileId} className="asn-create__label">첨부 파일 <span className="asn-create__count">(선택, 양식·시험지 등)</span></label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                {attached ? (
                  <span className="asn-create__file-chip">
                    {attached.fileName}
                    <button
                      type="button"
                      className="asn-create__chip-remove"
                      onClick={() => setAttached(null)}
                      aria-label={`${attached.fileName} 제거`}
                    >×</button>
                  </span>
                ) : (
                  <>
                    <label
                      htmlFor={fileId}
                      className={`asn-create__file-drop${uploading ? ' asn-create__file-drop--disabled' : ''}`}
                    >
                      {uploading ? '업로드 중...' : '파일 선택 (PDF / 이미지 / DOCX / HWP)'}
                    </label>
                    <input
                      id={fileId}
                      ref={fileInputRef}
                      type="file"
                      onChange={handleFile}
                      disabled={uploading}
                      accept=".pdf,.png,.jpg,.jpeg,.heic,.docx,.hwp"
                      style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
                    />
                  </>
                )}
              </div>
            </div>

            {/* 학생 선택 */}
            <div className="asn-create__students">
              <div className="asn-create__students-head">
                <span className="asn-create__label asn-create__label--required">
                  대상 학생
                  <span className="asn-create__count">({selectedIds.size}명 선택)</span>
                </span>
                <div className="asn-create__head-actions">
                  <button type="button" className="asn-create__btn-sm" onClick={selectAllFiltered} disabled={filteredByGrade.length === 0}>
                    검색 결과 전체
                  </button>
                  <button type="button" className="asn-create__btn-sm" onClick={clearAll} disabled={!hasSelection}>
                    모두 해제
                  </button>
                </div>
              </div>

              {/* 선택된 chip */}
              {hasSelection ? (
                <div className="asn-create__chips" aria-label={`${selectedStudents.length}명 선택됨`}>
                  {selectedStudents.map((s) => (
                    <span key={s.id} className="asn-create__student-chip">
                      {s.name}
                      <button
                        type="button"
                        onClick={() => toggleStudent(s.id)}
                        aria-label={`${s.name} 제거`}
                      >×</button>
                    </span>
                  ))}
                </div>
              ) : (
                <div className="asn-create__chips asn-create__chips--empty">선택된 학생이 없습니다</div>
              )}

              <input
                id={searchId}
                className="input"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="이름 · 학년 검색"
                aria-label="학생 검색"
              />

              <div className="asn-create__list" role="listbox" aria-multiselectable="true" aria-label="학생 목록">
                {studentsLoading ? (
                  <>
                    <div className="asn-create__skeleton" />
                    <div className="asn-create__skeleton" />
                    <div className="asn-create__skeleton" />
                  </>
                ) : filteredByGrade.length === 0 ? (
                  <p className="asn-create__empty">
                    {students.length === 0
                      ? '등록된 학생이 없습니다. 먼저 가차 학생을 등록해 주세요.'
                      : `"${search}" 검색 결과가 없습니다`}
                  </p>
                ) : (
                  filteredByGrade.map((g) => (
                    <div key={g.grade} className="asn-create__grade-group">
                      <div className="asn-create__grade-head">
                        <span className="asn-create__grade-label">
                          {g.grade}
                          <span className="asn-create__grade-count">{g.list.length}</span>
                        </span>
                        <button
                          type="button"
                          className="asn-create__grade-all"
                          onClick={() => selectGrade(g.list)}
                          aria-label={`${g.grade} 전체 선택`}
                        >
                          이 학년 전체
                        </button>
                      </div>
                      {g.list.map((s) => (
                        <StudentRow
                          key={s.id}
                          student={s}
                          checked={selectedIds.has(s.id)}
                          onToggle={toggleStudent}
                        />
                      ))}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </Modal.Body>
        {(!hasSelection || !title.trim()) && (
          <div className="asn-create__warn" role="status">
            {!title.trim() && <span>• 제목을 입력해 주세요</span>}
            {!hasSelection && <span>• 대상 학생을 1명 이상 선택해 주세요 (왼쪽 체크박스)</span>}
          </div>
        )}
        <Modal.Footer>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>취소</button>
          <button type="submit" className="btn btn-primary" disabled={saving || uploading}>
            {saving ? '발행 중...' : hasSelection ? `발행 (${selectedIds.size}명)` : '발행'}
          </button>
        </Modal.Footer>
      </form>
    </Modal>
  );
}
