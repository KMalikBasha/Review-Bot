import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Forward /api/* calls to the Node backend to avoid CORS hassles in dev
      '/api': 'http://localhost:4000',
    },
  },
});
