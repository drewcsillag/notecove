/**
 * Editor State Restoration Hook
 *
 * Handles scroll and cursor position persistence for the editor.
 * Manages saving and restoring state across note switches and app restarts.
 */

import { useEffect, useRef, type RefObject } from 'react';
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

  // Per-note scroll position persistence (across app restarts)
  const {
    getScrollPosition: getSavedNoteScrollPosition,
    reportScrollPosition: reportNoteScrollPosition,
  } = useNoteScrollPosition();

  // Track saved state for restoration after note loads
  const savedStateRef = useRef<{ scrollTop: number; cursorPosition: number } | null>(null);
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
      const windowState = await getSavedState();
      if (windowState) {
        savedStateRef.current = windowState;
        console.log(
          '[useEditorStateRestoration] Loaded window state for restoration:',
          windowState
        );
        return;
      }

      // Fall back to per-note scroll position (for cross-restart persistence)
      const noteScrollPosition = await getSavedNoteScrollPosition(noteId);
      if (noteScrollPosition > 0) {
        savedStateRef.current = { scrollTop: noteScrollPosition, cursorPosition: 0 };
        console.log(
          '[useEditorStateRestoration] Loaded per-note scroll position:',
          noteScrollPosition
        );
      }
    };

    void loadSavedState();
  }, [noteId, isLoading, getSavedState, getSavedNoteScrollPosition]);

  // Restore scroll and cursor position after note content is ready
  useEffect(() => {
    if (!editor || isLoading || !savedStateRef.current) return;

    const savedState = savedStateRef.current;

    // Small delay to ensure DOM is ready
    const timer = setTimeout(() => {
      // Restore scroll position
      if (editorContainerRef.current && savedState.scrollTop > 0) {
        console.log('[useEditorStateRestoration] Restoring scroll position:', savedState.scrollTop);
        editorContainerRef.current.scrollTop = savedState.scrollTop;
      }

      // Restore cursor position
      if (savedState.cursorPosition > 0) {
        try {
          const docLength = editor.state.doc.content.size;
          const safePosition = Math.min(savedState.cursorPosition, docLength - 1);
          if (safePosition > 0) {
            console.log('[useEditorStateRestoration] Restoring cursor position:', safePosition);
            editor.commands.setTextSelection(safePosition);
          }
        } catch (error) {
          console.warn('[useEditorStateRestoration] Failed to restore cursor position:', error);
        }
      }

      // Clear saved state after restoration
      savedStateRef.current = null;
    }, 150); // Delay to ensure content is rendered

    return () => {
      clearTimeout(timer);
    };
  }, [editor, isLoading, editorContainerRef]);

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
      reportCursorPosition(from);
    };

    editor.on('selectionUpdate', handleSelectionUpdate);
    return () => {
      editor.off('selectionUpdate', handleSelectionUpdate);
    };
  }, [editor, reportCursorPosition]);

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
    savedStateRef.current = null;
  }, [noteId]);
}
