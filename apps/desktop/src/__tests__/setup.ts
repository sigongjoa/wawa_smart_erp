import '@testing-library/jest-dom/vitest';

// Mock window.wawaAPI for Electron IPC
Object.defineProperty(window, 'wawaAPI', {
  value: undefined,
  writable: true,
});
