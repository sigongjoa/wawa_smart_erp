import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@wawa/notion-client': path.resolve(__dirname, '../../packages/notion-client/src'),
    },
  },
  build: {
    outDir: 'dist/renderer',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/api/notion/v1': {
        target: 'https://api.notion.com/v1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/notion\/v1/, ''),
        headers: {
          'Notion-Version': '2022-06-28',
        },
      },
    },
  },
});
