import { vi, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';

// Test data directory
const TEST_DATA_DIR = join(process.cwd(), '.test-data');

// Setup test data directory
beforeEach(() => {
  // Create test data directory
  if (!existsSync(TEST_DATA_DIR)) {
    mkdirSync(TEST_DATA_DIR, { recursive: true });
  }
});

// Cleanup after tests
afterEach(() => {
  // Clean up test data
  if (existsSync(TEST_DATA_DIR)) {
    rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  }
});

// Mock window.electronAPI with test data path
global.window.electronAPI = {
  isElectron: false, // Run tests in web mode by default
  settings: {
    get: vi.fn((key) => {
      if (key === 'notesPath') {
        return join(TEST_DATA_DIR, 'notes');
      }
      if (key === 'documentsPath') {
        return TEST_DATA_DIR;
      }
      return null;
    }),
    set: vi.fn()
  }
};

// Mock localStorage with test-specific storage
const testStorage = new Map();
const localStorageMock = {
  getItem: vi.fn((key) => testStorage.get(key) || null),
  setItem: vi.fn((key, value) => testStorage.set(key, value)),
  removeItem: vi.fn((key) => testStorage.delete(key)),
  clear: vi.fn(() => testStorage.clear()),
};
global.localStorage = localStorageMock;

// Export test utilities
export { TEST_DATA_DIR };
