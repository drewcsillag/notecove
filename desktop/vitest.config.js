import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.{js,ts}'],
    exclude: ['node_modules', 'dist', 'tests/e2e/**/*'],
    setupFiles: ['./vitest.setup.js']
  }
});