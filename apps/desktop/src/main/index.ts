import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';

// Windows에서 한글 렌더링을 위한 폰트 설정
app.commandLine.appendSwitch('lang', 'ko');
app.commandLine.appendSwitch('force-color-profile', 'srgb');

let mainWindow: BrowserWindow | null = null;
let pythonProcess: ChildProcess | null = null;

function startPythonBackend() {
  const isDev = process.env.NODE_ENV === 'development';
  // 개발 환경에서는 process.cwd()가 프로젝트 루트(apps/desktop)라고 가정
  // 프로덕션 환경의 경로는 패키징 방식에 따라 달라질 수 있음 (추후 확인 필요)
  const backendDir = isDev
    ? path.join(process.cwd(), 'backend')
    : path.join(process.resourcesPath, 'backend'); // 예시: 프로덕션 리소스 경로

  const mainScript = path.join(backendDir, 'main.py');

  // venv 확인 및 Python 실행 파일 결정
  let pythonExecutable = 'python3'; // 기본값 (시스템 python)
  if (process.platform === 'win32') {
    const venvPythonWin = path.join(backendDir, 'venv', 'Scripts', 'python.exe');
    if (fs.existsSync(venvPythonWin)) {
      pythonExecutable = venvPythonWin;
    } else {
      pythonExecutable = 'python'; // Windows fallback
    }
  } else {
    const venvPythonUnix = path.join(backendDir, 'venv', 'bin', 'python');
    if (fs.existsSync(venvPythonUnix)) {
      pythonExecutable = venvPythonUnix;
    }
  }

  console.log(`[Electron] Starting Python backend...`);
  console.log(`  Path: ${backendDir}`);
  console.log(`  Script: ${mainScript}`);
  console.log(`  Executable: ${pythonExecutable}`);

  // Windows에서 UTF-8 인코딩을 위한 환경변수 설정
  const env = { ...process.env };
  if (process.platform === 'win32') {
    env.PYTHONIOENCODING = 'utf-8';
    env.PYTHONUTF8 = '1';
  }

  pythonProcess = spawn(pythonExecutable, [mainScript], {
    cwd: backendDir,
    env,
    // stdio: 'inherit' for debugging in terminal
  });

  if (pythonProcess.stdout) {
    pythonProcess.stdout.setEncoding('utf8');
    pythonProcess.stdout.on('data', (data: string) => {
      console.log(`[Python] ${data.trim()}`);
    });
  }

  if (pythonProcess.stderr) {
    pythonProcess.stderr.setEncoding('utf8');
    pythonProcess.stderr.on('data', (data: string) => {
      console.error(`[Python API] ${data.trim()}`);
    });
  }

  pythonProcess.on('error', (err) => {
    console.error('[Electron] Failed to start Python backend:', err);
  });

  pythonProcess.on('exit', (code, signal) => {
    console.log(`[Electron] Python backend exited with code ${code} and signal ${signal}`);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
      webSecurity: false, // file:// 프로토콜에서 ES 모듈 로드 허용
      defaultEncoding: 'UTF-8',
    },
    show: false,
  });

  // 개발 모드에서는 Vite 서버, 프로덕션에서는 빌드된 파일 로드
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // 로드 에러 핸들링
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load:', errorCode, errorDescription);
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// 모듈 간 통신 핸들러
ipcMain.handle('module:navigate', async (_, module: string) => {
  console.log(`Navigating to module: ${module}`);
  return { success: true, module };
});

ipcMain.handle('module:message', async (_, data: { type: string; payload: any }) => {
  // 모든 웹뷰에 메시지 브로드캐스트
  mainWindow?.webContents.send('module:broadcast', data);
  return { success: true };
});

ipcMain.handle('notion:fetch', async (_, endpoint: string, options: any) => {
  try {
    const baseUrl = 'https://api.notion.com/v1';
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: options.method || 'GET',
      headers: {
        'Authorization': options.headers['Authorization'],
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: options.body,
    });

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text || 'Unknown error' };
    }

    if (!response.ok) {
      // 에러 메시지를 안전하게 추출
      const errorMessage = typeof data.message === 'string'
        ? data.message
        : (data.code || `Notion API 오류 (${response.status})`);
      return { success: false, error: data, message: errorMessage };
    }
    return { success: true, data };
  } catch (error: any) {
    // 네트워크 에러 메시지를 한글로 변환
    let message = '네트워크 오류';
    if (error.code === 'ENOTFOUND') {
      message = '서버에 연결할 수 없습니다';
    } else if (error.code === 'ETIMEDOUT') {
      message = '연결 시간이 초과되었습니다';
    } else if (error.message) {
      message = error.message;
    }
    return { success: false, message, error: { code: error.code } };
  }
});

// ==================== AI 종합평가 생성 ====================

interface AIGenerationRequest {
  studentName: string;
  grade: string;
  yearMonth: string;
  subjects: string[];
  scores: Array<{ subject: string; score: number; comment?: string }>;
  historicalData?: Array<{
    yearMonth: string;
    scores: Array<{ subject: string; score: number }>;
  }>;
  provider: 'gemini' | 'openai' | 'claude';
  model: string;
  promptTemplate: string;
  generationCount: number;
  maxTokens: number;
}

// 프롬프트 템플릿에 변수 바인딩
function buildPrompt(request: AIGenerationRequest): string {
  const { studentName, grade, yearMonth, scores, historicalData, promptTemplate } = request;

  const subjectScores = scores
    .map((s) => `- ${s.subject}: ${s.score}점`)
    .join('\n');

  const subjectComments = scores
    .filter((s) => s.comment)
    .map((s) => `- ${s.subject}: ${s.comment}`)
    .join('\n') || '(코멘트 없음)';

  const avgScore = scores.length > 0
    ? Math.round(scores.reduce((sum, s) => sum + s.score, 0) / scores.length)
    : 0;

  const bestSubject = scores.length > 0
    ? scores.reduce((a, b) => (a.score > b.score ? a : b)).subject
    : '-';

  const worstSubject = scores.length > 0
    ? scores.reduce((a, b) => (a.score < b.score ? a : b)).subject
    : '-';

  // 6개월 추이 생성
  let trendText = '(데이터 없음)';
  if (historicalData && historicalData.length > 0) {
    const lines = historicalData.map((h) => {
      const monthScores = h.scores.map((s) => `${s.subject}: ${s.score}점`).join(', ');
      return `- ${h.yearMonth}: ${monthScores}`;
    });
    trendText = lines.join('\n');

    // 성적 변화 방향 계산
    if (historicalData.length >= 2) {
      const prevAvg = historicalData[historicalData.length - 2].scores.reduce((sum, s) => sum + s.score, 0) /
        (historicalData[historicalData.length - 2].scores.length || 1);
      const currAvg = scores.reduce((sum, s) => sum + s.score, 0) / (scores.length || 1);
      const direction = currAvg > prevAvg ? '상승' : currAvg < prevAvg ? '하락' : '유지';
      trendText += `\n\n전체 평균 변화: ${Math.round(prevAvg)}점 → ${Math.round(currAvg)}점 (${direction})`;
    }
  }

  return promptTemplate
    .replace(/\{\{학생이름\}\}/g, studentName)
    .replace(/\{\{학년\}\}/g, grade)
    .replace(/\{\{연월\}\}/g, yearMonth)
    .replace(/\{\{과목목록\}\}/g, request.subjects.join(', '))
    .replace(/\{\{과목별점수\}\}/g, subjectScores)
    .replace(/\{\{과목별코멘트\}\}/g, subjectComments)
    .replace(/\{\{평균점수\}\}/g, String(avgScore))
    .replace(/\{\{최고과목\}\}/g, bestSubject)
    .replace(/\{\{최저과목\}\}/g, worstSubject)
    .replace(/\{\{6개월추이\}\}/g, trendText)
    .replace(/\{\{성적변화방향\}\}/g, '');
}

// Gemini API 호출
async function callGemini(apiKey: string, model: string, prompt: string, maxTokens: number): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  // thinking 모델(2.5 계열)은 thinking을 비활성화하여 토큰 낭비 방지
  const isThinking = model.startsWith('gemini-2.5');
  const generationConfig: any = { maxOutputTokens: maxTokens, temperature: 0.8 };
  if (isThinking) {
    generationConfig.thinkingConfig = { thinkingBudget: 0 };
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig,
    }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || `Gemini API 오류 (${response.status})`);
  }
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const usage = data.usageMetadata || {};
  return {
    text,
    inputTokens: usage.promptTokenCount || 0,
    outputTokens: usage.candidatesTokenCount || 0,
  };
}

// OpenAI API 호출
async function callOpenAI(apiKey: string, model: string, prompt: string, maxTokens: number): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
      temperature: 0.8,
    }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || `OpenAI API 오류 (${response.status})`);
  }
  return {
    text: data.choices?.[0]?.message?.content || '',
    inputTokens: data.usage?.prompt_tokens || 0,
    outputTokens: data.usage?.completion_tokens || 0,
  };
}

// Claude API 호출
async function callClaude(apiKey: string, model: string, prompt: string, maxTokens: number): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || `Claude API 오류 (${response.status})`);
  }
  return {
    text: data.content?.[0]?.text || '',
    inputTokens: data.usage?.input_tokens || 0,
    outputTokens: data.usage?.output_tokens || 0,
  };
}

ipcMain.handle('ai:generate', async (_, request: AIGenerationRequest) => {
  try {
    const prompt = buildPrompt(request);
    const { provider, model, maxTokens, generationCount } = request;

    // API 키 검증 - Renderer에서 전달받은 설정에서 가져오기
    let apiKey = '';
    if (provider === 'gemini') apiKey = request.scores.length >= 0 ? '' : ''; // placeholder
    if (provider === 'openai') apiKey = '';
    if (provider === 'claude') apiKey = '';

    // API 키는 Renderer에서 IPC로 전달
    // (보안: main process에서만 사용하고 렌더러에는 노출하지 않음)
    // 실제 키는 request에 포함해서 전달
    const reqWithKey = request as any;
    apiKey = reqWithKey.apiKey || '';

    if (!apiKey) {
      return { success: false, versions: [], error: `${provider} API 키가 설정되지 않았습니다.` };
    }

    // 여러 버전 순차 생성 (Free tier 속도 제한 대응)
    const callProvider = async (versionIndex: number) => {
      const promptVariation = versionIndex === 0 ? prompt
        : `${prompt}\n\n(다른 표현과 관점으로 작성해주세요. 버전 ${versionIndex + 1})`;

      switch (provider) {
        case 'gemini':
          return callGemini(apiKey, model, promptVariation, maxTokens);
        case 'openai':
          return callOpenAI(apiKey, model, promptVariation, maxTokens);
        case 'claude':
          return callClaude(apiKey, model, promptVariation, maxTokens);
        default:
          throw new Error(`지원하지 않는 프로바이더: ${provider}`);
      }
    };

    // 순차 호출 (API rate limit 대응, 각 호출 사이 1초 대기)
    const results: Array<{ text: string; inputTokens: number; outputTokens: number }> = [];
    for (let i = 0; i < generationCount; i++) {
      if (i > 0) await new Promise((r) => setTimeout(r, 1000));
      try {
        const result = await callProvider(i);
        results.push(result);
      } catch (err: any) {
        // 개별 버전 실패 시 에러 메시지를 텍스트로 넣고 계속 진행
        console.warn(`[AI] Version ${i + 1} generation failed:`, err.message);
        if (results.length === 0) throw err; // 첫 버전도 실패하면 전체 실패
      }
    }

    const versions = results.map((r) => r.text.trim());
    const totalInputTokens = results.reduce((sum, r) => sum + r.inputTokens, 0);
    const totalOutputTokens = results.reduce((sum, r) => sum + r.outputTokens, 0);

    return {
      success: true,
      versions,
      usage: {
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        model,
        provider,
      },
    };
  } catch (error: any) {
    console.error('[AI Generate Error]', error);
    return {
      success: false,
      versions: [],
      error: error.message || 'AI 생성 중 오류가 발생했습니다.',
    };
  }
});

ipcMain.handle('typst:compile', async (_, { source, outputPath }: { source: string; outputPath: string }) => {
  const { exec } = require('child_process');
  const fs = require('fs');
  const tempPath = path.join(app.getPath('temp'), `report_${Date.now()}.typ`);

  try {
    fs.writeFileSync(tempPath, source);
    return new Promise((resolve) => {
      exec(`typst compile "${tempPath}" "${outputPath}"`, (error: any, stdout: string, stderr: string) => {
        if (error) {
          resolve({ success: false, message: stderr || error.message });
        } else {
          resolve({ success: true, outputPath });
        }
      });
    });
  } catch (err: any) {
    return { success: false, message: err.message };
  }
});

app.whenReady().then(() => {
  startPythonBackend();
  createWindow();
});

app.on('will-quit', () => {
  if (pythonProcess) {
    console.log('[Electron] Killing Python backend...');
    pythonProcess.kill();
    pythonProcess = null;
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
