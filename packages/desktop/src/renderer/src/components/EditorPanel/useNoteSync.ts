/**
 * Note Sync Hook
 *
 * Handles note loading, unloading, and synchronization with the main process.
 * Manages Yjs document updates and IPC communication.
 */

import { useEffect, useState, type MutableRefObject } from 'react';
import type { Editor } from '@tiptap/react';
import * as Y from 'yjs';
import { clearNoteTitleCache, prefetchNoteTitles } from './extensions/InterNoteLink';

/**
 * Options for the useNoteSync hook
 */
export interface UseNoteSyncOptions {
  /** Whether the note is newly created (needs H1 formatting) */
  isNewlyCreated?: boolean;
  /** Whether the editor is read-only */
  readOnly?: boolean;
  /** Callback when note has finished loading */
  onNoteLoaded?: () => void;
}

/**
 * Refs that the hook needs access to (defined in parent component)
 */
export interface UseNoteSyncRefs {
  /** Ref to track if loading is in progress */
  isLoadingRef: MutableRefObject<boolean>;
  /** Ref to track the currently loaded note ID */
  loadedNoteIdRef: MutableRefObject<string | null>;
  /** Ref to the Yjs update handler (for temporary disabling during load) */
  updateHandlerRef: MutableRefObject<((update: Uint8Array, origin: unknown) => void) | null>;
  /** Set of pending update hashes (to detect own updates bouncing back) */
  pendingUpdatesRef: MutableRefObject<Set<string>>;
  /** Timer ref for sync indicator */
  syncIndicatorTimerRef: MutableRefObject<NodeJS.Timeout | null>;
  /** Whether to focus after loading completes */
  shouldFocusAfterLoadRef: MutableRefObject<boolean>;
  /** Whether focus has been attempted */
  focusAttemptedRef: MutableRefObject<boolean>;
}

/**
 * State from the parent component that the hook needs access to
 */
export interface UseNoteSyncState {
  /** Current loading state (owned by parent for useEditor) */
  isLoading: boolean;
  /** Setter for isLoading state */
  setIsLoading: (loading: boolean) => void;
}

/**
 * Return value from the useNoteSync hook
 */
export interface UseNoteSyncReturn {
  /** Whether to show the sync indicator */
  showSyncIndicator: boolean;
}

/**
 * Hook to handle note synchronization with the main process.
 *
 * Manages:
 * - Loading notes from main process
 * - Sending local updates to main process
 * - Receiving updates from other windows
 * - Showing sync indicator for external updates
 *
 * @param noteId - ID of the note to sync
 * @param editor - TipTap editor instance
 * @param yDoc - Yjs document for collaboration
 * @param refs - Refs from parent component
 * @param state - State from parent component (isLoading, setIsLoading)
 * @param options - Configuration options
 * @returns Sync state (showSyncIndicator)
 */
export function useNoteSync(
  noteId: string | null,
  editor: Editor | null,
  yDoc: Y.Doc,
  refs: UseNoteSyncRefs,
  state: UseNoteSyncState,
  options: UseNoteSyncOptions = {}
): UseNoteSyncReturn {
  const { isNewlyCreated = false, readOnly = false, onNoteLoaded } = options;
  const {
    isLoadingRef,
    loadedNoteIdRef,
    updateHandlerRef,
    pendingUpdatesRef,
    syncIndicatorTimerRef,
    shouldFocusAfterLoadRef,
    focusAttemptedRef,
  } = refs;
  const { isLoading, setIsLoading } = state;

  const [showSyncIndicator, setShowSyncIndicator] = useState(false);

  // Set up Yjs update handler to send local changes to main process
  useEffect(() => {
    if (!editor || !noteId) {
      return;
    }

    const updateHandler = (update: Uint8Array, origin: unknown) => {
      // Ignore updates from loading or remote sources
      if (origin === 'load' || origin === 'remote') {
        return;
      }

      // Create a hash of the first 32 bytes to identify this update
      const updateHash = Array.from(update.slice(0, 32))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      pendingUpdatesRef.current.add(updateHash);

      // Clean up old hashes after a short delay (in case update never comes back)
      setTimeout(() => {
        pendingUpdatesRef.current.delete(updateHash);
      }, 5000);

      console.log(
        `[useNoteSync] Sending update to main process for note ${noteId}, size: ${update.length} bytes, hash: ${updateHash.substring(0, 16)}...`
      );
      // Send update to main process for persistence and distribution to other windows
      window.electronAPI.note.applyUpdate(noteId, update).catch((error: Error) => {
        console.error(`Failed to apply update for note ${noteId}:`, error);
      });
    };

    // Store reference to handler so we can temporarily disable it during loading
    updateHandlerRef.current = updateHandler;

    yDoc.on('update', updateHandler);

    return () => {
      yDoc.off('update', updateHandler);
      updateHandlerRef.current = null;
    };
  }, [editor, yDoc, noteId, pendingUpdatesRef, updateHandlerRef]);

  // Handle note loading/unloading with IPC
  useEffect(() => {
    if (!noteId || !editor) {
      return;
    }

    let isActive = true;

    // Helper to set loading state (both ref and state)
    const setLoadingState = (loading: boolean) => {
      isLoadingRef.current = loading;
      setIsLoading(loading);
    };

    // Load note from main process
    const loadNote = async () => {
      // Skip if this note is already loaded (prevents redundant loads when
      // unrelated state changes trigger useEffect re-runs)
      if (loadedNoteIdRef.current === noteId) {
        return;
      }

      try {
        setLoadingState(true);
        console.log(`[useNoteSync] Loading note ${noteId}`);

        // Clear the title cache and prefetch fresh titles in parallel with note loading
        // This prevents "Loading..." flicker when links are rendered
        clearNoteTitleCache();
        const prefetchPromise = prefetchNoteTitles();

        // Tell main process to load this note (in parallel with title prefetch)
        await window.electronAPI.note.load(noteId);

        // Wait for prefetch to complete before rendering content
        await prefetchPromise;

        // Get the current state from main process
        const state = await window.electronAPI.note.getState(noteId);
        console.log(`[useNoteSync] Got state from main process, size: ${state.length} bytes`);

        if (!isActive) {
          return;
        }

        // Apply the state to our local Yjs document with 'load' origin
        // Since this editor instance is created fresh for each note (via key prop),
        // the yDoc is empty and we don't need to clear it first
        Y.applyUpdate(yDoc, state, 'load');
        console.log(`[useNoteSync] Applied state to yDoc`);

        // Check if this is a newly created note and set up initial formatting
        // Only apply H1 formatting to notes that were just created, not existing empty notes
        if (isNewlyCreated) {
          console.log(`[useNoteSync] Setting up newly created note with H1 formatting`);

          // For new notes, clear any default content and set H1 format
          editor.commands.setContent('');
          editor.commands.setHeading({ level: 1 });

          // Mark that we should focus after loading completes
          // Using ref because isNewlyCreated will be cleared by onNoteLoaded
          shouldFocusAfterLoadRef.current = true;
          focusAttemptedRef.current = false; // Reset so we can attempt focus
        }

        // IMPORTANT: Clear loading flag AFTER all content manipulation to prevent
        // spurious title updates from setContent/setHeading operations
        setLoadingState(false);

        // Mark this note as successfully loaded to prevent redundant reloads
        loadedNoteIdRef.current = noteId;

        // Enable editing now that loading is complete
        editor.setEditable(!readOnly);

        // Notify parent that note has been loaded
        onNoteLoaded?.();
      } catch (error) {
        console.error(`Failed to load note ${noteId}:`, error);
        setLoadingState(false);
        editor.setEditable(!readOnly);
      }
    };

    void loadNote();

    // Set up listener for updates from other windows in same process
    const handleNoteUpdate = (updatedNoteId: string, update: Uint8Array) => {
      if (updatedNoteId !== noteId) {
        return;
      }

      // Check if this is our own update bouncing back
      const updateHash = Array.from(update.slice(0, 32))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      if (pendingUpdatesRef.current.has(updateHash)) {
        // This is our own update, skip it to preserve undo stack
        console.log(
          `[useNoteSync] Skipping own update bounce-back, hash: ${updateHash.substring(0, 16)}...`
        );
        pendingUpdatesRef.current.delete(updateHash);
        return;
      }

      // Apply update from other window to our local Y.Doc with 'remote' origin
      // This will automatically update the editor via the Collaboration extension
      console.log(
        `[useNoteSync] Applying remote update with ${update.length} bytes, hash: ${updateHash.substring(0, 16)}...`
      );
      Y.applyUpdate(yDoc, update, 'remote');
    };

    const cleanupNoteUpdate = window.electronAPI.note.onUpdated(handleNoteUpdate);

    // Set up listener for updates from other instances (via activity sync)
    // Note: We don't need to do anything here - the main process will broadcast
    // note:updated events when it loads updates from disk, which handleNoteUpdate
    // will receive and process normally.
    const handleExternalUpdate = (data: { operation: string; noteIds: string[] }) => {
      console.log(
        `[useNoteSync] onExternalUpdate received:`,
        data.operation,
        data.noteIds,
        `this note: ${noteId}, included: ${data.noteIds.includes(noteId)}`
      );

      if (data.noteIds.includes(noteId)) {
        // Just show sync indicator - updates will come via note:updated
        if (syncIndicatorTimerRef.current) {
          clearTimeout(syncIndicatorTimerRef.current);
        }
        setShowSyncIndicator(true);
        syncIndicatorTimerRef.current = setTimeout(() => {
          setShowSyncIndicator(false);
        }, 2000);
      }
    };

    const cleanupExternalUpdate = window.electronAPI.note.onExternalUpdate(handleExternalUpdate);

    return () => {
      isActive = false;
      cleanupNoteUpdate();
      cleanupExternalUpdate();
      // Clean up sync indicator timer
      if (syncIndicatorTimerRef.current) {
        clearTimeout(syncIndicatorTimerRef.current);
      }
      // Tell main process we're done with this note
      void window.electronAPI.note.unload(noteId);
    };
  }, [
    noteId,
    editor,
    yDoc,
    isNewlyCreated,
    onNoteLoaded,
    readOnly,
    isLoadingRef,
    loadedNoteIdRef,
    pendingUpdatesRef,
    syncIndicatorTimerRef,
    shouldFocusAfterLoadRef,
    focusAttemptedRef,
    setIsLoading,
  ]);

  // Focus editor after loading completes for newly created notes
  // This is separate from the loading effect because isNewlyCreated changes
  // during loading (cleared by onNoteLoaded), causing the loading effect to re-run.
  // Using refs ensures we capture the "should focus" intent before it's cleared,
  // and only attempt focus once per new note.
  useEffect(() => {
    if (!isLoading && editor && shouldFocusAfterLoadRef.current && !focusAttemptedRef.current) {
      focusAttemptedRef.current = true;

      // Delay focus to ensure React has finished rendering
      // Use TipTap's focus command which properly handles NodeViews
      // Focus at 'start' to put cursor in the title heading
      setTimeout(() => {
        editor.commands.focus('start');
        shouldFocusAfterLoadRef.current = false;
      }, 100);
    }
  }, [isLoading, editor, shouldFocusAfterLoadRef, focusAttemptedRef]);

  return { showSyncIndicator };
}
