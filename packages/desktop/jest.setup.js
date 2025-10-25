/**
 * Jest setup file
 * Runs before all tests to configure the test environment
 */

// Mock i18next
jest.mock('i18next', () => ({
  use: jest.fn().mockReturnThis(),
  init: jest.fn().mockReturnThis(),
}));

// Mock react-i18next
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key,
    i18n: {
      changeLanguage: jest.fn(),
      language: 'en',
    },
  }),
  initReactI18next: {
    type: '3rdParty',
    init: jest.fn(),
  },
}));

// Mock react-resizable-panels
jest.mock('react-resizable-panels', () => {
  const React = require('react');
  return {
    Panel: ({ children }) => React.createElement('div', { 'data-testid': 'panel' }, children),
    PanelGroup: ({ children }) =>
      React.createElement('div', { 'data-testid': 'panel-group' }, children),
    PanelResizeHandle: ({ children }) =>
      React.createElement('div', { 'data-testid': 'resize-handle' }, children),
  };
});
