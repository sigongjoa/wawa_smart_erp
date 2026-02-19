import { useState, useMemo } from 'react';
import { useReportStore } from '../../stores/reportStore';
import { useAIStore, AI_MODELS, DEFAULT_PROMPT_TEMPLATE } from '../../stores/aiStore';
import { useToastStore } from '../../stores/toastStore';
import { testNotionConnection } from '../../services/notion';
import type { AIProvider } from '../../types';

type SettingsTab = 'notion' | 'ai' | 'kakao';

const PROMPT_VARIABLES = [
  { key: '{{학생이름}}', desc: '학생 이름' },
  { key: '{{학년}}', desc: '학년 (예: 중2)' },
  { key: '{{연월}}', desc: '평가 기간 (예: 2026-02)' },
  { key: '{{과목목록}}', desc: '수강 과목 (예: 국어, 영어, 수학)' },
  { key: '{{과목별점수}}', desc: '과목별 점수 목록' },
  { key: '{{과목별코멘트}}', desc: '과목별 선생님 코멘트' },
  { key: '{{평균점수}}', desc: '전 과목 평균 점수' },
  { key: '{{최고과목}}', desc: '최고 점수 과목' },
  { key: '{{최저과목}}', desc: '최저 점수 과목' },
  { key: '{{6개월추이}}', desc: '최근 6개월 성적 추이' },
];

export default function GlobalSettings() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('notion');
  const { appSettings, setAppSettings } = useReportStore();
  const { aiSettings, setAISettings, usageRecords, getTotalMonthlyStats } = useAIStore();
  const { addToast } = useToastStore();

  // Notion 설정 state
  const [notionForm, setNotionForm] = useState({
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
  });
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Kakao 설정 state
  const [kakaoForm, setKakaoForm] = useState({
    kakaoBizChannelId: appSettings.kakaoBizChannelId || '',
    kakaoBizSenderKey: appSettings.kakaoBizSenderKey || '',
    kakaoBizTemplateId: appSettings.kakaoBizTemplateId || '',
  });

  // AI 설정 state
  const [aiForm, setAiForm] = useState({
    geminiApiKey: aiSettings.geminiApiKey || '',
    openaiApiKey: aiSettings.openaiApiKey || '',
    claudeApiKey: aiSettings.claudeApiKey || '',
    defaultProvider: aiSettings.defaultProvider,
    defaultModel: aiSettings.defaultModel,
    promptTemplate: aiSettings.promptTemplate,
    generationCount: aiSettings.generationCount,
    maxTokens: aiSettings.maxTokens,
  });

  const availableModels = useMemo(
    () => AI_MODELS.filter((m) => m.provider === aiForm.defaultProvider),
    [aiForm.defaultProvider]
  );

  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthlyStats = getTotalMonthlyStats(currentMonth);

  const providerStats = useMemo(() => {
    const records = usageRecords.filter((r) => r.month === currentMonth);
    const stats: Record<string, { callCount: number; cost: number }> = {};
    records.forEach((r) => {
      if (!stats[r.provider]) stats[r.provider] = { callCount: 0, cost: 0 };
      stats[r.provider].callCount += r.callCount;
      stats[r.provider].cost += r.estimatedCost;
    });
    return stats;
  }, [usageRecords, currentMonth]);

  const providerLabels: Record<AIProvider, string> = {
    gemini: 'Google Gemini',
    openai: 'OpenAI (ChatGPT)',
    claude: 'Anthropic Claude',
  };

  const providerIcons: Record<AIProvider, string> = {
    gemini: 'auto_awesome',
    openai: 'psychology',
    claude: 'smart_toy',
  };

  // 저장 핸들러들
  const handleSaveNotion = () => {
    setAppSettings({ ...appSettings, ...notionForm });
    addToast('Notion 설정이 저장되었습니다.', 'success');
  };

  const handleSaveKakao = () => {
    setAppSettings({ ...appSettings, ...kakaoForm });
    addToast('카카오 알림톡 설정이 저장되었습니다.', 'success');
  };

  const handleSaveAI = () => {
    setAISettings(aiForm);
    addToast('AI 설정이 저장되었습니다.', 'success');
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const result = await testNotionConnection(notionForm.notionApiKey, {
        teachers: notionForm.notionTeachersDb,
        students: notionForm.notionStudentsDb,
        scores: notionForm.notionScoresDb,
        exams: notionForm.notionExamsDb,
        absenceHistory: notionForm.notionAbsenceHistoryDb,
        examSchedule: notionForm.notionExamScheduleDb,
        enrollment: notionForm.notionEnrollmentDb,
        makeup: notionForm.notionMakeupDb,
        dmMessages: notionForm.notionDmMessagesDb,
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
        setNotionForm(prev => ({ ...prev, ...json }));
        addToast('설정 파일이 로드되었습니다. "저장"을 눌러 반영하세요.', 'info');
      } catch {
        addToast('유효하지 않은 JSON 파일입니다.', 'error');
      }
    };
    reader.readAsText(file);
  };

  const handleProviderChange = (provider: AIProvider) => {
    const firstModel = AI_MODELS.find((m) => m.provider === provider);
    setAiForm((prev) => ({ ...prev, defaultProvider: provider, defaultModel: firstModel?.id || '' }));
  };

  const insertVariable = (variable: string) => {
    setAiForm((prev) => ({ ...prev, promptTemplate: prev.promptTemplate + variable }));
  };

  const handleResetPrompt = () => {
    setAiForm((prev) => ({ ...prev, promptTemplate: DEFAULT_PROMPT_TEMPLATE }));
    addToast('프롬프트가 기본값으로 초기화되었습니다.', 'info');
  };

  const tabs: { id: SettingsTab; label: string; icon: string }[] = [
    { id: 'notion', label: 'Notion 연동', icon: 'database' },
    { id: 'ai', label: 'AI 설정', icon: 'smart_toy' },
    { id: 'kakao', label: '카카오 알림톡', icon: 'chat' },
  ];

  return (
    <div style={{ padding: '0 0 40px 0' }}>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1 className="page-title">설정</h1>
            <p className="page-description">Notion 연동, AI, 카카오 알림톡 등 시스템 전체 설정을 관리합니다</p>
          </div>
          <div className="page-actions">
            <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
              <span className="material-symbols-outlined">upload</span>파일로 설정
              <input type="file" hidden accept=".json" onChange={handleFileUpload} />
            </label>
          </div>
        </div>
      </div>

      {/* 탭 네비게이션 */}
      <div style={{ display: 'flex', gap: '0', borderBottom: '2px solid var(--border)', marginBottom: '24px' }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '12px 24px',
              background: 'transparent', border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid var(--primary)' : '2px solid transparent',
              color: activeTab === tab.id ? 'var(--primary)' : 'var(--text-secondary)',
              fontWeight: activeTab === tab.id ? 600 : 400,
              cursor: 'pointer', marginBottom: '-2px',
              transition: 'all var(--transition-fast)',
              fontSize: '14px',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ========== Notion 설정 탭 ========== */}
      {activeTab === 'notion' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          <div className="card" style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px' }}>기본 설정</h2>
            <div className="form-group" style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '14px' }}>학원 이름</label>
              <input
                value={notionForm.academyName}
                onChange={e => setNotionForm(p => ({ ...p, academyName: e.target.value }))}
                className="search-input" style={{ width: '100%' }} placeholder="WAWA 학원"
              />
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>리포트에 표시될 학원 이름입니다</div>
            </div>

            <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px' }}>Notion API 키</h2>
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '14px' }}>API Key</label>
              <input
                type="password"
                value={notionForm.notionApiKey}
                onChange={e => setNotionForm(p => ({ ...p, notionApiKey: e.target.value }))}
                className="search-input" style={{ width: '100%' }} placeholder="secret_..."
              />
            </div>

            <div style={{ marginTop: '16px', display: 'flex', gap: '12px', alignItems: 'center' }}>
              <button className="btn btn-secondary" onClick={handleTestConnection} disabled={isTesting}>
                {isTesting ? '확인 중...' : '연결 테스트'}
              </button>
              {testResult && (
                <span style={{ color: testResult.success ? 'var(--success)' : 'var(--danger)', fontSize: '14px' }}>
                  {testResult.message}
                </span>
              )}
            </div>
          </div>

          <div className="card" style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px' }}>데이터베이스 ID</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {[
                { key: 'notionTeachersDb', label: '선생님 DB' },
                { key: 'notionStudentsDb', label: '학생 DB' },
                { key: 'notionScoresDb', label: '성적 DB' },
                { key: 'notionExamsDb', label: '시험지 DB' },
                { key: 'notionEnrollmentDb', label: '수강 일정 DB' },
                { key: 'notionAbsenceHistoryDb', label: '결시 이력 DB' },
                { key: 'notionExamScheduleDb', label: '시험 일정 DB' },
                { key: 'notionMakeupDb', label: '보강관리 DB' },
                { key: 'notionDmMessagesDb', label: '쪽지(DM) DB' },
              ].map(({ key, label }) => (
                <div key={key} className="form-group">
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500 }}>{label}</label>
                  <input
                    value={(notionForm as any)[key]}
                    onChange={e => setNotionForm(p => ({ ...p, [key]: e.target.value }))}
                    className="search-input" style={{ width: '100%', fontSize: '12px' }}
                    placeholder="DB ID..."
                  />
                </div>
              ))}
            </div>
          </div>

          <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'center' }}>
            <button className="btn btn-primary" style={{ padding: '12px 40px' }} onClick={handleSaveNotion}>
              <span className="material-symbols-outlined">save</span>Notion 설정 저장
            </button>
          </div>
        </div>
      )}

      {/* ========== AI 설정 탭 ========== */}
      {activeTab === 'ai' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* API 키 */}
            <div className="card" style={{ padding: '24px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="material-symbols-outlined" style={{ color: 'var(--primary)' }}>key</span>
                API 키 관리
              </h2>
              {[
                { key: 'geminiApiKey', label: 'Google Gemini API Key', icon: 'auto_awesome', color: '#4285F4', placeholder: 'AIza...' },
                { key: 'openaiApiKey', label: 'OpenAI API Key', icon: 'psychology', color: '#10a37f', placeholder: 'sk-...' },
                { key: 'claudeApiKey', label: 'Anthropic Claude API Key', icon: 'smart_toy', color: '#D97706', placeholder: 'sk-ant-...' },
              ].map(({ key, label, icon, color, placeholder }) => (
                <div key={key} style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', fontWeight: 600, fontSize: '14px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '18px', color }}>{icon}</span>
                    {label}
                  </label>
                  <input
                    type="password"
                    className="search-input" style={{ width: '100%' }}
                    placeholder={placeholder}
                    value={(aiForm as any)[key]}
                    onChange={e => setAiForm(p => ({ ...p, [key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>

            {/* 모델 설정 */}
            <div className="card" style={{ padding: '24px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="material-symbols-outlined" style={{ color: 'var(--primary)' }}>tune</span>
                기본 모델 설정
              </h2>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '14px' }}>AI 프로바이더</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {(['gemini', 'openai', 'claude'] as AIProvider[]).map((p) => (
                    <button
                      key={p}
                      className={`btn ${aiForm.defaultProvider === p ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ flex: 1, fontSize: '12px' }}
                      onClick={() => handleProviderChange(p)}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>{providerIcons[p]}</span>
                      {providerLabels[p]}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '14px' }}>모델</label>
                <select className="search-input" style={{ width: '100%' }} value={aiForm.defaultModel}
                  onChange={e => setAiForm(p => ({ ...p, defaultModel: e.target.value }))}>
                  {availableModels.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '14px' }}>생성 버전 수</label>
                  <select className="search-input" style={{ width: '100%' }} value={aiForm.generationCount}
                    onChange={e => setAiForm(p => ({ ...p, generationCount: Number(e.target.value) }))}>
                    <option value={2}>2개 버전</option>
                    <option value={3}>3개 버전</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '14px' }}>최대 토큰</label>
                  <input type="number" className="search-input" style={{ width: '100%' }}
                    min={100} max={2000} step={100} value={aiForm.maxTokens}
                    onChange={e => setAiForm(p => ({ ...p, maxTokens: Number(e.target.value) }))} />
                </div>
              </div>
            </div>

            {/* 사용량 */}
            <div className="card" style={{ padding: '24px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="material-symbols-outlined" style={{ color: 'var(--primary)' }}>monitoring</span>
                {currentMonth} 사용량
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div style={{ padding: '12px', background: 'var(--primary-light)', borderRadius: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--primary)' }}>{monthlyStats.callCount}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>총 호출</div>
                </div>
                <div style={{ padding: '12px', background: 'var(--success-light)', borderRadius: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--success)' }}>
                    {((monthlyStats.inputTokens + monthlyStats.outputTokens) / 1000).toFixed(1)}K
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>총 토큰</div>
                </div>
                <div style={{ padding: '12px', background: 'var(--warning-light)', borderRadius: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--warning)' }}>
                    ${monthlyStats.estimatedCost.toFixed(3)}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>예상 비용</div>
                </div>
              </div>
              {Object.keys(providerStats).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)', fontSize: '14px' }}>
                  이번 달 사용 기록이 없습니다
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {Object.entries(providerStats).map(([provider, stats]) => (
                    <div key={provider} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '10px 14px', background: 'var(--background)', borderRadius: '8px',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--text-secondary)' }}>
                          {providerIcons[provider as AIProvider] || 'smart_toy'}
                        </span>
                        <span style={{ fontWeight: 600, fontSize: '14px' }}>{providerLabels[provider as AIProvider] || provider}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '16px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                        <span>{stats.callCount}회</span>
                        <span style={{ fontWeight: 600 }}>${stats.cost.toFixed(3)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 프롬프트 템플릿 */}
          <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="material-symbols-outlined" style={{ color: 'var(--primary)' }}>edit_note</span>
                프롬프트 템플릿
              </h2>
              <button className="btn btn-secondary btn-sm" onClick={handleResetPrompt}>
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>restart_alt</span>
                기본값 복원
              </button>
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '13px', color: 'var(--text-secondary)' }}>
                사용 가능한 변수 (클릭하여 삽입)
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {PROMPT_VARIABLES.map((v) => (
                  <button
                    key={v.key}
                    onClick={() => insertVariable(v.key)}
                    title={v.desc}
                    style={{
                      padding: '3px 10px', fontSize: '12px', fontWeight: 600,
                      background: 'var(--primary-light)', color: 'var(--primary)',
                      border: '1px solid #bfdbfe', borderRadius: '20px', cursor: 'pointer',
                    }}
                  >
                    {v.key}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              className="search-input"
              style={{ width: '100%', flex: 1, minHeight: '300px', padding: '16px', fontFamily: 'var(--font-mono)', fontSize: '13px', lineHeight: '1.6', resize: 'vertical' }}
              value={aiForm.promptTemplate}
              onChange={e => setAiForm(p => ({ ...p, promptTemplate: e.target.value }))}
              placeholder="프롬프트 템플릿을 작성하세요..."
            />
          </div>

          <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'center' }}>
            <button className="btn btn-primary" style={{ padding: '12px 40px' }} onClick={handleSaveAI}>
              <span className="material-symbols-outlined">save</span>AI 설정 저장
            </button>
          </div>
        </div>
      )}

      {/* ========== 카카오 알림톡 탭 ========== */}
      {activeTab === 'kakao' && (
        <div style={{ maxWidth: '600px' }}>
          <div className="card" style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="material-symbols-outlined" style={{ color: '#FEE500' }}>chat</span>
              카카오 알림톡 설정
            </h2>
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '14px' }}>채널 ID</label>
              <input
                value={kakaoForm.kakaoBizChannelId}
                onChange={e => setKakaoForm(p => ({ ...p, kakaoBizChannelId: e.target.value }))}
                className="search-input" style={{ width: '100%' }}
                placeholder="@채널ID"
              />
            </div>
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '14px' }}>발신 프로필 키</label>
              <input
                type="password"
                value={kakaoForm.kakaoBizSenderKey}
                onChange={e => setKakaoForm(p => ({ ...p, kakaoBizSenderKey: e.target.value }))}
                className="search-input" style={{ width: '100%' }}
              />
            </div>
            <div className="form-group" style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '14px' }}>템플릿 ID</label>
              <input
                value={kakaoForm.kakaoBizTemplateId}
                onChange={e => setKakaoForm(p => ({ ...p, kakaoBizTemplateId: e.target.value }))}
                className="search-input" style={{ width: '100%' }}
              />
            </div>
            <button className="btn btn-primary" onClick={handleSaveKakao}>
              <span className="material-symbols-outlined">save</span>카카오 설정 저장
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
