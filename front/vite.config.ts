import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        hmr: false,
        proxy: {
          // MegaETH backend (port 3004) — must be before /api to match first
          '/api-mega': {
            target: 'http://localhost:3004',
            changeOrigin: true,
            rewrite: (path: string) => path.replace(/^\/api-mega/, '/api'),
          },
          '/api': {
            target: 'http://localhost:3003',
            changeOrigin: true,
          },
          // MegaETH metadata server (port 3002) — must be before /metadata
          '/metadata-mega': {
            target: 'http://localhost:3002',
            changeOrigin: true,
            rewrite: (path: string) => path.replace(/^\/metadata-mega/, '/metadata'),
          },
          '/metadata': {
            target: 'http://localhost:3001',
            changeOrigin: true,
          },
          '/health': {
            target: 'http://localhost:3003',
            changeOrigin: true,
          },
        },
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
