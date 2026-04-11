import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, Student } from '../api';
import { useAuthStore } from '../store';

export default function StudentListPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin';

  const [students, setStudents] = useState<Student[]>([]);
  const [search, setSearch] = useState('');
  const [activeOnly, setActiveOnly] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getStudents().then((data) => {
      setStudents(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    return students.filter((s) => {
      if (activeOnly && s.status !== 'active') return false;
      if (search && !s.name.includes(search)) return false;
      return true;
    });
  }, [students, search, activeOnly]);

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
        </div>
      </div>

      {loading ? (
        <p className="student-list-empty">불러오는 중...</p>
      ) : filtered.length === 0 ? (
        <p className="student-list-empty">담당 학생이 없습니다</p>
      ) : (
        <div className="student-list-grid">
          {filtered.map((s) => (
            <button
              key={s.id}
              className="student-card"
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
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
