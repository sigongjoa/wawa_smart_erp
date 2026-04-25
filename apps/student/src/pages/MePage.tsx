import { useAuthStore } from '../store';
import { useNavigate } from 'react-router-dom';
import VocabExamCard from '../components/VocabExamCard';

export default function MePage() {
  const student = useAuthStore((s) => s.auth?.student);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const hasGrade = !!student?.grade && student.grade !== '미지정';

  return (
    <div>
      <header className="page-header">
        <h1 className="page-title">나</h1>
      </header>
      <div className="page-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
        <section className="card-surface">
          <div className="card-label">학생</div>
          <div className="stat-number">{student?.name || '-'}</div>
          {hasGrade && (
            <div style={{ fontSize: 'var(--fs-body)', color: 'var(--ink-60)', marginTop: 'var(--sp-1)' }}>
              {student!.grade}
            </div>
          )}
        </section>

        <VocabExamCard />

        <button type="button" className="btn-danger-outline" onClick={handleLogout}>
          로그아웃
        </button>
      </div>
    </div>
  );
}
