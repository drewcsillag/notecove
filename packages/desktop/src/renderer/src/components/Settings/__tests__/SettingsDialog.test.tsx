/**
 * Settings Dialog Tests
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SettingsDialog } from '../SettingsDialog';
import { FeatureFlagsProvider } from '../../../contexts/FeatureFlagsContext';

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
  theme: {
    set: jest.fn().mockResolvedValue(undefined),
    onChanged: jest.fn(() => () => {
      /* unsubscribe */
    }),
  },
  user: {
    getCurrentProfile: jest.fn().mockResolvedValue({
      profileId: 'test-profile-id',
      username: 'Test User',
      handle: '@testuser',
    }),
  },
  featureFlags: {
    get: jest.fn().mockResolvedValue(true),
    getAll: jest.fn().mockResolvedValue([
      {
        flag: 'telemetry',
        enabled: true,
        metadata: { name: 'Telemetry', description: '', requiresRestart: false },
      },
      {
        flag: 'viewHistory',
        enabled: true,
        metadata: { name: 'View History', description: '', requiresRestart: true },
      },
      {
        flag: 'webServer',
        enabled: true,
        metadata: { name: 'Web Server', description: '', requiresRestart: true },
      },
    ]),
    onChange: jest.fn(() => () => {
      /* unsubscribe */
    }),
  },
};

/**
 * Wrapper that provides FeatureFlagsProvider context for tests
 */
function TestWrapper({ children }: { children: React.ReactNode }) {
  return <FeatureFlagsProvider>{children}</FeatureFlagsProvider>;
}

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

  it('should show all tabs when feature flags are enabled', async () => {
    const onClose = jest.fn();
    render(
      <TestWrapper>
        <SettingsDialog
          open={true}
          onClose={onClose}
          themeMode="light"
          onThemeChange={mockOnThemeChange}
        />
      </TestWrapper>
    );

    // Wait for feature flags to load (async)
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'Telemetry' })).toBeInTheDocument();
    });

    expect(screen.getByRole('tab', { name: 'Storage Directories' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'User' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Appearance' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Web Server' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Recovery' })).toBeInTheDocument();
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

  describe('Theme Broadcasting', () => {
    it('should call theme.set IPC when dark mode is toggled', async () => {
      const onClose = jest.fn();
      const onThemeChange = jest.fn();
      mockElectronAPI.sd.list.mockResolvedValue([]);

      render(
        <SettingsDialog
          open={true}
          onClose={onClose}
          themeMode="light"
          onThemeChange={onThemeChange}
        />
      );

      // Navigate to Appearance tab
      const appearanceTab = screen.getByText('Appearance');
      fireEvent.click(appearanceTab);

      await waitFor(() => {
        expect(screen.getByText(/Customize the look and feel/i)).toBeInTheDocument();
      });

      // Find and click the dark mode toggle
      const darkModeSwitch = screen.getByRole('checkbox');
      fireEvent.click(darkModeSwitch);

      // Should call theme.set IPC to broadcast to all windows
      await waitFor(() => {
        expect(mockElectronAPI.theme.set).toHaveBeenCalledWith('dark');
      });
    });

    it('should call theme.set with light when toggling off dark mode', async () => {
      const onClose = jest.fn();
      const onThemeChange = jest.fn();
      mockElectronAPI.sd.list.mockResolvedValue([]);

      render(
        <SettingsDialog
          open={true}
          onClose={onClose}
          themeMode="dark"
          onThemeChange={onThemeChange}
        />
      );

      // Navigate to Appearance tab
      const appearanceTab = screen.getByText('Appearance');
      fireEvent.click(appearanceTab);

      await waitFor(() => {
        expect(screen.getByText(/Customize the look and feel/i)).toBeInTheDocument();
      });

      // Find and click the dark mode toggle (currently on, should turn off)
      const darkModeSwitch = screen.getByRole('checkbox');
      fireEvent.click(darkModeSwitch);

      // Should call theme.set IPC with 'light'
      await waitFor(() => {
        expect(mockElectronAPI.theme.set).toHaveBeenCalledWith('light');
      });
    });
  });
});
