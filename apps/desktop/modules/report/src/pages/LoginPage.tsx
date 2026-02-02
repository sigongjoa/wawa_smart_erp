import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useReportStore } from '../stores/reportStore';
import { fetchTeachers, fetchStudents } from '../services/notion';

export default function LoginPage() {
  const navigate = useNavigate();
  const { currentUser, setCurrentUser, teachers, setTeachers, setStudents } = useReportStore();

  const [loading, setLoading] = useState(true);
  const [loadingStatus, setLoadingStatus] = useState('데이터 로드 중...');
  const [error, setError] = useState('');
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [pin, setPin] = useState(['', '', '', '']);
  const [loginError, setLoginError] = useState('');
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (currentUser) {
      navigate('/admin');
      return;
    }

    const loadInitialData = async () => {
      try {
        setLoadingStatus('선생님 데이터 로드 중...');
        const teacherData = await fetchTeachers();
        setTeachers(teacherData);

        setLoadingStatus('학생 데이터 로드 중...');
        const studentData = await fetchStudents();
        setStudents(studentData);

        setLoadingStatus('완료!');
      } catch (err) {
        console.error('[LoginPage] 초기 데이터 로드 실패:', err);
        setError('데이터 로드에 실패했습니다. 설정을 확인해주세요.');
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, [currentUser, navigate, setTeachers, setStudents]);

  const handlePinChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newPin = [...pin];
    newPin[index] = value.slice(-1);
    setPin(newPin);
    setLoginError('');

    if (value && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }

    // 4자리 완성 시 자동 로그인 시도
    if (index === 3 && value) {
      const fullPin = newPin.join('');
      if (fullPin.length === 4) {
        attemptLogin(fullPin);
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === 'Enter') {
      const fullPin = pin.join('');
      if (fullPin.length === 4) {
        attemptLogin(fullPin);
      }
    }
  };

  const attemptLogin = (inputPin: string) => {
    if (!selectedTeacherId) {
      setLoginError('선생님을 먼저 선택해주세요.');
      return;
    }

    const teacher = teachers.find((t) => t.id === selectedTeacherId);
    if (!teacher) {
      setLoginError('선생님을 찾을 수 없습니다.');
      return;
    }

    if (teacher.pin === inputPin) {
      setCurrentUser({
        teacher,
        loginAt: new Date().toISOString(),
      });
      // isAdmin이 true면 관리자 페이지, 아니면 선생님 페이지로
      navigate(teacher.isAdmin ? '/admin' : '/teacher');
    } else {
      setLoginError('PIN이 일치하지 않습니다.');
      setPin(['', '', '', '']);
      inputRefs.current[0]?.focus();
    }
  };

  const handleTeacherSelect = (teacherId: string) => {
    setSelectedTeacherId(teacherId);
    setLoginError('');
    setPin(['', '', '', '']);
    // 선생님 선택 후 PIN 입력으로 포커스
    setTimeout(() => inputRefs.current[0]?.focus(), 100);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#f3f4f6' }}>
        <div style={{ backgroundColor: '#ffffff', padding: '32px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', textAlign: 'center' }}>
          <div style={{ width: '40px', height: '40px', border: '3px solid #e5e7eb', borderTopColor: '#FF6B00', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: '#374151', fontWeight: '500' }}>{loadingStatus}</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#f3f4f6' }}>
        <div style={{ backgroundColor: '#ffffff', padding: '32px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', textAlign: 'center', maxWidth: '400px' }}>
          <p style={{ color: '#dc2626', marginBottom: '16px' }}>{error}</p>
          <button
            onClick={() => navigate('/setup')}
            style={{ padding: '12px 24px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
          >
            설정으로 이동
          </button>
        </div>
      </div>
    );
  }

  const selectedTeacher = teachers.find((t) => t.id === selectedTeacherId);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f3f4f6' }}>
      <div style={{ backgroundColor: '#ffffff', padding: '40px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', width: '100%', maxWidth: '400px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1f2937', marginBottom: '8px' }}>
            월말평가 리포트
          </h1>
          <p style={{ color: '#6b7280' }}>선생님 로그인</p>
        </div>

        {teachers.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#6b7280', padding: '20px' }}>
            <p style={{ marginBottom: '12px' }}>등록된 선생님이 없습니다.</p>
            <p style={{ fontSize: '14px', color: '#9ca3af' }}>Notion 설정을 확인하거나 DB에 선생님을 추가해주세요.</p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '16px' }}>
              <button
                onClick={() => navigate('/setup')}
                style={{ padding: '10px 20px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '500' }}
              >
                설정
              </button>
              <button
                onClick={() => window.location.reload()}
                style={{ padding: '10px 20px', backgroundColor: '#e5e7eb', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
              >
                새로고침
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* 선생님 선택 */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                선생님 선택
              </label>
              <select
                value={selectedTeacherId}
                onChange={(e) => handleTeacherSelect(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '16px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  backgroundColor: '#fff',
                  cursor: 'pointer',
                }}
              >
                <option value="">선생님을 선택하세요</option>
                {teachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.name} ({teacher.subjects.join(', ')})
                  </option>
                ))}
              </select>
            </div>

            {/* PIN 입력 (선생님 선택 후) */}
            {selectedTeacher && (
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: '#374151', textAlign: 'center' }}>
                  {selectedTeacher.name} 선생님 PIN 입력
                </label>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
                  {pin.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => { inputRefs.current[index] = el; }}
                      type="password"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handlePinChange(index, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(index, e)}
                      style={{
                        width: '56px',
                        height: '64px',
                        fontSize: '24px',
                        fontWeight: 'bold',
                        textAlign: 'center',
                        border: '2px solid #e5e7eb',
                        borderRadius: '8px',
                        outline: 'none',
                        transition: 'border-color 0.2s',
                      }}
                      onFocus={(e) => { e.target.style.borderColor = '#2563eb'; }}
                      onBlur={(e) => { e.target.style.borderColor = '#e5e7eb'; }}
                    />
                  ))}
                </div>
              </div>
            )}

            {loginError && (
              <p style={{ color: '#dc2626', textAlign: 'center', marginBottom: '16px', fontSize: '14px' }}>
                {loginError}
              </p>
            )}

            {/* 로그인 버튼 */}
            {selectedTeacher && (
              <button
                onClick={() => attemptLogin(pin.join(''))}
                disabled={pin.join('').length !== 4}
                style={{
                  width: '100%',
                  padding: '14px',
                  backgroundColor: pin.join('').length === 4 ? '#2563eb' : '#9ca3af',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: pin.join('').length === 4 ? 'pointer' : 'not-allowed',
                }}
              >
                로그인
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
