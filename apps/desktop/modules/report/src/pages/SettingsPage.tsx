import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useReportStore } from '../stores/reportStore';
import { testNotionConnection } from '../services/notion';
import { testCloudinaryConnection } from '../services/cloudinary';

type TabType = 'academy' | 'data' | 'notion' | 'cloudinary' | 'kakao';

export default function SettingsPage() {
  const navigate = useNavigate();
  const { currentUser, appSettings, setAppSettings, teachers, students, setTeachers, setStudents } = useReportStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<TabType>('academy');

  // 학원 정보
  const [academyName, setAcademyName] = useState(appSettings.academyName || '');
  const [academyLogo, setAcademyLogo] = useState(appSettings.academyLogo || '');

  // Notion 설정
  const [notionApiKey, setNotionApiKey] = useState(appSettings.notionApiKey || '');
  const [notionTeachersDb, setNotionTeachersDb] = useState(appSettings.notionTeachersDb || '');
  const [notionStudentsDb, setNotionStudentsDb] = useState(appSettings.notionStudentsDb || '');
  const [notionScoresDb, setNotionScoresDb] = useState(appSettings.notionScoresDb || '');
  const [notionExamsDb, setNotionExamsDb] = useState(appSettings.notionExamsDb || '');
  const [notionAbsenceHistoryDb, setNotionAbsenceHistoryDb] = useState(appSettings.notionAbsenceHistoryDb || '');
  const [notionExamScheduleDb, setNotionExamScheduleDb] = useState(appSettings.notionExamScheduleDb || '');
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [connectionMessage, setConnectionMessage] = useState('');

  // 카카오 설정
  const [kakaoBizChannelId, setKakaoBizChannelId] = useState(appSettings.kakaoBizChannelId || '');
  const [kakaoBizSenderKey, setKakaoBizSenderKey] = useState(appSettings.kakaoBizSenderKey || '');
  const [kakaoBizTemplateId, setKakaoBizTemplateId] = useState(appSettings.kakaoBizTemplateId || '');

  // Cloudinary 설정
  const [cloudinaryCloudName, setCloudinaryCloudName] = useState(appSettings.cloudinaryCloudName || '');
  const [cloudinaryApiKey, setCloudinaryApiKey] = useState(appSettings.cloudinaryApiKey || '');
  const [cloudinaryApiSecret, setCloudinaryApiSecret] = useState(appSettings.cloudinaryApiSecret || '');
  const [cloudinaryStatus, setCloudinaryStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [cloudinaryMessage, setCloudinaryMessage] = useState('');

  const [savedMessage, setSavedMessage] = useState('');

  if (!currentUser?.teacher.isAdmin) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f3f4f6' }}>
        <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '32px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <p style={{ color: '#6b7280', marginBottom: '16px' }}>관리자만 접근할 수 있습니다.</p>
          <button
            onClick={() => navigate(-1)}
            style={{ padding: '10px 20px', backgroundColor: '#2563eb', color: '#ffffff', borderRadius: '8px', border: 'none', cursor: 'pointer' }}
          >
            돌아가기
          </button>
        </div>
      </div>
    );
  }

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('이미지 파일만 업로드할 수 있습니다.');
      return;
    }

    if (file.size > 500 * 1024) {
      alert('파일 크기는 500KB 이하여야 합니다.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      setAcademyLogo(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setAcademyLogo('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleTestConnection = async () => {
    if (!notionApiKey) {
      setConnectionStatus('error');
      setConnectionMessage('API Key를 입력해주세요.');
      return;
    }

    setConnectionStatus('testing');
    setConnectionMessage('연결 테스트 중...');

    try {
      const result = await testNotionConnection(notionApiKey, {
        teachers: notionTeachersDb,
        students: notionStudentsDb,
        scores: notionScoresDb,
        exams: notionExamsDb,
        absenceHistory: notionAbsenceHistoryDb,
        examSchedule: notionExamScheduleDb,
      });

      if (result.success) {
        setConnectionStatus('success');
        setConnectionMessage(result.message);
      } else {
        setConnectionStatus('error');
        setConnectionMessage(result.message);
      }
    } catch {
      setConnectionStatus('error');
      setConnectionMessage('연결 테스트 중 오류가 발생했습니다.');
    }
  };

  const handleTestCloudinary = async () => {
    if (!cloudinaryCloudName || !cloudinaryApiKey || !cloudinaryApiSecret) {
      setCloudinaryStatus('error');
      setCloudinaryMessage('Cloud Name, API Key, API Secret을 모두 입력해주세요.');
      return;
    }

    // 테스트 전에 설정을 임시 저장 (testCloudinaryConnection이 localStorage에서 읽기 때문)
    setAppSettings({
      cloudinaryCloudName,
      cloudinaryApiKey,
      cloudinaryApiSecret,
    });

    setCloudinaryStatus('testing');
    setCloudinaryMessage('연결 테스트 중...');

    try {
      const result = await testCloudinaryConnection();

      if (result.success) {
        setCloudinaryStatus('success');
        setCloudinaryMessage(result.message);
      } else {
        setCloudinaryStatus('error');
        setCloudinaryMessage(result.message);
      }
    } catch {
      setCloudinaryStatus('error');
      setCloudinaryMessage('연결 테스트 중 오류가 발생했습니다.');
    }
  };

  const handleSave = () => {
    setAppSettings({
      // 학원 정보
      academyName: academyName || undefined,
      academyLogo: academyLogo || undefined,
      // Notion 설정
      notionApiKey: notionApiKey || undefined,
      notionTeachersDb: notionTeachersDb || undefined,
      notionStudentsDb: notionStudentsDb || undefined,
      notionScoresDb: notionScoresDb || undefined,
      notionExamsDb: notionExamsDb || undefined,
      notionAbsenceHistoryDb: notionAbsenceHistoryDb || undefined,
      notionExamScheduleDb: notionExamScheduleDb || undefined,
      // Cloudinary 설정
      cloudinaryCloudName: cloudinaryCloudName || undefined,
      cloudinaryApiKey: cloudinaryApiKey || undefined,
      cloudinaryApiSecret: cloudinaryApiSecret || undefined,
      // 카카오 설정
      kakaoBizChannelId: kakaoBizChannelId || undefined,
      kakaoBizSenderKey: kakaoBizSenderKey || undefined,
      kakaoBizTemplateId: kakaoBizTemplateId || undefined,
    });
    setSavedMessage('설정이 저장되었습니다!');
    setTimeout(() => setSavedMessage(''), 3000);
  };

  const tabStyle = (isActive: boolean) => ({
    padding: '12px 24px',
    backgroundColor: isActive ? '#ffffff' : 'transparent',
    color: isActive ? '#2563eb' : '#6b7280',
    border: 'none',
    borderBottom: isActive ? '2px solid #2563eb' : '2px solid transparent',
    cursor: 'pointer',
    fontWeight: isActive ? '600' : '400',
    fontSize: '14px',
  });

  const inputStyle = {
    width: '100%',
    padding: '12px',
    borderRadius: '8px',
    border: '1px solid #d1d5db',
    fontSize: '14px',
    boxSizing: 'border-box' as const,
  };

  const labelStyle = {
    display: 'block',
    marginBottom: '8px',
    fontWeight: '500' as const,
    color: '#374151',
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f3f4f6' }}>
      {/* 헤더 */}
      <header style={{ backgroundColor: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '16px 24px' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: '#1f2937' }}>설정</h1>
          <button
            onClick={() => navigate('/admin')}
            style={{ padding: '8px 16px', backgroundColor: '#f3f4f6', borderRadius: '8px', border: 'none', cursor: 'pointer' }}
          >
            돌아가기
          </button>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main style={{ maxWidth: '800px', margin: '0 auto', padding: '24px' }}>
        {/* 탭 네비게이션 */}
        <div style={{ backgroundColor: '#f9fafb', borderRadius: '12px 12px 0 0', display: 'flex', borderBottom: '1px solid #e5e7eb', overflowX: 'auto' }}>
          <button style={tabStyle(activeTab === 'academy')} onClick={() => setActiveTab('academy')}>
            학원 정보
          </button>
          <button style={tabStyle(activeTab === 'data')} onClick={() => setActiveTab('data')}>
            데이터 관리
          </button>
          <button style={tabStyle(activeTab === 'notion')} onClick={() => setActiveTab('notion')}>
            Notion 연동
          </button>
          <button style={tabStyle(activeTab === 'cloudinary')} onClick={() => setActiveTab('cloudinary')}>
            Cloudinary
          </button>
          <button style={tabStyle(activeTab === 'kakao')} onClick={() => setActiveTab('kakao')}>
            카카오 비즈
          </button>
        </div>

        {/* 탭 콘텐츠 */}
        <section style={{ backgroundColor: '#ffffff', borderRadius: '0 0 12px 12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '24px', marginBottom: '24px' }}>

          {/* 학원 정보 탭 */}
          {activeTab === 'academy' && (
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '20px', color: '#374151' }}>학원 정보</h2>

              {/* 학원 이름 */}
              <div style={{ marginBottom: '20px' }}>
                <label style={labelStyle}>학원 이름</label>
                <input
                  type="text"
                  value={academyName}
                  onChange={(e) => setAcademyName(e.target.value)}
                  placeholder="예: 와와학원"
                  style={inputStyle}
                />
              </div>

              {/* 학원 로고 */}
              <div>
                <label style={labelStyle}>학원 로고</label>
                <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '12px' }}>
                  PDF 리포트 상단에 표시됩니다. (권장: 정사각형 이미지, 최대 500KB)
                </p>

                {academyLogo ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <img
                      src={academyLogo}
                      alt="학원 로고"
                      style={{ width: '80px', height: '80px', objectFit: 'contain', borderRadius: '8px', border: '1px solid #e5e7eb' }}
                    />
                    <button
                      onClick={handleRemoveLogo}
                      style={{ padding: '8px 16px', backgroundColor: '#fee2e2', color: '#dc2626', borderRadius: '8px', border: 'none', cursor: 'pointer' }}
                    >
                      로고 삭제
                    </button>
                  </div>
                ) : (
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      style={{ display: 'none' }}
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      style={{
                        padding: '12px 24px',
                        backgroundColor: '#f3f4f6',
                        color: '#374151',
                        borderRadius: '8px',
                        border: '2px dashed #d1d5db',
                        cursor: 'pointer',
                        width: '100%',
                      }}
                    >
                      로고 이미지 업로드
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 데이터 관리 탭 */}
          {activeTab === 'data' && (
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '20px', color: '#374151' }}>데이터 관리</h2>

              {/* 현재 데이터 현황 */}
              <div style={{ backgroundColor: '#f9fafb', borderRadius: '8px', padding: '16px', marginBottom: '20px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: '#374151' }}>현재 데이터</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', padding: '12px', border: '1px solid #e5e7eb' }}>
                    <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>선생님</p>
                    <p style={{ fontSize: '20px', fontWeight: '600', color: '#2563eb' }}>{teachers.length}명</p>
                    {teachers.length > 0 && (
                      <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>
                        {teachers.map(t => t.name).join(', ')}
                      </p>
                    )}
                  </div>
                  <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', padding: '12px', border: '1px solid #e5e7eb' }}>
                    <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>학생</p>
                    <p style={{ fontSize: '20px', fontWeight: '600', color: '#16a34a' }}>{students.length}명</p>
                    {students.length > 0 && (
                      <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>
                        {students.slice(0, 5).map(s => s.name).join(', ')}{students.length > 5 ? ` 외 ${students.length - 5}명` : ''}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* 데이터 초기화 */}
              <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '20px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#374151' }}>초기 설정</h3>
                <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '16px' }}>
                  선생님/학생 데이터를 다시 설정하거나 JSON 파일로 업로드할 수 있습니다.
                </p>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    onClick={() => navigate('/setup')}
                    style={{
                      padding: '12px 24px',
                      backgroundColor: '#FF6B00',
                      color: '#ffffff',
                      borderRadius: '8px',
                      border: 'none',
                      cursor: 'pointer',
                      fontWeight: '500',
                    }}
                  >
                    초기 설정 페이지로 이동
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('모든 선생님/학생 데이터를 삭제하시겠습니까?')) {
                        setTeachers([]);
                        setStudents([]);
                        localStorage.removeItem('wawa-setup-complete');
                        navigate('/setup');
                      }
                    }}
                    style={{
                      padding: '12px 24px',
                      backgroundColor: '#fee2e2',
                      color: '#dc2626',
                      borderRadius: '8px',
                      border: 'none',
                      cursor: 'pointer',
                      fontWeight: '500',
                    }}
                  >
                    데이터 초기화
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Notion 연동 탭 */}
          {activeTab === 'notion' && (
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px', color: '#374151' }}>Notion 연동</h2>
              <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '20px' }}>
                Notion Integration API Key와 각 데이터베이스 ID를 입력하세요.
                <a href="https://www.notion.so/my-integrations" target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', marginLeft: '4px' }}>
                  Notion Integration 만들기
                </a>
              </p>

              {/* API Key */}
              <div style={{ marginBottom: '20px' }}>
                <label style={labelStyle}>Notion API Key</label>
                <input
                  type="password"
                  value={notionApiKey}
                  onChange={(e) => setNotionApiKey(e.target.value)}
                  placeholder="secret_xxxxxxxxxxxxxxx"
                  style={inputStyle}
                />
              </div>

              <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '20px', marginBottom: '20px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '16px', color: '#6b7280' }}>데이터베이스 ID</h3>

                {/* 선생님 DB */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={labelStyle}>선생님 DB ID</label>
                  <input
                    type="text"
                    value={notionTeachersDb}
                    onChange={(e) => setNotionTeachersDb(e.target.value)}
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    style={inputStyle}
                  />
                </div>

                {/* 학생 DB */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={labelStyle}>학생 DB ID</label>
                  <input
                    type="text"
                    value={notionStudentsDb}
                    onChange={(e) => setNotionStudentsDb(e.target.value)}
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    style={inputStyle}
                  />
                </div>

                {/* 점수 DB */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={labelStyle}>점수 DB ID</label>
                  <input
                    type="text"
                    value={notionScoresDb}
                    onChange={(e) => setNotionScoresDb(e.target.value)}
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    style={inputStyle}
                  />
                </div>

                {/* 시험지 DB */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={labelStyle}>시험지 DB ID</label>
                  <input
                    type="text"
                    value={notionExamsDb}
                    onChange={(e) => setNotionExamsDb(e.target.value)}
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    style={inputStyle}
                  />
                </div>

                {/* 결시 이력 DB */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={labelStyle}>결시 이력 DB ID</label>
                  <input
                    type="text"
                    value={notionAbsenceHistoryDb}
                    onChange={(e) => setNotionAbsenceHistoryDb(e.target.value)}
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    style={inputStyle}
                  />
                  <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>
                    결시 이력을 저장할 DB입니다. (선택)
                  </p>
                </div>

                {/* 시험 일정 DB */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={labelStyle}>시험 일정 DB ID</label>
                  <input
                    type="text"
                    value={notionExamScheduleDb}
                    onChange={(e) => setNotionExamScheduleDb(e.target.value)}
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    style={inputStyle}
                  />
                  <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>
                    월별 시험 일정을 관리할 DB입니다. (선택, 학생ID-년월-시험일)
                  </p>
                </div>
              </div>

              {/* 연결 테스트 */}
              <div style={{
                backgroundColor: connectionStatus === 'success' ? '#f0fdf4' : connectionStatus === 'error' ? '#fef2f2' : '#f9fafb',
                borderRadius: '8px',
                padding: '16px',
                border: `1px solid ${connectionStatus === 'success' ? '#bbf7d0' : connectionStatus === 'error' ? '#fecaca' : '#e5e7eb'}`
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <p style={{ fontWeight: '500', color: '#374151', marginBottom: '4px' }}>연결 상태</p>
                    <p style={{
                      fontSize: '12px',
                      color: connectionStatus === 'success' ? '#16a34a' : connectionStatus === 'error' ? '#dc2626' : '#6b7280'
                    }}>
                      {connectionMessage || '연결 테스트를 실행해주세요.'}
                    </p>
                  </div>
                  <button
                    onClick={handleTestConnection}
                    disabled={connectionStatus === 'testing'}
                    style={{
                      padding: '10px 20px',
                      backgroundColor: connectionStatus === 'testing' ? '#9ca3af' : '#4f46e5',
                      color: '#ffffff',
                      borderRadius: '8px',
                      border: 'none',
                      cursor: connectionStatus === 'testing' ? 'not-allowed' : 'pointer',
                      fontWeight: '500',
                    }}
                  >
                    {connectionStatus === 'testing' ? '테스트 중...' : '연결 테스트'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Cloudinary 탭 */}
          {activeTab === 'cloudinary' && (
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px', color: '#374151' }}>Cloudinary 설정</h2>
              <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '20px' }}>
                PDF 리포트를 Cloudinary에 업로드하여 URL로 공유합니다.
                <a href="https://cloudinary.com/users/register_free" target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', marginLeft: '4px' }}>
                  무료 계정 만들기
                </a>
              </p>

              {/* Cloud Name */}
              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Cloud Name *</label>
                <input
                  type="text"
                  value={cloudinaryCloudName}
                  onChange={(e) => setCloudinaryCloudName(e.target.value)}
                  placeholder="your-cloud-name"
                  style={inputStyle}
                />
                <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>
                  Cloudinary 대시보드 상단에서 확인할 수 있습니다.
                </p>
              </div>

              {/* API Key */}
              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>API Key *</label>
                <input
                  type="text"
                  value={cloudinaryApiKey}
                  onChange={(e) => setCloudinaryApiKey(e.target.value)}
                  placeholder="123456789012345"
                  style={inputStyle}
                />
                <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>
                  Cloudinary 대시보드 &gt; Settings &gt; API Keys에서 확인
                </p>
              </div>

              {/* API Secret */}
              <div style={{ marginBottom: '20px' }}>
                <label style={labelStyle}>API Secret *</label>
                <input
                  type="password"
                  value={cloudinaryApiSecret}
                  onChange={(e) => setCloudinaryApiSecret(e.target.value)}
                  placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxx"
                  style={inputStyle}
                />
              </div>

              {/* 연결 테스트 */}
              <div style={{
                backgroundColor: cloudinaryStatus === 'success' ? '#f0fdf4' : cloudinaryStatus === 'error' ? '#fef2f2' : '#f9fafb',
                borderRadius: '8px',
                padding: '16px',
                border: `1px solid ${cloudinaryStatus === 'success' ? '#bbf7d0' : cloudinaryStatus === 'error' ? '#fecaca' : '#e5e7eb'}`
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <p style={{ fontWeight: '500', color: '#374151', marginBottom: '4px' }}>연결 상태</p>
                    <p style={{
                      fontSize: '12px',
                      color: cloudinaryStatus === 'success' ? '#16a34a' : cloudinaryStatus === 'error' ? '#dc2626' : '#6b7280'
                    }}>
                      {cloudinaryMessage || '연결 테스트를 실행해주세요.'}
                    </p>
                  </div>
                  <button
                    onClick={handleTestCloudinary}
                    disabled={cloudinaryStatus === 'testing'}
                    style={{
                      padding: '10px 20px',
                      backgroundColor: cloudinaryStatus === 'testing' ? '#9ca3af' : '#f97316',
                      color: '#ffffff',
                      borderRadius: '8px',
                      border: 'none',
                      cursor: cloudinaryStatus === 'testing' ? 'not-allowed' : 'pointer',
                      fontWeight: '500',
                    }}
                  >
                    {cloudinaryStatus === 'testing' ? '테스트 중...' : '연결 테스트'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 카카오 비즈 탭 */}
          {activeTab === 'kakao' && (
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px', color: '#374151' }}>카카오 비즈 채널</h2>
              <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '20px' }}>
                카카오 비즈 채널을 통한 알림톡 전송을 위한 설정입니다.
              </p>

              {/* 채널 ID */}
              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>채널 ID</label>
                <input
                  type="text"
                  value={kakaoBizChannelId}
                  onChange={(e) => setKakaoBizChannelId(e.target.value)}
                  placeholder="@채널아이디"
                  style={inputStyle}
                />
              </div>

              {/* 발신 프로필 키 */}
              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>발신 프로필 키 (Sender Key)</label>
                <input
                  type="password"
                  value={kakaoBizSenderKey}
                  onChange={(e) => setKakaoBizSenderKey(e.target.value)}
                  placeholder="발신 프로필 키 입력"
                  style={inputStyle}
                />
              </div>

              {/* 템플릿 ID */}
              <div>
                <label style={labelStyle}>템플릿 ID</label>
                <input
                  type="text"
                  value={kakaoBizTemplateId}
                  onChange={(e) => setKakaoBizTemplateId(e.target.value)}
                  placeholder="알림톡 템플릿 ID"
                  style={inputStyle}
                />
              </div>
            </div>
          )}
        </section>

        {/* 저장 버튼 */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '12px' }}>
          {savedMessage && (
            <span style={{ color: '#16a34a', fontSize: '14px' }}>{savedMessage}</span>
          )}
          <button
            onClick={handleSave}
            style={{
              padding: '12px 32px',
              backgroundColor: '#2563eb',
              color: '#ffffff',
              borderRadius: '8px',
              fontWeight: '500',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            설정 저장
          </button>
        </div>
      </main>
    </div>
  );
}
