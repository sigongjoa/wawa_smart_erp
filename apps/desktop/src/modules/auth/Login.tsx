import { useState, useEffect } from 'react';
import { useReportStore } from '../../stores/reportStore';
import { useToastStore } from '../../stores/toastStore';
import { fetchTeachers } from '../../services/notion';

export default function Login() {
    const { setTeachers, teachers, setCurrentUser, appSettings } = useReportStore();
    const { addToast } = useToastStore();
    const [selectedTeacherId, setSelectedTeacherId] = useState('');
    const [pin, setPin] = useState('');
    const [isFetching, setIsFetching] = useState(false);

    useEffect(() => {
        const loadTeachers = async () => {
            if (teachers.length > 0 || !appSettings.notionApiKey) return;

            setIsFetching(true);
            try {
                const data = await fetchTeachers();
                setTeachers(data);
            } catch (error) {
                addToast('선생님 목록을 불러오지 못했습니다.', 'error');
            } finally {
                setIsFetching(false);
            }
        };
        loadTeachers();
    }, [appSettings.notionApiKey, teachers.length, setTeachers, addToast]);

    const handleLogin = () => {
        const teacher = teachers.find(t => t.id === selectedTeacherId);
        if (!teacher) {
            addToast('선생님을 선택해주세요.', 'warning');
            return;
        }

        if (teacher.pin && teacher.pin !== '0000' && pin !== teacher.pin) {
            addToast('PIN 번호가 일치하지 않습니다.', 'error');
            return;
        }

        setCurrentUser({
            teacher,
            loginAt: new Date().toISOString()
        });
        addToast(`${teacher.name} 선생님, 환영합니다!`, 'success');
    };

    return (
        <div className="login-container" style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            background: 'var(--bg-light)'
        }}>
            <div className="card login-card" style={{
                width: '100%',
                maxWidth: '400px',
                padding: '40px',
                textAlign: 'center',
                boxShadow: 'var(--shadow-lg)'
            }}>
                <div style={{ marginBottom: '32px' }}>
                    <div className="header-logo-icon" style={{ margin: '0 auto 16px', background: 'var(--primary)' }}>
                        <span className="material-symbols-outlined" style={{ color: 'white', fontSize: '32px' }}>school</span>
                    </div>
                    <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)' }}>WAWA ERP 로그인</h1>
                    <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>선생님 계정으로 접속해주세요</p>
                </div>

                <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 600 }}>선생님 선택</label>
                        <select
                            className="search-input"
                            style={{ width: '100%', height: '48px', marginTop: '8px' }}
                            value={selectedTeacherId}
                            onChange={(e) => setSelectedTeacherId(e.target.value)}
                            disabled={isFetching}
                        >
                            <option value="">{isFetching ? '불러오는 중...' : '선생님을 선택하세요'}</option>
                            {teachers.map(t => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 600 }}>PIN 번호 (기본: 0000)</label>
                        <input
                            type="password"
                            className="search-input"
                            style={{ width: '100%', height: '48px', marginTop: '8px' }}
                            placeholder="PIN 번호를 입력하세요"
                            value={pin}
                            onChange={(e) => setPin(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                        />
                    </div>

                    <button
                        className="btn btn-primary"
                        style={{ width: '100%', height: '48px', marginTop: '12px', fontSize: '16px', fontWeight: 700 }}
                        onClick={handleLogin}
                    >
                        접속하기
                    </button>
                </div>

                <div style={{ marginTop: '24px', fontSize: '13px', color: 'var(--text-muted)' }}>
                    시스템 관리자 문의: 010-XXXX-XXXX
                </div>
            </div>
        </div>
    );
}
