/**
 * Storage Directory Settings Tests
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { StorageDirectorySettings } from '../StorageDirectorySettings';

// Mock window.electronAPI
const mockElectronAPI = {
  sd: {
    list: jest.fn(),
    create: jest.fn(),
    setActive: jest.fn(),
    getActive: jest.fn(),
  },
  user: {
    getCurrentProfile: jest.fn().mockResolvedValue({
      profileId: 'test-profile-id',
      username: 'Test User',
      handle: '@testuser',
    }),
    onProfileChanged: jest.fn(() => () => {
      /* unsubscribe */
    }),
  },
};

// Set up window.electronAPI before tests
beforeAll(() => {
  (global as any).window.electronAPI = mockElectronAPI;
});

describe('StorageDirectorySettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should load and display SDs on mount', async () => {
    const mockSds = [
      {
        id: 'sd1',
        name: 'Work',
        path: '/path/to/work',
        created: Date.now(),
        isActive: true,
      },
      {
        id: 'sd2',
        name: 'Personal',
        path: '/path/to/personal',
        created: Date.now(),
        isActive: false,
      },
    ];

    mockElectronAPI.sd.list.mockResolvedValue(mockSds);

    render(<StorageDirectorySettings />);

    await waitFor(() => {
      expect(screen.getByText('Work')).toBeInTheDocument();
      expect(screen.getByText('Personal')).toBeInTheDocument();
      expect(screen.getByText('/path/to/work')).toBeInTheDocument();
      expect(screen.getByText('/path/to/personal')).toBeInTheDocument();
    });

    expect(mockElectronAPI.sd.list).toHaveBeenCalled();
  });

  it('should show active indicator for active SD', async () => {
    const mockSds = [
      {
        id: 'sd1',
        name: 'Work',
        path: '/path/to/work',
        created: Date.now(),
        isActive: true,
      },
    ];

    mockElectronAPI.sd.list.mockResolvedValue(mockSds);

    render(<StorageDirectorySettings />);

    await waitFor(() => {
      expect(screen.getByText('Active')).toBeInTheDocument();
    });
  });

  it('should show "Set Active" button for inactive SD', async () => {
    const mockSds = [
      {
        id: 'sd1',
        name: 'Work',
        path: '/path/to/work',
        created: Date.now(),
        isActive: true,
      },
      {
        id: 'sd2',
        name: 'Personal',
        path: '/path/to/personal',
        created: Date.now(),
        isActive: false,
      },
    ];

    mockElectronAPI.sd.list.mockResolvedValue(mockSds);

    render(<StorageDirectorySettings />);

    await waitFor(() => {
      expect(screen.getByText('Set Active')).toBeInTheDocument();
    });
  });

  it('should open add SD dialog when Add Directory button is clicked', async () => {
    mockElectronAPI.sd.list.mockResolvedValue([]);

    render(<StorageDirectorySettings />);

    await waitFor(() => {
      expect(screen.getByText('Add Directory')).toBeInTheDocument();
    });

    const addButton = screen.getByText('Add Directory');
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByText('Add Storage Directory')).toBeInTheDocument();
      expect(screen.getByLabelText('Name')).toBeInTheDocument();
      expect(screen.getByLabelText('Path')).toBeInTheDocument();
    });
  });

  it('should create SD when Add button is clicked with valid inputs', async () => {
    mockElectronAPI.sd.list.mockResolvedValue([]);
    mockElectronAPI.sd.create.mockResolvedValue('new-sd-id');

    render(<StorageDirectorySettings />);

    await waitFor(() => {
      expect(screen.getByText('Add Directory')).toBeInTheDocument();
    });

    // Open add dialog
    const addButton = screen.getByText('Add Directory');
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByText('Add Storage Directory')).toBeInTheDocument();
    });

    // Fill in form
    const nameInput = screen.getByLabelText('Name');
    const pathInput = screen.getByLabelText('Path');

    fireEvent.change(nameInput, { target: { value: 'Work' } });
    fireEvent.change(pathInput, { target: { value: '/path/to/work' } });

    // Mock the list to return the new SD after creation
    mockElectronAPI.sd.list.mockResolvedValue([
      {
        id: 'new-sd-id',
        name: 'Work',
        path: '/path/to/work',
        created: Date.now(),
        isActive: true,
      },
    ]);

    // Click Add button
    const addButtons = screen.getAllByRole('button', { name: /add/i });
    const dialogAddButton = addButtons[addButtons.length - 1];
    if (dialogAddButton) {
      fireEvent.click(dialogAddButton);
    }

    await waitFor(() => {
      expect(mockElectronAPI.sd.create).toHaveBeenCalledWith('Work', '/path/to/work');
    });

    // Dialog should close
    await waitFor(() => {
      expect(screen.queryByText('Add Storage Directory')).not.toBeInTheDocument();
    });
  });

  it('should show error when trying to add SD without name', async () => {
    mockElectronAPI.sd.list.mockResolvedValue([]);

    render(<StorageDirectorySettings />);

    await waitFor(() => {
      expect(screen.getByText('Add Directory')).toBeInTheDocument();
    });

    // Open add dialog
    const addButton = screen.getByText('Add Directory');
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByText('Add Storage Directory')).toBeInTheDocument();
    });

    // Try to add without filling form
    const addButtons = screen.getAllByRole('button', { name: /add/i });
    const dialogAddButton = addButtons[addButtons.length - 1];
    if (dialogAddButton) {
      fireEvent.click(dialogAddButton);
    }

    await waitFor(() => {
      expect(screen.getByText('Name and path are required')).toBeInTheDocument();
    });

    expect(mockElectronAPI.sd.create).not.toHaveBeenCalled();
  });

  it('should call setActive when Set Active button is clicked', async () => {
    const mockSds = [
      {
        id: 'sd1',
        name: 'Work',
        path: '/path/to/work',
        created: Date.now(),
        isActive: true,
      },
      {
        id: 'sd2',
        name: 'Personal',
        path: '/path/to/personal',
        created: Date.now(),
        isActive: false,
      },
    ];

    mockElectronAPI.sd.list.mockResolvedValue(mockSds);
    mockElectronAPI.sd.setActive.mockResolvedValue(undefined);

    render(<StorageDirectorySettings />);

    await waitFor(() => {
      expect(screen.getByText('Set Active')).toBeInTheDocument();
    });

    const setActiveButton = screen.getByText('Set Active');
    fireEvent.click(setActiveButton);

    await waitFor(() => {
      expect(mockElectronAPI.sd.setActive).toHaveBeenCalledWith('sd2');
    });
  });

  it('should show message when no SDs exist', async () => {
    mockElectronAPI.sd.list.mockResolvedValue([]);

    render(<StorageDirectorySettings />);

    await waitFor(() => {
      expect(screen.getByText(/No Storage Directories configured/i)).toBeInTheDocument();
    });
  });

  it('should disable delete button when only one SD exists', async () => {
    const mockSds = [
      {
        id: 'sd1',
        name: 'Default',
        path: '/path/to/default',
        created: Date.now(),
        isActive: true,
      },
    ];

    mockElectronAPI.sd.list.mockResolvedValue(mockSds);

    render(<StorageDirectorySettings />);

    await waitFor(() => {
      expect(screen.getByText('Default')).toBeInTheDocument();
    });

    const deleteButton = screen.getByRole('button', { name: /delete/i });
    expect(deleteButton).toBeDisabled();
  });

  it('should show loading state initially', () => {
    mockElectronAPI.sd.list.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => {
            resolve([]);
          }, 1000)
        )
    );

    render(<StorageDirectorySettings />);

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });
});
