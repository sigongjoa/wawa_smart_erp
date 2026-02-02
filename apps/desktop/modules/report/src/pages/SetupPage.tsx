import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useReportStore } from '../stores/reportStore';
import { fetchTeachers, fetchStudents, testNotionConnection } from '../services/notion';

export default function SetupPage() {
  const navigate = useNavigate();
  const { setTeachers, setStudents, setAppSettings, appSettings } = useReportStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  // Notion 설정
  const [notionApiKey, setNotionApiKey] = useState(appSettings.notionApiKey || '');
  const [notionTeachersDb, setNotionTeachersDb] = useState(appSettings.notionTeachersDb || '');
  const [notionStudentsDb, setNotionStudentsDb] = useState(appSettings.notionStudentsDb || '');
  const [notionScoresDb, setNotionScoresDb] = useState(appSettings.notionScoresDb || '');
  const [notionExamsDb, setNotionExamsDb] = useState(appSettings.notionExamsDb || '');
  const [notionAbsenceHistoryDb, setNotionAbsenceHistoryDb] = useState(appSettings.notionAbsenceHistoryDb || '');
  const [notionExamScheduleDb, setNotionExamScheduleDb] = useState(appSettings.notionExamScheduleDb || '');

  // JSON 파일 업로드 처리 (Notion 설정 정보)
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);

        // Notion 설정 정보 로드
        if (data.notionApiKey) {
          setNotionApiKey(data.notionApiKey);
        }
        if (data.notionTeachersDb || data.teachersDb) {
          setNotionTeachersDb(data.notionTeachersDb || data.teachersDb);
        }
        if (data.notionStudentsDb || data.studentsDb) {
          setNotionStudentsDb(data.notionStudentsDb || data.studentsDb);
        }
        if (data.notionScoresDb || data.scoresDb) {
          setNotionScoresDb(data.notionScoresDb || data.scoresDb);
        }
        if (data.notionExamsDb || data.examsDb) {
          setNotionExamsDb(data.notionExamsDb || data.examsDb);
        }
        if (data.notionAbsenceHistoryDb || data.absenceHistoryDb) {
          setNotionAbsenceHistoryDb(data.notionAbsenceHistoryDb || data.absenceHistoryDb);
        }
        if (data.notionExamScheduleDb || data.examScheduleDb) {
          setNotionExamScheduleDb(data.notionExamScheduleDb || data.examScheduleDb);
        }

        setError('');
        setStatus('설정 파일 로드 완료! "연결 및 데이터 로드" 버튼을 눌러주세요.');
      } catch (err) {
        setError('JSON 파일 형식이 올바르지 않습니다.');
      }
    };
    reader.readAsText(file);
  };

  // Notion 연결 및 데이터 로드
  const handleNotionSetup = async () => {
    if (!notionApiKey || !notionTeachersDb || !notionStudentsDb || !notionScoresDb) {
      setError('필수 필드(API Key, 선생님/학생/성적 DB)를 입력해주세요.');
      return;
    }

    setLoading(true);
    setError('');
    setStatus('Notion 연결 테스트 중...');

    try {
      // 설정 저장 (선택 항목 포함)
      setAppSettings({
        notionApiKey,
        notionTeachersDb,
        notionStudentsDb,
        notionScoresDb,
        notionExamsDb: notionExamsDb || undefined,
        notionAbsenceHistoryDb: notionAbsenceHistoryDb || undefined,
        notionExamScheduleDb: notionExamScheduleDb || undefined,
      });

      // 연결 테스트
      const testResult = await testNotionConnection(notionApiKey, {
        teachers: notionTeachersDb,
        students: notionStudentsDb,
        scores: notionScoresDb,
      });

      if (!testResult.success) {
        throw new Error(testResult.message);
      }

      // 데이터 로드
      setStatus('선생님 데이터 로드 중...');
      const teachers = await fetchTeachers();
      setTeachers(teachers);

      setStatus('학생 데이터 로드 중...');
      const students = await fetchStudents();
      setStudents(students);

      setStatus(`완료! 선생님 ${teachers.length}명, 학생 ${students.length}명`);

      // 설정 완료 표시
      localStorage.setItem('wawa-setup-complete', 'true');

      setTimeout(() => navigate('/'), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : '연결 실패');
    } finally {
      setLoading(false);
    }
  };

  // 샘플 JSON 다운로드 (Notion 설정용)
  const downloadSampleJson = () => {
    const sample = {
      notionApiKey: "ntn_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      notionTeachersDb: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
      notionStudentsDb: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
      notionScoresDb: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
      notionExamsDb: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx (선택)",
      notionAbsenceHistoryDb: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx (선택)",
      notionExamScheduleDb: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx (선택, 월별 시험일정)",
    };

    const blob = new Blob([JSON.stringify(sample, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'notion_config.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const inputStyle = {
    width: '100%',
    padding: '12px',
    borderRadius: '8px',
    border: '1px solid #d1d5db',
    fontSize: '14px',
    boxSizing: 'border-box' as const,
  };

  const isFormValid = notionApiKey && notionTeachersDb && notionStudentsDb && notionScoresDb;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', width: '100%', maxWidth: '500px', overflow: 'hidden' }}>
        {/* 헤더 */}
        <div style={{ backgroundColor: '#FF6B00', padding: '24px', textAlign: 'center' }}>
          <h1 style={{ color: '#ffffff', fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>
            월말평가 리포트
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: '14px' }}>초기 설정 - Notion 연동</p>
        </div>

        <div style={{ padding: '24px' }}>
          {/* JSON 파일로 설정 불러오기 */}
          <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
            <p style={{ fontSize: '14px', color: '#374151', marginBottom: '12px', fontWeight: '500' }}>
              JSON 파일로 설정 불러오기 (선택)
            </p>
            <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '12px' }}>
              Notion API Key와 DB ID가 저장된 JSON 파일을 업로드하면 자동으로 입력됩니다.
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '8px',
                  border: '1px solid #d1d5db',
                  backgroundColor: '#ffffff',
                  cursor: 'pointer',
                  fontSize: '13px',
                }}
              >
                JSON 파일 선택
              </button>
              <button
                onClick={downloadSampleJson}
                style={{
                  padding: '10px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#e5e7eb',
                  color: '#6b7280',
                  cursor: 'pointer',
                  fontSize: '13px',
                }}
              >
                샘플 다운로드
              </button>
            </div>
          </div>

          {/* 직접 입력 */}
          <div>
            <p style={{ fontSize: '14px', color: '#374151', marginBottom: '16px', fontWeight: '500' }}>
              Notion 연동 설정
            </p>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500' }}>
                API Key
              </label>
              <input
                type="password"
                value={notionApiKey}
                onChange={(e) => setNotionApiKey(e.target.value)}
                placeholder="ntn_xxx..."
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500' }}>
                선생님 DB ID
              </label>
              <input
                type="text"
                value={notionTeachersDb}
                onChange={(e) => setNotionTeachersDb(e.target.value)}
                placeholder="2f973635-f415-802d-..."
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500' }}>
                학생 DB ID
              </label>
              <input
                type="text"
                value={notionStudentsDb}
                onChange={(e) => setNotionStudentsDb(e.target.value)}
                placeholder="2f973635-f415-802d-..."
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500' }}>
                성적 DB ID *
              </label>
              <input
                type="text"
                value={notionScoresDb}
                onChange={(e) => setNotionScoresDb(e.target.value)}
                placeholder="2f973635-f415-800e-..."
                style={inputStyle}
              />
            </div>

            {/* 선택 항목 구분선 */}
            <div style={{ borderTop: '1px dashed #d1d5db', margin: '16px 0', paddingTop: '16px' }}>
              <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '12px' }}>
                선택 항목 (나중에 설정 페이지에서도 추가 가능)
              </p>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: '#6b7280' }}>
                시험지 DB ID (선택)
              </label>
              <input
                type="text"
                value={notionExamsDb}
                onChange={(e) => setNotionExamsDb(e.target.value)}
                placeholder="시험지 관리용 DB"
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: '#6b7280' }}>
                결시 이력 DB ID (선택)
              </label>
              <input
                type="text"
                value={notionAbsenceHistoryDb}
                onChange={(e) => setNotionAbsenceHistoryDb(e.target.value)}
                placeholder="결시 이력 저장용 DB"
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: '#6b7280' }}>
                시험 일정 DB ID (선택)
              </label>
              <input
                type="text"
                value={notionExamScheduleDb}
                onChange={(e) => setNotionExamScheduleDb(e.target.value)}
                placeholder="월별 시험 일정 관리용 DB"
                style={inputStyle}
              />
              <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>
                월별로 학생 시험일을 관리합니다. (학생ID, 년월, 시험일)
              </p>
            </div>

            <button
              onClick={handleNotionSetup}
              disabled={loading || !isFormValid}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: (loading || !isFormValid) ? '#d1d5db' : '#FF6B00',
                color: '#ffffff',
                fontWeight: '600',
                cursor: (loading || !isFormValid) ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? '연결 중...' : '연결 및 데이터 로드'}
            </button>
          </div>

          {/* 상태/에러 메시지 */}
          {status && (
            <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#f0fdf4', borderRadius: '8px', color: '#16a34a', fontSize: '14px' }}>
              {status}
            </div>
          )}
          {error && (
            <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#fef2f2', borderRadius: '8px', color: '#dc2626', fontSize: '14px' }}>
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
