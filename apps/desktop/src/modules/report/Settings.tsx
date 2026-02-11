import { useState } from 'react';
import { useReportStore } from '../../stores/reportStore';
import { testNotionConnection } from '../../services/notion';

export default function Settings() {
  const { appSettings, setAppSettings } = useReportStore();
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const [formData, setFormData] = useState({
    academyName: appSettings.academyName || '',
    notionApiKey: appSettings.notionApiKey || '',
    notionTeachersDb: appSettings.notionTeachersDb || '',
    notionStudentsDb: appSettings.notionStudentsDb || '',
    notionScoresDb: appSettings.notionScoresDb || '',
    notionExamsDb: appSettings.notionExamsDb || '',
    notionEnrollmentDb: appSettings.notionEnrollmentDb || '',
    notionAbsenceHistoryDb: appSettings.notionAbsenceHistoryDb || '',
    notionExamScheduleDb: appSettings.notionExamScheduleDb || '',
    notionMakeupDb: appSettings.notionMakeupDb || '',
    notionDmMessagesDb: appSettings.notionDmMessagesDb || '',
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

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const result = await testNotionConnection(formData.notionApiKey, {
        teachers: formData.notionTeachersDb,
        students: formData.notionStudentsDb,
        scores: formData.notionScoresDb,
        exams: formData.notionExamsDb,
        absenceHistory: formData.notionAbsenceHistoryDb,
        examSchedule: formData.notionExamScheduleDb,
        enrollment: formData.notionEnrollmentDb,
        makeup: formData.notionMakeupDb,
        dmMessages: formData.notionDmMessagesDb,
      });
      setTestResult({ success: result.success, message: result.message });
    } catch (error: any) {
      setTestResult({ success: false, message: error.message || '연결 테스트 중 오류 발생' });
    } finally {
      setIsTesting(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        setFormData(prev => ({ ...prev, ...json }));
        alert('설정 파일이 로드되었습니다. "설정 저장"을 눌러 반영하세요.');
      } catch {
        alert('유효하지 않은 JSON 파일입니다.');
      }
    };
    reader.readAsText(file);
  };

  const downloadSampleJson = () => {
    const sample = {
      notionApiKey: "secret_...",
      notionTeachersDb: "db_id...",
      notionStudentsDb: "db_id...",
      notionScoresDb: "db_id...",
      notionExamsDb: "db_id...",
    };
    const blob = new Blob([JSON.stringify(sample, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'wawa_config_sample.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ padding: '0 0 40px 0' }}>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1 className="page-title">리포트 설정</h1>
            <p className="page-description">Notion API 및 알림톡 설정을 관리합니다</p>
          </div>
          <div className="page-actions">
            <button className="btn btn-secondary" onClick={downloadSampleJson}>
              <span className="material-symbols-outlined">download</span>샘플 다운로드
            </button>
            <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
              <span className="material-symbols-outlined">upload</span>파일로 설정
              <input type="file" hidden accept=".json" onChange={handleFileUpload} />
            </label>
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

          <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px', marginTop: '32px' }}>Notion 연동 설정</h2>
          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label className="form-label" style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Notion API Key</label>
            <input name="notionApiKey" type="password" value={formData.notionApiKey} onChange={handleChange} className="search-input" style={{ width: '100%' }} placeholder="secret_..." />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">선생님 DB ID</label>
              <input name="notionTeachersDb" value={formData.notionTeachersDb} onChange={handleChange} className="search-input" style={{ width: '100%' }} />
            </div>
            <div className="form-group">
              <label className="form-label">학생 DB ID</label>
              <input name="notionStudentsDb" value={formData.notionStudentsDb} onChange={handleChange} className="search-input" style={{ width: '100%' }} />
            </div>
            <div className="form-group">
              <label className="form-label">성적 DB ID</label>
              <input name="notionScoresDb" value={formData.notionScoresDb} onChange={handleChange} className="search-input" style={{ width: '100%' }} />
            </div>
            <div className="form-group">
              <label className="form-label">시험지 DB ID</label>
              <input name="notionExamsDb" value={formData.notionExamsDb} onChange={handleChange} className="search-input" style={{ width: '100%' }} />
            </div>
            <div className="form-group">
              <label className="form-label">수강 일정 DB ID</label>
              <input name="notionEnrollmentDb" value={formData.notionEnrollmentDb} onChange={handleChange} className="search-input" style={{ width: '100%' }} />
            </div>
            <div className="form-group">
              <label className="form-label">결시 이력 DB ID</label>
              <input name="notionAbsenceHistoryDb" value={formData.notionAbsenceHistoryDb} onChange={handleChange} className="search-input" style={{ width: '100%' }} />
            </div>
            <div className="form-group">
              <label className="form-label">시험 일정 DB ID</label>
              <input name="notionExamScheduleDb" value={formData.notionExamScheduleDb} onChange={handleChange} className="search-input" style={{ width: '100%' }} />
            </div>
            <div className="form-group">
              <label className="form-label">보강관리 DB ID</label>
              <input name="notionMakeupDb" value={formData.notionMakeupDb} onChange={handleChange} className="search-input" style={{ width: '100%' }} />
            </div>
            <div className="form-group">
              <label className="form-label">쪽지(DM) DB ID</label>
              <input name="notionDmMessagesDb" value={formData.notionDmMessagesDb} onChange={handleChange} className="search-input" style={{ width: '100%' }} />
            </div>
          </div>

          <div style={{ marginTop: '24px', display: 'flex', gap: '12px' }}>
            <button className="btn btn-secondary" onClick={handleTestConnection} disabled={isTesting}>
              {isTesting ? '연결 확인 중...' : '연결 테스트'}
            </button>
            {testResult && (
              <div style={{ color: testResult.success ? 'var(--success)' : 'var(--danger)', fontSize: '14px', alignSelf: 'center' }}>
                {testResult.message}
              </div>
            )}
          </div>
        </div>

        <div className="card" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px' }}>카카오 알림톡 설정</h2>
          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label className="form-label">채널 ID</label>
            <input name="kakaoBizChannelId" value={formData.kakaoBizChannelId} onChange={handleChange} className="search-input" style={{ width: '100%' }} />
          </div>
          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label className="form-label">발신 프로필 키</label>
            <input name="kakaoBizSenderKey" value={formData.kakaoBizSenderKey} onChange={handleChange} className="search-input" style={{ width: '100%' }} />
          </div>
          <div className="form-group">
            <label className="form-label">템플릿 ID</label>
            <input name="kakaoBizTemplateId" value={formData.kakaoBizTemplateId} onChange={handleChange} className="search-input" style={{ width: '100%' }} />
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
