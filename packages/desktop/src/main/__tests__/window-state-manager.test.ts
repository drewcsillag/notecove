/**
 * Unit tests for WindowStateManager
 *
 * Tests window state tracking, debouncing, and persistence.
 */

/* eslint-disable @typescript-eslint/no-unsafe-argument */

import { WindowStateManager } from '../window-state-manager';
import type { WindowState, Database } from '@notecove/shared';
import type { BrowserWindow, Rectangle } from 'electron';

// Mock BrowserWindow
function createMockWindow(overrides: {
  id?: number;
  bounds?: Rectangle;
  isMaximized?: boolean;
  isFullScreen?: boolean;
  isDestroyed?: boolean;
  url?: string;
}): jest.Mocked<BrowserWindow> {
  const {
    id = 1,
    bounds = { x: 0, y: 0, width: 1200, height: 800 },
    isMaximized = false,
    isFullScreen = false,
    isDestroyed = false,
    url = 'file:///index.html',
  } = overrides;

  return {
    id,
    getBounds: jest.fn(() => bounds),
    isMaximized: jest.fn(() => isMaximized),
    isFullScreen: jest.fn(() => isFullScreen),
    isDestroyed: jest.fn(() => isDestroyed),
    webContents: {
      getURL: jest.fn(() => url),
    },
    on: jest.fn(),
    removeListener: jest.fn(),
  } as unknown as jest.Mocked<BrowserWindow>;
}

// Mock database
function createMockDatabase() {
  return {
    getState: jest.fn(() => Promise.resolve(null)),
    setState: jest.fn(() => Promise.resolve()),
    getStorageDir: jest.fn(() => Promise.resolve(null)),
  };
}

describe('WindowStateManager', () => {
  let manager: WindowStateManager;
  let mockDatabase: ReturnType<typeof createMockDatabase>;

  beforeEach(() => {
    jest.useFakeTimers();
    mockDatabase = createMockDatabase();
    manager = new WindowStateManager(mockDatabase as any);
  });

  afterEach(() => {
    jest.useRealTimers();
    manager.dispose();
  });

  describe('registerWindow', () => {
    it('should register a main window', () => {
      const win = createMockWindow({ id: 1 });
      const windowId = manager.registerWindow(win, 'main');

      expect(windowId).toBeDefined();
      expect(typeof windowId).toBe('string');
    });

    it('should register a minimal window with noteId', () => {
      const win = createMockWindow({
        id: 2,
        url: 'file:///index.html?noteId=note-123&minimal=true',
      });
      const windowId = manager.registerWindow(win, 'minimal', 'note-123', 'sd-456');

      expect(windowId).toBeDefined();
    });

    it('should register a syncStatus window', () => {
      const win = createMockWindow({
        id: 3,
        url: 'file:///index.html?syncStatus=true',
      });
      const windowId = manager.registerWindow(win, 'syncStatus');

      expect(windowId).toBeDefined();
    });

    it('should attach event listeners to the window', () => {
      const win = createMockWindow({ id: 1 });
      manager.registerWindow(win, 'main');

      // Should attach move, resize, and closed listeners
      expect(win.on).toHaveBeenCalledWith('move', expect.any(Function));
      expect(win.on).toHaveBeenCalledWith('resize', expect.any(Function));
      expect(win.on).toHaveBeenCalledWith('closed', expect.any(Function));
    });
  });

  describe('getCurrentState', () => {
    it('should return empty array when no windows registered', () => {
      const states = manager.getCurrentState();
      expect(states).toEqual([]);
    });

    it('should return state for registered windows', () => {
      const win = createMockWindow({
        id: 1,
        bounds: { x: 100, y: 200, width: 1400, height: 900 },
      });
      manager.registerWindow(win, 'main', 'note-abc', 'sd-xyz');

      const states = manager.getCurrentState();
      expect(states).toHaveLength(1);
      expect(states[0]!.type).toBe('main');
      expect(states[0]!.bounds).toEqual({ x: 100, y: 200, width: 1400, height: 900 });
      expect(states[0]!.noteId).toBe('note-abc');
      expect(states[0]!.sdId).toBe('sd-xyz');
    });

    it('should capture maximized state', () => {
      const win = createMockWindow({ id: 1, isMaximized: true });
      manager.registerWindow(win, 'main');

      const states = manager.getCurrentState();
      expect(states[0]!.isMaximized).toBe(true);
    });

    it('should capture fullscreen state', () => {
      const win = createMockWindow({ id: 1, isFullScreen: true });
      manager.registerWindow(win, 'main');

      const states = manager.getCurrentState();
      expect(states[0]!.isFullScreen).toBe(true);
    });

    it('should not include destroyed windows', () => {
      const win = createMockWindow({ id: 1, isDestroyed: true });
      manager.registerWindow(win, 'main');
      // Simulate window being destroyed
      (win.isDestroyed as jest.Mock).mockReturnValue(true);

      const states = manager.getCurrentState();
      expect(states).toHaveLength(0);
    });
  });

  describe('debounced state updates', () => {
    it('should debounce move events - only logs after debounce', () => {
      const win = createMockWindow({ id: 1 });
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      manager.registerWindow(win, 'main');

      // Get the move handler
      const moveHandler = (win.on as jest.Mock).mock.calls.find(
        ([event]) => event === 'move'
      )?.[1] as () => void;

      // Clear registration log
      consoleSpy.mockClear();

      // Trigger multiple move events rapidly
      moveHandler();
      moveHandler();
      moveHandler();

      // No bounds log yet (still debouncing)
      expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining('[WindowState] Window'));

      // Fast-forward past debounce period (500ms)
      jest.advanceTimersByTime(500);

      // Now should have logged bounds once
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[WindowState] Window'));
      expect(win.getBounds).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should debounce resize events - only captures after debounce', () => {
      const win = createMockWindow({ id: 1 });
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      manager.registerWindow(win, 'main');

      const resizeHandler = (win.on as jest.Mock).mock.calls.find(
        ([event]) => event === 'resize'
      )?.[1] as () => void;

      // Clear registration log
      consoleSpy.mockClear();
      (win.getBounds as jest.Mock).mockClear();

      // Trigger resize events
      resizeHandler();
      resizeHandler();

      // Not yet debounced
      expect(win.getBounds).not.toHaveBeenCalled();

      jest.advanceTimersByTime(500);

      // After debounce, bounds should be captured
      expect(win.getBounds).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('unregisterWindow', () => {
    it('should remove window from tracking', () => {
      const win = createMockWindow({ id: 1 });
      const windowId = manager.registerWindow(win, 'main');

      manager.unregisterWindow(windowId);

      const states = manager.getCurrentState();
      expect(states).toHaveLength(0);
    });

    it('should remove event listeners', () => {
      const win = createMockWindow({ id: 1 });
      const windowId = manager.registerWindow(win, 'main');

      manager.unregisterWindow(windowId);

      expect(win.removeListener).toHaveBeenCalledWith('move', expect.any(Function));
      expect(win.removeListener).toHaveBeenCalledWith('resize', expect.any(Function));
      expect(win.removeListener).toHaveBeenCalledWith('closed', expect.any(Function));
    });
  });

  describe('updateNoteId', () => {
    it('should update noteId for a window', () => {
      const win = createMockWindow({ id: 1 });
      const windowId = manager.registerWindow(win, 'main', 'old-note', 'sd-1');

      manager.updateNoteId(windowId, 'new-note', 'sd-2');

      const states = manager.getCurrentState();
      expect(states[0]!.noteId).toBe('new-note');
      expect(states[0]!.sdId).toBe('sd-2');
    });
  });

  describe('updateEditorState', () => {
    it('should update editor state for a window', () => {
      const win = createMockWindow({ id: 1 });
      const windowId = manager.registerWindow(win, 'main');

      manager.updateEditorState(windowId, { scrollTop: 150, cursorPosition: 42 });

      const states = manager.getCurrentState();
      expect(states[0]!.editorState).toEqual({ scrollTop: 150, cursorPosition: 42 });
    });
  });

  describe('saveState', () => {
    it('should save current state to database', async () => {
      const win = createMockWindow({
        id: 1,
        bounds: { x: 50, y: 100, width: 1200, height: 800 },
      });
      manager.registerWindow(win, 'main', 'note-1', 'sd-1');

      await manager.saveState();

      expect(mockDatabase.setState).toHaveBeenCalledWith('windowStates', expect.any(String));

      const calls = mockDatabase.setState.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const savedJson = (calls[0] as unknown as [string, string])[1];
      const savedStates = JSON.parse(savedJson) as WindowState[];
      expect(savedStates).toHaveLength(1);
      expect(savedStates[0]!.noteId).toBe('note-1');
    });
  });

  describe('loadState', () => {
    it('should load saved state from database', async () => {
      const savedState: WindowState[] = [
        {
          id: 'win-1',
          type: 'main',
          noteId: 'note-1',
          sdId: 'sd-1',
          bounds: { x: 100, y: 200, width: 1400, height: 900 },
          isMaximized: false,
          isFullScreen: false,
        },
      ];
      mockDatabase.getState.mockResolvedValueOnce(
        JSON.stringify(savedState) as unknown as Promise<null>
      );

      const states = await manager.loadState();

      expect(states).toHaveLength(1);
      expect(states[0]!.noteId).toBe('note-1');
    });

    it('should return empty array if no saved state', async () => {
      mockDatabase.getState.mockResolvedValueOnce(null as unknown as Promise<null>);

      const states = await manager.loadState();

      expect(states).toEqual([]);
    });

    it('should return empty array on parse error', async () => {
      mockDatabase.getState.mockResolvedValueOnce('invalid json' as unknown as Promise<null>);

      const states = await manager.loadState();

      expect(states).toEqual([]);
    });
  });

  describe('clearState', () => {
    it('should save empty array to database', async () => {
      await manager.clearState();

      expect(mockDatabase.setState).toHaveBeenCalledWith('windowStates', '[]');
    });
  });

  describe('isPositionVisible', () => {
    it('should return true for position within a display', () => {
      const displays: { bounds: { x: number; y: number; width: number; height: number } }[] = [
        { bounds: { x: 0, y: 0, width: 1920, height: 1080 } },
      ];

      const result = manager.isPositionVisible({ x: 100, y: 100 }, displays);
      expect(result).toBe(true);
    });

    it('should return false for position outside all displays', () => {
      const displays: { bounds: { x: number; y: number; width: number; height: number } }[] = [
        { bounds: { x: 0, y: 0, width: 1920, height: 1080 } },
      ];

      const result = manager.isPositionVisible({ x: 3000, y: 100 }, displays);
      expect(result).toBe(false);
    });

    it('should return true for position on any of multiple displays', () => {
      const displays: { bounds: { x: number; y: number; width: number; height: number } }[] = [
        { bounds: { x: 0, y: 0, width: 1920, height: 1080 } },
        { bounds: { x: 1920, y: 0, width: 1920, height: 1080 } }, // Second monitor to the right
      ];

      // Position on second monitor
      const result = manager.isPositionVisible({ x: 2000, y: 500 }, displays);
      expect(result).toBe(true);
    });

    it('should handle negative coordinates (monitor to the left)', () => {
      const displays: { bounds: { x: number; y: number; width: number; height: number } }[] = [
        { bounds: { x: -1920, y: 0, width: 1920, height: 1080 } }, // Left monitor
        { bounds: { x: 0, y: 0, width: 1920, height: 1080 } }, // Main monitor
      ];

      const result = manager.isPositionVisible({ x: -500, y: 500 }, displays);
      expect(result).toBe(true);
    });
  });

  describe('multi-window tracking', () => {
    it('should track multiple windows simultaneously', () => {
      const mainWin = createMockWindow({ id: 1, bounds: { x: 0, y: 0, width: 1200, height: 800 } });
      const minimalWin = createMockWindow({
        id: 2,
        bounds: { x: 100, y: 100, width: 800, height: 600 },
      });
      const syncWin = createMockWindow({
        id: 3,
        bounds: { x: 200, y: 200, width: 950, height: 600 },
      });

      const mainId = manager.registerWindow(mainWin, 'main', 'note-1', 'sd-1');
      const minimalId = manager.registerWindow(minimalWin, 'minimal', 'note-2', 'sd-1');
      const syncId = manager.registerWindow(syncWin, 'syncStatus');

      const states = manager.getCurrentState();
      expect(states).toHaveLength(3);

      const mainState = states.find((s) => s.id === mainId);
      const minimalState = states.find((s) => s.id === minimalId);
      const syncState = states.find((s) => s.id === syncId);

      expect(mainState?.type).toBe('main');
      expect(mainState?.noteId).toBe('note-1');

      expect(minimalState?.type).toBe('minimal');
      expect(minimalState?.noteId).toBe('note-2');

      expect(syncState?.type).toBe('syncStatus');
      expect(syncState?.noteId).toBeUndefined();
    });

    it('should preserve each window state independently', () => {
      const win1 = createMockWindow({
        id: 1,
        bounds: { x: 10, y: 20, width: 1000, height: 700 },
        isMaximized: true,
      });
      const win2 = createMockWindow({
        id: 2,
        bounds: { x: 50, y: 60, width: 800, height: 500 },
        isFullScreen: true,
      });

      const id1 = manager.registerWindow(win1, 'main', 'note-a', 'sd-1');
      const id2 = manager.registerWindow(win2, 'minimal', 'note-b', 'sd-2');

      // Update editor state for each
      manager.updateEditorState(id1, { scrollTop: 100, cursorPosition: 50 });
      manager.updateEditorState(id2, { scrollTop: 200, cursorPosition: 150 });

      const states = manager.getCurrentState();
      const state1 = states.find((s) => s.id === id1);
      const state2 = states.find((s) => s.id === id2);

      expect(state1?.bounds).toEqual({ x: 10, y: 20, width: 1000, height: 700 });
      expect(state1?.isMaximized).toBe(true);
      expect(state1?.editorState).toEqual({ scrollTop: 100, cursorPosition: 50 });

      expect(state2?.bounds).toEqual({ x: 50, y: 60, width: 800, height: 500 });
      expect(state2?.isFullScreen).toBe(true);
      expect(state2?.editorState).toEqual({ scrollTop: 200, cursorPosition: 150 });
    });

    it('should save all window states to database', async () => {
      const win1 = createMockWindow({ id: 1 });
      const win2 = createMockWindow({ id: 2 });

      manager.registerWindow(win1, 'main', 'note-1', 'sd-1');
      manager.registerWindow(win2, 'minimal', 'note-2', 'sd-1');

      await manager.saveState();

      expect(mockDatabase.setState).toHaveBeenCalledWith('windowStates', expect.any(String));

      const calls = mockDatabase.setState.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const savedJson = (calls[0] as unknown as [string, string])[1];
      const savedStates = JSON.parse(savedJson) as WindowState[];
      expect(savedStates).toHaveLength(2);

      const types = savedStates.map((s) => s.type);
      expect(types).toContain('main');
      expect(types).toContain('minimal');
    });

    it('should load multiple window states from database', async () => {
      const savedStates: WindowState[] = [
        {
          id: 'win-1',
          type: 'main',
          noteId: 'note-1',
          sdId: 'sd-1',
          bounds: { x: 0, y: 0, width: 1200, height: 800 },
          isMaximized: false,
          isFullScreen: false,
        },
        {
          id: 'win-2',
          type: 'minimal',
          noteId: 'note-2',
          sdId: 'sd-1',
          bounds: { x: 100, y: 100, width: 800, height: 600 },
          isMaximized: false,
          isFullScreen: false,
          editorState: { scrollTop: 50, cursorPosition: 25 },
        },
        {
          id: 'win-3',
          type: 'syncStatus',
          bounds: { x: 200, y: 200, width: 950, height: 600 },
          isMaximized: false,
          isFullScreen: false,
        },
      ];
      mockDatabase.getState.mockResolvedValueOnce(
        JSON.stringify(savedStates) as unknown as Promise<null>
      );

      const states = await manager.loadState();

      expect(states).toHaveLength(3);
      expect(states[0]!.type).toBe('main');
      expect(states[1]!.type).toBe('minimal');
      expect(states[1]!.editorState?.scrollTop).toBe(50);
      expect(states[2]!.type).toBe('syncStatus');
    });
  });

  describe('validateNoteForRestore', () => {
    const createMockFullDatabase = (notes: { id: string; deleted: boolean; sdId: string }[]) =>
      ({
        ...createMockDatabase(),
        getNote: jest.fn((noteId: string) => {
          const note = notes.find((n) => n.id === noteId);
          return Promise.resolve(note ?? null);
        }),
        getNotesBySd: jest.fn((sdId: string) => {
          const sdNotes = notes.filter((n) => n.sdId === sdId && !n.deleted);
          return Promise.resolve(sdNotes.map((n) => ({ ...n, title: 'Test Note' })));
        }),
        getStorageDir: jest.fn((sdId: string) => {
          return Promise.resolve({ id: sdId, path: '/test/path', name: 'Test SD' });
        }),
      }) as unknown as Database;

    it('should return the original noteId if note exists and is not deleted', async () => {
      const mockDb = createMockFullDatabase([{ id: 'note-1', deleted: false, sdId: 'sd-1' }]);
      const testManager = new WindowStateManager(mockDb);

      const result = await testManager.validateNoteForRestore('note-1', 'sd-1', mockDb);

      expect(result).toEqual({ noteId: 'note-1', sdId: 'sd-1' });
    });

    it('should fall back to top note if the specified note is deleted', async () => {
      const mockDb = createMockFullDatabase([
        { id: 'note-1', deleted: true, sdId: 'sd-1' },
        { id: 'note-2', deleted: false, sdId: 'sd-1' },
        { id: 'note-3', deleted: false, sdId: 'sd-1' },
      ]);
      const testManager = new WindowStateManager(mockDb);

      const result = await testManager.validateNoteForRestore('note-1', 'sd-1', mockDb);

      expect(result).toEqual({ noteId: 'note-2', sdId: 'sd-1' });
    });

    it('should fall back to top note if the specified note does not exist', async () => {
      const mockDb = createMockFullDatabase([{ id: 'note-2', deleted: false, sdId: 'sd-1' }]);
      const testManager = new WindowStateManager(mockDb);

      const result = await testManager.validateNoteForRestore('non-existent', 'sd-1', mockDb);

      expect(result).toEqual({ noteId: 'note-2', sdId: 'sd-1' });
    });

    it('should return null noteId if SD has no non-deleted notes', async () => {
      const mockDb = createMockFullDatabase([{ id: 'note-1', deleted: true, sdId: 'sd-1' }]);
      const testManager = new WindowStateManager(mockDb);

      const result = await testManager.validateNoteForRestore('note-1', 'sd-1', mockDb);

      expect(result).toEqual({ noteId: undefined, sdId: 'sd-1' });
    });

    it('should return the original values if noteId is undefined', async () => {
      const mockDb = createMockFullDatabase([]);
      const testManager = new WindowStateManager(mockDb);

      const result = await testManager.validateNoteForRestore(undefined, 'sd-1', mockDb);

      expect(result).toEqual({ noteId: undefined, sdId: 'sd-1' });
    });
  });

  describe('validateSDForRestore', () => {
    it('should return true if SD exists in database and path is accessible', async () => {
      const mockDb = {
        ...createMockDatabase(),
        getStorageDir: jest.fn().mockResolvedValue({
          id: 'sd-1',
          path: '/accessible/path',
          name: 'Test SD',
        }),
      } as unknown as Database;
      const mockFsAccess = jest.fn().mockResolvedValue(undefined);
      const testManager = new WindowStateManager(mockDb);

      const result = await testManager.validateSDForRestore('sd-1', mockDb, mockFsAccess);

      expect(result).toBe(true);
      expect(mockFsAccess).toHaveBeenCalledWith('/accessible/path');
    });

    it('should return false if SD does not exist in database', async () => {
      const mockDb = {
        ...createMockDatabase(),
        getStorageDir: jest.fn().mockResolvedValue(null),
      } as unknown as Database;
      const mockFsAccess = jest.fn();
      const testManager = new WindowStateManager(mockDb);

      const result = await testManager.validateSDForRestore('sd-1', mockDb, mockFsAccess);

      expect(result).toBe(false);
      expect(mockFsAccess).not.toHaveBeenCalled();
    });

    it('should return false if SD path is not accessible', async () => {
      const mockDb = {
        ...createMockDatabase(),
        getStorageDir: jest.fn().mockResolvedValue({
          id: 'sd-1',
          path: '/inaccessible/path',
          name: 'Test SD',
        }),
      } as unknown as Database;
      const mockFsAccess = jest.fn().mockRejectedValue(new Error('ENOENT'));
      const testManager = new WindowStateManager(mockDb);

      const result = await testManager.validateSDForRestore('sd-1', mockDb, mockFsAccess);

      expect(result).toBe(false);
    });

    it('should return true if sdId is undefined (syncStatus window)', async () => {
      const mockDb = createMockDatabase();
      const mockFsAccess = jest.fn();
      const testManager = new WindowStateManager(mockDb as unknown as Database);

      const result = await testManager.validateSDForRestore(undefined, mockDb, mockFsAccess);

      expect(result).toBe(true);
      expect(mockFsAccess).not.toHaveBeenCalled();
    });
  });

  describe('validateWindowState', () => {
    it('should return state unchanged if position is visible', () => {
      const displays: { bounds: { x: number; y: number; width: number; height: number } }[] = [
        { bounds: { x: 0, y: 0, width: 1920, height: 1080 } },
      ];
      const primaryBounds = { x: 0, y: 0, width: 1920, height: 1080 };

      const state: WindowState = {
        id: 'win-1',
        type: 'main',
        bounds: { x: 100, y: 100, width: 1200, height: 800 },
        isMaximized: false,
        isFullScreen: false,
      };

      const result = manager.validateWindowState(state, displays, primaryBounds);

      expect(result.bounds.x).toBe(100);
      expect(result.bounds.y).toBe(100);
    });

    it('should move window to primary monitor if position is off-screen', () => {
      const displays: { bounds: { x: number; y: number; width: number; height: number } }[] = [
        { bounds: { x: 0, y: 0, width: 1920, height: 1080 } },
      ];
      const primaryBounds = { x: 0, y: 0, width: 1920, height: 1080 };

      const state: WindowState = {
        id: 'win-1',
        type: 'main',
        bounds: { x: 5000, y: 100, width: 1200, height: 800 }, // Off screen
        isMaximized: false,
        isFullScreen: false,
      };

      const result = manager.validateWindowState(state, displays, primaryBounds);

      // Should be moved to primary monitor with some offset
      expect(result.bounds.x).toBeGreaterThanOrEqual(0);
      expect(result.bounds.x).toBeLessThan(primaryBounds.width);
      expect(result.bounds.y).toBeGreaterThanOrEqual(0);
    });

    it('should preserve other state properties when moving', () => {
      const displays: { bounds: { x: number; y: number; width: number; height: number } }[] = [
        { bounds: { x: 0, y: 0, width: 1920, height: 1080 } },
      ];
      const primaryBounds = { x: 0, y: 0, width: 1920, height: 1080 };

      const state: WindowState = {
        id: 'win-1',
        type: 'minimal',
        noteId: 'note-123',
        sdId: 'sd-456',
        bounds: { x: 5000, y: 100, width: 800, height: 600 },
        isMaximized: false,
        isFullScreen: false,
        editorState: { scrollTop: 100, cursorPosition: 50 },
      };

      const result = manager.validateWindowState(state, displays, primaryBounds);

      expect(result.noteId).toBe('note-123');
      expect(result.sdId).toBe('sd-456');
      expect(result.editorState).toEqual({ scrollTop: 100, cursorPosition: 50 });
      expect(result.bounds.width).toBe(800);
      expect(result.bounds.height).toBe(600);
    });
  });
});
