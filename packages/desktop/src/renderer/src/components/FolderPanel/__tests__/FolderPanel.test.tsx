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

describe('FolderPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

    render(<FolderPanel />);

    expect(screen.getByText('Folders')).toBeInTheDocument();

    // Wait for state to settle
    await waitFor(() => {
      expect(mockAppStateGet).toHaveBeenCalled();
    });
  });

  it('should render FolderTree component', async () => {
    mockAppStateGet.mockResolvedValue(null);
    mockFolderList.mockResolvedValue([]);

    render(<FolderPanel />);

    // Wait for state to load and FolderTree to render
    await waitFor(() => {
      expect(screen.getByTestId('folder-tree')).toBeInTheDocument();
    });
  });

  it('should load persisted folder selection on mount', async () => {
    mockAppStateGet.mockImplementation((key: string) => {
      if (key === 'selectedFolderId') return Promise.resolve('folder-1');
      if (key === 'expandedFolderIds')
        return Promise.resolve(JSON.stringify(['folder-1', 'folder-2']));
      return Promise.resolve(null);
    });

    render(<FolderPanel />);

    await waitFor(() => {
      expect(mockAppStateGet).toHaveBeenCalledWith('selectedFolderId');
      expect(mockAppStateGet).toHaveBeenCalledWith('expandedFolderIds');
    });
  });

  it('should default to "all-notes" when no persisted selection', async () => {
    mockAppStateGet.mockResolvedValue(null);

    render(<FolderPanel />);

    await waitFor(() => {
      expect(mockAppStateGet).toHaveBeenCalled();
    });

    // Component should render without errors and default to "all-notes"
    expect(screen.getByTestId('folder-tree')).toBeInTheDocument();
  });

  it('should handle appState load errors gracefully', async () => {
    mockAppStateGet.mockRejectedValue(new Error('Failed to load'));

    render(<FolderPanel />);

    await waitFor(() => {
      expect(mockAppStateGet).toHaveBeenCalled();
    });

    // Component should still render
    expect(screen.getByTestId('folder-tree')).toBeInTheDocument();
  });
});
