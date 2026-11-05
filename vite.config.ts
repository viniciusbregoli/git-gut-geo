import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const apiPort = Number(process.env.GGG_API_PORT ?? 4317);

export default defineConfig({
  root: 'web',
  plugins: [react()],
  server: {
    port: 5317,
    strictPort: true,
    proxy: { '/api': `http://127.0.0.1:${apiPort}` },
  },
  build: { outDir: '../dist', emptyOutDir: true },
});
