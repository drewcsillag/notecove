/**
 * Window State Manager
 *
 * Tracks window positions, sizes, and states for session restoration.
 * Saves state to database for persistence across app restarts.
 *
 * @see plans/retain-note-state/PLAN.md
 */

import type { BrowserWindow } from 'electron';
import {
  type WindowState,
  type EditorState,
  AppStateKey,
  serializeWindowStates,
  deserializeWindowStates,
} from '@notecove/shared';
import type { Database } from '@notecove/shared';
import { randomUUID } from 'crypto';

/** Debounce delay for window position/size changes (milliseconds) */
const BOUNDS_DEBOUNCE_MS = 500;

/** Internal tracking data for a window */
interface TrackedWindow {
  windowId: string;
  window: BrowserWindow;
  type: 'main' | 'minimal' | 'syncStatus' | 'noteInfo' | 'storageInspector' | 'sdPicker' | 'about';
  noteId?: string | undefined;
  sdId?: string | undefined;
  editorState?: EditorState | undefined;
  debounceTimer?: NodeJS.Timeout | undefined;
  moveHandler: () => void;
  resizeHandler: () => void;
  closedHandler: () => void;
}

/**
 * Manages window state tracking and persistence.
 *
 * Usage:
 * 1. Create manager with database reference
 * 2. Register windows as they're created
 * 3. Update noteId when user navigates
 * 4. Update editorState from renderer IPC
 * 5. Call saveState() on app quit
 */
export class WindowStateManager {
  private database: Database;
  private windows = new Map<string, TrackedWindow>();
  private disposed = false;

  constructor(database: Database) {
    this.database = database;
  }

  /**
   * Register a window for state tracking
   *
   * @param window - The BrowserWindow to track
   * @param type - Window type (main, minimal, syncStatus)
   * @param noteId - Optional note ID being displayed
   * @param sdId - Optional storage directory ID
   * @returns The assigned window ID (use for IPC communication)
   */
  registerWindow(
    window: BrowserWindow,
    type:
      | 'main'
      | 'minimal'
      | 'syncStatus'
      | 'noteInfo'
      | 'storageInspector'
      | 'sdPicker'
      | 'about',
    noteId?: string,
    sdId?: string
  ): string {
    const windowId = randomUUID();

    // Create handlers that capture the current state
    const moveHandler = this.createBoundsHandler(windowId);
    const resizeHandler = this.createBoundsHandler(windowId);
    const closedHandler = () => {
      this.unregisterWindow(windowId);
    };

    // Attach event listeners
    window.on('move', moveHandler);
    window.on('resize', resizeHandler);
    window.on('closed', closedHandler);

    const tracked: TrackedWindow = {
      windowId,
      window,
      type,
      noteId,
      sdId,
      moveHandler,
      resizeHandler,
      closedHandler,
    };

    this.windows.set(windowId, tracked);

    console.log(
      `[WindowState] Registered window ${windowId} (type=${type}, noteId=${noteId ?? 'none'})`
    );

    return windowId;
  }

  /**
   * Unregister a window (called automatically on close)
   */
  unregisterWindow(windowId: string): void {
    const tracked = this.windows.get(windowId);
    if (!tracked) return;

    // Clear debounce timer
    if (tracked.debounceTimer) {
      clearTimeout(tracked.debounceTimer);
    }

    // Remove event listeners (if window not destroyed)
    if (!tracked.window.isDestroyed()) {
      tracked.window.removeListener('move', tracked.moveHandler);
      tracked.window.removeListener('resize', tracked.resizeHandler);
      tracked.window.removeListener('closed', tracked.closedHandler);
    }

    this.windows.delete(windowId);
    console.log(`[WindowState] Unregistered window ${windowId}`);
  }

  /**
   * Update the note being displayed in a window
   */
  updateNoteId(windowId: string, noteId: string, sdId?: string): void {
    const tracked = this.windows.get(windowId);
    if (tracked) {
      tracked.noteId = noteId;
      tracked.sdId = sdId;
      console.log(`[WindowState] Updated window ${windowId} noteId=${noteId}`);
    }
  }

  /**
   * Update editor state (scroll/cursor) for a window
   */
  updateEditorState(windowId: string, editorState: EditorState): void {
    const tracked = this.windows.get(windowId);
    if (tracked) {
      tracked.editorState = editorState;
    }
  }

  /**
   * Get current state of all tracked windows
   */
  getCurrentState(): WindowState[] {
    const states: WindowState[] = [];

    for (const tracked of this.windows.values()) {
      // Skip destroyed windows
      if (tracked.window.isDestroyed()) {
        continue;
      }

      const bounds = tracked.window.getBounds();
      const state: WindowState = {
        id: tracked.windowId,
        type: tracked.type,
        noteId: tracked.noteId,
        sdId: tracked.sdId,
        bounds: {
          x: bounds.x,
          y: bounds.y,
          width: bounds.width,
          height: bounds.height,
        },
        isMaximized: tracked.window.isMaximized(),
        isFullScreen: tracked.window.isFullScreen(),
        editorState: tracked.editorState,
      };

      states.push(state);
    }

    return states;
  }

  /**
   * Save current window state to database
   */
  async saveState(): Promise<void> {
    const states = this.getCurrentState();
    const json = serializeWindowStates(states);
    await this.database.setState(AppStateKey.WindowStates, json);
    console.log(`[WindowState] Saved ${states.length} window state(s) to database`);
  }

  /**
   * Load saved window state from database
   */
  async loadState(): Promise<WindowState[]> {
    const json = await this.database.getState(AppStateKey.WindowStates);
    const states = deserializeWindowStates(json);
    console.log(`[WindowState] Loaded ${states.length} window state(s) from database`);
    return states;
  }

  /**
   * Clear saved window state (for fresh start)
   */
  async clearState(): Promise<void> {
    await this.database.setState(AppStateKey.WindowStates, '[]');
    console.log('[WindowState] Cleared saved window states');
  }

  /**
   * Clean up all resources
   */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    // Clear all debounce timers
    for (const tracked of this.windows.values()) {
      if (tracked.debounceTimer) {
        clearTimeout(tracked.debounceTimer);
      }
    }

    this.windows.clear();
    console.log('[WindowState] Disposed');
  }

  /**
   * Check if a position is visible on any display
   *
   * @param position - Position to check (x, y)
   * @param displays - Array of available displays from screen.getAllDisplays()
   */
  isPositionVisible(
    position: { x: number; y: number },
    displays: { bounds: { x: number; y: number; width: number; height: number } }[]
  ): boolean {
    return displays.some(
      (d) =>
        position.x >= d.bounds.x &&
        position.x < d.bounds.x + d.bounds.width &&
        position.y >= d.bounds.y &&
        position.y < d.bounds.y + d.bounds.height
    );
  }

  /**
   * Validate and adjust window state for current display configuration
   *
   * If window position is off-screen (e.g., external monitor disconnected),
   * move it to the primary display.
   *
   * @param state - Window state to validate
   * @param displays - Available displays from screen.getAllDisplays()
   * @param primaryBounds - Bounds of primary display for fallback
   */
  validateWindowState(
    state: WindowState,
    displays: { bounds: { x: number; y: number; width: number; height: number } }[],
    primaryBounds: { x: number; y: number; width: number; height: number }
  ): WindowState {
    // Check if current position is visible
    if (this.isPositionVisible({ x: state.bounds.x, y: state.bounds.y }, displays)) {
      return state;
    }

    // Position is off-screen, move to primary monitor
    console.log(
      `[WindowState] Window ${state.id} position (${state.bounds.x}, ${state.bounds.y}) is off-screen, moving to primary`
    );

    // Calculate centered position on primary display, with some offset to avoid stacking
    const offsetX = Math.min(50, primaryBounds.width - state.bounds.width);
    const offsetY = Math.min(50, primaryBounds.height - state.bounds.height);

    return {
      ...state,
      bounds: {
        ...state.bounds,
        x: primaryBounds.x + Math.max(0, offsetX),
        y: primaryBounds.y + Math.max(0, offsetY),
      },
    };
  }

  /**
   * Validate note exists and is not deleted for window restoration
   *
   * If the specified note is deleted or doesn't exist, falls back to the
   * top note in the SD's note list.
   *
   * @param noteId - The note ID to validate (may be undefined)
   * @param sdId - The storage directory ID
   * @param fullDatabase - Database with getNote/getNotesBySd access
   * @returns Object with validated noteId and sdId
   */
  async validateNoteForRestore(
    noteId: string | undefined,
    sdId: string | undefined,
    fullDatabase: {
      getNote(noteId: string): Promise<{ id: string; deleted: boolean; sdId: string } | null>;
      getNotesBySd(sdId: string): Promise<{ id: string; deleted: boolean }[]>;
    }
  ): Promise<{ noteId: string | undefined; sdId: string | undefined }> {
    // If no noteId specified, nothing to validate
    if (!noteId || !sdId) {
      return { noteId, sdId };
    }

    // Check if note exists and is not deleted
    const note = await fullDatabase.getNote(noteId);
    if (note && !note.deleted && note.sdId === sdId) {
      return { noteId, sdId };
    }

    // Note is deleted or doesn't exist - fall back to top note in SD
    console.log(
      `[WindowState] Note ${noteId} not found or deleted, falling back to top note in SD ${sdId}`
    );

    const notes = await fullDatabase.getNotesBySd(sdId);
    const firstNote = notes.find((n) => !n.deleted);

    if (firstNote) {
      console.log(`[WindowState] Using fallback note: ${firstNote.id}`);
      return { noteId: firstNote.id, sdId };
    }

    // No non-deleted notes in SD
    console.log(`[WindowState] No non-deleted notes in SD ${sdId}`);
    return { noteId: undefined, sdId };
  }

  /**
   * Validate storage directory exists and is accessible
   *
   * @param sdId - The storage directory ID to validate (may be undefined)
   * @param fullDatabase - Database with getStorageDir access
   * @param fsAccess - Function to check file system access (fs.access)
   * @returns true if SD is valid and accessible, false otherwise
   */
  async validateSDForRestore(
    sdId: string | undefined,
    fullDatabase: {
      getStorageDir(id: string): Promise<{ id: string; path: string; name: string } | null>;
    },
    fsAccess: (path: string) => Promise<void>
  ): Promise<boolean> {
    // If no sdId, it's likely a syncStatus window - always valid
    if (!sdId) {
      return true;
    }

    // Check if SD exists in database
    const sd = await fullDatabase.getStorageDir(sdId);
    if (!sd) {
      console.log(`[WindowState] SD ${sdId} not found in database, skipping window`);
      return false;
    }

    // Check if SD path is accessible
    try {
      await fsAccess(sd.path);
      return true;
    } catch {
      console.log(`[WindowState] SD ${sdId} path ${sd.path} is not accessible, skipping window`);
      return false;
    }
  }

  /**
   * Create a debounced handler for bounds changes
   */
  private createBoundsHandler(windowId: string): () => void {
    return () => {
      const tracked = this.windows.get(windowId);
      if (!tracked || tracked.window.isDestroyed()) return;

      // Clear existing timer
      if (tracked.debounceTimer) {
        clearTimeout(tracked.debounceTimer);
      }

      // Set new timer
      tracked.debounceTimer = setTimeout(() => {
        // Capture bounds after debounce
        if (!tracked.window.isDestroyed()) {
          // The state will be captured in getCurrentState()
          // Just log for debugging
          const bounds = tracked.window.getBounds();
          console.log(
            `[WindowState] Window ${windowId} bounds: ${bounds.x},${bounds.y} ${bounds.width}x${bounds.height}`
          );
        }
      }, BOUNDS_DEBOUNCE_MS);
    };
  }
}
