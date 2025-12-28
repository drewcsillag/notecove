/**
 * Hook for persisting scroll and cursor positions per-note across app restarts.
 *
 * Unlike useWindowState (which tracks state per-window for session restoration),
 * this hook persists editor state per-note so that reopening a note
 * in any window restores its scroll and cursor position.
 */

import { useCallback, useRef, useEffect } from 'react';
import { AppStateKey } from '@notecove/shared';

/** Debounce delay for saving position (milliseconds) */
const SAVE_DEBOUNCE_MS = 1000;

/** Maximum number of notes to track positions for (to limit storage size) */
const MAX_TRACKED_NOTES = 100;

/** Editor state for a note */
interface NoteEditorState {
  scrollTop: number;
  cursorPosition: number;
}

/** Editor state cache: noteId -> { scrollTop, cursorPosition } */
type EditorStateCache = Record<string, NoteEditorState>;

/**
 * Singleton cache of editor state (shared across all hook instances)
 * Initialize as empty object so positions can be recorded immediately.
 * When loadCache completes, it merges loaded state with any already recorded.
 */
let editorStateCache: EditorStateCache = {};
let cacheLoaded = false;
let cacheLoading = false;
let loadPromise: Promise<void> | null = null;

/**
 * Migrate old scroll-only format to new format with cursor position
 */
function migrateOldFormat(data: unknown): EditorStateCache {
  if (typeof data !== 'object' || data === null) {
    return {};
  }

  const result: EditorStateCache = {};
  for (const [noteId, value] of Object.entries(data)) {
    if (typeof value === 'number') {
      // Old format: just scroll position
      result[noteId] = { scrollTop: value, cursorPosition: 0 };
    } else if (
      typeof value === 'object' &&
      value !== null &&
      'scrollTop' in value &&
      typeof (value as { scrollTop: unknown }).scrollTop === 'number'
    ) {
      // New format
      result[noteId] = value as NoteEditorState;
    }
  }
  return result;
}

/**
 * Load editor state from database into cache
 * Merges with any state already recorded during loading
 */
async function loadCache(): Promise<void> {
  if (cacheLoaded || cacheLoading) return;
  cacheLoading = true;

  try {
    const saved = await window.electronAPI.appState.get(AppStateKey.NoteScrollPositions as string);
    if (saved) {
      const parsed: unknown = JSON.parse(saved);
      const loadedState = migrateOldFormat(parsed);
      // Merge loaded state with any already recorded during loading
      // Prefer recently recorded state over loaded ones (they're more current)
      editorStateCache = { ...loadedState, ...editorStateCache };
    }
    cacheLoaded = true;
  } catch (error: unknown) {
    console.error(
      '[useNoteScrollPosition] Failed to load editor state:',
      error instanceof Error ? error.message : String(error)
    );
    cacheLoaded = true;
  } finally {
    cacheLoading = false;
  }
}

/**
 * Save editor state from cache to database
 */
async function saveCache(): Promise<void> {
  try {
    // Limit the number of entries to prevent unbounded growth
    const entries = Object.entries(editorStateCache);
    if (entries.length > MAX_TRACKED_NOTES) {
      // Keep only the most recently accessed entries
      // For simplicity, just keep the last MAX_TRACKED_NOTES entries
      const limited = Object.fromEntries(entries.slice(-MAX_TRACKED_NOTES));
      editorStateCache = limited;
    }

    await window.electronAPI.appState.set(
      AppStateKey.NoteScrollPositions as string,
      JSON.stringify(editorStateCache)
    );
  } catch (error: unknown) {
    console.error(
      '[useNoteScrollPosition] Failed to save editor state:',
      error instanceof Error ? error.message : String(error)
    );
  }
}

/** Hook return type */
export interface UseNoteScrollPositionReturn {
  /** Get the saved scroll position for a note (returns 0 if not found) */
  getScrollPosition: (noteId: string) => Promise<number>;

  /** Get the saved cursor position for a note (returns 0 if not found) */
  getCursorPosition: (noteId: string) => Promise<number>;

  /** Get both scroll and cursor positions for a note */
  getEditorState: (noteId: string) => Promise<NoteEditorState>;

  /** Report a scroll position change (debounced, auto-saves) */
  reportScrollPosition: (noteId: string, scrollTop: number) => void;

  /** Report a cursor position change (debounced, auto-saves) */
  reportCursorPosition: (noteId: string, cursorPosition: number) => void;

  /** Report both scroll and cursor positions (debounced, auto-saves) */
  reportEditorState: (noteId: string, state: Partial<NoteEditorState>) => void;
}

/**
 * Hook for tracking and persisting per-note editor state (scroll and cursor positions)
 */
export function useNoteScrollPosition(): UseNoteScrollPositionReturn {
  // Debounce timer for saving
  const saveDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Load cache on mount
  useEffect(() => {
    if (!cacheLoaded && !cacheLoading) {
      loadPromise = loadCache();
    }
  }, []);

  // Clean up debounce timer on unmount
  useEffect(() => {
    return () => {
      if (saveDebounceRef.current) {
        clearTimeout(saveDebounceRef.current);
        // Flush pending save on unmount
        void saveCache();
      }
    };
  }, []);

  /**
   * Schedule a debounced save
   */
  const scheduleSave = useCallback(() => {
    // Clear existing timer
    if (saveDebounceRef.current) {
      clearTimeout(saveDebounceRef.current);
    }

    // Set new debounced save
    saveDebounceRef.current = setTimeout(() => {
      void saveCache();
    }, SAVE_DEBOUNCE_MS);
  }, []);

  /**
   * Get the saved scroll position for a note
   */
  const getScrollPosition = useCallback(async (noteId: string): Promise<number> => {
    // Ensure cache is loaded (wait for any in-progress load)
    if (!cacheLoaded && loadPromise) {
      await loadPromise;
    }

    return editorStateCache[noteId]?.scrollTop ?? 0;
  }, []);

  /**
   * Get the saved cursor position for a note
   */
  const getCursorPosition = useCallback(async (noteId: string): Promise<number> => {
    // Ensure cache is loaded (wait for any in-progress load)
    if (!cacheLoaded && loadPromise) {
      await loadPromise;
    }

    return editorStateCache[noteId]?.cursorPosition ?? 0;
  }, []);

  /**
   * Get both scroll and cursor positions for a note
   */
  const getEditorState = useCallback(async (noteId: string): Promise<NoteEditorState> => {
    // Ensure cache is loaded (wait for any in-progress load)
    if (!cacheLoaded && loadPromise) {
      await loadPromise;
    }

    return editorStateCache[noteId] ?? { scrollTop: 0, cursorPosition: 0 };
  }, []);

  /**
   * Report a scroll position change (debounced save)
   */
  const reportScrollPosition = useCallback(
    (noteId: string, scrollTop: number): void => {
      // Update cache immediately (cache is always available, never null)
      if (!editorStateCache[noteId]) {
        editorStateCache[noteId] = { scrollTop, cursorPosition: 0 };
      } else {
        editorStateCache[noteId].scrollTop = scrollTop;
      }

      scheduleSave();
    },
    [scheduleSave]
  );

  /**
   * Report a cursor position change (debounced save)
   */
  const reportCursorPosition = useCallback(
    (noteId: string, cursorPosition: number): void => {
      // Update cache immediately (cache is always available, never null)
      if (!editorStateCache[noteId]) {
        editorStateCache[noteId] = { scrollTop: 0, cursorPosition };
      } else {
        editorStateCache[noteId].cursorPosition = cursorPosition;
      }

      scheduleSave();
    },
    [scheduleSave]
  );

  /**
   * Report both scroll and cursor positions (debounced save)
   */
  const reportEditorState = useCallback(
    (noteId: string, state: Partial<NoteEditorState>): void => {
      // Update cache immediately
      if (!editorStateCache[noteId]) {
        editorStateCache[noteId] = {
          scrollTop: state.scrollTop ?? 0,
          cursorPosition: state.cursorPosition ?? 0,
        };
      } else {
        if (state.scrollTop !== undefined) {
          editorStateCache[noteId].scrollTop = state.scrollTop;
        }
        if (state.cursorPosition !== undefined) {
          editorStateCache[noteId].cursorPosition = state.cursorPosition;
        }
      }

      scheduleSave();
    },
    [scheduleSave]
  );

  return {
    getScrollPosition,
    getCursorPosition,
    getEditorState,
    reportScrollPosition,
    reportCursorPosition,
    reportEditorState,
  };
}

/**
 * Reset the singleton cache state (for testing only)
 * @internal
 */
export function __resetCacheForTesting(): void {
  editorStateCache = {};
  cacheLoaded = false;
  cacheLoading = false;
  loadPromise = null;
}
