import { useEffect, useMemo, useState } from 'react';
import { api, GachaStudent, VocabExamPolicy, VocabExamPolicyInput } from '../../api';
import { toast } from '../../components/Toast';
import Modal from '../../components/Modal';

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
    // boolean 필드는 0/1 → boolean 변환
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

export default function VocabPolicyTab() {
  const [policies, setPolicies] = useState<VocabExamPolicy[]>([]);
  const [students, setStudents] = useState<GachaStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingScope, setSavingScope] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const [acadInput, setAcadInput] = useState<VocabExamPolicyInput>({ ...DEFAULT_INPUT });
  const [editingStudent, setEditingStudent] = useState<string | null>(null);
  const [studentInput, setStudentInput] = useState<VocabExamPolicyInput>({ ...DEFAULT_INPUT });

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
    if (!confirm('이 학생의 오버라이드를 삭제할까요?\n학원 기본 정책이 적용됩니다.')) return;
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
    return <div className="vocab-empty">정책을 불러오고 있어요</div>;
  }

  return (
    <div className="vocab-policy-page">
      {/* 학원 기본 정책 */}
      <section className="vocab-policy-card">
        <header className="vocab-policy-card__head">
          <h2 className="vocab-policy-card__title">학원 기본 정책</h2>
          <p className="vocab-policy-card__hint">
            학생/교사 오버라이드가 없을 때 모든 학생에게 적용됩니다.
            학생이 학생앱에서 직접 시험을 시작할 때 이 설정으로 출제됩니다.
          </p>
        </header>
        <PolicyForm input={acadInput} onChange={setAcadInput} />
        <div className="vocab-policy-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={saveAcademy}
            disabled={savingScope === 'academy'}
          >
            {savingScope === 'academy' ? '저장 중…' : '학원 기본 정책 저장'}
          </button>
        </div>
      </section>

      {/* 학생별 오버라이드 */}
      <section className="vocab-policy-card">
        <header className="vocab-policy-card__head">
          <h2 className="vocab-policy-card__title">학생별 오버라이드</h2>
          <p className="vocab-policy-card__hint">
            특정 학생만 다른 정책을 적용할 때 설정. 미설정 학생은 학원 기본을 따릅니다.
          </p>
        </header>

        <div className="vocab-policy-toolbar">
          <input
            type="search"
            className="form-input form-input--sm"
            placeholder="학생 이름 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <span className="muted vocab-policy-count">
            {filteredStudents.length} / {students.length}명
          </span>
        </div>

        {filteredStudents.length === 0 ? (
          <div className="vocab-empty">
            {students.length === 0 ? '담당 학생이 없습니다.' : '검색 결과가 없어요'}
          </div>
        ) : (
          <div className="vocab-table-wrap">
            <table className="vocab-table">
              <thead>
                <tr>
                  <th>이름</th>
                  <th>적용 정책</th>
                  <th className="vocab-th-num">문항</th>
                  <th className="vocab-th-num">쿨다운</th>
                  <th className="vocab-th-num">일일</th>
                  <th className="vocab-th-actions">작업</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((s) => {
                  const p = studentPolicyMap.get(s.id);
                  const acad = policies.find((x) => x.scope === 'academy');
                  const eff = p ?? acad;
                  return (
                    <tr key={s.id}>
                      <td><strong>{s.name}</strong></td>
                      <td>
                        {p ? (
                          <span className="pill pill--primary">오버라이드</span>
                        ) : (
                          <span className="muted">학원 기본</span>
                        )}
                      </td>
                      <td className="vocab-cell-num">{eff?.vocab_count ?? '-'}</td>
                      <td className="vocab-cell-num">{eff ? `${eff.cooldown_min}분` : '-'}</td>
                      <td className="vocab-cell-num">{eff?.daily_limit ?? '-'}</td>
                      <td>
                        <div className="vocab-row-actions">
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => startEditStudent(s.id)}
                          >
                            편집
                          </button>
                          {p && (
                            <button
                              type="button"
                              className="btn btn-danger-ghost btn-sm"
                              onClick={() => clearStudent(s.id)}
                              disabled={savingScope === s.id}
                            >
                              기본으로
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editingStudent && (
        <Modal onClose={() => setEditingStudent(null)} className="vocab-policy-modal">
          <Modal.Header>
            {students.find((s) => s.id === editingStudent)?.name} 정책
          </Modal.Header>
          <Modal.Body>
            <PolicyForm input={studentInput} onChange={setStudentInput} />
          </Modal.Body>
          <Modal.Footer>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setEditingStudent(null)}
            >
              취소
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={saveStudent}
              disabled={savingScope === editingStudent}
            >
              {savingScope === editingStudent ? '저장 중…' : '저장'}
            </button>
          </Modal.Footer>
        </Modal>
      )}
    </div>
  );
}

// ── 정책 폼 (학원/학생 공용) ──
function PolicyForm({
  input, onChange,
}: { input: VocabExamPolicyInput; onChange: (next: VocabExamPolicyInput) => void }) {
  const set = <K extends keyof VocabExamPolicyInput>(k: K, v: VocabExamPolicyInput[K]) =>
    onChange({ ...input, [k]: v });

  return (
    <div className="vocab-policy-form">
      <label className="form-field">
        <span className="form-label">활성화</span>
        <Toggle checked={input.enabled} onChange={(v) => set('enabled', v)} />
      </label>

      <label className="form-field">
        <span className="form-label">문항 수</span>
        <input
          type="number" min={1} max={50}
          value={input.vocab_count}
          onChange={(e) => set('vocab_count', parseInt(e.target.value) || 10)}
          className="form-input form-input--xs"
        />
      </label>

      <label className="form-field">
        <span className="form-label">응시 시간 (초, 0=무제한)</span>
        <input
          type="number" min={0} max={7200}
          value={input.time_limit_sec}
          onChange={(e) => set('time_limit_sec', parseInt(e.target.value) || 0)}
          className="form-input form-input--sm"
        />
      </label>

      <label className="form-field">
        <span className="form-label">쿨다운 (분)</span>
        <input
          type="number" min={0} max={1440}
          value={input.cooldown_min}
          onChange={(e) => set('cooldown_min', parseInt(e.target.value) || 0)}
          className="form-input form-input--xs"
        />
      </label>

      <label className="form-field">
        <span className="form-label">일일 한도 (회, 0=무제한)</span>
        <input
          type="number" min={0} max={50}
          value={input.daily_limit}
          onChange={(e) => set('daily_limit', parseInt(e.target.value) || 0)}
          className="form-input form-input--xs"
        />
      </label>

      <label className="form-field">
        <span className="form-label">단어 쿨다운 (분)</span>
        <input
          type="number" min={0} max={10080}
          value={input.word_cooldown_min}
          onChange={(e) => set('word_cooldown_min', parseInt(e.target.value) || 0)}
          className="form-input form-input--xs"
        />
      </label>

      <label className="form-field">
        <span className="form-label">응시 시간 (시작)</span>
        <input
          type="time"
          value={input.active_from ?? ''}
          onChange={(e) => set('active_from', e.target.value || null)}
          className="form-input form-input--sm"
        />
      </label>

      <label className="form-field">
        <span className="form-label">응시 시간 (종료)</span>
        <input
          type="time"
          value={input.active_to ?? ''}
          onChange={(e) => set('active_to', e.target.value || null)}
          className="form-input form-input--sm"
        />
      </label>

      <label className="form-field">
        <span className="form-label">Box 필터 (CSV: 1~5)</span>
        <input
          type="text"
          value={input.box_filter}
          onChange={(e) => set('box_filter', e.target.value)}
          className="form-input form-input--sm"
          placeholder="1,2,3,4"
        />
      </label>

      <label className="form-field">
        <span className="form-label">영작 포함</span>
        <Toggle
          checked={input.writing_enabled}
          onChange={(v) => set('writing_enabled', v)}
        />
      </label>
    </div>
  );
}

// ── Toggle (디자인 토큰 사용) ──
function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`vocab-policy-toggle ${checked ? 'is-on' : ''}`}
    >
      <span className="vocab-policy-toggle__knob" />
    </button>
  );
}
