import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, Student } from '../api';
import { useAuthStore } from '../store';

const GRADE_OPTIONS = [
  '초4', '초5', '초6',
  '중1', '중2', '중3',
  '고1', '고2', '고3',
];

export default function StudentListPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const [students, setStudents] = useState<Student[]>([]);
  const [search, setSearch] = useState('');
  const [activeOnly, setActiveOnly] = useState(true);
  const [loading, setLoading] = useState(true);

  // 학생 추가 모달
  const [showAdd, setShowAdd] = useState(false);
  const [addName, setAddName] = useState('');
  const [addGrade, setAddGrade] = useState('');
  const [addContact, setAddContact] = useState('');
  const [addGuardian, setAddGuardian] = useState('');
  const [addSaving, setAddSaving] = useState(false);

  useEffect(() => {
    loadStudents();
  }, []);

  const loadStudents = () => {
    setLoading(true);
    api.getStudents().then((data) => {
      setStudents(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  const filtered = useMemo(() => {
    return students.filter((s) => {
      if (activeOnly && s.status !== 'active') return false;
      if (search && !s.name.includes(search)) return false;
      return true;
    });
  }, [students, search, activeOnly]);

  const handleAdd = async () => {
    if (!addName.trim() || !addGrade) return;
    setAddSaving(true);
    try {
      await api.createStudent({
        name: addName.trim(),
        grade: addGrade,
        contact: addContact.trim() || undefined,
        guardian_contact: addGuardian.trim() || undefined,
      });
      setShowAdd(false);
      setAddName('');
      setAddGrade('');
      setAddContact('');
      setAddGuardian('');
      loadStudents();
    } catch (err: any) {
      alert(err.message || '학생 추가 실패');
    } finally {
      setAddSaving(false);
    }
  };

  const closeModal = () => {
    setShowAdd(false);
    setAddName('');
    setAddGrade('');
    setAddContact('');
    setAddGuardian('');
  };

  return (
    <div className="student-list-page">
      <div className="student-list-header">
        <div className="student-list-title-row">
          <h2>내 학생</h2>
          <span className="student-count">{filtered.length}명</span>
        </div>
        <div className="student-list-filters">
          <input
            type="text"
            placeholder="이름 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="student-search-input"
          />
          <label className="student-filter-toggle">
            <input
              type="checkbox"
              checked={activeOnly}
              onChange={(e) => setActiveOnly(e.target.checked)}
            />
            활성만
          </label>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>
            + 학생 추가
          </button>
        </div>
      </div>

      {loading ? (
        <p className="student-list-empty">불러오는 중...</p>
      ) : filtered.length === 0 ? (
        <div className="student-list-empty-state">
          <p className="student-list-empty-title">담당 학생이 없습니다</p>
          <p className="student-list-empty-desc">학생을 추가하고 수업을 시작하세요</p>
          <button className="btn btn-accent" onClick={() => setShowAdd(true)}>
            첫 학생 추가하기
          </button>
        </div>
      ) : (
        <div className="student-list-grid">
          {filtered.map((s) => (
            <button
              key={s.id}
              className={`student-card ${s.status !== 'active' ? 'student-card--inactive' : ''}`}
              onClick={() => navigate(`/student/${s.id}`)}
            >
              <div className="student-card-name">{s.name}</div>
              <div className="student-card-meta">
                {s.grade && <span className="student-card-grade">{s.grade}</span>}
                {s.subjects.length > 0 && (
                  <span className="student-card-subjects">
                    {s.subjects.join(', ')}
                  </span>
                )}
              </div>
              {s.status !== 'active' && (
                <span className="student-card-status">{s.status === 'inactive' ? '비활성' : s.status}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* 학생 추가 모달 */}
      {showAdd && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <h3 className="modal-title">학생 추가</h3>
            <div className="modal-body">
              <input
                className="form-input"
                placeholder="학생 이름"
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                autoFocus
              />
              <select
                className="form-select"
                value={addGrade}
                onChange={(e) => setAddGrade(e.target.value)}
              >
                <option value="">학년 선택</option>
                {GRADE_OPTIONS.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
              <input
                className="form-input"
                placeholder="학생 연락처 (선택)"
                value={addContact}
                onChange={(e) => setAddContact(e.target.value)}
              />
              <input
                className="form-input"
                placeholder="학부모 연락처 (선택)"
                value={addGuardian}
                onChange={(e) => setAddGuardian(e.target.value)}
              />
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={closeModal}>취소</button>
              <button
                className="btn btn-primary"
                onClick={handleAdd}
                disabled={addSaving || !addName.trim() || !addGrade}
              >
                {addSaving ? '추가 중...' : '추가'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
