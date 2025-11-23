/**
 * Jest setup file
 * Runs before all tests to configure the test environment
 */

// Polyfill TextEncoder/TextDecoder for jsdom environment
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

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

// Mock MUI TreeView components
jest.mock('@mui/x-tree-view/RichTreeView', () => {
  const React = require('react');
  return {
    RichTreeView: ({ items, slots, slotProps, ...props }) => {
      const TreeItem = slots?.item || require('@mui/x-tree-view/TreeItem').TreeItem;
      const renderTree = (nodes) => {
        return nodes.map((node) => {
          const itemProps =
            typeof slotProps?.item === 'function' ? slotProps.item({}) : slotProps?.item || {};
          return React.createElement(
            'div',
            { key: node.id, 'data-testid': `tree-item-${node.id}` },
            [
              React.createElement('div', { key: `label-${node.id}` }, node.label),
              node.children && node.children.length > 0 ? renderTree(node.children) : null,
            ]
          );
        });
      };
      return React.createElement(
        'div',
        { 'data-testid': 'rich-tree-view' },
        renderTree(items || [])
      );
    },
  };
});

jest.mock('@mui/x-tree-view/TreeItem', () => {
  const React = require('react');
  return {
    TreeItem: React.forwardRef(({ itemId, children, ...props }, ref) => {
      return React.createElement(
        'div',
        { ref, 'data-testid': `tree-item-${itemId}`, ...props },
        children
      );
    }),
  };
});

jest.mock('@mui/x-tree-view/models', () => ({
  // Export types as empty objects for Jest
}));
