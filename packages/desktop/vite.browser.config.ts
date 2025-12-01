/**
 * Vite config for browser-only build (web interface)
 *
 * This builds the renderer without Electron dependencies,
 * allowing it to run in a standalone browser context.
 */

import { resolve } from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: resolve(__dirname, 'src/renderer'),
  base: '/',

  build: {
    outDir: resolve(__dirname, 'dist-browser'),
    emptyDirBeforeWrite: true,
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'src/renderer/index-browser.html'),
      },
    },
  },

  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/renderer'),
      '@shared': resolve(__dirname, '../shared/src'),
    },
  },

  plugins: [react()],

  define: {
    // Flag to detect browser vs Electron at runtime
    '__IS_BROWSER__': JSON.stringify(true),
  },
});
