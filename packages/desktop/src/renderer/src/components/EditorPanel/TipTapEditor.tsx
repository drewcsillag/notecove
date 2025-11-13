/**
 * TipTap Editor Component
 *
 * Rich text editor using TipTap with Yjs collaboration support.
 * Syncs with main process CRDT via IPC.
 */

import React, { useEffect, useState, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Collaboration from '@tiptap/extension-collaboration';
import Underline from '@tiptap/extension-underline';
import SearchAndReplace from '@sereneinserenade/tiptap-search-and-replace';
import { Box, useTheme } from '@mui/material';
import * as Y from 'yjs';
import { EditorToolbar } from './EditorToolbar';
import { Hashtag } from './extensions/Hashtag';
import { InterNoteLink, clearNoteTitleCache } from './extensions/InterNoteLink';
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
}) => {
  const theme = useTheme();
  const [yDoc] = useState(() => new Y.Doc());
  // Start with loading=true to prevent title extraction before note loads
  const isLoadingNoteRef = useRef(true);
  const noteIdRef = useRef<string | null>(noteId);
  const titleUpdateTimerRef = useRef<NodeJS.Timeout | null>(null);
  const updateHandlerRef = useRef<((update: Uint8Array, origin: unknown) => void) | null>(null);

  const editor = useEditor({
    extensions: [
      // Use StarterKit but exclude History (Collaboration provides its own)
      StarterKit.configure({
        history: false, // Collaboration extension handles undo/redo
      }),
      // Add Underline extension (not in StarterKit)
      Underline,
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
    editable: !readOnly,
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-2xl mx-auto focus:outline-none',
      },
    },
    // Track content changes for title extraction
    onUpdate: ({ editor }) => {
      // Don't extract title while loading a note
      if (isLoadingNoteRef.current) {
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

  // Keep noteIdRef in sync with noteId prop and handle note deselection
  useEffect(() => {
    const previousNoteId = noteIdRef.current;

    if (previousNoteId !== noteId) {
      // If we're deselecting a note (changing from a valid ID to null or different ID),
      // immediately save the current editor content
      if (previousNoteId && editor && onTitleChange) {
        // Don't save if the note is still loading
        if (isLoadingNoteRef.current) {
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
      if (noteId && editor && onTitleChange && !isLoadingNoteRef.current) {
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
      } else if (noteId && isLoadingNoteRef.current) {
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

      console.log(
        `[TipTapEditor] Sending update to main process for note ${noteId}, size: ${update.length} bytes`
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

    // Load note from main process
    const loadNote = async () => {
      try {
        isLoadingNoteRef.current = true;
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
        isLoadingNoteRef.current = false;

        // Notify parent that note has been loaded
        onNoteLoaded?.();
      } catch (error) {
        console.error(`Failed to load note ${noteId}:`, error);
        isLoadingNoteRef.current = false;
      }
    };

    void loadNote();

    // Set up listener for updates from other windows in same process
    const handleNoteUpdate = (updatedNoteId: string, update: Uint8Array) => {
      if (updatedNoteId === noteId) {
        // Apply update from other window to our local Y.Doc with 'remote' origin
        // This will automatically update the editor via the Collaboration extension
        Y.applyUpdate(yDoc, update, 'remote');
      }
    };

    const cleanupNoteUpdate = window.electronAPI.note.onUpdated(handleNoteUpdate);

    // Set up listener for updates from other instances (via activity sync)
    const handleExternalUpdate = (data: { operation: string; noteIds: string[] }) => {
      if (data.noteIds.includes(noteId)) {
        // Reload note state from main process
        void (async () => {
          try {
            const state = await window.electronAPI.note.getState(noteId);
            Y.applyUpdate(yDoc, state, 'remote');
          } catch (error) {
            console.error(`Failed to reload note ${noteId}:`, error);
          }
        })();
      }
    };

    const cleanupExternalUpdate = window.electronAPI.note.onExternalUpdate(handleExternalUpdate);

    return () => {
      isActive = false;
      cleanupNoteUpdate();
      cleanupExternalUpdate();
      // Tell main process we're done with this note
      void window.electronAPI.note.unload(noteId);
    };
  }, [noteId, editor, yDoc, isNewlyCreated, onNoteLoaded]);

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
        },
      }}
    >
      <EditorToolbar editor={editor} />
      <Box
        sx={{ flex: 1, overflow: 'auto', padding: 2, cursor: 'text' }}
        onClick={(e) => {
          // Only handle clicks on the Box itself (empty space), not on the editor content
          if (e.target === e.currentTarget && editor) {
            // Focus the editor and move cursor to the end
            editor.commands.focus('end');
          }
        }}
      >
        <EditorContent editor={editor} />
      </Box>
      {showSearchPanel && onSearchPanelClose && (
        <SearchPanel editor={editor} onClose={onSearchPanelClose} />
      )}
    </Box>
  );
};
