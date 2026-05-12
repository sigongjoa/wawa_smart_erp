import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, GachaStudent, StudentSignupRequest } from '../api';
import { toast, useConfirm } from '../components/Toast';
import DialogShell from '../components/DialogShell';
import { useAuthStore } from '../store';

const GRADE_OPTIONS = ['중1', '중2', '중3', '고1', '고2', '고3'];

export default function GachaStudentPage() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin';
  const [scope, setScope] = useState<'mine' | 'all'>('mine');
  const [students, setStudents] = useState<GachaStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [gradeFilter, setGradeFilter] = useState('');

  // 추가 폼
  const [showAdd, setShowAdd] = useState(false);
  const [addName, setAddName] = useState('');
  const [addPin, setAddPin] = useState('');
  const [addGrade, setAddGrade] = useState('');
  const [adding, setAdding] = useState(false);

  // 수정
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editGrade, setEditGrade] = useState('');

  // PIN 초기화
  const [resetPinId, setResetPinId] = useState<string | null>(null);
  const [newPin, setNewPin] = useState('');
  const [generatedPin, setGeneratedPin] = useState<string | null>(null);
  const [pinBusy, setPinBusy] = useState(false);

  const { confirm: confirmDialog, ConfirmDialog } = useConfirm();

  // 자가 가입 요청 (pending)
  const [signupRequests, setSignupRequests] = useState<StudentSignupRequest[]>([]);
  const [signupBusy, setSignupBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getGachaStudents(isAdmin && scope === 'all' ? 'all' : 'mine');
      setStudents(data || []);
    } catch {
      setStudents([]);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, scope]);

  const loadSignupRequests = useCallback(async () => {
    try {
      const data = await api.getSignupRequests('pending');
      setSignupRequests(Array.isArray(data) ? data : []);
    } catch {
      setSignupRequests([]);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadSignupRequests(); }, [loadSignupRequests]);

  const handleApproveSignup = async (req: StudentSignupRequest) => {
    setSignupBusy(req.id);
    try {
      await api.approveSignupRequest(req.id);
      toast.success(`${req.name} 가입 승인 완료`);
      await Promise.all([loadSignupRequests(), load()]);
    } catch (err) {
      toast.error('승인 실패: ' + (err as Error).message);
    } finally {
      setSignupBusy(null);
    }
  };

  const handleRejectSignup = async (req: StudentSignupRequest) => {
    const reason = window.prompt(`${req.name} 가입 요청을 거절합니다.\n사유 (선택, 학생에게 표시되지 않음):`);
    if (reason === null) return; // 취소
    setSignupBusy(req.id);
    try {
      await api.rejectSignupRequest(req.id, reason || undefined);
      toast.success(`${req.name} 가입 거절`);
      await loadSignupRequests();
    } catch (err) {
      toast.error('거절 실패: ' + (err as Error).message);
    } finally {
      setSignupBusy(null);
    }
  };

  const filtered = useMemo(() => {
    let list = students;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(s => s.name.toLowerCase().includes(q));
    }
    if (gradeFilter) {
      list = list.filter(s => s.grade === gradeFilter);
    }
    return list;
  }, [students, search, gradeFilter]);

  const handleAdd = async () => {
    if (!addName.trim() || !addPin) return;
    setAdding(true);
    try {
      await api.createGachaStudent({ name: addName.trim(), pin: addPin, grade: addGrade || undefined });
      toast.success(`${addName} 학생 추가 완료`);
      setAddName(''); setAddPin(''); setAddGrade(''); setShowAdd(false);
      load();
    } catch (err) {
      toast.error('추가 실패: ' + (err as Error).message);
    } finally {
      setAdding(false);
    }
  };

  const handleUpdate = async (id: string) => {
    try {
      await api.updateGachaStudent(id, { name: editName, grade: editGrade });
      toast.success('수정 완료');
      setEditId(null);
      load();
    } catch (err) {
      toast.error('수정 실패: ' + (err as Error).message);
    }
  };

  const handleDelete = async (s: GachaStudent) => {
    const ok = await confirmDialog(`${s.name} 학생을 삭제하시겠습니까?\n관련 카드, 세션, 결과가 모두 삭제됩니다.`);
    if (!ok) return;
    try {
      await api.deleteGachaStudent(s.id);
      toast.success('삭제 완료');
      load();
    } catch (err) {
      toast.error('삭제 실패: ' + (err as Error).message);
    }
  };

  const handleResetPin = async () => {
    if (!resetPinId || newPin.length !== 4) return;
    setPinBusy(true);
    try {
      await api.resetGachaStudentPin(resetPinId, newPin);
      toast.success(`PIN 초기화 완료 (${newPin})`);
      setResetPinId(null); setNewPin(''); setGeneratedPin(null);
      load();
    } catch (err) {
      toast.error('PIN 초기화 실패: ' + (err as Error).message);
    } finally {
      setPinBusy(false);
    }
  };

  const handleGeneratePin = async () => {
    if (!resetPinId) return;
    setPinBusy(true);
    try {
      const res = await api.generateGachaStudentPin(resetPinId);
      setGeneratedPin(res.pin);
      toast.success(`PIN 생성됨: ${res.pin}`);
      load();
    } catch (err) {
      toast.error('PIN 생성 실패: ' + (err as Error).message);
    } finally {
      setPinBusy(false);
    }
  };

  function copyPin(pin: string) {
    void navigator.clipboard.writeText(pin).then(
      () => toast.success('PIN 클립보드 복사됨'),
      () => toast.error('복사 실패')
    );
  }

  return (
    <div className="gacha-page">
      {ConfirmDialog}

      {/* 자가 가입 요청 (pending) — 있을 때만 노출 */}
      {signupRequests.length > 0 && (
        <div className="gacha-form-card" style={{ borderColor: '#FAC000', background: '#FFFBEB' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            가입 요청 대기
            <span style={{
              background: '#FAC000', color: '#0a1f14',
              padding: '2px 8px', borderRadius: 12,
              fontSize: 12, fontWeight: 800,
            }}>{signupRequests.length}</span>
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
            {signupRequests.map((req) => (
              <div key={req.id} style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 2fr auto',
                gap: 12,
                alignItems: 'center',
                padding: '10px 12px',
                background: '#fff',
                border: '1px solid #eee',
                borderRadius: 8,
              }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{req.name}</div>
                  <div style={{ fontSize: 12, color: '#666' }}>{req.grade ?? '학년 미지정'}</div>
                </div>
                <div style={{ fontSize: 12, color: '#666' }}>
                  {new Date(req.submitted_at + (req.submitted_at.endsWith('Z') ? '' : 'Z')).toLocaleString('ko-KR', {
                    month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
                  })}
                </div>
                <div style={{ fontSize: 12, color: '#444', wordBreak: 'break-word', display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {req.requested_teacher_name ? (
                    <span><strong style={{ color: '#0a1f14' }}>지정 선생님:</strong> {req.requested_teacher_name}</span>
                  ) : (
                    <span style={{ color: '#aaa' }}>지정 선생님 없음</span>
                  )}
                  {req.memo && <span style={{ color: '#888' }}>{req.memo}</span>}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    className="btn-primary"
                    disabled={signupBusy === req.id}
                    onClick={() => handleApproveSignup(req)}
                  >
                    {signupBusy === req.id ? '...' : '✓ 승인'}
                  </button>
                  <button
                    className="btn-secondary"
                    disabled={signupBusy === req.id}
                    onClick={() => handleRejectSignup(req)}
                  >
                    ✗ 거절
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="gacha-page-header">
        <h1>학습 학생 관리</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {isAdmin && (
            <div className="scope-toggle" role="group">
              <button
                className={`scope-toggle-btn ${scope === 'mine' ? 'scope-toggle-btn--active' : ''}`}
                onClick={() => setScope('mine')}
              >내 학생</button>
              <button
                className={`scope-toggle-btn ${scope === 'all' ? 'scope-toggle-btn--active' : ''}`}
                onClick={() => setScope('all')}
              >모두 보기</button>
            </div>
          )}
          <button className="btn-primary" onClick={() => setShowAdd(true)}>+ 학생 추가</button>
        </div>
      </div>

      {/* 필터 */}
      <div className="gacha-filters">
        <input
          type="text"
          placeholder="이름 검색..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="gacha-search"
        />
        <select value={gradeFilter} onChange={e => setGradeFilter(e.target.value)} className="gacha-select">
          <option value="">전체 학년</option>
          {GRADE_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
      </div>

      {/* 추가 폼 */}
      {showAdd && (
        <div className="gacha-form-card">
          <h3>학생 추가</h3>
          <div className="gacha-form-row">
            <input placeholder="이름" value={addName} onChange={e => setAddName(e.target.value)} />
            <input placeholder="PIN (4자리)" value={addPin} onChange={e => setAddPin(e.target.value.replace(/\D/g, '').slice(0, 4))} maxLength={4} />
            <select value={addGrade} onChange={e => setAddGrade(e.target.value)}>
              <option value="">학년 선택</option>
              {GRADE_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div className="gacha-form-actions">
            <button className="btn-secondary" onClick={() => setShowAdd(false)}>취소</button>
            <button className="btn-primary" onClick={handleAdd} disabled={adding || !addName.trim() || addPin.length !== 4}>
              {adding ? '추가 중...' : '추가'}
            </button>
          </div>
        </div>
      )}

      {/* PIN 초기화 모달 */}
      {resetPinId && (
        <DialogShell
          ariaLabel="PIN 재설정"
          onClose={() => { setResetPinId(null); setGeneratedPin(null); setNewPin(''); }}
          overlayClassName="gacha-modal-overlay"
        >
          <div className="gacha-modal" onClick={e => e.stopPropagation()}>
            <h3>PIN 재설정</h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '6px 0 12px' }}>
              <strong>{students.find(s => s.id === resetPinId)?.name}</strong> 학생의 PIN.
              저장된 PIN은 단방향 해시라 보기는 불가하며, 새 값으로만 변경할 수 있습니다.
            </p>

            {generatedPin ? (
              <div className="gacha-pin-display">
                <div className="gacha-pin-display-label">새 PIN</div>
                <div className="gacha-pin-display-value">{generatedPin}</div>
                <button className="btn-sm btn-primary" onClick={() => copyPin(generatedPin)}>복사</button>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 12 }}>
                  이 PIN은 한 번만 표시됩니다. 학생에게 즉시 안내해주세요.
                </p>
                <div className="gacha-form-actions">
                  <button className="btn-primary" onClick={() => { setResetPinId(null); setGeneratedPin(null); setNewPin(''); }}>완료</button>
                </div>
              </div>
            ) : (
              <>
                <input
                  placeholder="새 PIN 4자리 직접 입력"
                  value={newPin}
                  onChange={e => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  maxLength={4}
                  autoFocus
                />
                <div className="gacha-form-actions" style={{ flexWrap: 'wrap', gap: 8 }}>
                  <button
                    className="btn-secondary"
                    onClick={handleGeneratePin}
                    disabled={pinBusy}
                    title="서버가 4자리 랜덤 PIN 생성"
                  >🎲 자동 생성</button>
                  <button className="btn-secondary" onClick={() => setResetPinId(null)}>취소</button>
                  <button
                    className="btn-primary"
                    onClick={handleResetPin}
                    disabled={pinBusy || newPin.length !== 4}
                  >{pinBusy ? '저장 중…' : '저장'}</button>
                </div>
              </>
            )}
          </div>
        </DialogShell>
      )}

      {/* 목록 */}
      {loading ? (
        <div className="gacha-loading">불러오는 중...</div>
      ) : filtered.length === 0 ? (
        <div className="gacha-empty">학생이 없습니���. 위 버튼으로 추가해주세요.</div>
      ) : (
        <div className="gacha-student-list">
          {filtered.map(s => (
            <div key={s.id} className="gacha-student-card">
              {editId === s.id ? (
                <div className="gacha-edit-inline">
                  <input value={editName} onChange={e => setEditName(e.target.value)} />
                  <select value={editGrade} onChange={e => setEditGrade(e.target.value)}>
                    <option value="">학년</option>
                    {GRADE_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                  <button className="btn-sm btn-primary" onClick={() => handleUpdate(s.id)}>저장</button>
                  <button className="btn-sm btn-secondary" onClick={() => setEditId(null)}>취소</button>
                </div>
              ) : (
                <>
                  <div className="gacha-student-info">
                    <span className="gacha-student-name">{s.name}</span>
                    <span className="gacha-student-grade">{s.grade || '-'}</span>
                    <span className={`gacha-student-status gacha-student-status--${s.status}`}>
                      {s.status === 'active' ? '활성' : '비활성'}
                    </span>
                    {(!s.pin_hash || s.pin_hash.length === 0) && (
                      <span className="gacha-student-status gacha-student-status--no-pin" title="PIN 미설정 — 학생 로그인 불가">
                        PIN 미설정
                      </span>
                    )}
                  </div>
                  <div className="gacha-student-stats">
                    <span>카드 {s.card_count ?? 0}장</span>
                    <span>증명 {s.proof_count ?? 0}개</span>
                  </div>
                  <div className="gacha-student-actions">
                    <button className="btn-sm" onClick={() => { setEditId(s.id); setEditName(s.name); setEditGrade(s.grade || ''); }}>수정</button>
                    <button className="btn-sm" onClick={() => { setResetPinId(s.id); setNewPin(''); }}>PIN</button>
                    <button className="btn-sm btn-danger" onClick={() => handleDelete(s)}>삭제</button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="gacha-summary">
        총 {filtered.length}명 {gradeFilter && `(${gradeFilter})`}
      </div>
    </div>
  );
}
