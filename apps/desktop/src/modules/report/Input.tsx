import { useState, useEffect } from 'react';
import { useReportStore, useFilteredData } from '../../stores/reportStore';
import { useToastStore } from '../../stores/toastStore';
import { useAIStore, AI_MODELS } from '../../stores/aiStore';
import { useAsync } from '../../hooks/useAsync';
import { saveScore } from '../../services/notion';
import type { AIProvider } from '../../types';
import { getSubjectColor } from '../../constants/common';

export default function Input() {
  const { students, reports } = useFilteredData();
  const { currentYearMonth, currentUser, fetchAllData, isLoading, appSettings } = useReportStore();
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState<Record<string, { score: number; comment: string }>>({});

  // AppShell에서 이미 fetchAllData 호출하므로 여기서는 중복 호출하지 않음
  // 디버깅 로그
  useEffect(() => {
    console.log('[Input] State:', {
      studentsCount: students.length,
      reportsCount: reports.length,
      hasApiKey: !!appSettings.notionApiKey,
      hasScoresDb: !!appSettings.notionScoresDb,
    });
  }, [students, reports, appSettings]);

  const selectedStudent = students.find(s => s.id === selectedStudentId);
  const currentReport = reports.find(r => r.studentId === selectedStudentId);

  // 검색 필터링
  const filteredStudents = students.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.grade.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 학생 선택 시 폼 초기화
  useEffect(() => {
    if (selectedStudentId && selectedStudent) {
      const initialForm: Record<string, { score: number; comment: string }> = {};
      selectedStudent.subjects.forEach(sub => {
        const existingScore = currentReport?.scores.find(s => s.subject === sub);
        initialForm[sub] = {
          score: existingScore?.score ?? 0,
          comment: existingScore?.comment || '',
        };
      });
      initialForm['__TOTAL_COMMENT__'] = {
        score: 0,
        comment: currentReport?.totalComment || '',
      };
      setFormData(initialForm);
    }
  }, [selectedStudentId, currentReport, selectedStudent]);

  const saveAsync = useAsync(saveScore);
  const { addToast } = useToastStore();

  const handleSave = async (subject: string) => {
    if (!selectedStudent) return;

    const teacherId = currentUser?.teacher?.id || '';
    const data = formData[subject];

    if (!data || data.score === undefined || isNaN(data.score)) {
      addToast('올바른 점수를 입력해주세요.', 'warning');
      return;
    }

    const result = await saveAsync.execute(
      selectedStudent.id,
      selectedStudent.name,
      currentYearMonth,
      subject,
      data.score,
      teacherId,
      data.comment
    );

    if (result.success) {
      addToast(`${subject} 점수가 저장되었습니다.`, 'success');
      await fetchAllData();
    } else {
      addToast(result.error?.message || '저장에 실패했습니다.', 'error');
    }
  };

  // 입력 완료 상태 계산
  const getStudentStatus = (studentId: string) => {
    const student = students.find(s => s.id === studentId);
    const report = reports.find(r => r.studentId === studentId);
    if (!student || !report) return { status: 'none', count: 0, total: student?.subjects.length || 0 };
    const count = report.scores.length;
    const total = student.subjects.length;
    if (count >= total) return { status: 'complete', count, total };
    if (count > 0) return { status: 'partial', count, total };
    return { status: 'none', count, total };
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1 className="page-title">성적 입력</h1>
            <p className="page-description">{currentYearMonth} 월말평가 성적을 입력합니다</p>
          </div>
          <button className="btn btn-secondary" onClick={() => fetchAllData()} disabled={isLoading}>
            <span className={`material-symbols-outlined ${isLoading ? 'spin' : ''}`}>refresh</span>
            새로고침
          </button>
        </div>
      </div>

      <div className="grid" style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '24px' }}>
        <div className="card" style={{ padding: '0', overflow: 'hidden', maxHeight: 'calc(100vh - 180px)' }}>
          <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-light)', position: 'sticky', top: 0, zIndex: 10 }}>
            <input
              className="search-input"
              style={{ width: '100%' }}
              placeholder="학생 검색..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <div style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 260px)' }}>
            {isLoading ? (
              <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                <div className="spin" style={{ display: 'inline-block', marginBottom: '12px' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '32px', color: 'var(--primary)' }}>refresh</span>
                </div>
                <div style={{ color: 'var(--text-muted)' }}>데이터 로딩 중...</div>
              </div>
            ) : students.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '48px', color: '#cbd5e1', marginBottom: '12px', display: 'block' }}>warning</span>
                <div style={{ fontWeight: 600, marginBottom: '8px' }}>학생 데이터가 없습니다</div>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                  {!appSettings.notionApiKey ? 'Notion API 키를 설정해주세요' :
                    !appSettings.notionStudentsDb ? '학생 DB ID를 설정해주세요' :
                      '설정을 확인하거나 새로고침을 시도해주세요'}
                </div>
                <button className="btn btn-secondary btn-sm" onClick={() => window.location.hash = '#/report/settings'}>
                  설정으로 이동
                </button>
              </div>
            ) : filteredStudents.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                검색 결과가 없습니다
              </div>
            ) : filteredStudents.map(s => {
              const { status, count, total } = getStudentStatus(s.id);
              const isSelected = selectedStudentId === s.id;
              return (
                <div
                  key={s.id}
                  onClick={() => setSelectedStudentId(s.id)}
                  style={{
                    padding: '14px 16px',
                    cursor: 'pointer',
                    background: isSelected ? 'var(--primary-light)' : 'transparent',
                    borderBottom: '1px solid var(--border-light)',
                    borderLeft: isSelected ? '4px solid var(--primary)' : '4px solid transparent',
                    transition: 'all 0.15s'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <div style={{ fontWeight: 600 }}>{s.name}</div>
                    <span className={`badge ${status === 'complete' ? 'badge-success' : status === 'partial' ? 'badge-warning' : 'badge-neutral'}`} style={{ fontSize: '10px' }}>
                      {status === 'complete' ? '완료' : status === 'partial' ? '진행중' : '미입력'}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                    <span>{s.grade}</span>
                    <span>{count}/{total} 과목</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
          {selectedStudent ? (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', background: 'white' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '4px' }}>{selectedStudent.name} 학생</h2>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{selectedStudent.grade} · {selectedStudent.subjects.join(', ')}</div>
                  </div>
                  <button
                    className="btn btn-primary"
                    onClick={() => window.location.hash = '#/report/preview'}
                  >
                    <span className="material-symbols-outlined">visibility</span>
                    리포트 미리보기
                  </button>
                </div>
              </div>

              <div style={{ flex: 1, padding: '24px', overflowY: 'auto', background: '#f8fafc' }}>
                {selectedStudent.subjects.map(sub => {
                  const existingScore = currentReport?.scores.find(s => s.subject === sub);
                  const isSaved = !!existingScore;
                  const isEditable = currentUser?.teacher.isAdmin || currentUser?.teacher.subjects.includes(sub);

                  return (
                    <div key={sub} style={{
                      padding: '20px',
                      marginBottom: '16px',
                      background: 'white',
                      borderRadius: '12px',
                      border: `1px solid ${isSaved ? '#10B981' : '#e2e8f0'}`,
                      borderLeft: `4px solid ${getSubjectColor(sub)}`,
                      opacity: isEditable ? 1 : 0.8
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{
                            backgroundColor: `${getSubjectColor(sub)}20`,
                            color: getSubjectColor(sub),
                            padding: '6px 14px',
                            borderRadius: '20px',
                            fontSize: '13px',
                            fontWeight: 600
                          }}>
                            {sub}
                          </span>
                          {!isEditable && (
                            <span style={{ color: '#64748B', fontSize: '11px', background: '#F1F5F9', padding: '2px 8px', borderRadius: '4px' }}>
                              읽기 전용 (담당 과목 아님)
                            </span>
                          )}
                          {isSaved && (
                            <span style={{ color: '#10B981', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>check_circle</span>
                              저장됨
                            </span>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: '12px', alignItems: 'center', marginBottom: '12px' }}>
                        <label style={{ fontWeight: 500, color: '#64748B' }}>점수</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            className="search-input"
                            style={{ width: '100px', textAlign: 'center', fontWeight: 600, fontSize: '16px' }}
                            value={formData[sub]?.score ?? ''}
                            onChange={e => setFormData({ ...formData, [sub]: { ...formData[sub], score: parseInt(e.target.value) || 0 } })}
                            disabled={!isEditable}
                          />
                          <span style={{ color: '#64748B' }}>/ 100점</span>
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: '12px' }}>
                        <label style={{ fontWeight: 500, color: '#64748B', paddingTop: '10px' }}>코멘트</label>
                        <textarea
                          className="search-input"
                          style={{ width: '100%', minHeight: '80px', padding: '12px', resize: 'vertical' }}
                          placeholder={isEditable ? "학생에 대한 코멘트를 입력하세요..." : "담당 과목이 아닙니다."}
                          value={formData[sub]?.comment ?? ''}
                          onChange={e => setFormData({ ...formData, [sub]: { ...formData[sub], comment: e.target.value } })}
                          disabled={!isEditable}
                        />
                      </div>
                      {isEditable && (
                        <div style={{ textAlign: 'right', marginTop: '16px' }}>
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => handleSave(sub)}
                            disabled={saveAsync.isLoading}
                            style={{ minWidth: '100px' }}
                          >
                            {saveAsync.isLoading ? '저장 중...' : '저장'}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* 종합 평가 + AI 생성 */}
                <AITotalComment
                  selectedStudent={selectedStudent}
                  currentReport={currentReport}
                  currentYearMonth={currentYearMonth}
                  reports={reports}
                  formData={formData}
                  setFormData={setFormData}
                  handleSave={() => handleSave('__TOTAL_COMMENT__')}
                  isSaving={saveAsync.isLoading}
                  isAdmin={currentUser?.teacher.isAdmin || false}
                />
              </div>
            </div>
          ) : (
            <div className="empty-state" style={{ margin: 'auto', padding: '60px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '64px', color: '#cbd5e1', marginBottom: '16px' }}>person_search</span>
              <div className="empty-state-title">학생을 선택해주세요</div>
              <p style={{ color: 'var(--text-muted)' }}>왼쪽 목록에서 성적을 입력할 학생을 선택하세요</p>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
}

// ==================== AI 종합평가 컴포넌트 ====================

function AITotalComment({
  selectedStudent,
  currentReport,
  currentYearMonth,
  reports,
  formData,
  setFormData,
  handleSave,
  isSaving,
  isAdmin,
}: {
  selectedStudent: any;
  currentReport: any;
  currentYearMonth: string;
  reports: any[];
  formData: Record<string, { score: number; comment: string }>;
  setFormData: (d: Record<string, { score: number; comment: string }>) => void;
  handleSave: () => void;
  isSaving: boolean;
  isAdmin: boolean;
}) {
  const { aiSettings, isGenerating, generatedVersions, generateEvaluation, setGeneratedVersions } = useAIStore();
  const { addToast } = useToastStore();
  const [selectedVersion, setSelectedVersion] = useState(-1);
  const [selectedProvider, setSelectedProvider] = useState<AIProvider>(aiSettings.defaultProvider);
  const [selectedModel, setSelectedModel] = useState(aiSettings.defaultModel);

  // 프로바이더 변경 시 모델도 변경
  useEffect(() => {
    const firstModel = AI_MODELS.find((m) => m.provider === selectedProvider);
    if (firstModel) setSelectedModel(firstModel.id);
  }, [selectedProvider]);

  // 사용 가능한 모델
  const availableModels = AI_MODELS.filter((m) => m.provider === selectedProvider);

  // API 키 확인
  const getApiKey = (provider: AIProvider): string => {
    switch (provider) {
      case 'gemini': return aiSettings.geminiApiKey || '';
      case 'openai': return aiSettings.openaiApiKey || '';
      case 'claude': return aiSettings.claudeApiKey || '';
    }
  };

  const hasApiKey = !!getApiKey(selectedProvider);

  // 과거 6개월 데이터 수집
  const getHistoricalData = () => {
    if (!selectedStudent) return [];
    const [year, month] = currentYearMonth.split('-').map(Number);
    const historical: Array<{ yearMonth: string; scores: Array<{ subject: string; score: number }> }> = [];

    for (let i = 5; i >= 0; i--) {
      let m = month - i;
      let y = year;
      if (m <= 0) { m += 12; y -= 1; }
      const ym = `${y}-${String(m).padStart(2, '0')}`;
      const report = reports.find((r) => r.studentId === selectedStudent.id && r.yearMonth === ym);
      if (report) {
        historical.push({
          yearMonth: ym,
          scores: report.scores.map((s: any) => ({ subject: s.subject, score: s.score })),
        });
      }
    }
    return historical;
  };

  const handleGenerate = async () => {
    if (!hasApiKey) {
      addToast(`${selectedProvider} API 키를 설정해주세요. AI 설정 페이지에서 등록할 수 있습니다.`, 'warning');
      return;
    }

    // 현재 입력된 점수 데이터 수집
    const scores = selectedStudent.subjects
      .filter((sub: string) => formData[sub]?.score > 0)
      .map((sub: string) => ({
        subject: sub,
        score: formData[sub].score,
        comment: formData[sub].comment || undefined,
      }));

    if (scores.length === 0) {
      addToast('점수가 입력된 과목이 없습니다. 먼저 과목별 점수를 입력해주세요.', 'warning');
      return;
    }

    const result = await generateEvaluation({
      studentName: selectedStudent.name,
      grade: selectedStudent.grade,
      yearMonth: currentYearMonth,
      subjects: selectedStudent.subjects,
      scores,
      historicalData: getHistoricalData(),
      provider: selectedProvider,
      model: selectedModel,
      promptTemplate: aiSettings.promptTemplate,
      generationCount: aiSettings.generationCount,
      maxTokens: aiSettings.maxTokens,
      apiKey: getApiKey(selectedProvider),
    } as any);

    if (result.success && result.versions.length > 0) {
      setSelectedVersion(0);
      addToast(`${result.versions.length}개 버전이 생성되었습니다.`, 'success');
    } else {
      addToast(result.error || 'AI 생성에 실패했습니다.', 'error');
    }
  };

  const handleUseVersion = (index: number) => {
    const text = generatedVersions[index];
    if (text) {
      setFormData({ ...formData, '__TOTAL_COMMENT__': { score: 0, comment: text } });
      setGeneratedVersions([]);
      setSelectedVersion(-1);
      addToast('선택한 버전이 종합평가에 적용되었습니다.', 'success');
    }
  };

  const providerLabels: Record<AIProvider, string> = {
    gemini: 'Gemini',
    openai: 'ChatGPT',
    claude: 'Claude',
  };

  return (
    <div style={{
      padding: '20px',
      background: '#FFF7ED',
      borderRadius: '12px',
      border: '1px solid #FDBA74',
    }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="material-symbols-outlined" style={{ color: '#FF6B00', fontSize: '20px' }}>edit_note</span>
          <span style={{ fontWeight: 700, color: '#9A3412' }}>종합 평가</span>
        </div>

        {/* AI 생성 컨트롤 - 관리자 전용 */}
        {isAdmin && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <select
              className="search-input"
              style={{ width: '110px', padding: '6px 10px', fontSize: '12px' }}
              value={selectedProvider}
              onChange={(e) => setSelectedProvider(e.target.value as AIProvider)}
            >
              {(['gemini', 'openai', 'claude'] as AIProvider[]).map((p) => (
                <option key={p} value={p}>{providerLabels[p]}</option>
              ))}
            </select>
            <select
              className="search-input"
              style={{ width: '160px', padding: '6px 10px', fontSize: '12px' }}
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
            >
              {availableModels.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleGenerate}
              disabled={isGenerating}
              style={{ whiteSpace: 'nowrap' }}
            >
              {isGenerating ? (
                <>
                  <span className="material-symbols-outlined spin" style={{ fontSize: '16px' }}>progress_activity</span>
                  생성 중...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>auto_awesome</span>
                  AI 생성
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* API 키 미설정 경고 - 관리자 전용 */}
      {isAdmin && !hasApiKey && (
        <div style={{
          padding: '10px 14px', marginBottom: '12px', borderRadius: '8px',
          background: '#FEF2F2', border: '1px solid #FECACA', fontSize: '13px', color: '#991B1B',
          display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>warning</span>
          {providerLabels[selectedProvider]} API 키가 설정되지 않았습니다.
          <button
            className="btn btn-secondary btn-sm"
            style={{ marginLeft: 'auto', fontSize: '12px', padding: '4px 10px' }}
            onClick={() => window.location.hash = '#/report/ai-settings'}
          >
            AI 설정으로 이동
          </button>
        </div>
      )}

      {/* AI 생성 결과 - 버전 선택 */}
      {generatedVersions.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          {/* 탭 */}
          <div style={{ display: 'flex', gap: '4px', marginBottom: '12px' }}>
            {generatedVersions.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedVersion(idx)}
                style={{
                  padding: '6px 16px',
                  fontSize: '13px',
                  fontWeight: selectedVersion === idx ? 700 : 500,
                  background: selectedVersion === idx ? 'var(--primary)' : 'white',
                  color: selectedVersion === idx ? 'white' : 'var(--text-secondary)',
                  border: selectedVersion === idx ? 'none' : '1px solid var(--border)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 150ms ease',
                }}
              >
                버전 {idx + 1}
              </button>
            ))}
          </div>
          {/* 선택된 버전 미리보기 */}
          {selectedVersion >= 0 && (
            <div style={{
              padding: '14px', background: 'white', borderRadius: '8px',
              border: '1px solid var(--border)', fontSize: '14px', lineHeight: '1.7',
              whiteSpace: 'pre-wrap', maxHeight: '200px', overflowY: 'auto',
            }}>
              {generatedVersions[selectedVersion]}
            </div>
          )}
          {/* 버전 사용 버튼 */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => { setGeneratedVersions([]); setSelectedVersion(-1); }}
            >
              닫기
            </button>
            {selectedVersion >= 0 && (
              <button
                className="btn btn-primary btn-sm"
                onClick={() => handleUseVersion(selectedVersion)}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>check</span>
                이 버전 사용
              </button>
            )}
          </div>
        </div>
      )}

      {/* 종합평가 텍스트 입력 */}
      <textarea
        className="search-input"
        style={{ width: '100%', minHeight: '120px', padding: '12px', resize: 'vertical', background: 'white' }}
        placeholder="학생의 전반적인 학습 태도와 향후 계획을 입력해주세요... (AI 생성 버튼으로 자동 작성 가능)"
        value={formData['__TOTAL_COMMENT__']?.comment ?? ''}
        onChange={(e) => setFormData({ ...formData, '__TOTAL_COMMENT__': { score: 0, comment: e.target.value } })}
      />
      <div style={{ textAlign: 'right', marginTop: '16px' }}>
        <button
          className="btn btn-primary btn-sm"
          onClick={handleSave}
          disabled={isSaving}
          style={{ minWidth: '100px' }}
        >
          {isSaving ? '저장 중...' : '저장'}
        </button>
      </div>
    </div>
  );
}
