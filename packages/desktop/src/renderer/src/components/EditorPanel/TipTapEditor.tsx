/**
 * TipTap Editor Component
 *
 * Rich text editor using TipTap with Yjs collaboration support.
 * Syncs with main process CRDT via IPC.
 */

import React, { useEffect, useState, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import BulletList from '@tiptap/extension-bullet-list';
import OrderedList from '@tiptap/extension-ordered-list';
import Collaboration from '@tiptap/extension-collaboration';
import Underline from '@tiptap/extension-underline';
import SearchAndReplace from '@sereneinserenade/tiptap-search-and-replace';
import { Box, useTheme, Chip, Fade, CircularProgress } from '@mui/material';
import SyncIcon from '@mui/icons-material/Sync';
import * as Y from 'yjs';
import { yUndoPluginKey } from 'y-prosemirror';
import { EditorToolbar } from './EditorToolbar';
import { Hashtag } from './extensions/Hashtag';
import { InterNoteLink, clearNoteTitleCache } from './extensions/InterNoteLink';
import { TriStateTaskItem } from './extensions/TriStateTaskItem';
import { SearchPanel } from './SearchPanel';

export interface TipTapEditorProps {
  noteId: string | null;
  readOnly?: boolean;
  isNewlyCreated?: boolean;
  onNoteLoaded?: () => void;
  onTitleChange?: (noteId: string, title: string, contentText: string) => void;
  showSearchPanel?: boolean;
  onSearchPanelClose?: () => void;
  onNavigateToNote?: (noteId: string) => void;
  /** Lifted search term state for retention across panel open/close */
  searchTerm?: string;
  /** Callback to update the lifted search term state */
  onSearchTermChange?: (term: string) => void;
}

export const TipTapEditor: React.FC<TipTapEditorProps> = ({
  noteId,
  readOnly = false,
  isNewlyCreated = false,
  onNoteLoaded,
  onTitleChange,
  showSearchPanel = false,
  onSearchPanelClose,
  onNavigateToNote,
  searchTerm = '',
  onSearchTermChange,
}) => {
  const theme = useTheme();
  const [yDoc] = useState(() => new Y.Doc());
  // Show sync indicator when external updates arrive
  const [showSyncIndicator, setShowSyncIndicator] = useState(false);
  const syncIndicatorTimerRef = useRef<NodeJS.Timeout | null>(null);
  // Loading state - start with loading=true to prevent title extraction before note loads
  // Use both state (for rendering) and ref (for callbacks that need synchronous access)
  const [isLoading, setIsLoading] = useState(true);
  const isLoadingRef = useRef(true);
  const noteIdRef = useRef<string | null>(noteId);
  const titleUpdateTimerRef = useRef<NodeJS.Timeout | null>(null);
  const updateHandlerRef = useRef<((update: Uint8Array, origin: unknown) => void) | null>(null);
  // Track updates we've sent to main process so we can skip them when they bounce back
  const pendingUpdatesRef = useRef<Set<string>>(new Set());

  const editor = useEditor({
    extensions: [
      // Use StarterKit but exclude History and built-in lists
      // (we'll add custom list extensions that support taskItem)
      StarterKit.configure({
        history: false, // Collaboration extension handles undo/redo
        bulletList: false, // Use custom version that accepts taskItem
        orderedList: false, // Use custom version that accepts taskItem
      }),
      // Custom BulletList that accepts both listItem and taskItem
      BulletList.extend({
        content: '(listItem | taskItem)+',
      }),
      // Custom OrderedList that accepts both listItem and taskItem
      OrderedList.extend({
        content: '(listItem | taskItem)+',
      }),
      // Add Underline extension (not in StarterKit)
      Underline,
      // Add tri-state task item extension (list-based checkboxes)
      TriStateTaskItem.configure({
        nested: true, // Allow nesting for sub-tasks
      }),
      // Add Hashtag extension for #tag support
      Hashtag,
      // Add InterNoteLink extension for [[note-id]] support
      InterNoteLink.configure({
        onLinkClick: (linkNoteId: string) => {
          // Single click: Navigate to note in same window
          console.log('[InterNoteLink] Single click on note:', linkNoteId);
          if (onNavigateToNote) {
            onNavigateToNote(linkNoteId);
          }
        },
        onLinkDoubleClick: (linkNoteId: string) => {
          // Double click: Open note in new window (minimal layout)
          console.log('[InterNoteLink] Double click on note:', linkNoteId);
          void window.electronAPI.testing
            .createWindow({
              noteId: linkNoteId,
              minimal: true,
            })
            .then(() => {
              console.log('[InterNoteLink] New window created for note:', linkNoteId);
            })
            .catch((err) => {
              console.error('[InterNoteLink] Failed to create new window:', err);
            });
        },
      }),
      // Add SearchAndReplace extension for in-note search
      SearchAndReplace,
      // Collaboration extension binds TipTap to Yjs
      // Use 'content' fragment to match NoteDoc structure
      Collaboration.configure({
        document: yDoc,
        fragment: yDoc.getXmlFragment('content'),
      }),
    ],
    // Don't set initial content - let Yjs/Collaboration handle it from loaded state
    // Setting content here causes onUpdate to fire before note loads
    // Disable editing while loading or if readOnly
    editable: !readOnly && !isLoading,
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-2xl mx-auto focus:outline-none',
      },
    },
    // Track content changes for title extraction
    onUpdate: ({ editor }) => {
      // Don't extract title while loading a note
      if (isLoadingRef.current) {
        console.log('[TipTapEditor] onUpdate fired but loading flag is set, skipping');
        return;
      }

      // Don't extract title if no note is selected
      if (!noteIdRef.current) {
        console.log('[TipTapEditor] onUpdate fired but no noteId, skipping');
        return;
      }

      // Don't extract title if editor is read-only (e.g., for deleted notes)
      if (readOnly) {
        return;
      }

      // Extract title from first line and debounce the update
      const firstLine = editor.state.doc.firstChild;
      if (firstLine && onTitleChange) {
        const titleText = firstLine.textContent.trim();
        console.log(
          `[TipTapEditor] onUpdate extracting title for note ${noteIdRef.current}: "${titleText}"`
        );

        // Clear existing timer
        if (titleUpdateTimerRef.current) {
          clearTimeout(titleUpdateTimerRef.current);
        }

        // Capture the noteId NOW, before debounce delay
        const capturedNoteId = noteIdRef.current;

        // Debounce title update by 300ms for snappy updates
        titleUpdateTimerRef.current = setTimeout(() => {
          // Extract full text content for FTS5 indexing
          // Manually extract with block separators to preserve word boundaries
          let text = '';
          editor.state.doc.descendants((node) => {
            if (node.isText) {
              text += node.text ?? '';
            } else if (node.isBlock && text.length > 0 && !text.endsWith(' ')) {
              // Add space between blocks to preserve word boundaries
              text += ' ';
            }
            return true;
          });

          console.log(
            `[TipTapEditor] Sending title update for note ${capturedNoteId}: "${titleText || 'Untitled'}"`
          );
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
          onTitleChange?.(capturedNoteId, titleText || 'Untitled', text.trim());
        }, 300);
      }
    },
  });

  // Fix: Ensure UndoManager is properly configured after React StrictMode double-mount
  // React StrictMode unmounts and remounts components, which can break the TipTap
  // Collaboration extension's UndoManager in two ways:
  // 1. The UndoManager may lose itself from trackedOrigins
  // 2. The UndoManager's afterTransactionHandler may be unregistered from the Y.Doc
  useEffect(() => {
    if (editor) {
      const undoPluginState = yUndoPluginKey.getState(editor.state);
      if (undoPluginState?.undoManager) {
        const um = undoPluginState.undoManager;

        // Fix 1: If the UndoManager doesn't have itself in trackedOrigins, add it
        if (!um.trackedOrigins.has(um)) {
          um.trackedOrigins.add(um);
        }

        // Fix 2: If the UndoManager's handler is not registered on Y.Doc, re-register it
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
        const umAny = um as any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
        const yDocAny = yDoc as any;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
        const observers = yDocAny._observers?.get('afterTransaction');
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
        const hasUmHandler = observers?.has(umAny.afterTransactionHandler) ?? false;

        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (!hasUmHandler && umAny.afterTransactionHandler) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
          yDoc.on('afterTransaction', umAny.afterTransactionHandler);
        }
      }
    }
  }, [editor, yDoc]);

  // Keep noteIdRef in sync with noteId prop and handle note deselection
  useEffect(() => {
    const previousNoteId = noteIdRef.current;

    if (previousNoteId !== noteId) {
      // If we're deselecting a note (changing from a valid ID to null or different ID),
      // immediately save the current editor content
      if (previousNoteId && editor && onTitleChange) {
        // Don't save if the note is still loading
        if (isLoadingRef.current) {
          console.log(
            `[TipTapEditor] Skipping save during deselection - note ${previousNoteId} still loading`
          );
          noteIdRef.current = noteId;
          return;
        }

        // Clear any pending debounced update
        if (titleUpdateTimerRef.current) {
          clearTimeout(titleUpdateTimerRef.current);
          titleUpdateTimerRef.current = null;
        }

        // Extract and save title immediately
        const firstLine = editor.state.doc.firstChild;
        if (firstLine) {
          const titleText = firstLine.textContent.trim();
          let text = '';
          editor.state.doc.descendants((node) => {
            if (node.isText) {
              text += node.text ?? '';
            } else if (node.isBlock && text.length > 0 && !text.endsWith(' ')) {
              text += ' ';
            }
            return true;
          });
          onTitleChange(previousNoteId, titleText || 'Untitled', text.trim());
        }
      }

      noteIdRef.current = noteId;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId]); // editor and onTitleChange intentionally excluded to avoid re-running on every editor update

  // Cleanup on unmount - save any pending changes before destroying editor
  useEffect(() => {
    return () => {
      // Save current editor content before unmounting
      // IMPORTANT: Only save if note was fully loaded to prevent data corruption
      if (noteId && editor && onTitleChange && !isLoadingRef.current) {
        const firstLine = editor.state.doc.firstChild;
        if (firstLine) {
          const titleText = firstLine.textContent.trim();
          let text = '';
          editor.state.doc.descendants((node) => {
            if (node.isText) {
              text += node.text ?? '';
            } else if (node.isBlock && text.length > 0 && !text.endsWith(' ')) {
              text += ' ';
            }
            return true;
          });
          console.log(
            `[TipTapEditor] Unmount: Saving note ${noteId} with title: "${titleText || 'Untitled'}"`
          );
          onTitleChange(noteId, titleText || 'Untitled', text.trim());
        }
      } else if (noteId && isLoadingRef.current) {
        console.log(
          `[TipTapEditor] Unmount: Skipping save for note ${noteId} - still loading (preventing data corruption)`
        );
      }

      if (titleUpdateTimerRef.current) {
        clearTimeout(titleUpdateTimerRef.current);
      }
      editor?.destroy();
      yDoc.destroy();
    };
  }, [editor, yDoc, noteId, onTitleChange]);

  // Send Yjs updates to main process for persistence and cross-window sync
  useEffect(() => {
    if (!editor || !noteId) return;

    // Send updates to main process (but not updates from network/load)
    const updateHandler = (update: Uint8Array, origin: unknown) => {
      // Skip updates that we applied from external sources (origin will be set)
      if (origin === 'remote' || origin === 'load') {
        console.log(`[TipTapEditor] Skipping update with origin: ${origin}`);
        return;
      }

      // Create a hash of the update to track it
      const updateHash = Array.from(update.slice(0, 32))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      pendingUpdatesRef.current.add(updateHash);

      // Clean up old hashes after a short delay (in case update never comes back)
      setTimeout(() => {
        pendingUpdatesRef.current.delete(updateHash);
      }, 5000);

      console.log(
        `[TipTapEditor] Sending update to main process for note ${noteId}, size: ${update.length} bytes, hash: ${updateHash.substring(0, 16)}...`
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
  }, [editor, yDoc, noteId]);

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
      try {
        setLoadingState(true);
        console.log(`[TipTapEditor] Loading note ${noteId}`);

        // Clear the title cache to ensure we fetch fresh titles
        clearNoteTitleCache();

        // Tell main process to load this note
        await window.electronAPI.note.load(noteId);

        // Get the current state from main process
        const state = await window.electronAPI.note.getState(noteId);
        console.log(`[TipTapEditor] Got state from main process, size: ${state.length} bytes`);

        if (!isActive) {
          return;
        }

        // Apply the state to our local Yjs document with 'load' origin
        // Since this editor instance is created fresh for each note (via key prop),
        // the yDoc is empty and we don't need to clear it first
        Y.applyUpdate(yDoc, state, 'load');
        console.log(`[TipTapEditor] Applied state to yDoc`);

        // Check if this is a newly created note and set up initial formatting
        // Only apply H1 formatting to notes that were just created, not existing empty notes
        if (isNewlyCreated) {
          console.log(`[TipTapEditor] Setting up newly created note with H1 formatting`);

          // For new notes, clear any default content and set H1 format
          editor.commands.setContent('');
          editor.commands.setHeading({ level: 1 });
          editor.commands.focus();
        }

        // IMPORTANT: Clear loading flag AFTER all content manipulation to prevent
        // spurious title updates from setContent/setHeading operations
        setLoadingState(false);

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
          `[TipTapEditor] Skipping own update bounce-back, hash: ${updateHash.substring(0, 16)}...`
        );
        pendingUpdatesRef.current.delete(updateHash);
        return;
      }

      // Apply update from other window to our local Y.Doc with 'remote' origin
      // This will automatically update the editor via the Collaboration extension
      console.log(
        `[TipTapEditor] Applying remote update with ${update.length} bytes, hash: ${updateHash.substring(0, 16)}...`
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
        `[TipTapEditor] onExternalUpdate received:`,
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
  }, [noteId, editor, yDoc, isNewlyCreated, onNoteLoaded, readOnly]);

  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        '& .ProseMirror': {
          minHeight: '100%',
          outline: 'none',
          '& h1': {
            fontSize: '2em',
            fontWeight: 600,
            marginTop: 2,
            marginBottom: 1,
          },
          '& h2': {
            fontSize: '1.5em',
            fontWeight: 600,
            marginTop: 1.5,
            marginBottom: 0.75,
          },
          '& h3': {
            fontSize: '1.25em',
            fontWeight: 600,
            marginTop: 1.25,
            marginBottom: 0.5,
          },
          '& p': {
            marginBottom: 0,
            marginTop: 0,
          },
          '& ul, & ol': {
            paddingLeft: 2,
            marginBottom: 1,
          },
          '& code': {
            backgroundColor: 'action.hover',
            padding: '2px 4px',
            borderRadius: 0.5,
            fontSize: '0.9em',
          },
          '& pre': {
            backgroundColor: 'action.hover',
            padding: 2,
            borderRadius: 1,
            overflow: 'auto',
            '& code': {
              padding: 0,
              backgroundColor: 'transparent',
            },
          },
          '& blockquote': {
            borderLeft: '4px solid',
            borderColor: 'primary.main',
            paddingLeft: 2,
            marginLeft: 0,
            fontStyle: 'italic',
            color: 'text.secondary',
          },
          // Hashtag styling
          '& .hashtag': {
            color: theme.palette.primary.main,
            fontWeight: 500,
            cursor: 'pointer',
            textDecoration: 'none',
            '&:hover': {
              textDecoration: 'underline',
            },
          },
          // Inter-note link styling (complementary to tags - use secondary color)
          '& .inter-note-link': {
            color: theme.palette.secondary.main,
            fontWeight: 500,
            cursor: 'pointer',
            textDecoration: 'none',
            borderBottom: `1px dotted ${theme.palette.secondary.main}`,
            '&:hover': {
              textDecoration: 'underline',
              borderBottomStyle: 'solid',
            },
          },
          // Broken inter-note link styling (note doesn't exist or is deleted)
          '& .inter-note-link-broken': {
            color: theme.palette.error.main,
            fontWeight: 500,
            cursor: 'not-allowed',
            textDecoration: 'line-through',
            borderBottom: `1px dotted ${theme.palette.error.main}`,
          },
          // Hide the original [[note-id]] text when displaying title
          '& .inter-note-link-hidden': {
            display: 'none',
          },
          // Search result highlighting
          '& .search-result': {
            backgroundColor:
              theme.palette.mode === 'dark' ? 'rgba(255, 235, 59, 0.3)' : 'rgba(255, 235, 59, 0.5)',
            borderRadius: '2px',
          },
          '& .search-result-current': {
            backgroundColor:
              theme.palette.mode === 'dark' ? 'rgba(255, 152, 0, 0.5)' : 'rgba(255, 152, 0, 0.7)',
            outline: `2px solid ${theme.palette.primary.main}`,
            outlineOffset: '1px',
          },
          // Task item styling (list-based checkboxes)
          // The checkbox is positioned to the left of content
          // Content aligns with body text (task item pulls back to cancel list indentation)
          '& li[data-type="taskItem"]': {
            display: 'flex',
            alignItems: 'flex-start',
            listStyle: 'none',
            position: 'relative',
            // Pull back to cancel list padding, so content aligns with body text
            // Lists have paddingLeft: 2 (16px), so we offset by -16px
            marginLeft: -2, // MUI spacing: -16px
            // Add padding on left for the checkbox
            paddingLeft: '28px', // 18px checkbox + 10px gap

            // Checkbox wrapper - positioned absolutely in the padding area
            '& .task-checkbox-wrapper': {
              position: 'absolute',
              left: 0,
              top: '2px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              userSelect: 'none',
            },

            // Checkbox element
            '& .task-checkbox': {
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '18px',
              height: '18px',
              border: `2px solid ${theme.palette.text.secondary}`,
              borderRadius: '3px',
              fontSize: '12px',
              fontWeight: 700,
              lineHeight: 1,
              transition: 'all 0.15s ease',
            },

            // Task content area
            '& .task-content': {
              flex: 1,
              minWidth: 0,
            },

            // Unchecked state - empty checkbox
            '&[data-checked="unchecked"]': {
              '& .task-checkbox': {
                backgroundColor: 'transparent',
              },
              '& .task-content': {
                textDecoration: 'none',
                opacity: 1,
              },
            },

            // Checked state - green checkbox with checkmark, strikethrough text
            '&[data-checked="checked"]': {
              '& .task-checkbox': {
                backgroundColor: theme.palette.success.main,
                borderColor: theme.palette.success.main,
                color: '#ffffff',
              },
              '& .task-content': {
                textDecoration: 'line-through',
                opacity: 0.6,
                color: theme.palette.text.secondary,
              },
            },

            // Nope state - red checkbox with X, strikethrough text
            '&[data-checked="nope"]': {
              '& .task-checkbox': {
                backgroundColor: theme.palette.error.main,
                borderColor: theme.palette.error.main,
                color: '#ffffff',
              },
              '& .task-content': {
                textDecoration: 'line-through',
                opacity: 0.6,
                color: theme.palette.text.secondary,
              },
            },
          },
        },
      }}
    >
      <EditorToolbar editor={editor} />
      {/* Sync indicator - shows briefly when external updates arrive */}
      <Fade in={showSyncIndicator}>
        <Chip
          icon={<SyncIcon sx={{ fontSize: '0.9rem' }} />}
          label="Synced"
          size="small"
          color="primary"
          variant="outlined"
          sx={{
            position: 'absolute',
            top: 48, // Below toolbar
            right: 8,
            zIndex: 10,
            fontSize: '0.75rem',
            height: 24,
          }}
        />
      </Fade>
      {/* Loading overlay - shows spinner while note is loading */}
      <Fade in={isLoading}>
        <Box
          sx={{
            position: 'absolute',
            top: 48, // Below toolbar
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor:
              theme.palette.mode === 'dark' ? 'rgba(0, 0, 0, 0.7)' : 'rgba(255, 255, 255, 0.8)',
            zIndex: 5,
          }}
        >
          <CircularProgress size={40} />
        </Box>
      </Fade>
      <Box
        sx={{ flex: 1, overflow: 'auto', padding: 2, cursor: isLoading ? 'wait' : 'text' }}
        onClick={(e) => {
          // Only handle clicks on the Box itself (empty space), not on the editor content
          // Don't allow focus while loading
          if (e.target === e.currentTarget && editor && !isLoading) {
            // Focus the editor and move cursor to the end
            editor.commands.focus('end');
          }
        }}
      >
        <EditorContent editor={editor} />
      </Box>
      {showSearchPanel && onSearchPanelClose && onSearchTermChange && (
        <SearchPanel
          editor={editor}
          onClose={onSearchPanelClose}
          searchTerm={searchTerm}
          onSearchTermChange={onSearchTermChange}
        />
      )}
    </Box>
  );
};
