import { resolve } from 'path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'dist-electron/main',
    },
    resolve: {
      alias: {
        '@': resolve('src/main'),
        '@shared': resolve('../shared/src'),
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'dist-electron/preload',
    },
  },
  renderer: {
    build: {
      outDir: 'dist-electron/renderer',
    },
    resolve: {
      alias: {
        '@': resolve('src/renderer'),
        '@shared': resolve('../shared/src'),
      },
    },
    plugins: [react()],
  },
});
