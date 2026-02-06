import { useState, useMemo } from 'react';
import { useAIStore, AI_MODELS, DEFAULT_PROMPT_TEMPLATE } from '../../stores/aiStore';
import { useToastStore } from '../../stores/toastStore';
import type { AIProvider } from '../../types';

// 프롬프트 변수 목록
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

export default function AISettings() {
  const { aiSettings, setAISettings, usageRecords, getTotalMonthlyStats } = useAIStore();
  const { addToast } = useToastStore();

  const [formData, setFormData] = useState({
    geminiApiKey: aiSettings.geminiApiKey || '',
    openaiApiKey: aiSettings.openaiApiKey || '',
    claudeApiKey: aiSettings.claudeApiKey || '',
    defaultProvider: aiSettings.defaultProvider,
    defaultModel: aiSettings.defaultModel,
    promptTemplate: aiSettings.promptTemplate,
    generationCount: aiSettings.generationCount,
    maxTokens: aiSettings.maxTokens,
  });

  // 현재 선택된 프로바이더의 모델 목록
  const availableModels = useMemo(
    () => AI_MODELS.filter((m) => m.provider === formData.defaultProvider),
    [formData.defaultProvider]
  );

  // 현재 월 사용량
  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthlyStats = getTotalMonthlyStats(currentMonth);

  // 프로바이더별 월간 사용량
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

  const handleProviderChange = (provider: AIProvider) => {
    const firstModel = AI_MODELS.find((m) => m.provider === provider);
    setFormData((prev) => ({
      ...prev,
      defaultProvider: provider,
      defaultModel: firstModel?.id || '',
    }));
  };

  const handleSave = () => {
    setAISettings(formData);
    addToast('AI 설정이 저장되었습니다.', 'success');
  };

  const handleResetPrompt = () => {
    setFormData((prev) => ({ ...prev, promptTemplate: DEFAULT_PROMPT_TEMPLATE }));
    addToast('프롬프트가 기본값으로 초기화되었습니다.', 'info');
  };

  const insertVariable = (variable: string) => {
    setFormData((prev) => ({
      ...prev,
      promptTemplate: prev.promptTemplate + variable,
    }));
  };

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

  return (
    <div style={{ padding: '0 0 40px 0' }}>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1 className="page-title">AI 설정</h1>
            <p className="page-description">AI 종합평가 생성을 위한 API 키, 모델, 프롬프트를 설정합니다</p>
          </div>
          <button className="btn btn-primary" onClick={handleSave}>
            <span className="material-symbols-outlined">save</span>
            설정 저장
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* 왼쪽: API 키 & 모델 선택 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* API 키 관리 */}
          <div className="card" style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--primary)' }}>key</span>
              API 키 관리
            </h2>

            {/* Gemini */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', fontWeight: 600, fontSize: '14px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#4285F4' }}>auto_awesome</span>
                Google Gemini API Key
              </label>
              <input
                type="password"
                className="search-input"
                style={{ width: '100%' }}
                placeholder="AIza..."
                value={formData.geminiApiKey}
                onChange={(e) => setFormData((p) => ({ ...p, geminiApiKey: e.target.value }))}
              />
            </div>

            {/* OpenAI */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', fontWeight: 600, fontSize: '14px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#10a37f' }}>psychology</span>
                OpenAI API Key
              </label>
              <input
                type="password"
                className="search-input"
                style={{ width: '100%' }}
                placeholder="sk-..."
                value={formData.openaiApiKey}
                onChange={(e) => setFormData((p) => ({ ...p, openaiApiKey: e.target.value }))}
              />
            </div>

            {/* Claude */}
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', fontWeight: 600, fontSize: '14px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#D97706' }}>smart_toy</span>
                Anthropic Claude API Key
              </label>
              <input
                type="password"
                className="search-input"
                style={{ width: '100%' }}
                placeholder="sk-ant-..."
                value={formData.claudeApiKey}
                onChange={(e) => setFormData((p) => ({ ...p, claudeApiKey: e.target.value }))}
              />
            </div>
          </div>

          {/* 모델 선택 */}
          <div className="card" style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--primary)' }}>tune</span>
              기본 모델 설정
            </h2>

            {/* 프로바이더 선택 */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '14px' }}>AI 프로바이더</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {(['gemini', 'openai', 'claude'] as AIProvider[]).map((p) => (
                  <button
                    key={p}
                    className={`btn ${formData.defaultProvider === p ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1, fontSize: '13px' }}
                    onClick={() => handleProviderChange(p)}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>{providerIcons[p]}</span>
                    {providerLabels[p]}
                  </button>
                ))}
              </div>
            </div>

            {/* 모델 선택 */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '14px' }}>모델</label>
              <select
                className="search-input"
                style={{ width: '100%' }}
                value={formData.defaultModel}
                onChange={(e) => setFormData((p) => ({ ...p, defaultModel: e.target.value }))}
              >
                {availableModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} (입력: ${m.inputPricePerMToken}/1M, 출력: ${m.outputPricePerMToken}/1M)
                  </option>
                ))}
              </select>
            </div>

            {/* 생성 옵션 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '14px' }}>생성 버전 수</label>
                <select
                  className="search-input"
                  style={{ width: '100%' }}
                  value={formData.generationCount}
                  onChange={(e) => setFormData((p) => ({ ...p, generationCount: Number(e.target.value) }))}
                >
                  <option value={2}>2개 버전</option>
                  <option value={3}>3개 버전</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '14px' }}>최대 토큰</label>
                <input
                  type="number"
                  className="search-input"
                  style={{ width: '100%' }}
                  min={100}
                  max={2000}
                  step={100}
                  value={formData.maxTokens}
                  onChange={(e) => setFormData((p) => ({ ...p, maxTokens: Number(e.target.value) }))}
                />
              </div>
            </div>
          </div>

          {/* 사용량 모니터링 */}
          <div className="card" style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--primary)' }}>monitoring</span>
              {currentMonth} 사용량
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '20px' }}>
              <div style={{ padding: '16px', background: 'var(--primary-light)', borderRadius: '12px', textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--primary)' }}>{monthlyStats.callCount}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>총 호출</div>
              </div>
              <div style={{ padding: '16px', background: 'var(--success-light)', borderRadius: '12px', textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--success)' }}>
                  {((monthlyStats.inputTokens + monthlyStats.outputTokens) / 1000).toFixed(1)}K
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>총 토큰</div>
              </div>
              <div style={{ padding: '16px', background: 'var(--warning-light)', borderRadius: '12px', textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--warning)' }}>
                  ${monthlyStats.estimatedCost.toFixed(3)}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>예상 비용</div>
              </div>
            </div>

            {/* 프로바이더별 사용량 */}
            {Object.keys(providerStats).length > 0 ? (
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
            ) : (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '14px' }}>
                이번 달 사용 기록이 없습니다
              </div>
            )}
          </div>
        </div>

        {/* 오른쪽: 프롬프트 템플릿 */}
        <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--primary)' }}>edit_note</span>
              프롬프트 템플릿
            </h2>
            <button className="btn btn-secondary btn-sm" onClick={handleResetPrompt}>
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>restart_alt</span>
              기본값 복원
            </button>
          </div>

          {/* 변수 태그 */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '14px', color: 'var(--text-secondary)' }}>
              사용 가능한 변수 (클릭하여 삽입)
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {PROMPT_VARIABLES.map((v) => (
                <button
                  key={v.key}
                  onClick={() => insertVariable(v.key)}
                  title={v.desc}
                  style={{
                    padding: '4px 10px',
                    fontSize: '12px',
                    fontWeight: 600,
                    background: 'var(--primary-light)',
                    color: 'var(--primary)',
                    border: '1px solid #bfdbfe',
                    borderRadius: '20px',
                    cursor: 'pointer',
                    transition: 'all 150ms ease',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--primary)'; e.currentTarget.style.color = 'white'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--primary-light)'; e.currentTarget.style.color = 'var(--primary)'; }}
                >
                  {v.key}
                </button>
              ))}
            </div>
          </div>

          {/* 프롬프트 편집기 */}
          <textarea
            className="search-input"
            style={{
              width: '100%',
              flex: 1,
              minHeight: '400px',
              padding: '16px',
              fontFamily: 'var(--font-mono)',
              fontSize: '13px',
              lineHeight: '1.6',
              resize: 'vertical',
            }}
            value={formData.promptTemplate}
            onChange={(e) => setFormData((p) => ({ ...p, promptTemplate: e.target.value }))}
            placeholder="프롬프트 템플릿을 작성하세요..."
          />

          {/* 프롬프트 미리보기 */}
          <div style={{ marginTop: '16px', padding: '14px', background: 'var(--background)', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>미리보기 (예시 데이터)</div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6', whiteSpace: 'pre-wrap', maxHeight: '150px', overflow: 'auto' }}>
              {formData.promptTemplate
                .replace(/\{\{학생이름\}\}/g, '김민수')
                .replace(/\{\{학년\}\}/g, '중2')
                .replace(/\{\{연월\}\}/g, '2026-02')
                .replace(/\{\{과목목록\}\}/g, '국어, 영어, 수학')
                .replace(/\{\{과목별점수\}\}/g, '- 국어: 85점\n- 영어: 92점\n- 수학: 78점')
                .replace(/\{\{과목별코멘트\}\}/g, '- 국어: 독해력이 향상되었습니다\n- 영어: 문법 실력이 우수합니다\n- 수학: 도형 영역 보강 필요')
                .replace(/\{\{평균점수\}\}/g, '85')
                .replace(/\{\{최고과목\}\}/g, '영어')
                .replace(/\{\{최저과목\}\}/g, '수학')
                .replace(/\{\{6개월추이\}\}/g, '- 2025-09: 국어 80, 영어 88, 수학 72\n- 2025-10: 국어 82, 영어 90, 수학 75\n- 2026-02: 국어 85, 영어 92, 수학 78')
                .replace(/\{\{성적변화방향\}\}/g, '상승')
                .slice(0, 500) + '...'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
