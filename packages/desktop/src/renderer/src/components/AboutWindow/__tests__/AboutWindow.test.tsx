/**
 * About Window Tests
 *
 * Tests for the standalone About window component that displays
 * application information in its own window.
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AboutWindow } from '../AboutWindow';

// Mock window.electronAPI
const mockElectronAPI = {
  app: {
    getInfo: jest.fn(),
  },
  shell: {
    openExternal: jest.fn(),
  },
  user: {
    getCurrentProfile: jest.fn().mockResolvedValue({
      profileId: 'test-profile-id',
      username: 'Test User',
      handle: '@testuser',
    }),
  },
};

// Set up global mocks before tests
beforeAll(() => {
  (global as unknown as { window: { electronAPI: typeof mockElectronAPI } }).window.electronAPI =
    mockElectronAPI;
});

describe('AboutWindow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockElectronAPI.app.getInfo.mockResolvedValue({
      version: '1.2.3',
      isDevBuild: false,
      profileId: 'test-profile-id',
      profileName: 'Test Profile',
    });
  });

  it('should render app name', async () => {
    render(<AboutWindow />);

    await waitFor(() => {
      expect(screen.getByText('NoteCove')).toBeInTheDocument();
    });
  });

  it('should display version number', async () => {
    render(<AboutWindow />);

    await waitFor(() => {
      expect(screen.getByText(/Version 1\.2\.3/)).toBeInTheDocument();
    });
  });

  it('should display "Development Build" when isDevBuild is true', async () => {
    mockElectronAPI.app.getInfo.mockResolvedValue({
      version: '1.2.3',
      isDevBuild: true,
      profileId: 'test-profile-id',
      profileName: 'Test Profile',
    });

    render(<AboutWindow />);

    await waitFor(() => {
      expect(screen.getByText('Development Build')).toBeInTheDocument();
    });
  });

  it('should not display "Development Build" when isDevBuild is false', async () => {
    render(<AboutWindow />);

    await waitFor(() => {
      expect(screen.getByText('NoteCove')).toBeInTheDocument();
    });
    expect(screen.queryByText('Development Build')).not.toBeInTheDocument();
  });

  it('should display profile name and ID', async () => {
    render(<AboutWindow />);

    await waitFor(() => {
      expect(screen.getByText(/Test Profile/)).toBeInTheDocument();
      expect(screen.getByText(/test-profile-id/)).toBeInTheDocument();
    });
  });

  it('should display copyright notice', async () => {
    render(<AboutWindow />);

    await waitFor(() => {
      expect(screen.getByText(/© 2025 Drew Csillag/)).toBeInTheDocument();
    });
  });

  it('should display license link', async () => {
    render(<AboutWindow />);

    await waitFor(() => {
      expect(screen.getByText(/Apache 2\.0/)).toBeInTheDocument();
    });
  });

  it('should open license URL when license link is clicked', async () => {
    render(<AboutWindow />);

    await waitFor(() => {
      expect(screen.getByText(/Apache 2\.0/)).toBeInTheDocument();
    });

    const licenseLink = screen.getByText(/Apache 2\.0/);
    fireEvent.click(licenseLink);

    expect(mockElectronAPI.shell.openExternal).toHaveBeenCalledWith(
      'https://www.apache.org/licenses/LICENSE-2.0'
    );
  });

  it('should show loading state while fetching data', () => {
    mockElectronAPI.app.getInfo.mockImplementation(
      () =>
        new Promise(() => {
          // Never resolves - intentionally testing loading state
        })
    );

    render(<AboutWindow />);

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('should call getInfo on mount', async () => {
    render(<AboutWindow />);

    await waitFor(() => {
      expect(mockElectronAPI.app.getInfo).toHaveBeenCalled();
    });
  });

  it('should not display profile section when profileName is null', async () => {
    mockElectronAPI.app.getInfo.mockResolvedValue({
      version: '1.2.3',
      isDevBuild: false,
      profileId: null,
      profileName: null,
    });

    render(<AboutWindow />);

    await waitFor(() => {
      expect(screen.getByText('NoteCove')).toBeInTheDocument();
    });
    expect(screen.queryByText('Profile:')).not.toBeInTheDocument();
  });
});
