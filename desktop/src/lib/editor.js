import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import { generateUUID, debounce } from './utils.js';
import { Hashtag } from './extensions/hashtag.js';
import { TaskList } from './extensions/task-list.js';
import { TaskItem } from './extensions/task-item.js';
import { initTableResizing } from './table-resize.js';

/**
 * NoteCove rich text editor wrapper around TipTap
 */
export class NoteCoveEditor {
  constructor(element, options = {}) {
    this.element = element;
    this.options = {
      autofocus: true,
      placeholder: 'Start writing...',
      onUpdate: () => {},
      onFocus: () => {},
      onBlur: () => {},
      ...options
    };

    this.currentNote = null;
    this.isReady = false;
    this.cleanupTableResizing = null;

    this.initializeEditor();
  }

  initializeEditor() {
    this.editor = new Editor({
      element: this.element,
      extensions: [
        StarterKit.configure({
          heading: {
            levels: [1, 2, 3]
          },
          bulletList: {
            keepMarks: true,
            keepAttributes: false
          },
          orderedList: {
            keepMarks: true,
            keepAttributes: false
          }
        }),
        Hashtag,
        TaskList,
        TaskItem.configure({
          nested: true,
        }),
        Image.configure({
          inline: true,
          allowBase64: true,
        }),
        Table.configure({
          resizable: true,
          HTMLAttributes: {
            class: 'editor-table',
          },
        }),
        TableRow,
        TableHeader,
        TableCell.configure({
          HTMLAttributes: {
            class: 'editor-table-cell',
          },
        }),
      ],
      content: '',
      autofocus: this.options.autofocus,
      editable: true,
      injectCSS: false,
      onUpdate: ({ editor }) => {
        this.handleUpdate(editor);
      },
      onFocus: ({ editor }) => {
        this.options.onFocus(editor);
      },
      onBlur: ({ editor }) => {
        this.options.onBlur(editor);
      },
      onCreate: () => {
        this.isReady = true;
        this.updatePlaceholder();

        // Initialize table column resizing
        this.cleanupTableResizing = initTableResizing(this.element);

        // Setup paste image handling
        this.setupPasteHandler();
      }
    });

    // Debounced update handler to avoid excessive saves
    this.debouncedUpdate = debounce((editor) => {
      this.options.onUpdate(editor);
    }, 1000); // Increased debounce time to reduce flickering
  }

  handleUpdate(editor) {
    this.updatePlaceholder();
    this.debouncedUpdate(editor);
  }

  updatePlaceholder() {
    const isEmpty = this.editor.isEmpty;
    const element = this.editor.view.dom;

    if (isEmpty && !element.classList.contains('is-empty')) {
      element.classList.add('is-empty');
      element.setAttribute('data-placeholder', this.options.placeholder);
    } else if (!isEmpty && element.classList.contains('is-empty')) {
      element.classList.remove('is-empty');
      element.removeAttribute('data-placeholder');
    }
  }

  /**
   * Set the content of the editor
   * @param {string} content - HTML content
   */
  setContent(content) {
    if (this.isReady) {
      this.editor.commands.setContent(content || '');
      this.updatePlaceholder();
    }
  }

  /**
   * Get the current content as HTML
   * @returns {string} HTML content
   */
  getContent() {
    return this.isReady ? this.editor.getHTML() : '';
  }

  /**
   * Get the current content as plain text
   * @returns {string} Plain text content
   */
  getText() {
    return this.isReady ? this.editor.getText() : '';
  }

  /**
   * Focus the editor
   */
  focus() {
    if (this.isReady) {
      this.editor.commands.focus();
    }
  }

  /**
   * Check if the editor has focus
   * @returns {boolean}
   */
  isFocused() {
    return this.isReady ? this.editor.isFocused : false;
  }

  /**
   * Check if editor is empty
   * @returns {boolean}
   */
  isEmpty() {
    return this.isReady ? this.editor.isEmpty : true;
  }

  /**
   * Insert text at current position
   * @param {string} text
   */
  insertText(text) {
    if (this.isReady) {
      this.editor.commands.insertContent(text);
    }
  }

  /**
   * Format text commands
   */
  bold() {
    if (this.isReady) {
      this.editor.chain().focus().toggleBold().run();
    }
  }

  italic() {
    if (this.isReady) {
      this.editor.chain().focus().toggleItalic().run();
    }
  }

  heading(level = 1) {
    if (this.isReady) {
      this.editor.chain().focus().toggleHeading({ level }).run();
    }
  }

  bulletList() {
    if (this.isReady) {
      this.editor.chain().focus().toggleBulletList().run();
    }
  }

  orderedList() {
    if (this.isReady) {
      this.editor.chain().focus().toggleOrderedList().run();
    }
  }

  /**
   * Get formatting state
   */
  getFormatState() {
    if (!this.isReady) return {};

    return {
      isBold: this.editor.isActive('bold'),
      isItalic: this.editor.isActive('italic'),
      isHeading1: this.editor.isActive('heading', { level: 1 }),
      isHeading2: this.editor.isActive('heading', { level: 2 }),
      isHeading3: this.editor.isActive('heading', { level: 3 }),
      isBulletList: this.editor.isActive('bulletList'),
      isOrderedList: this.editor.isActive('orderedList')
    };
  }

  /**
   * Setup toolbar with formatting buttons
   */
  setupToolbar() {
    const toolbar = document.getElementById('editorToolbar');
    if (!toolbar) return;

    // Add click handlers to toolbar buttons
    toolbar.addEventListener('click', (e) => {
      const button = e.target.closest('.toolbar-btn');
      if (!button) return;

      const action = button.dataset.action;
      this.executeToolbarAction(action);
    });

    // Update toolbar button states on selection change
    if (this.editor) {
      this.editor.on('selectionUpdate', () => {
        this.updateToolbarState();
      });
    }
  }

  /**
   * Execute toolbar action
   */
  executeToolbarAction(action) {
    if (!this.editor) return;

    const actions = {
      bold: () => this.editor.chain().focus().toggleBold().run(),
      italic: () => this.editor.chain().focus().toggleItalic().run(),
      strike: () => this.editor.chain().focus().toggleStrike().run(),
      heading1: () => this.editor.chain().focus().toggleHeading({ level: 1 }).run(),
      heading2: () => this.editor.chain().focus().toggleHeading({ level: 2 }).run(),
      heading3: () => this.editor.chain().focus().toggleHeading({ level: 3 }).run(),
      bulletList: () => this.editor.chain().focus().toggleBulletList().run(),
      orderedList: () => this.editor.chain().focus().toggleOrderedList().run(),
      taskList: () => this.editor.chain().focus().toggleTaskList().run(),
      insertImage: () => this.insertImage(),
      insertTable: () => this.editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
      undo: () => this.editor.chain().focus().undo().run(),
      redo: () => this.editor.chain().focus().redo().run(),
    };

    if (actions[action]) {
      actions[action]();
    }
  }

  /**
   * Setup paste event handler for images
   */
  setupPasteHandler() {
    if (!this.element) return;

    this.element.addEventListener('paste', async (event) => {
      const items = event.clipboardData?.items;
      if (!items) return;

      // Check if there's an image in the clipboard
      for (const item of items) {
        if (item.type.indexOf('image') !== -1) {
          event.preventDefault();

          const file = item.getAsFile();
          if (!file) continue;

          // Convert to base64
          const reader = new FileReader();
          reader.onload = (e) => {
            const base64 = e.target.result;
            this.editor.chain().focus().setImage({ src: base64 }).run();
          };
          reader.readAsDataURL(file);
          break;
        }
      }
    });
  }

  /**
   * Insert an image using file picker
   */
  async insertImage() {
    // Create a hidden file input
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';

    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      // Convert to base64
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target.result;
        this.editor.chain().focus().setImage({ src: base64 }).run();
      };
      reader.readAsDataURL(file);
    };

    input.click();
  }

  /**
   * Update toolbar button active states
   */
  updateToolbarState() {
    if (!this.editor) return;

    const toolbar = document.getElementById('editorToolbar');
    if (!toolbar) return;

    const states = {
      bold: this.editor.isActive('bold'),
      italic: this.editor.isActive('italic'),
      strike: this.editor.isActive('strike'),
      heading1: this.editor.isActive('heading', { level: 1 }),
      heading2: this.editor.isActive('heading', { level: 2 }),
      heading3: this.editor.isActive('heading', { level: 3 }),
      bulletList: this.editor.isActive('bulletList'),
      orderedList: this.editor.isActive('orderedList'),
      taskList: this.editor.isActive('taskList'),
    };

    Object.keys(states).forEach(action => {
      const button = toolbar.querySelector(`[data-action="${action}"]`);
      if (button) {
        button.classList.toggle('active', states[action]);
      }
    });
  }

  /**
   * Destroy the editor
   */
  destroy() {
    // Cleanup table resizing
    if (this.cleanupTableResizing) {
      this.cleanupTableResizing();
      this.cleanupTableResizing = null;
    }

    if (this.editor) {
      this.editor.destroy();
    }
  }
}