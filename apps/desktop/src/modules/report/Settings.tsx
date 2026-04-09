import { useState, useEffect } from 'react';
import { useReportStore } from '../../stores/reportStore';
import { isLoggedIn, kakaoLogin, kakaoLogout, loadToken } from '../../services/kakao';

export default function Settings() {
  const { appSettings, setAppSettings } = useReportStore();
  const [kakaoLoggedIn, setKakaoLoggedIn] = useState(isLoggedIn());
  const [kakaoLoading, setKakaoLoading] = useState(false);

  useEffect(() => {
    setKakaoLoggedIn(isLoggedIn());
  }, []);

  const handleKakaoLogin = async () => {
    setKakaoLoading(true);
    const ok = await kakaoLogin();
    setKakaoLoading(false);
    setKakaoLoggedIn(ok);
    if (!ok) alert('카카오 로그인에 실패했습니다. Redirect URI 설정을 확인해주세요.');
  };

  const handleKakaoLogout = () => {
    kakaoLogout();
    setKakaoLoggedIn(false);
  };

  const [formData, setFormData] = useState({
    academyName: appSettings.academyName || '',
    kakaoBizChannelId: appSettings.kakaoBizChannelId || '',
    kakaoBizSenderKey: appSettings.kakaoBizSenderKey || '',
    kakaoBizTemplateId: appSettings.kakaoBizTemplateId || '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = () => {
    setAppSettings(formData);
    alert('설정이 저장되었습니다.');
  };

  return (
    <div style={{ padding: '0 0 40px 0' }}>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1 className="page-title">리포트 설정</h1>
            <p className="page-description">학원 기본 설정 및 알림톡 설정을 관리합니다</p>
          </div>
        </div>
      </div>

      <div className="grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        <div className="card" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px' }}>기본 설정</h2>
          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label className="form-label" style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>학원 이름</label>
            <input name="academyName" value={formData.academyName} onChange={handleChange} className="search-input" style={{ width: '100%' }} placeholder="WAWA 학원" />
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>리포트에 표시될 학원 이름입니다</div>
          </div>

          <div style={{ padding: '16px', background: 'var(--success-light)', borderRadius: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--success)' }}>check_circle</span>
              <span style={{ fontWeight: 600 }}>Cloudflare D1 데이터베이스 연동됨</span>
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              모든 데이터는 Cloudflare D1을 통해 관리됩니다.
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>카카오톡 연동</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '24px' }}>
            월말평가 결과를 카카오톡 친구에게 직접 전송합니다
          </p>

          <div style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            padding: '16px', borderRadius: '10px',
            background: kakaoLoggedIn ? 'var(--success-light)' : 'var(--surface-raised)',
            border: `1px solid ${kakaoLoggedIn ? 'var(--success-border)' : 'var(--border)'}`,
            marginBottom: '20px',
          }}>
            <span style={{ fontSize: '28px' }}>{kakaoLoggedIn ? '✅' : '💬'}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: '14px' }}>
                {kakaoLoggedIn ? '카카오 로그인됨' : '카카오 로그아웃 상태'}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                {kakaoLoggedIn
                  ? '리포트 전송 페이지에서 친구에게 메시지를 보낼 수 있습니다'
                  : '로그인하면 친구에게 월말평가 결과를 카카오톡으로 전송할 수 있습니다'}
              </div>
            </div>
            {kakaoLoggedIn ? (
              <button className="btn btn-secondary btn-sm" onClick={handleKakaoLogout}>
                로그아웃
              </button>
            ) : (
              <button
                className="btn btn-sm"
                style={{ background: 'var(--kakao-yellow)', color: 'var(--kakao-brown)', fontWeight: 700, whiteSpace: 'nowrap' }}
                onClick={handleKakaoLogin}
                disabled={kakaoLoading}
              >
                {kakaoLoading ? '로그인 중...' : '카카오 로그인'}
              </button>
            )}
          </div>

          <div style={{ fontSize: '13px', color: 'var(--text-muted)', background: 'var(--background)', borderRadius: '8px', padding: '12px 14px' }}>
            <div style={{ fontWeight: 600, marginBottom: '6px' }}>⚙️ 카카오 개발자 콘솔 설정 필요</div>
            <ul style={{ margin: 0, paddingLeft: '16px', lineHeight: '1.8' }}>
              <li>플랫폼 키 → JavaScript SDK 도메인: <code>http://localhost:5173</code></li>
              <li>카카오 로그인 → Redirect URI: <code>http://localhost:5173/kakao-callback.html</code></li>
              <li>동의항목 → talk_message, friends 선택 동의</li>
            </ul>
          </div>
        </div>
      </div>

      <div style={{ marginTop: '32px', display: 'flex', justifyContent: 'center' }}>
        <button className="btn btn-primary" style={{ padding: '12px 40px' }} onClick={handleSave}>
          <span className="material-symbols-outlined">save</span>설정 저장하기
        </button>
      </div>
    </div>
  );
}
