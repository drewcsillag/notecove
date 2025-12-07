import { resolve } from 'path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: ['bonjour-service'] })],
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
      rollupOptions: {
        input: {
          // Main app preload
          index: resolve(__dirname, 'src/preload/index.ts'),
          // Profile picker preload
          'profile-picker': resolve(__dirname, 'src/preload/profile-picker.ts'),
        },
      },
    },
  },
  renderer: {
    build: {
      outDir: 'dist-electron/renderer',
      rollupOptions: {
        input: {
          // Main app window
          index: resolve(__dirname, 'src/renderer/index.html'),
          // Profile picker window (separate entry point)
          'profile-picker': resolve(__dirname, 'src/renderer/profile-picker/index.html'),
        },
      },
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
