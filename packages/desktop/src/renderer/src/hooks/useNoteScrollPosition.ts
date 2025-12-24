/**
 * Hook for persisting scroll positions per-note across app restarts.
 *
 * Unlike useWindowState (which tracks state per-window for session restoration),
 * this hook persists scroll positions per-note so that reopening a note
 * in any window restores its scroll position.
 */

import { useCallback, useRef, useEffect } from 'react';
import { AppStateKey } from '@notecove/shared';

/** Debounce delay for saving scroll position (milliseconds) */
const SAVE_DEBOUNCE_MS = 1000;

/** Maximum number of notes to track scroll positions for (to limit storage size) */
const MAX_TRACKED_NOTES = 100;

/** Scroll positions cache: noteId -> scrollTop */
type ScrollPositionsCache = Record<string, number>;

/** Singleton cache of scroll positions (shared across all hook instances) */
let scrollPositionsCache: ScrollPositionsCache | null = null;
let cacheLoaded = false;
let cacheLoading = false;
let loadPromise: Promise<void> | null = null;

/**
 * Load scroll positions from database into cache
 */
async function loadCache(): Promise<void> {
  if (cacheLoaded || cacheLoading) return;
  cacheLoading = true;

  try {
    const saved = await window.electronAPI.appState.get(AppStateKey.NoteScrollPositions as string);
    if (saved) {
      scrollPositionsCache = JSON.parse(saved) as ScrollPositionsCache;
    } else {
      scrollPositionsCache = {};
    }
    cacheLoaded = true;
  } catch (error: unknown) {
    console.error(
      '[useNoteScrollPosition] Failed to load scroll positions:',
      error instanceof Error ? error.message : String(error)
    );
    scrollPositionsCache = {};
    cacheLoaded = true;
  } finally {
    cacheLoading = false;
  }
}

/**
 * Save scroll positions from cache to database
 */
async function saveCache(): Promise<void> {
  if (!scrollPositionsCache) return;

  try {
    // Limit the number of entries to prevent unbounded growth
    const entries = Object.entries(scrollPositionsCache);
    if (entries.length > MAX_TRACKED_NOTES) {
      // Keep only the most recently accessed entries
      // For simplicity, just keep the first MAX_TRACKED_NOTES entries
      const limited = Object.fromEntries(entries.slice(-MAX_TRACKED_NOTES));
      scrollPositionsCache = limited;
    }

    await window.electronAPI.appState.set(
      AppStateKey.NoteScrollPositions as string,
      JSON.stringify(scrollPositionsCache)
    );
  } catch (error: unknown) {
    console.error(
      '[useNoteScrollPosition] Failed to save scroll positions:',
      error instanceof Error ? error.message : String(error)
    );
  }
}

/** Hook return type */
export interface UseNoteScrollPositionReturn {
  /** Get the saved scroll position for a note (returns 0 if not found) */
  getScrollPosition: (noteId: string) => Promise<number>;

  /** Report a scroll position change (debounced, auto-saves) */
  reportScrollPosition: (noteId: string, scrollTop: number) => void;
}

/**
 * Hook for tracking and persisting per-note scroll positions
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
   * Get the saved scroll position for a note
   */
  const getScrollPosition = useCallback(async (noteId: string): Promise<number> => {
    // Ensure cache is loaded
    if (!cacheLoaded && loadPromise) {
      await loadPromise;
    }

    return scrollPositionsCache?.[noteId] ?? 0;
  }, []);

  /**
   * Report a scroll position change (debounced save)
   */
  const reportScrollPosition = useCallback((noteId: string, scrollTop: number): void => {
    // Update cache immediately
    if (scrollPositionsCache) {
      scrollPositionsCache[noteId] = scrollTop;
    }

    // Clear existing timer
    if (saveDebounceRef.current) {
      clearTimeout(saveDebounceRef.current);
    }

    // Set new debounced save
    saveDebounceRef.current = setTimeout(() => {
      void saveCache();
    }, SAVE_DEBOUNCE_MS);
  }, []);

  return {
    getScrollPosition,
    reportScrollPosition,
  };
}
