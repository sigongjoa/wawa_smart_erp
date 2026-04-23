import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Stale dynamic-import 청크 자동 복구
// 배포로 chunk 파일명이 바뀌면 옛 index.js가 참조하는 옛 청크는 404가 되며
// "Failed to fetch dynamically imported module" 에러가 발생.
// 한 번만 강제 새로고침해서 새 index.html을 받게 한다 (무한 루프 방지 플래그).
const RELOAD_FLAG = 'stale-chunk-reload';
function isStaleChunkError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /Failed to fetch dynamically imported module|Loading chunk \d+ failed|MIME type of "text\/html"/i.test(msg);
}
function tryReloadOnce() {
  if (sessionStorage.getItem(RELOAD_FLAG)) return;
  sessionStorage.setItem(RELOAD_FLAG, '1');
  window.location.reload();
}
window.addEventListener('error', (e) => {
  if (isStaleChunkError(e.error || e.message)) tryReloadOnce();
});
window.addEventListener('unhandledrejection', (e) => {
  if (isStaleChunkError(e.reason)) tryReloadOnce();
});
// 정상 로드되면 플래그 초기화 (다음 배포 때 재발 시 다시 동작)
window.addEventListener('load', () => {
  setTimeout(() => sessionStorage.removeItem(RELOAD_FLAG), 5000);
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
