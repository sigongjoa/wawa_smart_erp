/**
 * VocabPolicyTab — mockup v2/09c-vocab-policy.html 톤으로 전면 재작성.
 *
 * 구조:
 *   - 학원 기본 정책 card (toggle + form-grid + 저장 버튼)
 *   - 학생별 오버라이드 card (검색 + 학생 카운트 + data-table + 편집/기본으로 액션)
 *   - 학생 정책 편집 Modal
 *
 * 비즈니스 로직 유지: listVocabPolicies, upsertVocabPolicy, deleteVocabPolicy, getGachaStudents
 */
import { useEffect, useMemo, useState } from 'react';
import { api, GachaStudent, VocabExamPolicy, VocabExamPolicyInput } from '../../api';
import { toast, useConfirm } from '../../components/Toast';
import Modal from '../../components/Modal';
import { useOutletContext } from 'react-router-dom';
import type { VocabOutletContext } from '../VocabAdminPage';
import { Icon } from '../../components/icons/Icon';

const DEFAULT_INPUT: VocabExamPolicyInput = {
  vocab_count: 10,
  context_count: 0,
  grammar_count: 0,
  writing_enabled: false,
  writing_type: null,
  box_filter: '1,2,3,4',
  source: 'student_pool',
  textbook_id: null,
  time_limit_sec: 600,
  cooldown_min: 60,
  daily_limit: 3,
  active_from: null,
  active_to: null,
  word_cooldown_min: 30,
  ai_grading: true,
  enabled: true,
};

const POLICY_FIELDS: (keyof VocabExamPolicyInput)[] = [
  'vocab_count', 'context_count', 'grammar_count', 'writing_enabled', 'writing_type',
  'box_filter', 'source', 'textbook_id', 'time_limit_sec', 'cooldown_min', 'daily_limit',
  'active_from', 'active_to', 'word_cooldown_min', 'ai_grading', 'enabled',
];

function policyToInput(p: VocabExamPolicy | null): VocabExamPolicyInput {
  if (!p) return { ...DEFAULT_INPUT };
  const out = {} as VocabExamPolicyInput;
  for (const k of POLICY_FIELDS) {
    const v = (p as any)[k];
    if (k === 'writing_enabled' || k === 'ai_grading' || k === 'enabled') {
      (out as any)[k] = !!v;
    } else {
      (out as any)[k] = v;
    }
  }
  return out;
}

function validatePolicy(input: VocabExamPolicyInput): string | null {
  if (input.vocab_count < 1 || input.vocab_count > 50) return '문항 수는 1~50 사이여야 합니다';
  if (input.cooldown_min < 0 || input.cooldown_min > 1440) return '쿨다운은 0~1440분';
  if (input.daily_limit < 0 || input.daily_limit > 50) return '일일 한도는 0~50회';
  if (!/^[1-5](,[1-5])*$/.test(input.box_filter)) return 'Box 필터는 1~5 숫자 CSV (예: 1,2,3,4)';
  if (input.time_limit_sec < 0 || input.time_limit_sec > 7200) return '응시 시간은 0~7200초';
  if ((input.active_from && !input.active_to) || (!input.active_from && input.active_to)) {
    return '응시 시간 범위는 시작·종료 모두 입력하거나 모두 비워야 합니다';
  }
  return null;
}

function avatarChars(name: string): string {
  return name.slice(0, 2);
}

function gradeClass(grade?: string | null): string {
  if (!grade) return '';
  const m: Record<string, string> = {
    중1: 'm1', 중2: 'm2', 중3: 'm3',
    고1: 'h1', 고2: 'h2', 고3: 'h3',
  };
  return m[grade] || '';
}

export default function VocabPolicyTab() {
  const { setHeaderAction } = useOutletContext<VocabOutletContext>();
  const { confirm, ConfirmDialog } = useConfirm();
  const [policies, setPolicies] = useState<VocabExamPolicy[]>([]);
  const [students, setStudents] = useState<GachaStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingScope, setSavingScope] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const [acadInput, setAcadInput] = useState<VocabExamPolicyInput>({ ...DEFAULT_INPUT });
  const [editingStudent, setEditingStudent] = useState<string | null>(null);
  const [studentInput, setStudentInput] = useState<VocabExamPolicyInput>({ ...DEFAULT_INPUT });

  useEffect(() => {
    setHeaderAction(null);
    return () => setHeaderAction(null);
  }, [setHeaderAction]);

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [pols, sts] = await Promise.all([
        api.listVocabPolicies(),
        api.getGachaStudents('mine').catch(() => [] as GachaStudent[]),
      ]);
      setPolicies(pols);
      setStudents(sts);
      const acad = pols.find((p) => p.scope === 'academy');
      setAcadInput(policyToInput(acad ?? null));
    } catch (e: any) {
      toast.error(`정책 불러오기 실패: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  const studentPolicyMap = useMemo(() => {
    const m = new Map<string, VocabExamPolicy>();
    for (const p of policies) if (p.scope === 'student' && p.scope_id) m.set(p.scope_id, p);
    return m;
  }, [policies]);

  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) => s.name.toLowerCase().includes(q));
  }, [students, search]);

  async function saveAcademy() {
    const err = validatePolicy(acadInput);
    if (err) { toast.error(err); return; }
    setSavingScope('academy');
    try {
      await api.upsertVocabPolicy('academy', '_', acadInput);
      toast.success('학원 기본 정책 저장됨');
      await load();
    } catch (e: any) {
      toast.error(`저장 실패: ${e.message}`);
    } finally {
      setSavingScope(null);
    }
  }

  function startEditStudent(sid: string) {
    setEditingStudent(sid);
    const p = studentPolicyMap.get(sid);
    setStudentInput(policyToInput(p ?? null));
  }

  async function saveStudent() {
    if (!editingStudent) return;
    const err = validatePolicy(studentInput);
    if (err) { toast.error(err); return; }
    setSavingScope(editingStudent);
    try {
      await api.upsertVocabPolicy('student', editingStudent, studentInput);
      toast.success('학생 정책 저장됨');
      setEditingStudent(null);
      await load();
    } catch (e: any) {
      toast.error(`저장 실패: ${e.message}`);
    } finally {
      setSavingScope(null);
    }
  }

  async function clearStudent(sid: string) {
    if (!(await confirm('이 학생의 오버라이드를 삭제할까요?\n학원 기본 정책이 적용됩니다.'))) return;
    setSavingScope(sid);
    try {
      await api.deleteVocabPolicy('student', sid);
      toast.success('오버라이드 삭제됨');
      await load();
    } catch (e: any) {
      toast.error(`삭제 실패: ${e.message}`);
    } finally {
      setSavingScope(null);
    }
  }

  if (loading && policies.length === 0) {
    return <div className="v2-empty">정책을 불러오고 있어요</div>;
  }

  return (
    <>
      {/* 학원 기본 정책 카드 */}
      <div className="v2-panel v2-policy-card">
        <div className="v2-policy-card__head">
          <h2 className="v2-policy-card__title">
            <Icon name="Building2" size={18} /> 학원 기본 정책
          </h2>
          <p className="v2-policy-card__hint">
            학생/교사 오버라이드가 없을 때 모든 학생에게 적용됩니다.
            학생이 학생앱에서 직접 시험을 시작할 때 이 설정으로 출제됩니다.
          </p>
        </div>
        <div className="v2-policy-card__body">
          <PolicyForm input={acadInput} onChange={setAcadInput} />
        </div>
        <div className="v2-policy-card__foot">
          <button
            type="button"
            className="v2-btn v2-btn--primary"
            onClick={saveAcademy}
            disabled={savingScope === 'academy'}
          >
            <Icon name="Check" size={14} />
            {savingScope === 'academy' ? '저장 중…' : '학원 기본 정책 저장'}
          </button>
        </div>
      </div>

      {/* 학생별 오버라이드 카드 */}
      <div className="v2-panel v2-policy-card">
        <div className="v2-policy-card__head">
          <div className="v2-policy-card__head-row">
            <div>
              <h2 className="v2-policy-card__title">
                <Icon name="Users" size={18} /> 학생별 오버라이드
              </h2>
              <p className="v2-policy-card__hint">
                특정 학생만 다른 정책을 적용할 때 설정. 미설정 학생은 학원 기본을 따릅니다.
              </p>
            </div>
            <div className="v2-cluster">
              <div className="v2-input-group" style={{ width: 220 }}>
                <Icon name="Search" size={14} />
                <input
                  placeholder="학생 이름 검색"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <span className="v2-text-mute" style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>
                {filteredStudents.length} / {students.length}명
              </span>
            </div>
          </div>
        </div>

        {filteredStudents.length === 0 ? (
          <div className="v2-empty">
            {students.length === 0 ? '담당 학생이 없습니다.' : '검색 결과가 없어요'}
          </div>
        ) : (
          <table className="v2-data-table">
            <thead>
              <tr>
                <th>이름</th>
                <th style={{ width: 140 }}>적용 정책</th>
                <th style={{ width: 70 }} className="v2-tabular">문항</th>
                <th style={{ width: 100 }} className="v2-tabular">쿨다운</th>
                <th style={{ width: 70 }} className="v2-tabular">일일</th>
                <th style={{ width: 200 }}>작업</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((s) => {
                const p = studentPolicyMap.get(s.id);
                const acad = policies.find((x) => x.scope === 'academy');
                const eff = p ?? acad;
                const isOverride = !!p;
                return (
                  <tr key={s.id}>
                    <td>
                      <div className="v2-cluster">
                        <div className="v2-avatar">{avatarChars(s.name)}</div>
                        <div className="v2-cell-stack">
                          <span className="v2-cell-stack__primary">{s.name}</span>
                          {s.grade && (
                            <span className="v2-cell-stack__meta">
                              <span className={`grade-badge ${gradeClass(s.grade)}`}>{s.grade}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`v2-applied-pill v2-applied-pill--${isOverride ? 'override' : 'default'}`}>
                        {isOverride ? '오버라이드' : '학원 기본'}
                      </span>
                    </td>
                    <td className={`v2-tabular${isOverride ? '' : ' v2-text-mute'}`}>
                      {isOverride ? eff?.vocab_count : '—'}
                    </td>
                    <td className={`v2-tabular${isOverride ? '' : ' v2-text-mute'}`}>
                      {isOverride && eff ? `${eff.cooldown_min}분` : '—'}
                    </td>
                    <td className={`v2-tabular${isOverride ? '' : ' v2-text-mute'}`}>
                      {isOverride ? eff?.daily_limit : '—'}
                    </td>
                    <td>
                      <div className="v2-action-cell">
                        <button
                          type="button"
                          className="v2-btn v2-btn--secondary v2-btn--sm"
                          onClick={() => startEditStudent(s.id)}
                        >
                          편집
                        </button>
                        {p && (
                          <button
                            type="button"
                            className="v2-btn v2-btn--sm"
                            onClick={() => clearStudent(s.id)}
                            disabled={savingScope === s.id}
                          >
                            <Icon name="Undo" size={12} /> 기본으로
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {editingStudent && (
        <Modal onClose={() => setEditingStudent(null)} className="modal-content--wide">
          <Modal.Header>
            {students.find((s) => s.id === editingStudent)?.name} 정책
          </Modal.Header>
          <Modal.Body>
            <PolicyForm input={studentInput} onChange={setStudentInput} />
          </Modal.Body>
          <Modal.Footer>
            <button
              type="button"
              className="v2-btn v2-btn--secondary"
              onClick={() => setEditingStudent(null)}
            >취소</button>
            <button
              type="button"
              className="v2-btn v2-btn--primary"
              onClick={saveStudent}
              disabled={savingScope === editingStudent}
            >
              {savingScope === editingStudent ? '저장 중…' : '저장'}
            </button>
          </Modal.Footer>
        </Modal>
      )}
      {ConfirmDialog}
    </>
  );
}

// ── PolicyForm (mockup form-grid 톤) ──
function PolicyForm({
  input, onChange,
}: { input: VocabExamPolicyInput; onChange: (next: VocabExamPolicyInput) => void }) {
  const set = <K extends keyof VocabExamPolicyInput>(k: K, v: VocabExamPolicyInput[K]) =>
    onChange({ ...input, [k]: v });

  return (
    <div className="v2-form-grid">
      <div className="v2-form-grid--full">
        <div className="v2-toggle-row">
          <div>
            <div className="v2-toggle-row__label">활성화</div>
            <div className="v2-field-hint">비활성화 시 학생 앱의 시험 시작 버튼이 숨겨집니다</div>
          </div>
          <Toggle checked={input.enabled} onChange={(v) => set('enabled', v)} />
        </div>
      </div>

      <div className="v2-field">
        <label className="v2-field__label">문항 수</label>
        <input
          className="v2-input" type="number" min={1} max={50}
          value={input.vocab_count}
          onChange={(e) => set('vocab_count', parseInt(e.target.value) || 10)}
        />
        <span className="v2-field-hint">1 ~ 50</span>
      </div>

      <div className="v2-field">
        <label className="v2-field__label">응시 시간 (초)</label>
        <input
          className="v2-input" type="number" min={0} max={7200}
          value={input.time_limit_sec}
          onChange={(e) => set('time_limit_sec', parseInt(e.target.value) || 0)}
        />
        <span className="v2-field-hint">0 = 무제한 · 최대 7200 (2시간)</span>
      </div>

      <div className="v2-field">
        <label className="v2-field__label">쿨다운 (분)</label>
        <input
          className="v2-input" type="number" min={0} max={1440}
          value={input.cooldown_min}
          onChange={(e) => set('cooldown_min', parseInt(e.target.value) || 0)}
        />
        <span className="v2-field-hint">시험 완료 후 재응시까지 · 0 = 즉시</span>
      </div>

      <div className="v2-field">
        <label className="v2-field__label">일일 한도 (회)</label>
        <input
          className="v2-input" type="number" min={0} max={50}
          value={input.daily_limit}
          onChange={(e) => set('daily_limit', parseInt(e.target.value) || 0)}
        />
        <span className="v2-field-hint">0 = 무제한</span>
      </div>

      <div className="v2-field">
        <label className="v2-field__label">단어 쿨다운 (분)</label>
        <input
          className="v2-input" type="number" min={0} max={10080}
          value={input.word_cooldown_min}
          onChange={(e) => set('word_cooldown_min', parseInt(e.target.value) || 0)}
        />
        <span className="v2-field-hint">같은 단어 재출제 대기 · 1440 = 1일</span>
      </div>

      <div className="v2-field">
        <label className="v2-field__label">Box 필터 (CSV)</label>
        <input
          className="v2-input" type="text"
          placeholder="1,2,3,4"
          value={input.box_filter}
          onChange={(e) => set('box_filter', e.target.value)}
        />
        <span className="v2-field-hint">출제할 Box 번호 (1~5)</span>
      </div>

      <div className="v2-field v2-form-grid--full">
        <label className="v2-field__label">응시 가능 시간대</label>
        <div className="v2-time-range">
          <input
            className="v2-input" type="time"
            value={input.active_from ?? ''}
            onChange={(e) => set('active_from', e.target.value || null)}
          />
          <span className="v2-time-range__sep">~</span>
          <input
            className="v2-input" type="time"
            value={input.active_to ?? ''}
            onChange={(e) => set('active_to', e.target.value || null)}
          />
        </div>
        <span className="v2-field-hint">시작·종료 모두 입력하거나 모두 비워야 합니다</span>
      </div>

      <div className="v2-form-grid--full">
        <div className="v2-toggle-row">
          <div>
            <div className="v2-toggle-row__label">영작 포함</div>
            <div className="v2-field-hint">단어 → 영작 문제 추가 출제</div>
          </div>
          <Toggle checked={input.writing_enabled} onChange={(v) => set('writing_enabled', v)} />
        </div>
      </div>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`v2-toggle${checked ? ' is-on' : ''}`}
    >
      <span className="v2-toggle__knob" />
    </button>
  );
}
