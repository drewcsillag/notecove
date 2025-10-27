/**
 * TipTap Editor Component
 *
 * Rich text editor using TipTap with Yjs collaboration support.
 * Syncs with main process CRDT via IPC.
 */

import React, { useEffect, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Collaboration from '@tiptap/extension-collaboration';
import Underline from '@tiptap/extension-underline';
import { Box } from '@mui/material';
import * as Y from 'yjs';
import { EditorToolbar } from './EditorToolbar';

export interface TipTapEditorProps {
  noteId: string | null;
  onTitleChange?: (title: string) => void;
}

export const TipTapEditor: React.FC<TipTapEditorProps> = ({ noteId, onTitleChange }) => {
  const [yDoc] = useState(() => new Y.Doc());
  const isLoadingNoteRef = React.useRef(false);
  const currentNoteIdRef = React.useRef<string | null>(null);
  const titleUpdateTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const updateHandlerRef = React.useRef<((update: Uint8Array, origin: unknown) => void) | null>(null);

  const editor = useEditor({
    extensions: [
      // Use StarterKit but exclude History (Collaboration provides its own)
      StarterKit.configure({
        history: false, // Collaboration extension handles undo/redo
      }),
      // Add Underline extension (not in StarterKit)
      Underline,
      // Collaboration extension binds TipTap to Yjs
      // Use 'content' fragment to match NoteDoc structure
      Collaboration.configure({
        document: yDoc,
        fragment: yDoc.getXmlFragment('content'),
      }),
    ],
    content: '<p>Start typing...</p>',
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-2xl mx-auto focus:outline-none',
      },
    },
    // Track content changes for title extraction
    onUpdate: ({ editor }) => {
      // Don't extract title while loading a note
      if (isLoadingNoteRef.current) {
        console.log('[TipTapEditor] Skipping title extraction - still loading');
        return;
      }

      // Extract title from first line and debounce the update
      const firstLine = editor.state.doc.firstChild;
      if (firstLine && onTitleChange) {
        const titleText = firstLine.textContent.trim();
        console.log(`[TipTapEditor] Extracted title: "${titleText}"`);

        // Clear existing timer
        if (titleUpdateTimerRef.current) {
          clearTimeout(titleUpdateTimerRef.current);
        }

        // Debounce title update by 300ms for snappy updates
        titleUpdateTimerRef.current = setTimeout(() => {
          console.log(`[TipTapEditor] Calling onTitleChange with: "${titleText || 'Untitled'}"`);
          onTitleChange(titleText || 'Untitled');
        }, 300);
      }
    },
  });

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (titleUpdateTimerRef.current) {
        clearTimeout(titleUpdateTimerRef.current);
      }
      editor?.destroy();
      yDoc.destroy();
    };
  }, [editor, yDoc]);

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

      console.log(`[TipTapEditor] Sending update to main process for note ${noteId}, size: ${update.length} bytes`);
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

        // Tell main process to load this note
        await window.electronAPI.note.load(noteId);

        // Get the current state from main process
        const state = await window.electronAPI.note.getState(noteId);
        console.log(`[TipTapEditor] Got state from main process, size: ${state.length} bytes`);

        if (!isActive) return;

        // Apply the state to our local Yjs document with 'load' origin
        // Since this editor instance is created fresh for each note (via key prop),
        // the yDoc is empty and we don't need to clear it first
        Y.applyUpdate(yDoc, state, 'load');
        console.log(`[TipTapEditor] Applied state to yDoc`);

        currentNoteIdRef.current = noteId;
        isLoadingNoteRef.current = false;
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
  }, [noteId, editor, yDoc]);

  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        '& .ProseMirror': {
          minHeight: '100%',
          outline: 'none',
          '& > *': {
            marginBottom: 1,
          },
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
            marginBottom: 1,
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
        },
      }}
    >
      <EditorToolbar editor={editor} />
      <Box sx={{ flex: 1, overflow: 'auto', padding: 2 }}>
        <EditorContent editor={editor} />
      </Box>
    </Box>
  );
};
