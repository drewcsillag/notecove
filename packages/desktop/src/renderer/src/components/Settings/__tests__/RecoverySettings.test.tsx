/**
 * Recovery Settings Tests
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { RecoverySettings } from '../RecoverySettings';

// Mock window.electronAPI
const mockElectronAPI = {
  recovery: {
    getStaleMoves: jest.fn(),
    takeOverMove: jest.fn(),
    cancelMove: jest.fn(),
    getBackups: jest.fn().mockResolvedValue([]),
    restoreFromBackup: jest.fn(),
  },
  sd: {
    list: jest.fn().mockResolvedValue([]),
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

describe('RecoverySettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Loading and Display', () => {
    it('should show loading state initially', () => {
      mockElectronAPI.recovery.getStaleMoves.mockReturnValue(
        new Promise(() => {
          /* never resolves */
        })
      );

      render(<RecoverySettings />);

      expect(screen.getByText('Loading diagnostic information...')).toBeInTheDocument();
    });

    it('should display success message when no stuck operations', async () => {
      mockElectronAPI.recovery.getStaleMoves.mockResolvedValue([]);

      render(<RecoverySettings />);

      await waitFor(() => {
        expect(screen.getByText('No Issues Detected')).toBeInTheDocument();
        expect(
          screen.getByText('All move operations are completing normally.')
        ).toBeInTheDocument();
      });

      expect(mockElectronAPI.recovery.getStaleMoves).toHaveBeenCalled();
    });

    it('should display stuck operations when they exist', async () => {
      const staleMoves = [
        {
          id: 'move-1',
          noteId: 'note-1',
          sourceSdUuid: 'source-uuid',
          targetSdUuid: 'target-uuid',
          targetFolderId: null,
          state: 'copying_files',
          initiatedBy: 'instance-123',
          initiatedAt: Date.now() - 600000, // 10 minutes ago
          lastModified: Date.now() - 600000,
          sourceSdPath: '/path/to/source',
          targetSdPath: '/path/to/target',
          error: null,
        },
      ];

      mockElectronAPI.recovery.getStaleMoves.mockResolvedValue(staleMoves);

      render(<RecoverySettings />);

      await waitFor(() => {
        expect(screen.getByText('Stuck Operations Detected')).toBeInTheDocument();
        expect(screen.getByText(/Found 1 incomplete move operation/)).toBeInTheDocument();
      });

      // Check if note ID is displayed
      expect(screen.getByText(/Note: note-1/)).toBeInTheDocument();

      // Check if state is displayed
      expect(screen.getByText('copying_files')).toBeInTheDocument();

      // Check if instance is displayed
      expect(screen.getByText(/Instance: instance-123/)).toBeInTheDocument();
    });

    it('should display multiple stuck operations', async () => {
      const staleMoves = [
        {
          id: 'move-1',
          noteId: 'note-1',
          sourceSdUuid: 'source-uuid',
          targetSdUuid: 'target-uuid',
          targetFolderId: null,
          state: 'copying_files',
          initiatedBy: 'instance-123',
          initiatedAt: Date.now() - 600000,
          lastModified: Date.now() - 600000,
          sourceSdPath: '/path/to/source',
          targetSdPath: '/path/to/target',
          error: null,
        },
        {
          id: 'move-2',
          noteId: 'note-2',
          sourceSdUuid: 'source-uuid',
          targetSdUuid: 'target-uuid',
          targetFolderId: 'folder-1',
          state: 'updating_db',
          initiatedBy: 'instance-456',
          initiatedAt: Date.now() - 900000,
          lastModified: Date.now() - 900000,
          sourceSdPath: '/path/to/source',
          targetSdPath: '/path/to/target',
          error: 'Database update failed',
        },
      ];

      mockElectronAPI.recovery.getStaleMoves.mockResolvedValue(staleMoves);

      render(<RecoverySettings />);

      await waitFor(() => {
        expect(screen.getByText(/Found 2 incomplete move operations/)).toBeInTheDocument();
      });

      expect(screen.getByText(/Note: note-1/)).toBeInTheDocument();
      expect(screen.getByText(/Note: note-2/)).toBeInTheDocument();
      expect(screen.getByText(/Error: Database update failed/)).toBeInTheDocument();
    });

    it('should format age correctly for minutes', async () => {
      const staleMoves = [
        {
          id: 'move-1',
          noteId: 'note-1',
          sourceSdUuid: 'source-uuid',
          targetSdUuid: 'target-uuid',
          targetFolderId: null,
          state: 'copying_files',
          initiatedBy: 'instance-123',
          initiatedAt: Date.now() - 420000, // 7 minutes ago
          lastModified: Date.now() - 420000,
          sourceSdPath: '/path/to/source',
          targetSdPath: '/path/to/target',
          error: null,
        },
      ];

      mockElectronAPI.recovery.getStaleMoves.mockResolvedValue(staleMoves);

      render(<RecoverySettings />);

      await waitFor(() => {
        expect(screen.getByText(/Age: 7m ago/)).toBeInTheDocument();
      });
    });

    it('should format age correctly for hours and minutes', async () => {
      const staleMoves = [
        {
          id: 'move-1',
          noteId: 'note-1',
          sourceSdUuid: 'source-uuid',
          targetSdUuid: 'target-uuid',
          targetFolderId: null,
          state: 'copying_files',
          initiatedBy: 'instance-123',
          initiatedAt: Date.now() - 7380000, // 2 hours 3 minutes ago
          lastModified: Date.now() - 7380000,
          sourceSdPath: '/path/to/source',
          targetSdPath: '/path/to/target',
          error: null,
        },
      ];

      mockElectronAPI.recovery.getStaleMoves.mockResolvedValue(staleMoves);

      render(<RecoverySettings />);

      await waitFor(() => {
        expect(screen.getByText(/Age: 2h 3m ago/)).toBeInTheDocument();
      });
    });
  });

  describe('Take Over Functionality', () => {
    it('should open confirmation dialog when Take Over is clicked', async () => {
      const staleMoves = [
        {
          id: 'move-1',
          noteId: 'note-1',
          sourceSdUuid: 'source-uuid',
          targetSdUuid: 'target-uuid',
          targetFolderId: null,
          state: 'copying_files',
          initiatedBy: 'instance-123',
          initiatedAt: Date.now() - 600000,
          lastModified: Date.now() - 600000,
          sourceSdPath: '/path/to/source',
          targetSdPath: '/path/to/target',
          error: null,
        },
      ];

      mockElectronAPI.recovery.getStaleMoves.mockResolvedValue(staleMoves);

      render(<RecoverySettings />);

      await waitFor(() => {
        expect(screen.getByText(/Note: note-1/)).toBeInTheDocument();
      });

      const takeOverButton = screen.getByRole('button', { name: /Take Over/i });
      fireEvent.click(takeOverButton);

      await waitFor(() => {
        expect(screen.getByText('Take Over Move Operation')).toBeInTheDocument();
        expect(
          screen.getByText(/Are you sure you want to take over this move operation/)
        ).toBeInTheDocument();
      });

      // Verify move details are shown in dialog
      expect(screen.getByText(/Note ID:/)).toBeInTheDocument();
      expect(screen.getByText(/State:/)).toBeInTheDocument();
      expect(screen.getByText(/Original Instance:/)).toBeInTheDocument();
    });

    it('should successfully complete take over', async () => {
      const staleMoves = [
        {
          id: 'move-1',
          noteId: 'note-1',
          sourceSdUuid: 'source-uuid',
          targetSdUuid: 'target-uuid',
          targetFolderId: null,
          state: 'copying_files',
          initiatedBy: 'instance-123',
          initiatedAt: Date.now() - 600000,
          lastModified: Date.now() - 600000,
          sourceSdPath: '/path/to/source',
          targetSdPath: '/path/to/target',
          error: null,
        },
      ];

      mockElectronAPI.recovery.getStaleMoves.mockResolvedValueOnce(staleMoves);
      mockElectronAPI.recovery.takeOverMove.mockResolvedValue({ success: true });
      mockElectronAPI.recovery.getStaleMoves.mockResolvedValueOnce([]); // After takeover

      render(<RecoverySettings />);

      await waitFor(() => {
        expect(screen.getByText(/Note: note-1/)).toBeInTheDocument();
      });

      const takeOverButton = screen.getByRole('button', { name: /Take Over/i });
      fireEvent.click(takeOverButton);

      await waitFor(() => {
        expect(screen.getByText('Take Over Move Operation')).toBeInTheDocument();
      });

      const completeMoveButton = screen.getByRole('button', { name: /Complete Move/i });
      fireEvent.click(completeMoveButton);

      await waitFor(() => {
        expect(mockElectronAPI.recovery.takeOverMove).toHaveBeenCalledWith('move-1');
        expect(mockElectronAPI.recovery.getStaleMoves).toHaveBeenCalledTimes(2);
      });

      // Should close dialog and refresh list
      await waitFor(() => {
        expect(screen.queryByText('Take Over Move Operation')).not.toBeInTheDocument();
        expect(screen.getByText('No Issues Detected')).toBeInTheDocument();
      });
    });

    it('should show error when take over fails', async () => {
      const staleMoves = [
        {
          id: 'move-1',
          noteId: 'note-1',
          sourceSdUuid: 'source-uuid',
          targetSdUuid: 'target-uuid',
          targetFolderId: null,
          state: 'copying_files',
          initiatedBy: 'instance-123',
          initiatedAt: Date.now() - 600000,
          lastModified: Date.now() - 600000,
          sourceSdPath: '/path/to/source',
          targetSdPath: '/path/to/target',
          error: null,
        },
      ];

      mockElectronAPI.recovery.getStaleMoves.mockResolvedValue(staleMoves);
      mockElectronAPI.recovery.takeOverMove.mockResolvedValue({
        success: false,
        error: 'Cannot access source SD',
      });

      render(<RecoverySettings />);

      await waitFor(() => {
        expect(screen.getByText(/Note: note-1/)).toBeInTheDocument();
      });

      const takeOverButton = screen.getByRole('button', { name: /Take Over/i });
      fireEvent.click(takeOverButton);

      await waitFor(() => {
        expect(screen.getByText('Take Over Move Operation')).toBeInTheDocument();
      });

      const completeMoveButton = screen.getByRole('button', { name: /Complete Move/i });
      fireEvent.click(completeMoveButton);

      await waitFor(() => {
        expect(
          screen.getByText(/Failed to take over move: Cannot access source SD/)
        ).toBeInTheDocument();
      });
    });

    it('should close dialog when Back button is clicked', async () => {
      const staleMoves = [
        {
          id: 'move-1',
          noteId: 'note-1',
          sourceSdUuid: 'source-uuid',
          targetSdUuid: 'target-uuid',
          targetFolderId: null,
          state: 'copying_files',
          initiatedBy: 'instance-123',
          initiatedAt: Date.now() - 600000,
          lastModified: Date.now() - 600000,
          sourceSdPath: '/path/to/source',
          targetSdPath: '/path/to/target',
          error: null,
        },
      ];

      mockElectronAPI.recovery.getStaleMoves.mockResolvedValue(staleMoves);

      render(<RecoverySettings />);

      await waitFor(() => {
        expect(screen.getByText(/Note: note-1/)).toBeInTheDocument();
      });

      const takeOverButton = screen.getByRole('button', { name: /Take Over/i });
      fireEvent.click(takeOverButton);

      await waitFor(() => {
        expect(screen.getByText('Take Over Move Operation')).toBeInTheDocument();
      });

      const backButton = screen.getByRole('button', { name: /Back/i });
      fireEvent.click(backButton);

      await waitFor(() => {
        expect(screen.queryByText('Take Over Move Operation')).not.toBeInTheDocument();
      });
    });
  });

  describe('Cancel Functionality', () => {
    it('should successfully cancel a move', async () => {
      const staleMoves = [
        {
          id: 'move-1',
          noteId: 'note-1',
          sourceSdUuid: 'source-uuid',
          targetSdUuid: 'target-uuid',
          targetFolderId: null,
          state: 'copying_files',
          initiatedBy: 'instance-123',
          initiatedAt: Date.now() - 600000,
          lastModified: Date.now() - 600000,
          sourceSdPath: '/path/to/source',
          targetSdPath: '/path/to/target',
          error: null,
        },
      ];

      mockElectronAPI.recovery.getStaleMoves.mockResolvedValueOnce(staleMoves);
      mockElectronAPI.recovery.cancelMove.mockResolvedValue({ success: true });
      mockElectronAPI.recovery.getStaleMoves.mockResolvedValueOnce([]); // After cancel

      render(<RecoverySettings />);

      await waitFor(() => {
        expect(screen.getByText(/Note: note-1/)).toBeInTheDocument();
      });

      const cancelButton = screen.getByRole('button', { name: /Cancel/i });
      fireEvent.click(cancelButton);

      await waitFor(() => {
        expect(mockElectronAPI.recovery.cancelMove).toHaveBeenCalledWith('move-1');
        expect(mockElectronAPI.recovery.getStaleMoves).toHaveBeenCalledTimes(2);
      });

      // Should refresh list
      await waitFor(() => {
        expect(screen.getByText('No Issues Detected')).toBeInTheDocument();
      });
    });

    it('should show error when cancel fails', async () => {
      const staleMoves = [
        {
          id: 'move-1',
          noteId: 'note-1',
          sourceSdUuid: 'source-uuid',
          targetSdUuid: 'target-uuid',
          targetFolderId: null,
          state: 'copying_files',
          initiatedBy: 'instance-123',
          initiatedAt: Date.now() - 600000,
          lastModified: Date.now() - 600000,
          sourceSdPath: '/path/to/source',
          targetSdPath: '/path/to/target',
          error: null,
        },
      ];

      mockElectronAPI.recovery.getStaleMoves.mockResolvedValue(staleMoves);
      mockElectronAPI.recovery.cancelMove.mockResolvedValue({
        success: false,
        error: 'Move is already completed',
      });

      render(<RecoverySettings />);

      await waitFor(() => {
        expect(screen.getByText(/Note: note-1/)).toBeInTheDocument();
      });

      const cancelButton = screen.getByRole('button', { name: /Cancel/i });
      fireEvent.click(cancelButton);

      await waitFor(() => {
        expect(
          screen.getByText(/Failed to cancel move: Move is already completed/)
        ).toBeInTheDocument();
      });
    });
  });

  describe('Refresh Functionality', () => {
    it('should reload stale moves when refresh button is clicked', async () => {
      const staleMoves1 = [
        {
          id: 'move-1',
          noteId: 'note-1',
          sourceSdUuid: 'source-uuid',
          targetSdUuid: 'target-uuid',
          targetFolderId: null,
          state: 'copying_files',
          initiatedBy: 'instance-123',
          initiatedAt: Date.now() - 600000,
          lastModified: Date.now() - 600000,
          sourceSdPath: '/path/to/source',
          targetSdPath: '/path/to/target',
          error: null,
        },
      ];

      const staleMoves2 = [
        ...staleMoves1,
        {
          id: 'move-2',
          noteId: 'note-2',
          sourceSdUuid: 'source-uuid',
          targetSdUuid: 'target-uuid',
          targetFolderId: null,
          state: 'updating_db',
          initiatedBy: 'instance-456',
          initiatedAt: Date.now() - 700000,
          lastModified: Date.now() - 700000,
          sourceSdPath: '/path/to/source',
          targetSdPath: '/path/to/target',
          error: null,
        },
      ];

      mockElectronAPI.recovery.getStaleMoves.mockResolvedValueOnce(staleMoves1);

      render(<RecoverySettings />);

      await waitFor(() => {
        expect(screen.getByText(/Found 1 incomplete move operation/)).toBeInTheDocument();
      });

      mockElectronAPI.recovery.getStaleMoves.mockResolvedValueOnce(staleMoves2);

      const refreshButton = screen.getByRole('button', { name: /Refresh/i });
      fireEvent.click(refreshButton);

      await waitFor(() => {
        expect(screen.getByText(/Found 2 incomplete move operations/)).toBeInTheDocument();
        expect(mockElectronAPI.recovery.getStaleMoves).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Error Handling', () => {
    it('should display error when loading fails', async () => {
      mockElectronAPI.recovery.getStaleMoves.mockRejectedValue(
        new Error('Database connection failed')
      );

      render(<RecoverySettings />);

      await waitFor(() => {
        expect(screen.getByText(/Database connection failed/)).toBeInTheDocument();
      });
    });

    it('should allow dismissing error messages', async () => {
      mockElectronAPI.recovery.getStaleMoves.mockRejectedValue(
        new Error('Database connection failed')
      );

      render(<RecoverySettings />);

      await waitFor(() => {
        expect(screen.getByText(/Database connection failed/)).toBeInTheDocument();
      });

      // Find and click the close button on the alert
      const closeButton = screen.getByRole('button', { name: /close/i });
      fireEvent.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByText(/Database connection failed/)).not.toBeInTheDocument();
      });
    });
  });
});
