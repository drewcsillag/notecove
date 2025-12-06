/**
 * IPC Events Tests
 */

jest.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: jest.fn(() => []),
  },
}));

import { BrowserWindow } from 'electron';
import { IPCEvents } from '../events';

describe('IPCEvents', () => {
  const mockSend = jest.fn();
  const mockWindow = {
    webContents: {
      send: mockSend,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (BrowserWindow.getAllWindows as jest.Mock).mockReturnValue([mockWindow]);
  });

  describe('sendNoteUpdated', () => {
    it('should send note:updated event to all windows', () => {
      const update = new Uint8Array([1, 2, 3]);
      IPCEvents.sendNoteUpdated('note-1', update);

      expect(mockSend).toHaveBeenCalledWith('note:updated', 'note-1', update);
    });

    it('should send to multiple windows', () => {
      const mockWindow2 = { webContents: { send: jest.fn() } };
      (BrowserWindow.getAllWindows as jest.Mock).mockReturnValue([mockWindow, mockWindow2]);

      const update = new Uint8Array([1, 2, 3]);
      IPCEvents.sendNoteUpdated('note-1', update);

      expect(mockSend).toHaveBeenCalledWith('note:updated', 'note-1', update);
      expect(mockWindow2.webContents.send).toHaveBeenCalledWith('note:updated', 'note-1', update);
    });
  });

  describe('sendNoteDeleted', () => {
    it('should send note:deleted event to all windows', () => {
      IPCEvents.sendNoteDeleted('note-1');

      expect(mockSend).toHaveBeenCalledWith('note:deleted', 'note-1');
    });
  });

  describe('sendFolderUpdated', () => {
    it('should send folder:updated event to all windows', () => {
      IPCEvents.sendFolderUpdated('folder-1');

      expect(mockSend).toHaveBeenCalledWith('folder:updated', 'folder-1');
    });
  });

  describe('sendSyncProgress', () => {
    it('should send sync:progress event to all windows', () => {
      const progress = {
        sdId: 'sd-1',
        totalFiles: 10,
        processedFiles: 5,
        phase: 'indexing' as const,
      };
      IPCEvents.sendSyncProgress('sd-1', progress);

      expect(mockSend).toHaveBeenCalledWith('sync:progress', 'sd-1', progress);
    });
  });
});
