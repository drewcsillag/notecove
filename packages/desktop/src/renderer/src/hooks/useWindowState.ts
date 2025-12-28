/**
 * Hook for tracking and restoring window/editor state
 *
 * Handles:
 * - Getting windowId from URL params
 * - Reporting current note to main process
 * - Tracking scroll position (debounced 1000ms)
 * - Tracking cursor position (debounced 1000ms)
 * - Restoring state when note loads
 *
 * @see plans/retain-note-state/PLAN.md
 */

import { useRef, useCallback, useEffect, useState } from 'react';

/** Debounce delay for editor state updates (milliseconds) */
const EDITOR_STATE_DEBOUNCE_MS = 1000;

/** Saved editor state from previous session */
export interface SavedEditorState {
  scrollTop: number;
  cursorPosition: number;
}

/** Hook return type */
export interface UseWindowStateReturn {
  /** The window ID from URL params (null if not available) */
  windowId: string | null;

  /** Report that the user navigated to a new note */
  reportCurrentNote: (noteId: string, sdId?: string) => void;

  /** Report scroll position change (debounced) */
  reportScrollPosition: (scrollTop: number) => void;

  /** Report cursor position change (debounced) */
  reportCursorPosition: (cursorPosition: number) => void;

  /** Get saved state for restoration (returns null if not for this note or not a restored window) */
  getSavedState: (noteId: string) => Promise<SavedEditorState | null>;

  /** Report final state immediately (for beforeunload) */
  reportFinalState: (scrollTop: number, cursorPosition: number) => void;
}

/**
 * Get windowId from URL params (query string or hash)
 */
function getWindowIdFromUrl(): string | null {
  try {
    // Try query string first
    const searchParams = new URLSearchParams(window.location.search);
    let windowId = searchParams.get('windowId');

    // If not in search, try hash (for file:// protocol)
    if (!windowId && window.location.hash) {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      windowId = hashParams.get('windowId');
    }

    return windowId;
  } catch (error) {
    console.error('[useWindowState] Error parsing URL for windowId:', error);
    return null;
  }
}

/**
 * Hook for tracking and restoring window/editor state
 */
export function useWindowState(): UseWindowStateReturn {
  // Get windowId from URL on mount
  const [windowId] = useState<string | null>(() => getWindowIdFromUrl());

  // Debounce timers
  const scrollDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const cursorDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Track last reported values to avoid redundant reports
  const lastScrollTopRef = useRef<number | null>(null);
  const lastCursorPositionRef = useRef<number | null>(null);

  // Log windowId on mount
  useEffect(() => {
    if (windowId) {
      console.log('[useWindowState] Window ID from URL:', windowId);
    } else {
      console.log('[useWindowState] No windowId in URL params');
    }
  }, [windowId]);

  // Clean up debounce timers on unmount
  useEffect(() => {
    return () => {
      if (scrollDebounceRef.current) {
        clearTimeout(scrollDebounceRef.current);
      }
      if (cursorDebounceRef.current) {
        clearTimeout(cursorDebounceRef.current);
      }
    };
  }, []);

  /**
   * Report that the user navigated to a new note
   */
  const reportCurrentNote = useCallback(
    (noteId: string, sdId?: string) => {
      if (!windowId) return;

      console.log(`[useWindowState] Reporting current note: ${noteId} (sd: ${sdId ?? 'none'})`);
      void window.electronAPI.windowState.reportCurrentNote(windowId, noteId, sdId);
    },
    [windowId]
  );

  /**
   * Report scroll position change (debounced)
   */
  const reportScrollPosition = useCallback(
    (scrollTop: number) => {
      if (!windowId) return;

      // Clear existing timer
      if (scrollDebounceRef.current) {
        clearTimeout(scrollDebounceRef.current);
      }

      // Set new debounced report
      scrollDebounceRef.current = setTimeout(() => {
        // Skip if value hasn't changed
        if (scrollTop === lastScrollTopRef.current) return;
        lastScrollTopRef.current = scrollTop;

        const cursorPosition = lastCursorPositionRef.current ?? 0;
        console.log(
          `[useWindowState] Reporting editor state: scroll=${scrollTop}, cursor=${cursorPosition}`
        );
        void window.electronAPI.windowState.reportEditorState(windowId, {
          scrollTop,
          cursorPosition,
        });
      }, EDITOR_STATE_DEBOUNCE_MS);
    },
    [windowId]
  );

  /**
   * Report cursor position change (debounced)
   */
  const reportCursorPosition = useCallback(
    (cursorPosition: number) => {
      if (!windowId) return;

      // Clear existing timer
      if (cursorDebounceRef.current) {
        clearTimeout(cursorDebounceRef.current);
      }

      // Set new debounced report
      cursorDebounceRef.current = setTimeout(() => {
        // Skip if value hasn't changed
        if (cursorPosition === lastCursorPositionRef.current) return;
        lastCursorPositionRef.current = cursorPosition;

        const scrollTop = lastScrollTopRef.current ?? 0;
        console.log(
          `[useWindowState] Reporting editor state: scroll=${scrollTop}, cursor=${cursorPosition}`
        );
        void window.electronAPI.windowState.reportEditorState(windowId, {
          scrollTop,
          cursorPosition,
        });
      }, EDITOR_STATE_DEBOUNCE_MS);
    },
    [windowId]
  );

  /**
   * Get saved state for restoration (only if it's for the specified note)
   */
  const getSavedState = useCallback(
    async (noteId: string): Promise<SavedEditorState | null> => {
      if (!windowId) return null;

      try {
        const savedState = await window.electronAPI.windowState.getSavedState(windowId);
        // Only return state if it's for the note we're trying to restore
        // This prevents using stale state from a different note
        if (savedState?.editorState && savedState.noteId === noteId) {
          console.log(
            '[useWindowState] Got saved editor state for note:',
            noteId,
            savedState.editorState
          );
          return savedState.editorState;
        }
        if (savedState?.noteId && savedState.noteId !== noteId) {
          console.log(
            `[useWindowState] Saved state is for different note (saved: ${savedState.noteId}, requested: ${noteId})`
          );
        }
      } catch (error) {
        console.error('[useWindowState] Error getting saved state:', error);
      }
      return null;
    },
    [windowId]
  );

  /**
   * Report final state immediately (for beforeunload)
   */
  const reportFinalState = useCallback(
    (scrollTop: number, cursorPosition: number) => {
      if (!windowId) return;

      // Clear any pending debounced reports
      if (scrollDebounceRef.current) {
        clearTimeout(scrollDebounceRef.current);
      }
      if (cursorDebounceRef.current) {
        clearTimeout(cursorDebounceRef.current);
      }

      console.log(
        `[useWindowState] Reporting final state: scroll=${scrollTop}, cursor=${cursorPosition}`
      );
      // Use synchronous approach for beforeunload
      void window.electronAPI.windowState.reportEditorState(windowId, {
        scrollTop,
        cursorPosition,
      });
    },
    [windowId]
  );

  return {
    windowId,
    reportCurrentNote,
    reportScrollPosition,
    reportCursorPosition,
    getSavedState,
    reportFinalState,
  };
}
