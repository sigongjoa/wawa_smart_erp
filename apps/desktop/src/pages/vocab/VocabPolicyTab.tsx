import { useEffect, useMemo, useState } from 'react';
import { api, GachaStudent, VocabExamPolicy, VocabExamPolicyInput } from '../../api';

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

function policyToInput(p: VocabExamPolicy | null): VocabExamPolicyInput {
  if (!p) return { ...DEFAULT_INPUT };
  return {
    vocab_count: p.vocab_count,
    context_count: p.context_count,
    grammar_count: p.grammar_count,
    writing_enabled: !!p.writing_enabled,
    writing_type: p.writing_type,
    box_filter: p.box_filter,
    source: p.source,
    textbook_id: p.textbook_id,
    time_limit_sec: p.time_limit_sec,
    cooldown_min: p.cooldown_min,
    daily_limit: p.daily_limit,
    active_from: p.active_from,
    active_to: p.active_to,
    word_cooldown_min: p.word_cooldown_min,
    ai_grading: !!p.ai_grading,
    enabled: !!p.enabled,
  };
}

export default function VocabPolicyTab() {
  const [policies, setPolicies] = useState<VocabExamPolicy[]>([]);
  const [students, setStudents] = useState<GachaStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingScope, setSavingScope] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  // 학원 기본 정책 폼
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
      setMsg(`불러오기 실패: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  const studentPolicyMap = useMemo(() => {
    const m = new Map<string, VocabExamPolicy>();
    for (const p of policies) if (p.scope === 'student' && p.scope_id) m.set(p.scope_id, p);
    return m;
  }, [policies]);

  async function saveAcademy() {
    setSavingScope('academy');
    try {
      await api.upsertVocabPolicy('academy', '_', acadInput);
      setMsg('학원 기본 정책 저장됨');
      await load();
    } catch (e: any) {
      setMsg(`저장 실패: ${e.message}`);
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
    setSavingScope(editingStudent);
    try {
      await api.upsertVocabPolicy('student', editingStudent, studentInput);
      setMsg(`학생 정책 저장됨`);
      setEditingStudent(null);
      await load();
    } catch (e: any) {
      setMsg(`저장 실패: ${e.message}`);
    } finally {
      setSavingScope(null);
    }
  }

  async function clearStudent(sid: string) {
    if (!confirm('이 학생의 오버라이드를 삭제할까요? (학원 기본 정책이 적용됩니다)')) return;
    setSavingScope(sid);
    try {
      await api.deleteVocabPolicy('student', sid);
      await load();
    } catch (e: any) {
      setMsg(`삭제 실패: ${e.message}`);
    } finally {
      setSavingScope(null);
    }
  }

  if (loading) return <div className="p-4 text-slate-500">불러오는 중…</div>;

  return (
    <div className="space-y-6 p-4">
      {msg && (
        <div className="rounded bg-blue-50 border border-blue-200 px-3 py-2 text-sm text-blue-800">
          {msg}
        </div>
      )}

      <section className="rounded-lg border bg-white p-4">
        <h2 className="text-lg font-bold mb-3">학원 기본 정책</h2>
        <p className="text-xs text-slate-500 mb-4">
          학생/교사 오버라이드가 없을 때 모든 학생에게 적용됩니다. 학생이 직접 시험을 시작할 때 이 설정으로 출제됩니다.
        </p>
        <PolicyForm input={acadInput} onChange={setAcadInput} />
        <div className="flex justify-end mt-4">
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded font-semibold disabled:opacity-50"
            onClick={saveAcademy}
            disabled={savingScope === 'academy'}
          >
            {savingScope === 'academy' ? '저장 중…' : '저장'}
          </button>
        </div>
      </section>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="text-lg font-bold mb-3">학생별 오버라이드</h2>
        <p className="text-xs text-slate-500 mb-4">
          특정 학생만 다른 정책을 적용하고 싶을 때 설정. 미설정 학생은 학원 기본 정책을 따릅니다.
        </p>

        {students.length === 0 ? (
          <div className="text-sm text-slate-500">담당 학생이 없습니다.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-500 border-b">
              <tr>
                <th className="pb-2 pr-2">이름</th>
                <th className="pb-2 pr-2">정책</th>
                <th className="pb-2 pr-2">문항</th>
                <th className="pb-2 pr-2">쿨다운</th>
                <th className="pb-2 pr-2">일일</th>
                <th className="pb-2 pr-2 text-right">작업</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => {
                const p = studentPolicyMap.get(s.id);
                return (
                  <tr key={s.id} className="border-b last:border-0">
                    <td className="py-2 pr-2 font-medium">{s.name}</td>
                    <td className="py-2 pr-2">
                      {p ? (
                        <span className="text-blue-700 font-semibold">오버라이드</span>
                      ) : (
                        <span className="text-slate-400">학원 기본</span>
                      )}
                    </td>
                    <td className="py-2 pr-2">{p?.vocab_count ?? '-'}</td>
                    <td className="py-2 pr-2">{p ? `${p.cooldown_min}분` : '-'}</td>
                    <td className="py-2 pr-2">{p?.daily_limit ?? '-'}</td>
                    <td className="py-2 pr-2 text-right space-x-2">
                      <button
                        className="px-2 py-1 text-xs bg-slate-100 rounded hover:bg-slate-200"
                        onClick={() => startEditStudent(s.id)}
                      >
                        편집
                      </button>
                      {p && (
                        <button
                          className="px-2 py-1 text-xs bg-red-50 text-red-700 rounded hover:bg-red-100"
                          onClick={() => clearStudent(s.id)}
                          disabled={savingScope === s.id}
                        >
                          기본으로
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {editingStudent && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">
                {students.find((s) => s.id === editingStudent)?.name} 정책
              </h3>
              <button
                className="text-slate-400 hover:text-slate-600"
                onClick={() => setEditingStudent(null)}
              >
                ✕
              </button>
            </div>
            <PolicyForm input={studentInput} onChange={setStudentInput} />
            <div className="flex justify-end gap-2 mt-4">
              <button
                className="px-4 py-2 bg-slate-100 rounded"
                onClick={() => setEditingStudent(null)}
              >
                취소
              </button>
              <button
                className="px-4 py-2 bg-blue-600 text-white rounded font-semibold disabled:opacity-50"
                onClick={saveStudent}
                disabled={savingScope === editingStudent}
              >
                {savingScope === editingStudent ? '저장 중…' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PolicyForm({
  input, onChange,
}: { input: VocabExamPolicyInput; onChange: (next: VocabExamPolicyInput) => void }) {
  const set = <K extends keyof VocabExamPolicyInput>(k: K, v: VocabExamPolicyInput[K]) =>
    onChange({ ...input, [k]: v });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Field label="활성화">
        <Toggle checked={input.enabled} onChange={(v) => set('enabled', v)} />
      </Field>

      <Field label="문항 수">
        <input
          type="number" min={1} max={50}
          value={input.vocab_count}
          onChange={(e) => set('vocab_count', parseInt(e.target.value) || 10)}
          className="border rounded px-2 py-1 w-24"
        />
      </Field>

      <Field label="응시 시간 (초, 0=무제한)">
        <input
          type="number" min={0} max={7200}
          value={input.time_limit_sec}
          onChange={(e) => set('time_limit_sec', parseInt(e.target.value) || 0)}
          className="border rounded px-2 py-1 w-32"
        />
      </Field>

      <Field label="쿨다운 (분)">
        <input
          type="number" min={0} max={1440}
          value={input.cooldown_min}
          onChange={(e) => set('cooldown_min', parseInt(e.target.value) || 0)}
          className="border rounded px-2 py-1 w-24"
        />
      </Field>

      <Field label="일일 한도 (회, 0=무제한)">
        <input
          type="number" min={0} max={50}
          value={input.daily_limit}
          onChange={(e) => set('daily_limit', parseInt(e.target.value) || 0)}
          className="border rounded px-2 py-1 w-24"
        />
      </Field>

      <Field label="단어 쿨다운 (분)">
        <input
          type="number" min={0} max={10080}
          value={input.word_cooldown_min}
          onChange={(e) => set('word_cooldown_min', parseInt(e.target.value) || 0)}
          className="border rounded px-2 py-1 w-24"
        />
      </Field>

      <Field label="응시 가능 시간 (시작)">
        <input
          type="time"
          value={input.active_from ?? ''}
          onChange={(e) => set('active_from', e.target.value || null)}
          className="border rounded px-2 py-1"
        />
      </Field>

      <Field label="응시 가능 시간 (종료)">
        <input
          type="time"
          value={input.active_to ?? ''}
          onChange={(e) => set('active_to', e.target.value || null)}
          className="border rounded px-2 py-1"
        />
      </Field>

      <Field label="박스 필터 (CSV)">
        <input
          type="text"
          value={input.box_filter}
          onChange={(e) => set('box_filter', e.target.value)}
          className="border rounded px-2 py-1 w-32"
          placeholder="1,2,3,4"
        />
      </Field>

      <Field label="영작 포함">
        <Toggle
          checked={input.writing_enabled}
          onChange={(v) => set('writing_enabled', v)}
        />
      </Field>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-slate-600 font-semibold">{label}</span>
      <div>{children}</div>
    </label>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 rounded-full transition-colors ${
        checked ? 'bg-blue-600' : 'bg-slate-300'
      }`}
    >
      <span
        className={`absolute top-0.5 inline-block h-5 w-5 rounded-full bg-white transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}
