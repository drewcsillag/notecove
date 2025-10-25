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
  const isInitialLoadRef = React.useRef(true);

  const editor = useEditor({
    extensions: [
      // Use StarterKit but exclude History (Collaboration provides its own)
      StarterKit.configure({
        history: false, // Collaboration extension handles undo/redo
      }),
      // Add Underline extension (not in StarterKit)
      Underline,
      // Collaboration extension binds TipTap to Yjs
      Collaboration.configure({
        document: yDoc,
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
      // Extract title from first line
      const firstLine = editor.state.doc.firstChild;
      if (firstLine && onTitleChange) {
        const titleText = firstLine.textContent.trim();
        onTitleChange(titleText || 'Untitled');
      }
    },
  });

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      editor?.destroy();
      yDoc.destroy();
    };
  }, [editor, yDoc]);

  // DEMO HACK: Sync between windows using BroadcastChannel
  // This is a temporary demo to show collaboration working
  // Will be replaced with proper IPC integration in Phase 3.x
  useEffect(() => {
    if (!editor) return;

    // Create broadcast channel for this note (or default channel)
    const channelName = noteId ? `notecove-note-${noteId}` : 'notecove-demo';
    const channel = new BroadcastChannel(channelName);

    // Send updates to other windows (but not during initial load)
    const updateHandler = (update: Uint8Array) => {
      // Skip broadcasting during initial content load to prevent duplication
      if (isInitialLoadRef.current) return;

      // Convert Uint8Array to regular array for structured clone
      channel.postMessage({
        type: 'yjs-update',
        update: Array.from(update),
      });
    };

    yDoc.on('update', updateHandler);

    // Receive updates from other windows
    channel.onmessage = (event: MessageEvent<{ type: string; update: number[] }>) => {
      if (event.data.type === 'yjs-update') {
        // Convert back to Uint8Array
        const update = new Uint8Array(event.data.update);
        Y.applyUpdate(yDoc, update);
      }
    };

    return () => {
      yDoc.off('update', updateHandler);
      channel.close();
    };
  }, [editor, yDoc, noteId]);

  // Handle note loading/unloading
  useEffect(() => {
    if (!noteId) {
      // No note selected - show welcome message
      isInitialLoadRef.current = true;
      editor?.commands.setContent(
        '<h1>Welcome to NoteCove!</h1><p>Open multiple windows to see real-time collaboration in action.</p><p>Try typing here and watch it appear in other windows! 🎉</p>'
      );
      // Wait for content to be applied before enabling sync
      setTimeout(() => {
        isInitialLoadRef.current = false;
      }, 100);
      return;
    }

    // Load note with placeholder content
    isInitialLoadRef.current = true;
    editor?.commands.setContent(
      `<h1>Note ${noteId}</h1><p>Start typing to test collaboration between windows...</p>`
    );
    // Wait for content to be applied before enabling sync
    setTimeout(() => {
      isInitialLoadRef.current = false;
    }, 100);

    // TODO: Set up IPC listeners for incoming updates
    // window.electron.ipc.on('note:updated', handleUpdate)

    return () => {
      // TODO: Clean up IPC listeners
      // window.electron.ipc.removeListener('note:updated', handleUpdate)
    };
  }, [noteId, editor]);

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
