/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.d.ts', '!src/**/__tests__/**'],
  coverageThreshold: {
    global: {
      statements: 26,
      branches: 18,
      functions: 21,
      lines: 27,
    },
  },
  passWithNoTests: true,
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@shared/(.*)$': '<rootDir>/../shared/src/$1',
    '^@notecove/shared$': '<rootDir>/../shared/dist/cjs/index.js',
    '^@minoru/react-dnd-treeview$': '<rootDir>/src/__mocks__/@minoru/react-dnd-treeview.tsx',
    '^react-dnd$': '<rootDir>/src/__mocks__/react-dnd.tsx',
    '^react-dnd-html5-backend$': '<rootDir>/src/__mocks__/react-dnd-html5-backend.tsx',
    '^uuid$': '<rootDir>/src/__mocks__/uuid.ts',
    '^lowlight$': '<rootDir>/src/__mocks__/lowlight.ts',
    '^@tiptap/extension-code-block-lowlight$':
      '<rootDir>/src/__mocks__/@tiptap/extension-code-block-lowlight.ts',
    '^@floating-ui/dom$': '<rootDir>/src/__mocks__/@floating-ui/dom.ts',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(@minoru/react-dnd-treeview|react-dnd|dnd-core|@react-dnd|uuid)/)',
  ],
};
