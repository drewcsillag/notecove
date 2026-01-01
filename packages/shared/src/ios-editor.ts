/**
 * iOS Editor Bridge
 *
 * Standalone TipTap editor for iOS WKWebView.
 * Communicates with Swift via webkit.messageHandlers.
 */

import { Editor } from '@tiptap/core';
import { StarterKit } from '@tiptap/starter-kit';
import { Underline } from '@tiptap/extension-underline';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { Link } from '@tiptap/extension-link';
import { Image } from '@tiptap/extension-image';
import { Placeholder } from '@tiptap/extension-placeholder';
import * as Y from 'yjs';
import { yXmlFragmentToProseMirrorRootNode } from 'y-prosemirror';

// Declare webkit message handler type
declare global {
  interface Window {
    webkit?: {
      messageHandlers?: {
        noteCove?: {
          postMessage: (message: unknown) => void;
        };
      };
    };
    NoteCoveEditor?: typeof NoteCoveEditor;
  }
}

// Send message to Swift
function postToSwift(action: string, data: unknown = {}) {
  window.webkit?.messageHandlers?.noteCove?.postMessage({ action, ...data });
}

// The editor instance
let editor: Editor | null = null;
let ydoc: Y.Doc | null = null;
let currentNoteId: string | null = null;

/**
 * iOS Editor Bridge API
 */
const NoteCoveEditor = {
  /**
   * Initialize the editor in a container element
   */
  init(containerId: string = 'editor') {
    const container = document.getElementById(containerId);
    if (!container) {
      postToSwift('error', { message: `Container #${containerId} not found` });
      return false;
    }

    editor = new Editor({
      element: container,
      extensions: [
        StarterKit.configure({
          heading: { levels: [1, 2, 3] },
        }),
        Underline,
        TaskList,
        TaskItem.configure({
          nested: true,
        }),
        Table.configure({
          resizable: false,
        }),
        TableRow,
        TableCell,
        TableHeader,
        Link.configure({
          openOnClick: false,
          HTMLAttributes: {
            rel: 'noopener noreferrer',
          },
        }),
        Image.configure({
          inline: false,
          allowBase64: true,
        }),
        Placeholder.configure({
          placeholder: 'Start writing...',
        }),
      ],
      editorProps: {
        attributes: {
          class: 'prose prose-sm sm:prose focus:outline-none',
        },
      },
      onUpdate: ({ editor }) => {
        // Notify Swift of content changes
        postToSwift('contentChanged', {
          noteId: currentNoteId,
          html: editor.getHTML(),
          json: editor.getJSON(),
        });
      },
      onSelectionUpdate: ({ editor }) => {
        // Notify Swift of selection/formatting state
        postToSwift('selectionChanged', {
          isBold: editor.isActive('bold'),
          isItalic: editor.isActive('italic'),
          isUnderline: editor.isActive('underline'),
          isStrike: editor.isActive('strike'),
          isCode: editor.isActive('code'),
          isBulletList: editor.isActive('bulletList'),
          isOrderedList: editor.isActive('orderedList'),
          isTaskList: editor.isActive('taskList'),
          isBlockquote: editor.isActive('blockquote'),
          isCodeBlock: editor.isActive('codeBlock'),
          heading: editor.isActive('heading', { level: 1 })
            ? 1
            : editor.isActive('heading', { level: 2 })
              ? 2
              : editor.isActive('heading', { level: 3 })
                ? 3
                : 0,
        });
      },
      onFocus: () => {
        postToSwift('focused');
      },
      onBlur: () => {
        postToSwift('blurred');
      },
    });

    postToSwift('ready');
    return true;
  },

  /**
   * Load content from a Yjs document state (base64 encoded)
   */
  loadFromYjs(noteId: string, stateBase64: string) {
    if (!editor) {
      postToSwift('error', { message: 'Editor not initialized' });
      return false;
    }

    try {
      currentNoteId = noteId;
      ydoc = new Y.Doc();

      // Decode and apply the state
      const binaryString = atob(stateBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      Y.applyUpdate(ydoc, bytes);

      // Get the content fragment and convert to ProseMirror
      const content = ydoc.getXmlFragment('content');
      const node = yXmlFragmentToProseMirrorRootNode(content, editor.schema);

      // Set content in editor
      editor.commands.setContent(node.toJSON());

      postToSwift('loaded', { noteId });
      return true;
    } catch (error) {
      postToSwift('error', {
        message: `Failed to load: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
      return false;
    }
  },

  /**
   * Load content from HTML
   */
  loadFromHTML(noteId: string, html: string) {
    if (!editor) {
      postToSwift('error', { message: 'Editor not initialized' });
      return false;
    }

    currentNoteId = noteId;
    editor.commands.setContent(html);
    postToSwift('loaded', { noteId });
    return true;
  },

  /**
   * Create a new empty document
   */
  newDocument(noteId: string) {
    if (!editor) {
      postToSwift('error', { message: 'Editor not initialized' });
      return false;
    }

    currentNoteId = noteId;
    ydoc = new Y.Doc();
    editor.commands.clearContent();
    postToSwift('loaded', { noteId });
    return true;
  },

  /**
   * Get the current Yjs state as base64
   */
  getYjsState(): string | null {
    if (!ydoc) return null;
    const state = Y.encodeStateAsUpdate(ydoc);
    let binary = '';
    for (let i = 0; i < state.length; i++) {
      binary += String.fromCharCode(state[i]);
    }
    return btoa(binary);
  },

  /**
   * Get current content as HTML
   */
  getHTML(): string {
    return editor?.getHTML() || '';
  },

  /**
   * Get current content as JSON
   */
  getJSON(): object {
    return editor?.getJSON() || {};
  },

  // MARK: - Formatting Commands

  toggleBold() {
    editor?.chain().focus().toggleBold().run();
  },

  toggleItalic() {
    editor?.chain().focus().toggleItalic().run();
  },

  toggleUnderline() {
    editor?.chain().focus().toggleUnderline().run();
  },

  toggleStrike() {
    editor?.chain().focus().toggleStrike().run();
  },

  toggleCode() {
    editor?.chain().focus().toggleCode().run();
  },

  toggleHeading(level: 1 | 2 | 3) {
    editor?.chain().focus().toggleHeading({ level }).run();
  },

  setParagraph() {
    editor?.chain().focus().setParagraph().run();
  },

  toggleBulletList() {
    editor?.chain().focus().toggleBulletList().run();
  },

  toggleOrderedList() {
    editor?.chain().focus().toggleOrderedList().run();
  },

  toggleTaskList() {
    editor?.chain().focus().toggleTaskList().run();
  },

  toggleBlockquote() {
    editor?.chain().focus().toggleBlockquote().run();
  },

  toggleCodeBlock() {
    editor?.chain().focus().toggleCodeBlock().run();
  },

  setHorizontalRule() {
    editor?.chain().focus().setHorizontalRule().run();
  },

  // MARK: - Link Commands

  setLink(url: string) {
    editor?.chain().focus().setLink({ href: url }).run();
  },

  unsetLink() {
    editor?.chain().focus().unsetLink().run();
  },

  // MARK: - Image Commands

  insertImage(src: string, alt?: string) {
    editor?.chain().focus().setImage({ src, alt }).run();
  },

  // MARK: - Table Commands

  insertTable(rows: number = 3, cols: number = 3) {
    editor?.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run();
  },

  addRowBefore() {
    editor?.chain().focus().addRowBefore().run();
  },

  addRowAfter() {
    editor?.chain().focus().addRowAfter().run();
  },

  addColumnBefore() {
    editor?.chain().focus().addColumnBefore().run();
  },

  addColumnAfter() {
    editor?.chain().focus().addColumnAfter().run();
  },

  deleteRow() {
    editor?.chain().focus().deleteRow().run();
  },

  deleteColumn() {
    editor?.chain().focus().deleteColumn().run();
  },

  deleteTable() {
    editor?.chain().focus().deleteTable().run();
  },

  // MARK: - History

  undo() {
    editor?.chain().focus().undo().run();
  },

  redo() {
    editor?.chain().focus().redo().run();
  },

  // MARK: - Focus

  focus() {
    editor?.commands.focus();
  },

  blur() {
    editor?.commands.blur();
  },

  // MARK: - Cleanup

  destroy() {
    editor?.destroy();
    editor = null;
    ydoc = null;
    currentNoteId = null;
  },
};

// Export to window for Swift access
window.NoteCoveEditor = NoteCoveEditor;

export default NoteCoveEditor;
