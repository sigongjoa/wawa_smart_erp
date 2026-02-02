import { app, BrowserWindow, shell, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import http from 'http';
import fs from 'fs';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 개발 모드 확인
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    icon: path.join(__dirname, '../public/icon.png'),
    title: '월말평가 리포트',
    autoHideMenuBar: true,
  });

  // 외부 링크는 기본 브라우저에서 열기
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// ============ 프린터 IPC Handlers ============

// 프린터 목록 조회
ipcMain.handle('get-printers', async () => {
  try {
    const mainWindow = BrowserWindow.getAllWindows()[0];
    if (!mainWindow) {
      throw new Error('No window found');
    }

    const printers = mainWindow.webContents.getPrinters();
    return {
      success: true,
      printers: printers.map(p => ({
        name: p.name,
        displayName: p.displayName,
        description: p.description,
        status: p.status,
        isDefault: p.isDefault,
        options: p.options,
      })),
    };
  } catch (error) {
    console.error('Failed to get printers:', error);
    return {
      success: false,
      error: error.message,
      printers: [],
    };
  }
});

// 기본 프린터 조회
ipcMain.handle('get-default-printer', async () => {
  try {
    const mainWindow = BrowserWindow.getAllWindows()[0];
    if (!mainWindow) {
      throw new Error('No window found');
    }

    const printers = mainWindow.webContents.getPrinters();
    const defaultPrinter = printers.find(p => p.isDefault);

    return {
      success: true,
      printer: defaultPrinter ? {
        name: defaultPrinter.name,
        displayName: defaultPrinter.displayName,
      } : null,
    };
  } catch (error) {
    console.error('Failed to get default printer:', error);
    return {
      success: false,
      error: error.message,
      printer: null,
    };
  }
});

// PDF 다운로드 헬퍼
function downloadPDF(url) {
  return new Promise((resolve, reject) => {
    const tempPath = path.join(os.tmpdir(), `print_${Date.now()}.pdf`);
    const file = fs.createWriteStream(tempPath);

    const protocol = url.startsWith('https') ? https : http;

    protocol.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ElectronPrintApp/1.0)',
      },
    }, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
        return;
      }

      response.pipe(file);

      file.on('finish', () => {
        file.close();
        resolve(tempPath);
      });
    }).on('error', (err) => {
      fs.unlink(tempPath, () => {});
      reject(err);
    });

    file.on('error', (err) => {
      fs.unlink(tempPath, () => {});
      reject(err);
    });
  });
}

// PDF 프린트
ipcMain.handle('print-pdf', async (event, pdfUrl, printerName) => {
  let tempFilePath = null;

  try {
    const mainWindow = BrowserWindow.getAllWindows()[0];
    if (!mainWindow) {
      throw new Error('No window found');
    }

    // 1. PDF 다운로드
    console.log('[Print] Downloading PDF:', pdfUrl);
    tempFilePath = await downloadPDF(pdfUrl);
    console.log('[Print] Downloaded to:', tempFilePath);

    // 2. 프린터 확인
    const printers = mainWindow.webContents.getPrinters();

    if (printers.length === 0) {
      throw new Error('프린터가 설치되어 있지 않습니다.');
    }

    let targetPrinter;
    if (printerName) {
      targetPrinter = printers.find(p => p.name === printerName);
      if (!targetPrinter) {
        throw new Error(`프린터를 찾을 수 없습니다: ${printerName}`);
      }
    } else {
      targetPrinter = printers.find(p => p.isDefault) || printers[0];
    }

    console.log('[Print] Using printer:', targetPrinter.name);

    // 3. 프린트 윈도우 생성 (보이지 않음)
    const printWindow = new BrowserWindow({
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    // 4. PDF 로드
    await printWindow.loadFile(tempFilePath);

    // 5. 프린트 실행
    return new Promise((resolve) => {
      printWindow.webContents.print(
        {
          silent: true,
          printBackground: true,
          deviceName: targetPrinter.name,
        },
        (success, failureReason) => {
          // 프린트 윈도우 닫기
          printWindow.close();

          // 임시 파일 삭제
          if (tempFilePath) {
            fs.unlink(tempFilePath, (err) => {
              if (err) console.error('[Print] Failed to delete temp file:', err);
            });
          }

          if (success) {
            console.log('[Print] Print job sent successfully');
            resolve({
              success: true,
              message: '프린트 요청이 전송되었습니다.',
              printer: targetPrinter.displayName || targetPrinter.name,
            });
          } else {
            console.error('[Print] Print failed:', failureReason);
            resolve({
              success: false,
              error: '프린트 실패',
              details: failureReason || '알 수 없는 오류',
            });
          }
        }
      );
    });
  } catch (error) {
    console.error('[Print] Error:', error);

    // 에러 발생시 임시 파일 삭제
    if (tempFilePath) {
      fs.unlink(tempFilePath, (err) => {
        if (err) console.error('[Print] Failed to delete temp file:', err);
      });
    }

    let errorMessage = '프린트 실패';
    let errorDetails = error.message;

    if (error.message.includes('HTTP')) {
      errorMessage = 'PDF 다운로드 실패';
    } else if (error.message.includes('ENOTFOUND') || error.message.includes('ETIMEDOUT')) {
      errorMessage = '네트워크 오류';
      errorDetails = 'PDF를 다운로드할 수 없습니다. 인터넷 연결을 확인하세요.';
    }

    return {
      success: false,
      error: errorMessage,
      details: errorDetails,
    };
  }
});

// ============ Notion API 프록시 ============

ipcMain.handle('notion-fetch', async (event, endpoint, options = {}) => {
  return new Promise((resolve, reject) => {
    const url = new URL(`https://api.notion.com/v1${endpoint}`);

    const requestOptions = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28',
        ...options.headers,
      },
    };

    const req = https.request(requestOptions, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (res.statusCode >= 400) {
            resolve({ error: true, status: res.statusCode, data: json });
          } else {
            resolve({ error: false, status: res.statusCode, data: json });
          }
        } catch (e) {
          resolve({ error: true, status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', (error) => {
      resolve({ error: true, message: error.message });
    });

    if (options.body) {
      req.write(options.body);
    }

    req.end();
  });
});
