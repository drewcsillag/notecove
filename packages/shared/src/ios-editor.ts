/**
 * iOS Editor Bridge
 *
 * Standalone TipTap editor for iOS WKWebView.
 * Communicates with Swift via webkit.messageHandlers.
 */

import { Editor, Node, mergeAttributes } from '@tiptap/core';
import { StarterKit } from '@tiptap/starter-kit';
import { Underline } from '@tiptap/extension-underline';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { Link } from '@tiptap/extension-link';
import { Placeholder } from '@tiptap/extension-placeholder';
import * as Y from 'yjs';

/**
 * NotecoveImage - iOS TipTap Image Extension
 *
 * A simplified block node for displaying images stored in sync directories.
 * Images are loaded via the notecove:// URL scheme which is handled by Swift's WKURLSchemeHandler.
 */

interface NotecoveImageAttrs {
  imageId: string | null;
  sdId: string | null;
  alt: string;
  caption: string;
  width: string | null;
  linkHref: string | null;
}

// Extend TipTap's Commands interface
declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    notecoveImage: {
      insertNotecoveImage: (attrs: Partial<NotecoveImageAttrs>) => ReturnType;
    };
  }
}

const NotecoveImage = Node.create({
  name: 'notecoveImage',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      imageId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-image-id'),
        renderHTML: (attributes: NotecoveImageAttrs) => {
          if (!attributes.imageId) return {};
          return { 'data-image-id': attributes.imageId };
        },
      },
      sdId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-sd-id'),
        renderHTML: (attributes: NotecoveImageAttrs) => {
          if (!attributes.sdId) return {};
          return { 'data-sd-id': attributes.sdId };
        },
      },
      alt: {
        default: '',
        parseHTML: (element) => {
          const img = element.querySelector('img');
          return img?.getAttribute('alt') ?? '';
        },
        renderHTML: () => ({}),
      },
      caption: {
        default: '',
        parseHTML: (element) => {
          const figcaption = element.querySelector('figcaption');
          return figcaption?.textContent ?? '';
        },
        renderHTML: () => ({}),
      },
      width: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-width'),
        renderHTML: (attributes: NotecoveImageAttrs) => {
          if (!attributes.width) return {};
          return { 'data-width': attributes.width };
        },
      },
      linkHref: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-link-href'),
        renderHTML: (attributes: NotecoveImageAttrs) => {
          if (!attributes.linkHref) return {};
          return { 'data-link-href': attributes.linkHref };
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: 'figure.notecove-image' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    // Access attributes from node.attrs, not HTMLAttributes (which contains rendered HTML attrs)
    const { imageId, sdId, alt, caption, width } = node.attrs as NotecoveImageAttrs;

    // Build the image src using the notecove:// scheme
    const src = imageId && sdId ? `notecove://image/${sdId}/${imageId}` : '';
    console.log(`[NotecoveImage] renderHTML: imageId=${imageId}, sdId=${sdId}, src=${src}`);

    // Build style for width
    const imgStyle = width ? `width: ${width}` : '';

    return [
      'figure',
      mergeAttributes(HTMLAttributes, { class: 'notecove-image' }),
      ['img', { src, alt, style: imgStyle, class: 'notecove-image-element' }],
      caption ? ['figcaption', {}, caption] : ['figcaption', { style: 'display: none' }],
    ];
  },

  addCommands() {
    return {
      insertNotecoveImage:
        (attrs) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs,
          });
        },
    };
  },
});
import { yXmlFragmentToProseMirrorRootNode, prosemirrorJSONToYXmlFragment } from 'y-prosemirror';

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
let originalStateVector: Uint8Array | null = null; // Track original state for delta encoding

// Auto-save debounce timer
let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
const AUTO_SAVE_DELAY_MS = 5000; // 5 seconds debounce
let isLoadingNote = false; // Flag to prevent auto-save during note loading

/**
 * Cancel any pending auto-save timer
 */
function cancelAutoSave() {
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = null;
  }
}

/**
 * Perform an auto-save: sync editor content to Y.Doc and send update to Swift
 */
function performAutoSave() {
  if (!editor || !ydoc || !currentNoteId) return;

  try {
    // Get the content fragment from the existing ydoc
    const content = ydoc.getXmlFragment('content');

    // Clear existing content and replace with current editor state
    ydoc.transact(() => {
      content.delete(0, content.length);
      const json = editor!.getJSON();
      prosemirrorJSONToYXmlFragment(editor!.schema, json, content);
    });

    // Encode the delta since the original state
    const update = originalStateVector
      ? Y.encodeStateAsUpdate(ydoc, originalStateVector)
      : Y.encodeStateAsUpdate(ydoc);

    // Check if there's actually anything to save (update might be empty)
    if (update.length <= 2) {
      // Empty updates are typically just 2 bytes (state vector header)
      return;
    }

    let binary = '';
    for (let i = 0; i < update.length; i++) {
      binary += String.fromCharCode(update[i]);
    }
    const updateBase64 = btoa(binary);

    // Update the state vector for next save
    originalStateVector = Y.encodeStateVector(ydoc);

    // Send to Swift for persistence
    postToSwift('autoSave', { noteId: currentNoteId, updateBase64 });
  } catch (error) {
    console.error('[ios-editor] Auto-save error:', error);
  }
}

/**
 * Schedule an auto-save with debouncing
 */
function scheduleAutoSave() {
  // Don't schedule during note loading
  if (isLoadingNote) return;

  // Cancel any existing timer
  cancelAutoSave();

  // Schedule new auto-save
  autoSaveTimer = setTimeout(() => {
    autoSaveTimer = null;
    performAutoSave();
  }, AUTO_SAVE_DELAY_MS);
}

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
        NotecoveImage,
        Placeholder.configure({
          placeholder: 'Start writing...',
        }),
      ],
      editorProps: {
        attributes: {
          class: 'prose prose-sm sm:prose focus:outline-none',
        },
        handlePaste: (view, event) => {
          // Check for pasted images
          const items = event.clipboardData?.items;
          if (!items) return false;

          for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.type.startsWith('image/')) {
              // Get the image as a blob
              const blob = item.getAsFile();
              if (blob) {
                event.preventDefault();
                // Read as base64 and send to Swift for storage
                const reader = new FileReader();
                reader.onload = () => {
                  const base64 = (reader.result as string).split(',')[1];
                  const mimeType = blob.type;
                  postToSwift('imagePasted', { base64, mimeType });
                };
                reader.readAsDataURL(blob);
                return true;
              }
            }
          }
          return false;
        },
      },
      onUpdate: ({ editor }) => {
        // Notify Swift of content changes
        postToSwift('contentChanged', {
          noteId: currentNoteId,
          html: editor.getHTML(),
          json: editor.getJSON(),
        });

        // Schedule auto-save (debounced)
        scheduleAutoSave();
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

    // Cancel any pending auto-save from previous note
    cancelAutoSave();
    isLoadingNote = true;

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

      // Capture the state vector AFTER loading - this is our baseline for delta encoding
      originalStateVector = Y.encodeStateVector(ydoc);

      // Get the content fragment and convert to ProseMirror
      const content = ydoc.getXmlFragment('content');
      const node = yXmlFragmentToProseMirrorRootNode(content, editor.schema);

      // Set content in editor
      editor.commands.setContent(node.toJSON());

      // Allow auto-saves now that loading is complete
      isLoadingNote = false;

      postToSwift('loaded', { noteId });
      return true;
    } catch (error) {
      isLoadingNote = false;
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

    // Cancel any pending auto-save from previous note
    cancelAutoSave();
    isLoadingNote = true;

    currentNoteId = noteId;
    ydoc = new Y.Doc();
    // For new documents, the original state is empty
    originalStateVector = Y.encodeStateVector(ydoc);
    editor.commands.clearContent();

    // Allow auto-saves now
    isLoadingNote = false;

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
   * Sync editor content back to Yjs and return the update as base64.
   *
   * This method properly handles CRDT updates by:
   * 1. Clearing the existing ydoc content
   * 2. Converting the current editor state to the ydoc
   * 3. Encoding only the DELTA since the original state (not full state)
   *
   * This ensures that when merged with other devices' updates, content
   * isn't duplicated.
   *
   * Returns null if editor is not initialized.
   */
  syncAndGetUpdate(): string | null {
    // Cancel any pending auto-save since we're saving now
    cancelAutoSave();

    if (!editor || !ydoc) return null;

    try {
      // Get the content fragment from the existing ydoc
      const content = ydoc.getXmlFragment('content');

      // Clear existing content and replace with current editor state
      // We do this in a transaction so it's a single update
      ydoc.transact(() => {
        // Delete all existing content
        content.delete(0, content.length);

        // Convert current ProseMirror content to Y.XmlFragment
        const json = editor!.getJSON();
        prosemirrorJSONToYXmlFragment(editor!.schema, json, content);
      });

      // Encode the delta since the original state (not the full state!)
      // This ensures we only send what changed, not duplicate existing content
      const update = originalStateVector
        ? Y.encodeStateAsUpdate(ydoc, originalStateVector)
        : Y.encodeStateAsUpdate(ydoc);

      let binary = '';
      for (let i = 0; i < update.length; i++) {
        binary += String.fromCharCode(update[i]);
      }

      // Update the state vector for next save
      originalStateVector = Y.encodeStateVector(ydoc);

      postToSwift('synced', { noteId: currentNoteId });
      return btoa(binary);
    } catch (error) {
      postToSwift('error', {
        message: `Failed to sync: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
      return null;
    }
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

  /**
   * Insert a NoteCove image at the current cursor position.
   * Used when user selects an image from photo library or pastes from clipboard.
   */
  insertNotecoveImage(imageId: string, sdId: string, alt?: string) {
    console.log(`[NoteCoveEditor] insertNotecoveImage called: imageId=${imageId}, sdId=${sdId}`);
    if (!editor) {
      console.error('[NoteCoveEditor] insertNotecoveImage: editor not initialized');
      return;
    }
    editor
      ?.chain()
      .focus()
      .insertNotecoveImage({ imageId, sdId, alt: alt || '' })
      .run();
    // Log the DOM after insertion
    setTimeout(() => {
      const imgs = document.querySelectorAll('.notecove-image img');
      console.log(`[NoteCoveEditor] After insertion: found ${imgs.length} images`);
      imgs.forEach((img, i) => {
        const imgEl = img as HTMLImageElement;
        console.log(
          `[NoteCoveEditor] Image ${i}: src=${imgEl.src}, complete=${imgEl.complete}, naturalWidth=${imgEl.naturalWidth}`
        );
      });
    }, 100);
    postToSwift('imageInserted', { imageId, sdId });
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
    cancelAutoSave();
    editor?.destroy();
    editor = null;
    ydoc = null;
    currentNoteId = null;
    isLoadingNote = false;
  },
};

// Export to window for Swift access
window.NoteCoveEditor = NoteCoveEditor;

export default NoteCoveEditor;
