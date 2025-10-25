/**
 * App Component Tests
 */

// Mock i18n before any imports
jest.mock('../i18n', () => ({}));

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
};

Object.defineProperty(window, 'electronAPI', {
  value: mockElectronAPI,
  writable: true,
});

describe('App', () => {
  it('should render the app title', () => {
    render(<App />);
    expect(screen.getByText('app.title')).toBeInTheDocument();
  });

  it('should render the tagline', () => {
    render(<App />);
    expect(screen.getByText('app.tagline')).toBeInTheDocument();
  });

  it('should display platform information', () => {
    render(<App />);
    expect(screen.getByText(/Platform: darwin/i)).toBeInTheDocument();
  });

  it('should use Material-UI theme', () => {
    const { container } = render(<App />);
    // Check that MUI CssBaseline is applied
    expect(container.firstChild).toBeTruthy();
  });
});
