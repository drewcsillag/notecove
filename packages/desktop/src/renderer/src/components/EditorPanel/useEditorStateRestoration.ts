/**
 * Editor State Restoration Hook
 *
 * Handles scroll and cursor position persistence for the editor.
 * Manages saving and restoring state across note switches and app restarts.
 */

import { useEffect, useRef, useState, type RefObject } from 'react';
import type { Editor } from '@tiptap/react';
import { useWindowState } from '../../hooks/useWindowState';
import { useNoteScrollPosition } from '../../hooks/useNoteScrollPosition';

/**
 * Hook to handle editor state persistence and restoration.
 *
 * Manages:
 * - Reporting current note to window state manager
 * - Loading saved scroll/cursor position from window state or per-note storage
 * - Restoring scroll/cursor position after content loads
 * - Tracking and reporting scroll/cursor changes
 * - Saving final state on unmount
 *
 * @param noteId - ID of the current note
 * @param editor - TipTap editor instance
 * @param isLoading - Whether the note is currently loading
 * @param editorContainerRef - Ref to the scrollable editor container
 */
export function useEditorStateRestoration(
  noteId: string | null,
  editor: Editor | null,
  isLoading: boolean,
  editorContainerRef: RefObject<HTMLDivElement>
): void {
  // Window state hooks for session restoration
  const {
    windowId,
    reportCurrentNote,
    reportScrollPosition: reportWindowScrollPosition,
    reportCursorPosition,
    getSavedState,
    reportFinalState,
  } = useWindowState();

  // Per-note editor state persistence (across app restarts)
  const {
    getEditorState: getSavedNoteEditorState,
    reportScrollPosition: reportNoteScrollPosition,
    reportCursorPosition: reportNoteCursorPosition,
  } = useNoteScrollPosition();

  // Track saved state for restoration after note loads
  // Using state instead of ref so restoration effect re-runs when state is set
  const [savedState, setSavedState] = useState<{
    scrollTop: number;
    cursorPosition: number;
  } | null>(null);
  const hasRestoredStateRef = useRef(false);

  // Report current note to window state manager when note changes
  useEffect(() => {
    if (noteId && windowId) {
      reportCurrentNote(noteId);
    }
  }, [noteId, windowId, reportCurrentNote]);

  // Load saved state when note loads (for session restoration or per-note persistence)
  useEffect(() => {
    if (!noteId || isLoading) return;

    // Only attempt restoration once per note load
    if (hasRestoredStateRef.current) return;
    hasRestoredStateRef.current = true;

    const loadSavedState = async () => {
      // First try window state (for session restoration within same app run)
      // Only use if the saved state is for THIS note (prevents using stale state from different note)
      const windowState = await getSavedState(noteId);
      if (windowState) {
        setSavedState(windowState);
        console.log(
          '[useEditorStateRestoration] Loaded window state for restoration:',
          windowState
        );
        return;
      }

      // Fall back to per-note editor state (for cross-restart persistence and note switching)
      const noteEditorState = await getSavedNoteEditorState(noteId);
      if (noteEditorState.scrollTop > 0 || noteEditorState.cursorPosition > 0) {
        setSavedState(noteEditorState);
        console.log('[useEditorStateRestoration] Loaded per-note editor state:', noteEditorState);
      }
    };

    void loadSavedState();
  }, [noteId, isLoading, getSavedState, getSavedNoteEditorState]);

  // Restore scroll and cursor position after note content is ready
  useEffect(() => {
    if (!editor || isLoading || !savedState) return;

    const container = editorContainerRef.current;
    if (!container) return;

    // For long notes, content may not be fully rendered immediately.
    // We retry scroll restoration until it succeeds or we give up.
    const targetScrollTop = savedState.scrollTop;
    const targetCursorPosition = savedState.cursorPosition;
    let attempts = 0;
    const maxAttempts = 10;
    const retryDelay = 100; // ms between retries

    const attemptRestore = () => {
      attempts++;

      // Check if we can scroll to the target position
      const maxScrollTop = container.scrollHeight - container.clientHeight;
      const canScrollToTarget = targetScrollTop <= maxScrollTop;

      if (targetScrollTop > 0) {
        if (canScrollToTarget || attempts >= maxAttempts) {
          // Either we can scroll to target, or we've given up waiting
          const actualScrollTop = Math.min(targetScrollTop, maxScrollTop);
          console.log(
            `[useEditorStateRestoration] Restoring scroll position: ${actualScrollTop} ` +
              `(target: ${targetScrollTop}, max: ${maxScrollTop}, attempt: ${attempts})`
          );
          container.scrollTop = actualScrollTop;
        } else {
          // Content still loading, retry
          console.log(
            `[useEditorStateRestoration] Waiting for content (scrollHeight: ${container.scrollHeight}, ` +
              `need: ${targetScrollTop + container.clientHeight}, attempt: ${attempts})`
          );
          timerId = setTimeout(attemptRestore, retryDelay);
          return; // Don't clear saved state yet
        }
      }

      // Restore cursor position (do this after scroll is stable)
      if (targetCursorPosition > 0) {
        try {
          const docLength = editor.state.doc.content.size;
          const safePosition = Math.min(targetCursorPosition, docLength - 1);
          if (safePosition > 0) {
            console.log('[useEditorStateRestoration] Restoring cursor position:', safePosition);
            editor.commands.setTextSelection(safePosition);
          }
        } catch (error) {
          console.warn('[useEditorStateRestoration] Failed to restore cursor position:', error);
        }
      }

      // Clear saved state after restoration
      setSavedState(null);
    };

    // Start with initial delay to let first render complete
    let timerId: NodeJS.Timeout | null = setTimeout(attemptRestore, 100);

    return () => {
      if (timerId) {
        clearTimeout(timerId);
      }
    };
  }, [editor, isLoading, savedState, editorContainerRef]);

  // Track scroll position changes
  useEffect(() => {
    const container = editorContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const scrollTop = container.scrollTop;
      // Report to window state (for session restoration)
      reportWindowScrollPosition(scrollTop);
      // Report to per-note storage (for cross-restart persistence)
      if (noteId) {
        reportNoteScrollPosition(noteId, scrollTop);
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [reportWindowScrollPosition, reportNoteScrollPosition, noteId, editorContainerRef]);

  // Track cursor position changes
  useEffect(() => {
    if (!editor) return;

    const handleSelectionUpdate = () => {
      const { from } = editor.state.selection;
      // Report to window state (for session restoration)
      reportCursorPosition(from);
      // Report to per-note storage (for cross-restart persistence)
      if (noteId) {
        reportNoteCursorPosition(noteId, from);
      }
    };

    editor.on('selectionUpdate', handleSelectionUpdate);
    return () => {
      editor.off('selectionUpdate', handleSelectionUpdate);
    };
  }, [editor, noteId, reportCursorPosition, reportNoteCursorPosition]);

  // Report final state on unmount
  useEffect(() => {
    const containerRef = editorContainerRef.current;
    return () => {
      if (containerRef && editor) {
        const scrollTop = containerRef.scrollTop;
        const cursorPosition = editor.state.selection.from;
        reportFinalState(scrollTop, cursorPosition);
      }
    };
  }, [editor, reportFinalState, editorContainerRef]);

  // Reset restoration flag when note changes
  useEffect(() => {
    hasRestoredStateRef.current = false;
    setSavedState(null);
  }, [noteId]);
}
