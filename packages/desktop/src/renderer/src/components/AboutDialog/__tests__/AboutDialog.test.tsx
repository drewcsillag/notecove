/**
 * About Dialog Tests
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AboutDialog } from '../AboutDialog';

// Mock window.electronAPI
const mockElectronAPI = {
  app: {
    getInfo: jest.fn(),
  },
  shell: {
    openExternal: jest.fn(),
  },
};

// Set up global mocks before tests
beforeAll(() => {
  (global as any).window.electronAPI = mockElectronAPI;
});

describe('AboutDialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockElectronAPI.app.getInfo.mockResolvedValue({
      version: '1.2.3',
      isDevBuild: false,
      profileId: 'test-profile-id',
      profileName: 'Test Profile',
    });
  });

  it('should render when open is true', async () => {
    const onClose = jest.fn();
    render(<AboutDialog open={true} onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByText('NoteCove')).toBeInTheDocument();
    });
  });

  it('should not render when open is false', () => {
    const onClose = jest.fn();
    render(<AboutDialog open={false} onClose={onClose} />);

    expect(screen.queryByText('NoteCove')).not.toBeInTheDocument();
  });

  it('should display version number', async () => {
    const onClose = jest.fn();
    render(<AboutDialog open={true} onClose={onClose} />);

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

    const onClose = jest.fn();
    render(<AboutDialog open={true} onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByText('Development Build')).toBeInTheDocument();
    });
  });

  it('should not display "Development Build" when isDevBuild is false', async () => {
    const onClose = jest.fn();
    render(<AboutDialog open={true} onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByText('NoteCove')).toBeInTheDocument();
    });
    expect(screen.queryByText('Development Build')).not.toBeInTheDocument();
  });

  it('should display profile name and ID', async () => {
    const onClose = jest.fn();
    render(<AboutDialog open={true} onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByText(/Test Profile/)).toBeInTheDocument();
      expect(screen.getByText(/test-profile-id/)).toBeInTheDocument();
    });
  });

  it('should display copyright notice', async () => {
    const onClose = jest.fn();
    render(<AboutDialog open={true} onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByText(/© 2025 Drew Csillag/)).toBeInTheDocument();
    });
  });

  it('should display license link', async () => {
    const onClose = jest.fn();
    render(<AboutDialog open={true} onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByText(/Apache 2\.0/)).toBeInTheDocument();
    });
  });

  it('should open license URL when license link is clicked', async () => {
    const onClose = jest.fn();
    render(<AboutDialog open={true} onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByText(/Apache 2\.0/)).toBeInTheDocument();
    });

    const licenseLink = screen.getByText(/Apache 2\.0/);
    fireEvent.click(licenseLink);

    expect(mockElectronAPI.shell.openExternal).toHaveBeenCalledWith(
      'https://www.apache.org/licenses/LICENSE-2.0'
    );
  });

  it('should call onClose when close button is clicked', async () => {
    const onClose = jest.fn();
    render(<AboutDialog open={true} onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByText('NoteCove')).toBeInTheDocument();
    });

    // Get all close buttons (one in header, one at bottom)
    const closeButtons = screen.getAllByRole('button', { name: /close/i });
    // Click the bottom "Close" button (last one)
    const closeButton = closeButtons[closeButtons.length - 1];
    if (closeButton) {
      fireEvent.click(closeButton);
    }

    expect(onClose).toHaveBeenCalled();
  });
});
