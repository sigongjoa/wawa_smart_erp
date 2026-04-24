import { useAuthStore } from '../store';
import { useNavigate } from 'react-router-dom';

export default function MePage() {
  const student = useAuthStore((s) => s.auth?.student);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div>
      <header className="page-header">
        <h1 className="page-title">나</h1>
      </header>
      <div style={{ padding: '0 20px' }}>
        <section
          style={{
            background: 'var(--bg-card)',
            border: 'var(--border-hairline)',
            borderRadius: 'var(--r-lg)',
            padding: '20px',
            marginBottom: '16px',
          }}
        >
          <div style={{
            fontSize: 'var(--fs-caption)',
            fontWeight: 'var(--fw-semi)',
            color: 'var(--ink-60)',
            letterSpacing: 'var(--ls-caption)',
            textTransform: 'uppercase',
            marginBottom: '8px',
          }}>
            학생
          </div>
          <div style={{ fontSize: 'var(--fs-title-1)', fontWeight: 'var(--fw-black)', color: 'var(--ink)' }}>
            {student?.name || '-'}
          </div>
          {student?.grade && student.grade !== '미지정' && (
            <div style={{ fontSize: 'var(--fs-body)', color: 'var(--ink-60)', marginTop: '4px' }}>
              {student.grade}
            </div>
          )}
        </section>

        <button
          type="button"
          onClick={handleLogout}
          style={{
            width: '100%',
            padding: '14px',
            minHeight: '48px',
            background: 'var(--bg-card)',
            border: '1.5px solid var(--danger)',
            borderRadius: 'var(--r-md)',
            color: 'var(--danger)',
            fontSize: 'var(--fs-body)',
            fontWeight: 'var(--fw-semi)',
            fontFamily: 'var(--font-display)',
            cursor: 'pointer',
          }}
        >
          로그아웃
        </button>
      </div>
    </div>
  );
}
