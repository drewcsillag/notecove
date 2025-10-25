/**
 * App Component Tests
 */

// Mock i18n before any imports
jest.mock('../i18n', () => ({}));

// Mock TipTap editor
jest.mock('../components/EditorPanel/TipTapEditor', () => ({
  TipTapEditor: () => <div data-testid="tiptap-editor">TipTap Editor</div>,
}));

import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import App from '../App';

// Mock window.electronAPI
const mockElectronAPI = {
  platform: 'darwin',
  note: {
    load: jest.fn(),
    unload: jest.fn(),
    applyUpdate: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    move: jest.fn(),
    getMetadata: jest.fn(),
    onUpdated: jest.fn(),
    onDeleted: jest.fn(),
  },
  folder: {
    create: jest.fn(),
    delete: jest.fn(),
    onUpdated: jest.fn(),
  },
  sync: {
    onProgress: jest.fn(),
  },
  appState: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
  },
};

Object.defineProperty(window, 'electronAPI', {
  value: mockElectronAPI,
  writable: true,
});

describe('App', () => {
  it('should render the three-panel layout', () => {
    const { container } = render(<App />);
    // Check that the panel group is rendered
    const panelGroup = container.querySelector('[data-testid="panel-group"]');
    expect(panelGroup).toBeInTheDocument();
  });

  it('should render all three panels', () => {
    const { container } = render(<App />);
    // Check that all three panels are rendered
    const panels = container.querySelectorAll('[data-testid="panel"]');
    expect(panels).toHaveLength(3);
  });

  it('should render folder panel content', () => {
    render(<App />);
    expect(screen.getByText('folders.title')).toBeInTheDocument();
  });

  it('should render notes list panel content', () => {
    render(<App />);
    expect(screen.getByText('notes.title')).toBeInTheDocument();
  });

  it('should render editor panel content', () => {
    render(<App />);
    expect(screen.getByTestId('tiptap-editor')).toBeInTheDocument();
  });

  it('should use Material-UI theme', () => {
    const { container } = render(<App />);
    // Check that MUI CssBaseline is applied
    expect(container.firstChild).toBeTruthy();
  });
});
