import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../services/api';
import { useToastStore } from '../../stores/toastStore';
import { useReportStore } from '../../stores/reportStore';
import cacheManager from '../../utils/cache';

/**
 * Cloudflare Workers API 기반 로그인 페이지
 */
export default function CloudflareLogin() {
  const navigate = useNavigate();
  const { addToast } = useToastStore();
  const { setCurrentUser } = useReportStore();

  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [apiHealth, setApiHealth] = useState<boolean | null>(null);

  // API 상태 확인
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const healthy = await apiClient.healthCheck();
        setApiHealth(healthy);
        if (!healthy) {
          addToast('API 서버에 연결할 수 없습니다', 'warning');
        }
      } catch (error) {
        setApiHealth(false);
        addToast('API 상태 확인 실패', 'error');
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 30000); // 30초마다 확인
    return () => clearInterval(interval);
  }, [addToast]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name || !pin) {
      addToast('선생님 이름과 PIN을 입력해주세요', 'warning');
      return;
    }

    if (pin.length < 4) {
      addToast('PIN은 최소 4자 이상이어야 합니다', 'warning');
      return;
    }

    setIsLoading(true);

    try {
      // API 로그인
      const user = await apiClient.login(name, pin);

      // 사용자 정보 저장
      setCurrentUser({
        teacher: {
          id: user.id,
          name: user.name,
          isAdmin: user.role === 'admin',
          subjects: [],
          pin: '', // PIN은 저장하지 않음
        },
        loginAt: new Date().toISOString(),
      });

      // 초기 데이터 캐싱
      await cacheManager.set('students', 'initialized', true, 3600000); // 1시간 TTL

      addToast(`${user.name} 선생님, 환영합니다!`, 'success');

      // 대시보드로 이동
      setTimeout(() => navigate('/timer'), 500);
    } catch (error) {
      console.error('Login error:', error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : '로그인 실패. 이메일과 비밀번호를 확인해주세요.';
      addToast(errorMessage, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="login-container"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'var(--background)',
      }}
    >
      <div
        className="card login-card"
        style={{
          width: '100%',
          maxWidth: '400px',
          padding: '40px',
          textAlign: 'center',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        {/* 헤더 */}
        <div style={{ marginBottom: '32px' }}>
          <div
            className="header-logo-icon"
            style={{ margin: '0 auto 16px', background: 'var(--primary)', width: '60px', height: '60px' }}
          >
            <span className="material-symbols-outlined" style={{ color: 'white', fontSize: '32px' }}>
              school
            </span>
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)' }}>
            WAWA Smart ERP
          </h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>선생님 로그인</p>
        </div>

        {/* API 상태 표시 */}
        {apiHealth !== null && (
          <div
            style={{
              padding: '12px',
              marginBottom: '20px',
              borderRadius: '8px',
              fontSize: '13px',
              backgroundColor: apiHealth ? '#e8f5e9' : '#ffebee',
              color: apiHealth ? '#2e7d32' : '#c62828',
              border: `1px solid ${apiHealth ? '#81c784' : '#ef5350'}`,
            }}
          >
            {apiHealth ? '✓ API 서버 연결됨' : '✗ API 서버 연결 안 됨'}
          </div>
        )}

        {/* 로그인 폼 */}
        <form onSubmit={handleLogin}>
          <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* 이름 입력 */}
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 600 }}>
                선생님 이름
              </label>
              <input
                type="text"
                className="search-input"
                style={{
                  width: '100%',
                  height: '48px',
                  marginTop: '8px',
                  padding: '12px',
                  borderRadius: '8px',
                }}
                placeholder="예: 김상현"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isLoading}
                autoFocus
              />
            </div>

            {/* PIN 입력 */}
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 600 }}>
                PIN (4자 이상)
              </label>
              <input
                type="password"
                className="search-input"
                style={{
                  width: '100%',
                  height: '48px',
                  marginTop: '8px',
                  padding: '12px',
                  borderRadius: '8px',
                }}
                placeholder="PIN을 입력하세요"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                disabled={isLoading}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin(e)}
              />
            </div>

            {/* 로그인 버튼 */}
            <button
              type="submit"
              style={{
                width: '100%',
                height: '48px',
                marginTop: '24px',
                backgroundColor: 'var(--primary)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: 600,
                cursor: isLoading ? 'not-allowed' : 'pointer',
                opacity: isLoading ? 0.6 : 1,
              }}
              disabled={isLoading || apiHealth === false}
            >
              {isLoading ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '20px', animation: 'spin 1s linear infinite' }}>
                    progress_activity
                  </span>
                  로그인 중...
                </span>
              ) : (
                '로그인'
              )}
            </button>
          </div>
        </form>

        {/* 테스트 계정 정보 (개발용) */}
        {import.meta.env.DEV && (
          <div
            style={{
              marginTop: '24px',
              padding: '12px',
              borderRadius: '8px',
              backgroundColor: '#f5f5f5',
              fontSize: '12px',
              color: '#666',
              textAlign: 'left',
            }}
          >
            <p style={{ margin: '0 0 8px 0', fontWeight: 600 }}>테스트 계정:</p>
            <p style={{ margin: 0 }}>이름: 김상현 | PIN: 1234</p>
            <p style={{ margin: 0 }}>이름: 남현욱 | PIN: 1312</p>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
