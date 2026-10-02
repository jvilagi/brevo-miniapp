import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { staticPwa } from './pwa-plugin.ts';

export default defineConfig({
  plugins: [react(), staticPwa()],
  envDir: false,
  // Cap variable d'entorn s'incorpora automàticament al codi del navegador.
  envPrefix: 'PUBLIC_WEB_',
  server: {
    host: '127.0.0.1', port: 5174, strictPort: true,
    proxy: { '/api': { target: 'http://127.0.0.1:3000' } },
  },
});
