/**
 * FolderPanel Component Tests
 */

import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FolderPanel } from '../FolderPanel';

// Mock FolderTree component
jest.mock('../FolderTree', () => ({
  FolderTree: () => <div data-testid="folder-tree">FolderTree Mock</div>,
}));

// Mock electron API
const mockAppStateGet = jest.fn();
const mockAppStateSet = jest.fn();
const mockFolderOnUpdated = jest.fn();
const mockFolderList = jest.fn();
const mockFolderGet = jest.fn();
const mockFolderCreate = jest.fn();
const mockFolderRename = jest.fn();
const mockFolderMove = jest.fn();
const mockFolderDelete = jest.fn();
const mockSdGetActive = jest.fn();
const mockSdList = jest.fn();
const mockSdSetActive = jest.fn();
const mockSdOnUpdated = jest.fn();

global.window.electronAPI = {
  appState: {
    get: mockAppStateGet,
    set: mockAppStateSet,
  },
  folder: {
    list: mockFolderList,
    get: mockFolderGet,
    create: mockFolderCreate,
    rename: mockFolderRename,
    move: mockFolderMove,
    delete: mockFolderDelete,
    onUpdated: mockFolderOnUpdated,
  },
  sd: {
    getActive: mockSdGetActive,
    list: mockSdList,
    setActive: mockSdSetActive,
    onUpdated: mockSdOnUpdated,
  },
} as unknown as typeof window.electronAPI;

// Default props for tests (selectedFolderId and onFolderSelect are now required)
const defaultProps = {
  selectedFolderId: null as string | null,
  onFolderSelect: jest.fn(),
};

describe('FolderPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    defaultProps.onFolderSelect.mockClear();
    // Make onUpdated return an unsubscribe function
    mockFolderOnUpdated.mockReturnValue(() => {
      /* unsubscribe */
    });
    mockSdOnUpdated.mockReturnValue(() => {
      /* unsubscribe */
    });
    // Mock sd.getActive to return a default SD ID
    mockSdGetActive.mockResolvedValue('default');
  });

  it('should render the folder panel with header', async () => {
    mockAppStateGet.mockResolvedValue(null);

    render(<FolderPanel {...defaultProps} />);

    expect(screen.getByText('Folders')).toBeInTheDocument();

    // Wait for state to settle
    await waitFor(() => {
      expect(mockAppStateGet).toHaveBeenCalled();
    });
  });

  it('should render FolderTree component', async () => {
    mockAppStateGet.mockResolvedValue(null);
    mockFolderList.mockResolvedValue([]);

    render(<FolderPanel {...defaultProps} />);

    // Wait for state to load and FolderTree to render
    await waitFor(() => {
      expect(screen.getByTestId('folder-tree')).toBeInTheDocument();
    });
  });

  it('should load persisted expanded folders on mount', async () => {
    mockAppStateGet.mockImplementation((key: string) => {
      if (key === 'expandedFolderIds')
        return Promise.resolve(JSON.stringify(['folder-1', 'folder-2']));
      return Promise.resolve(null);
    });

    // Note: selectedFolderId is now passed as prop, not loaded from appState
    render(<FolderPanel {...defaultProps} selectedFolderId="folder-1" />);

    await waitFor(() => {
      // selectedFolderId is now passed as prop, only expandedFolderIds is loaded from appState
      expect(mockAppStateGet).toHaveBeenCalledWith('expandedFolderIds');
    });
  });

  it('should render correctly with null selectedFolderId', async () => {
    mockAppStateGet.mockResolvedValue(null);

    render(<FolderPanel {...defaultProps} />);

    await waitFor(() => {
      expect(mockAppStateGet).toHaveBeenCalled();
    });

    // Component should render without errors and default to "all-notes"
    expect(screen.getByTestId('folder-tree')).toBeInTheDocument();
  });

  it('should handle appState load errors gracefully', async () => {
    mockAppStateGet.mockRejectedValue(new Error('Failed to load'));

    render(<FolderPanel {...defaultProps} />);

    await waitFor(() => {
      expect(mockAppStateGet).toHaveBeenCalled();
    });

    // Component should still render
    expect(screen.getByTestId('folder-tree')).toBeInTheDocument();
  });
});
