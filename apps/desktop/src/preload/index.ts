import { contextBridge, ipcRenderer } from 'electron';

// 모듈과 메인 프로세스 간 안전한 통신 API
contextBridge.exposeInMainWorld('wawaAPI', {
  // 모듈 네비게이션
  navigate: (module: string) => ipcRenderer.invoke('module:navigate', module),

  // 모듈 간 메시지 전송
  sendMessage: (data: { type: string; payload: any }) =>
    ipcRenderer.invoke('module:message', data),

  // 브로드캐스트 메시지 수신
  onBroadcast: (callback: (data: any) => void) => {
    ipcRenderer.on('module:broadcast', (_, data) => callback(data));
  },

  // 플랫폼 정보
  platform: process.platform,

  // 앱 버전
  version: process.env.npm_package_version || '1.0.0',

  // Notion API 호출
  notionFetch: (endpoint: string, options: any) =>
    ipcRenderer.invoke('notion:fetch', endpoint, options),
  // Typst 컴파일
  typstCompile: (data: { source: string; outputPath: string }) =>
    ipcRenderer.invoke('typst:compile', data),
});

// TypeScript 타입 선언
declare global {
  interface Window {
    wawaAPI: {
      navigate: (module: string) => Promise<{ success: boolean; module: string }>;
      sendMessage: (data: { type: string; payload: any }) => Promise<{ success: boolean }>;
      onBroadcast: (callback: (data: any) => void) => void;
      platform: string;
      version: string;
      notionFetch: (endpoint: string, options: any) => Promise<{ success: boolean; data?: any; message?: string; error?: any }>;
      typstCompile: (data: { source: string; outputPath: string }) => Promise<{ success: boolean; outputPath?: string; message?: string }>;
    };
  }
}
