import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    // `vendor-cad` (three.js + dxf-parser, ~174 kB gzip) ships only to the lazy
    // CAD surfaces and the remaining entry (~180 kB gzip) is the marketing +
    // auth + explorer route, so the default 500 kB warning is expected noise.
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three') || id.includes('node_modules/dxf-parser')) return 'vendor-cad';
        },
      },
    },
  },
});
