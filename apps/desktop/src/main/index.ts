import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';

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

  pythonProcess = spawn(pythonExecutable, [mainScript], {
    cwd: backendDir,
    // stdio: 'inherit' for debugging in terminal
  });

  if (pythonProcess.stdout) {
    pythonProcess.stdout.on('data', (data) => {
      console.log(`[Python] ${data.toString().trim()}`);
    });
  }

  if (pythonProcess.stderr) {
    pythonProcess.stderr.on('data', (data) => {
      console.error(`[Python API] ${data.toString().trim()}`);
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
        'Content-Type': 'application/json',
      },
      body: options.body,
    });

    const data = await response.json();
    if (!response.ok) {
      return { success: false, error: data, message: data.message || 'Notion API error' };
    }
    return { success: true, data };
  } catch (error: any) {
    return { success: false, message: error.message || 'Network error', error };
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
