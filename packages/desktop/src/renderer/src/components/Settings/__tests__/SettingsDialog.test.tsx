/**
 * Settings Dialog Tests
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SettingsDialog } from '../SettingsDialog';

// Mock window.electronAPI
const mockElectronAPI = {
  sd: {
    list: jest.fn(),
    create: jest.fn(),
    setActive: jest.fn(),
    getActive: jest.fn(),
    selectPath: jest.fn(),
    getCloudStoragePaths: jest.fn().mockResolvedValue({}),
  },
  appState: {
    get: jest.fn(),
    set: jest.fn(),
  },
  config: {
    getDatabasePath: jest.fn().mockResolvedValue('/test/path/notecove.db'),
    setDatabasePath: jest.fn(),
  },
};

// Set up global mocks before tests
beforeAll(() => {
  (global as any).window.electronAPI = mockElectronAPI;
  (global as any).window.matchMedia = jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  }));
});

describe('SettingsDialog', () => {
  const mockOnThemeChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockElectronAPI.sd.list.mockResolvedValue([]);
  });

  it('should render when open is true', () => {
    const onClose = jest.fn();
    render(
      <SettingsDialog
        open={true}
        onClose={onClose}
        themeMode="light"
        onThemeChange={mockOnThemeChange}
      />
    );

    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('should not render when open is false', () => {
    const onClose = jest.fn();
    render(
      <SettingsDialog
        open={false}
        onClose={onClose}
        themeMode="light"
        onThemeChange={mockOnThemeChange}
      />
    );

    expect(screen.queryByText('Settings')).not.toBeInTheDocument();
  });

  it('should show four tabs', () => {
    const onClose = jest.fn();
    render(
      <SettingsDialog
        open={true}
        onClose={onClose}
        themeMode="light"
        onThemeChange={mockOnThemeChange}
      />
    );

    expect(screen.getByText('Storage Directories')).toBeInTheDocument();
    expect(screen.getByText('User')).toBeInTheDocument();
    expect(screen.getByText('Appearance')).toBeInTheDocument();
    expect(screen.getByText('Database')).toBeInTheDocument();
  });

  it('should call onClose when close button is clicked', () => {
    const onClose = jest.fn();
    render(
      <SettingsDialog
        open={true}
        onClose={onClose}
        themeMode="light"
        onThemeChange={mockOnThemeChange}
      />
    );

    const closeButtons = screen.getAllByRole('button', { name: /close/i });
    if (closeButtons[0]) {
      fireEvent.click(closeButtons[0]); // Click the X button in header
    }

    expect(onClose).toHaveBeenCalled();
  });

  it('should switch tabs when clicked', async () => {
    const onClose = jest.fn();
    render(
      <SettingsDialog
        open={true}
        onClose={onClose}
        themeMode="light"
        onThemeChange={mockOnThemeChange}
      />
    );

    // Initially on Storage Directories tab
    await waitFor(() => {
      expect(screen.getByText(/Storage Directories sync your notes/i)).toBeInTheDocument();
    });

    // Click User tab
    const userTab = screen.getByText('User');
    fireEvent.click(userTab);

    await waitFor(() => {
      expect(screen.getByText(/These settings identify you/i)).toBeInTheDocument();
    });

    // Click Appearance tab
    const appearanceTab = screen.getByText('Appearance');
    fireEvent.click(appearanceTab);

    await waitFor(() => {
      expect(screen.getByText(/Customize the look and feel/i)).toBeInTheDocument();
    });
  });

  it('should reset to first tab when closed and reopened', async () => {
    const onClose = jest.fn();
    mockElectronAPI.sd.list.mockResolvedValue([]);

    const { rerender } = render(
      <SettingsDialog
        open={true}
        onClose={onClose}
        themeMode="light"
        onThemeChange={mockOnThemeChange}
      />
    );

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'Storage Directories' })).toHaveAttribute(
        'aria-selected',
        'true'
      );
    });

    // Switch to User tab
    const userTab = screen.getByRole('tab', { name: 'User' });
    fireEvent.click(userTab);

    await waitFor(() => {
      expect(userTab).toHaveAttribute('aria-selected', 'true');
    });

    // Close dialog
    rerender(
      <SettingsDialog
        open={false}
        onClose={onClose}
        themeMode="light"
        onThemeChange={mockOnThemeChange}
      />
    );

    // Reopen dialog
    rerender(
      <SettingsDialog
        open={true}
        onClose={onClose}
        themeMode="light"
        onThemeChange={mockOnThemeChange}
      />
    );

    // Should be back on Storage Directories tab
    await waitFor(() => {
      const sdTab = screen.getByRole('tab', { name: 'Storage Directories' });
      expect(sdTab).toHaveAttribute('aria-selected', 'true');
    });
  });
});
