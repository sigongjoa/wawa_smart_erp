import { useCallback, useEffect, useState } from 'react';
import { api, MaterialItem, Student } from '../api';
import { toast, useConfirm } from '../components/Toast';

type StatusFilter = '' | 'todo' | 'done';

export default function MaterialsPage() {
  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [filter, setFilter] = useState<StatusFilter>('');
  const [studentFilter, setStudentFilter] = useState('');
  const [loading, setLoading] = useState(true);

  // 빠른 추가 폼
  const [addStudentId, setAddStudentId] = useState('');
  const [addTitle, setAddTitle] = useState('');
  const [adding, setAdding] = useState(false);

  // 파일 URL 편집
  const [editingFile, setEditingFile] = useState<string | null>(null);
  const [fileUrlDraft, setFileUrlDraft] = useState('');

  const { confirm: confirmDialog, ConfirmDialog } = useConfirm();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: { status?: string; studentId?: string } = {};
      if (filter) params.status = filter;
      if (studentFilter) params.studentId = studentFilter;
      const data = await api.getMaterials(params);
      setMaterials(data || []);
    } catch {
      setMaterials([]);
    } finally {
      setLoading(false);
    }
  }, [filter, studentFilter]);

  useEffect(() => { load(); }, [load]);

  // 학생 목록 1회 로드
  useEffect(() => {
    api.getStudents().then(setStudents).catch(() => {});
  }, []);

  const handleAdd = async () => {
    if (!addStudentId || !addTitle.trim()) return;
    setAdding(true);
    try {
      await api.createMaterial({ studentId: addStudentId, title: addTitle.trim() });
      setAddTitle('');
      toast.success('교재 등록 완료');
      load();
    } catch (err) {
      toast.error('등록 실패: ' + (err as Error).message);
    } finally {
      setAdding(false);
    }
  };

  const handleToggleStatus = async (item: MaterialItem) => {
    const newStatus = item.status === 'todo' ? 'done' : 'todo';
    try {
      await api.updateMaterial(item.id, { status: newStatus });
      setMaterials((prev) =>
        prev.map((m) => m.id === item.id ? { ...m, status: newStatus, completed_at: newStatus === 'done' ? new Date().toISOString() : null } : m)
      );
    } catch (err) {
      toast.error('상태 변경 실패: ' + (err as Error).message);
    }
  };

  const handleFileSave = async (id: string) => {
    try {
      await api.updateMaterial(id, { fileUrl: fileUrlDraft });
      setMaterials((prev) =>
        prev.map((m) => m.id === id ? { ...m, file_url: fileUrlDraft } : m)
      );
      setEditingFile(null);
      setFileUrlDraft('');
      toast.success('파일 링크 저장');
    } catch (err) {
      toast.error('저장 실패: ' + (err as Error).message);
    }
  };

  const handleDelete = async (item: MaterialItem) => {
    const ok = await confirmDialog(`"${item.title}" 삭제할까요?`);
    if (!ok) return;
    try {
      await api.deleteMaterial(item.id);
      setMaterials((prev) => prev.filter((m) => m.id !== item.id));
    } catch (err) {
      toast.error('삭제 실패: ' + (err as Error).message);
    }
  };

  const counts = {
    all: materials.length,
    todo: materials.filter((m) => m.status === 'todo').length,
    done: materials.filter((m) => m.status === 'done').length,
  };

  const formatDate = (d: string) => d?.split('T')[0] || d?.split(' ')[0] || '';

  return (
    <div className="materials-page">
      <div className="materials-header">
        <h2 className="page-title">교재 관리</h2>
      </div>

      {/* 빠른 추가 */}
      <div className="materials-add" data-testid="materials-add-form">
        <select
          className="materials-add-select"
          value={addStudentId}
          onChange={(e) => setAddStudentId(e.target.value)}
          aria-label="학생 선택"
        >
          <option value="">학생 선택</option>
          {students.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <input
          className="materials-add-input"
          type="text"
          placeholder="교재 제목 입력"
          value={addTitle}
          onChange={(e) => setAddTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
          aria-label="교재 제목"
        />
        <button
          className="btn btn-primary materials-add-btn"
          onClick={handleAdd}
          disabled={adding || !addStudentId || !addTitle.trim()}
        >
          {adding ? '등록 중...' : '추가'}
        </button>
      </div>

      {/* 필터 */}
      <div className="materials-filters">
        <div className="materials-status-filters">
          {([
            { key: '' as StatusFilter, label: '전체', count: counts.all },
            { key: 'todo' as StatusFilter, label: '미완료', count: counts.todo },
            { key: 'done' as StatusFilter, label: '완료', count: counts.done },
          ]).map(({ key, label, count }) => (
            <button
              key={key}
              className={`filter-btn ${filter === key ? 'filter-btn--active' : ''}`}
              onClick={() => setFilter(key)}
            >
              {label}
              {count > 0 && <span className="filter-count">{count}</span>}
            </button>
          ))}
        </div>
        <select
          className="materials-student-filter"
          value={studentFilter}
          onChange={(e) => setStudentFilter(e.target.value)}
          aria-label="학생 필터"
        >
          <option value="">전체 학생</option>
          {students.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="rpt-loading" role="status">
          <div className="rpt-spinner" />
          <span>로딩 중...</span>
        </div>
      ) : materials.length === 0 ? (
        <div className="materials-empty">
          {filter === 'todo' ? '미완료 교재가 없습니다' :
           filter === 'done' ? '완료된 교재가 없습니다' :
           '등록된 교재가 없습니다. 위에서 추가해보세요.'}
        </div>
      ) : (
        <>
          {/* 데스크탑 테이블 */}
          <table className="materials-table materials-desktop" data-testid="materials-table">
            <thead>
              <tr>
                <th className="materials-th-status">상태</th>
                <th className="materials-th-student">학생</th>
                <th className="materials-th-title">제목</th>
                <th className="materials-th-file">파일</th>
                <th className="materials-th-date">등록일</th>
                <th className="materials-th-action"></th>
              </tr>
            </thead>
            <tbody>
              {materials.map((m) => (
                <tr key={m.id} className={m.status === 'done' ? 'materials-row--done' : ''} data-testid={`material-row-${m.id}`}>
                  <td>
                    <button
                      className={`materials-check ${m.status === 'done' ? 'materials-check--done' : ''}`}
                      onClick={() => handleToggleStatus(m)}
                      aria-label={m.status === 'done' ? '미완료로 변경' : '완료로 변경'}
                      data-testid={`toggle-${m.id}`}
                    >
                      {m.status === 'done' ? '●' : '○'}
                    </button>
                  </td>
                  <td className="materials-cell-student">{m.student_name}</td>
                  <td className={`materials-cell-title ${m.status === 'done' ? 'materials-cell-title--done' : ''}`}>
                    {m.title}
                    {m.memo && <span className="materials-memo">{m.memo}</span>}
                  </td>
                  <td className="materials-cell-file">
                    {editingFile === m.id ? (
                      <div className="materials-file-edit">
                        <input
                          type="url"
                          className="materials-file-input"
                          placeholder="구글드라이브 URL"
                          value={fileUrlDraft}
                          onChange={(e) => setFileUrlDraft(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleFileSave(m.id); if (e.key === 'Escape') setEditingFile(null); }}
                          autoFocus
                          data-testid={`file-input-${m.id}`}
                        />
                        <button className="btn btn-sm btn-primary" onClick={() => handleFileSave(m.id)}>저장</button>
                        <button className="btn btn-sm btn-secondary" onClick={() => setEditingFile(null)}>취소</button>
                      </div>
                    ) : m.file_url ? (
                      <div className="materials-file-link">
                        <a href={m.file_url} target="_blank" rel="noopener noreferrer" className="materials-open-link" data-testid={`file-link-${m.id}`}>
                          📎 열기
                        </a>
                        <button
                          className="materials-edit-link"
                          onClick={() => { setEditingFile(m.id); setFileUrlDraft(m.file_url); }}
                          aria-label="파일 링크 수정"
                        >
                          수정
                        </button>
                      </div>
                    ) : (
                      <button
                        className="materials-add-file"
                        onClick={() => { setEditingFile(m.id); setFileUrlDraft(''); }}
                        data-testid={`add-file-${m.id}`}
                      >
                        + 파일 연결
                      </button>
                    )}
                  </td>
                  <td className="materials-cell-date">{formatDate(m.created_at)}</td>
                  <td>
                    <button
                      className="materials-delete"
                      onClick={() => handleDelete(m)}
                      aria-label="삭제"
                      data-testid={`delete-${m.id}`}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* 모바일 카드 */}
          <div className="materials-cards materials-mobile" data-testid="materials-cards">
            {materials.map((m) => (
              <div key={m.id} className={`materials-card ${m.status === 'done' ? 'materials-card--done' : ''}`} data-testid={`material-card-${m.id}`}>
                <div className="materials-card-top">
                  <button
                    className={`materials-check ${m.status === 'done' ? 'materials-check--done' : ''}`}
                    onClick={() => handleToggleStatus(m)}
                    aria-label={m.status === 'done' ? '미완료로 변경' : '완료로 변경'}
                  >
                    {m.status === 'done' ? '●' : '○'}
                  </button>
                  <div className="materials-card-info">
                    <span className="materials-card-student">{m.student_name}</span>
                    <span className={`materials-card-title ${m.status === 'done' ? 'materials-cell-title--done' : ''}`}>{m.title}</span>
                  </div>
                  <button className="materials-delete" onClick={() => handleDelete(m)} aria-label="삭제">×</button>
                </div>
                {m.memo && <div className="materials-card-memo">{m.memo}</div>}
                <div className="materials-card-bottom">
                  <span className="materials-card-date">{formatDate(m.created_at)}</span>
                  {editingFile === m.id ? (
                    <div className="materials-file-edit">
                      <input
                        type="url"
                        className="materials-file-input"
                        placeholder="구글드라이브 URL"
                        value={fileUrlDraft}
                        onChange={(e) => setFileUrlDraft(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleFileSave(m.id); if (e.key === 'Escape') setEditingFile(null); }}
                        autoFocus
                      />
                      <button className="btn btn-sm btn-primary" onClick={() => handleFileSave(m.id)}>저장</button>
                    </div>
                  ) : m.file_url ? (
                    <a href={m.file_url} target="_blank" rel="noopener noreferrer" className="materials-open-link">
                      📎 열기
                    </a>
                  ) : (
                    <button className="materials-add-file" onClick={() => { setEditingFile(m.id); setFileUrlDraft(''); }}>
                      + 파일
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {ConfirmDialog}
    </div>
  );
}
