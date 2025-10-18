import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Collaboration from '@tiptap/extension-collaboration';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import * as Y from 'yjs';
import { debounce } from './utils';
import { Hashtag } from './extensions/hashtag';
import { TaskList } from './extensions/task-list';
import { TaskItem } from './extensions/task-item';
import { ResizableImage } from './extensions/resizable-image';
import { NoteLink } from './extensions/note-link';
import { initTableResizing } from './table-resize';
import type { AttachmentManager } from './attachment-manager';

export interface NoteCoveEditorOptions {
  autofocus?: boolean;
  placeholder?: string;
  onUpdate?: (editor: Editor) => void;
  onFocus?: (editor: Editor) => void;
  onBlur?: (editor: Editor) => void;
  onReady?: () => void;
  isSettingContent?: () => boolean;
  yDoc?: Y.Doc | null;
  onNavigateToNote?: (noteId: string | null, noteTitle: string) => void;
  onFindNoteByTitle?: (title: string) => { id: string; title: string } | null;
  onValidateNoteLink?: (noteId: string | null, title: string) => boolean;
  onSearchNotes?: (query: string) => { id: string; title: string }[];
  attachmentManager?: AttachmentManager;
}

interface FormatState {
  isBold: boolean;
  isItalic: boolean;
  isHeading1: boolean;
  isHeading2: boolean;
  isHeading3: boolean;
  isBulletList: boolean;
  isOrderedList: boolean;
}

interface ToolbarStates {
  bold: boolean;
  italic: boolean;
  strike: boolean;
  heading1: boolean;
  heading2: boolean;
  heading3: boolean;
  bulletList: boolean;
  orderedList: boolean;
  taskList: boolean;
}

type ToolbarAction =
  | 'bold'
  | 'italic'
  | 'strike'
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'bulletList'
  | 'orderedList'
  | 'taskList'
  | 'insertImage'
  | 'insertTable'
  | 'undo'
  | 'redo';

/**
 * NoteCove rich text editor wrapper around TipTap
 */
export class NoteCoveEditor {
  private element: HTMLElement;
  private options: Required<NoteCoveEditorOptions>;
  private currentNoteId: string | null;
  private isReady: boolean;
  private cleanupTableResizing: (() => void) | null;
  private yDoc: Y.Doc | null;
  private editor!: Editor;
  private debouncedUpdate!: (editor: Editor, noteId: string | null) => void;
  private _isBindingDocument: boolean;

  constructor(element: HTMLElement, options: NoteCoveEditorOptions = {}) {
    this.element = element;
    this.options = {
      autofocus: true,
      placeholder: 'Start writing...',
      onUpdate: () => {},
      onFocus: () => {},
      onBlur: () => {},
      onReady: () => {}, // Called when editor is fully initialized
      isSettingContent: () => false,
      yDoc: null,
      onNavigateToNote: () => {},
      onFindNoteByTitle: () => null,
      onValidateNoteLink: () => true,
      ...options
    };

    this.currentNoteId = null; // Track which note we're editing
    this.isReady = false;
    this.cleanupTableResizing = null;
    this._isBindingDocument = false;

    // Y.Doc for CRDT-based collaboration (Electron mode)
    this.yDoc = options.yDoc || null;

    this.initializeEditor();
  }

  private initializeEditor(): void {
    // Build extensions array
    const extensions = [
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
      NoteLink.configure({
        onNavigate: (noteId: string | null, title: string) => {
          this.options.onNavigateToNote(noteId, title);
        },
        findNoteByTitle: (title: string) => {
          return this.options.onFindNoteByTitle(title);
        },
        validateNoteLink: (noteId: string | null, title: string) => {
          return this.options.onValidateNoteLink(noteId, title);
        },
        searchNotes: this.options.onSearchNotes ? (query: string) => {
          return this.options.onSearchNotes!(query);
        } : undefined,
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      ResizableImage.configure({
        inline: true,
        allowBase64: true,
        attachmentManager: this.options.attachmentManager,
        currentNoteId: () => this.currentNoteId,
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
    ];

    // Add Collaboration extension if we have a Y.Doc (Electron mode)
    if (this.yDoc) {
      extensions.push(
        Collaboration.configure({
          document: this.yDoc,
          field: 'default' // Use 'default' fragment name to match CRDTManager
        })
      );
    }

    this.editor = new Editor({
      element: this.element,
      extensions,
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

        // Initialize H1 structure for new empty notes
        this.initializeNewNoteStructure();

        // Clear binding flag after debounce period to allow initial sync
        if (this._isBindingDocument) {
          setTimeout(() => {
            this._isBindingDocument = false;
            // Notify that editor is fully ready
            this.options.onReady();
          }, 300); // Longer than debounce (250ms)
        } else {
          // If not binding, call onReady immediately
          this.options.onReady();
        }
      }
    });

    // Debounced update handler to avoid excessive saves
    // Note: We pass the noteId to verify we're still on the same note when the update fires
    this.debouncedUpdate = debounce((editor: Editor, noteId: string | null) => {
      // Only trigger update if we're still on the same note
      if (noteId === this.currentNoteId) {
        this.options.onUpdate(editor);
      }
      // Silently skip if note has changed
    }, 250); // Reduced to 250ms for faster saves
  }

  private handleUpdate(editor: Editor): void {
    this.updatePlaceholder();

    // Don't queue updates if we're binding a new document
    if (this._isBindingDocument) {
      return;
    }

    // Don't queue updates if we're programmatically setting content
    // This prevents debounced updates from firing after isSettingContent becomes false
    if (this.options.isSettingContent && this.options.isSettingContent()) {
      return;
    }

    // Pass the current note ID to the debounced update so it can verify
    // the note hasn't changed before applying the update
    this.debouncedUpdate(editor, this.currentNoteId);
  }

  private updatePlaceholder(): void {
    const isEmpty = this.editor.isEmpty;
    const element = this.editor.view.dom as HTMLElement;

    if (isEmpty && !element.classList.contains('is-empty')) {
      element.classList.add('is-empty');
      element.setAttribute('data-placeholder', this.options.placeholder);
    } else if (!isEmpty && element.classList.contains('is-empty')) {
      element.classList.remove('is-empty');
      element.removeAttribute('data-placeholder');
    }
  }

  /**
   * Initialize H1 structure for new empty notes
   * This runs when the editor is created, and if the document is completely empty,
   * it inserts an H1 heading followed by a paragraph
   */
  private initializeNewNoteStructure(): void {
    console.log('[Editor] initializeNewNoteStructure called - isBindingDocument:', this._isBindingDocument, 'isEmpty:', this.editor?.isEmpty);

    // Don't initialize if we're binding to an existing Y.Doc
    // The Collaboration extension will load content from the Y.Doc asynchronously
    if (this._isBindingDocument) {
      console.log('[Editor] Skipping initialization because we are binding to existing Y.Doc');
      return;
    }

    // Only initialize if document is completely empty
    if (!this.editor.isEmpty) {
      console.log('[Editor] Skipping initialization because editor is not empty');
      return;
    }

    console.log('[Editor] Initializing new note structure with <h1></h1><p></p>');
    // Insert H1 for title, followed by paragraph for body
    this.editor.commands.setContent('<h1></h1><p></p>');

    // Focus on the H1
    this.editor.commands.focus('start');
  }

  /**
   * Switch to a new Y.Doc (for CRDT mode when changing notes)
   * @param yDoc - New Y.Doc to bind to
   * @param noteId - ID of the note being loaded
   */
  setDocument(yDoc: Y.Doc, noteId: string): void {
    if (!yDoc) {
      console.error('setDocument called with null yDoc');
      return;
    }

    // DEBUG: Log the OLD Y.Doc before we switch
    if (this.yDoc && this.currentNoteId) {
      const oldYContent = this.yDoc.getXmlFragment('default');
      console.log(`[Editor] setDocument - OLD Y.Doc (${this.currentNoteId}) before destroy:`, {
        length: oldYContent.length,
        hasImage: oldYContent.toString().includes('<image'),
        preview: oldYContent.toString().substring(0, 200)
      });
    }

    const oldYDoc = this.yDoc;
    const oldNoteId = this.currentNoteId;

    this.yDoc = yDoc;
    this.currentNoteId = noteId;

    console.log(`[Editor] setDocument - Switching from ${oldNoteId} to ${noteId}`);

    // DEBUG: Check NEW Y.Doc BEFORE binding to editor
    const newYContent = yDoc.getXmlFragment('default');
    console.log(`[Editor] setDocument - NEW Y.Doc (${noteId}) BEFORE editor binding:`, {
      length: newYContent.length,
      hasImage: newYContent.toString().includes('<image'),
      preview: newYContent.toString().substring(0, 300)
    });

    // Set flag to prevent updates during editor recreation
    this._isBindingDocument = true;

    // Need to destroy and recreate editor with new Y.Doc
    // TipTap Collaboration extension doesn't support changing documents dynamically
    if (this.editor) {
      console.log('[Editor] setDocument - About to destroy editor');
      this.editor.destroy();
      console.log('[Editor] setDocument - Editor destroyed');
    }

    // DEBUG: Check if OLD Y.Doc was corrupted during editor destruction
    if (oldYDoc && oldNoteId) {
      const oldYContent = oldYDoc.getXmlFragment('default');
      console.log(`[Editor] setDocument - OLD Y.Doc (${oldNoteId}) AFTER destroy:`, {
        length: oldYContent.length,
        hasImage: oldYContent.toString().includes('<image'),
        preview: oldYContent.toString().substring(0, 200)
      });
    }

    if (this.cleanupTableResizing) {
      this.cleanupTableResizing();
      this.cleanupTableResizing = null;
    }

    this.isReady = false;
    this.initializeEditor();

    // DEBUG: Check NEW Y.Doc AFTER editor initialization
    const newYContentAfter = yDoc.getXmlFragment('default');
    console.log(`[Editor] setDocument - NEW Y.Doc (${noteId}) AFTER editor binding:`, {
      length: newYContentAfter.length,
      hasImage: newYContentAfter.toString().includes('<image'),
      preview: newYContentAfter.toString().substring(0, 300)
    });
  }

  /**
   * Set the content of the editor (for non-CRDT mode)
   * @param content - HTML content
   * @param noteId - ID of the note being loaded (optional, for tracking)
   */
  setContent(content: string, noteId: string | null = null): void {
    if (this.isReady) {
      // Update the current note ID so we can track if it changes before debounced updates fire
      if (noteId) {
        this.currentNoteId = noteId;
      }

      // If content is empty or just a paragraph, initialize with H1 structure
      const trimmedContent = (content || '').trim();
      if (!trimmedContent || trimmedContent === '<p></p>' || trimmedContent === '<p><br></p>') {
        console.log('[Editor] setContent: Empty content, initializing with H1 structure');
        this.editor.commands.setContent('<h1></h1><p></p>');
        this.editor.commands.focus('start');
      } else {
        this.editor.commands.setContent(content || '');
      }

      this.updatePlaceholder();

      // Notify that editor is ready (in case renderer is waiting with isSettingContent flag)
      // This matches the behavior of setDocument() which calls onReady after binding
      this.options.onReady();
    }
  }

  /**
   * Get the current content as HTML
   * @returns HTML content
   */
  getContent(): string {
    return this.isReady ? this.editor.getHTML() : '';
  }

  /**
   * Get the current content as plain text
   * @returns Plain text content
   */
  getText(): string {
    return this.isReady ? this.editor.getText() : '';
  }

  /**
   * Focus the editor
   */
  focus(): void {
    if (this.isReady) {
      this.editor.commands.focus();
    }
  }

  /**
   * Check if the editor has focus
   * @returns boolean
   */
  isFocused(): boolean {
    return this.isReady ? this.editor.isFocused : false;
  }

  /**
   * Check if editor is empty
   * @returns boolean
   */
  isEmpty(): boolean {
    return this.isReady ? this.editor.isEmpty : true;
  }

  /**
   * Insert text at current position
   * @param text - Text to insert
   */
  insertText(text: string): void {
    if (this.isReady) {
      this.editor.commands.insertContent(text);
    }
  }

  /**
   * Format text commands
   */
  bold(): void {
    if (this.isReady) {
      this.editor.chain().focus().toggleBold().run();
    }
  }

  italic(): void {
    if (this.isReady) {
      this.editor.chain().focus().toggleItalic().run();
    }
  }

  heading(level: 1 | 2 | 3 = 1): void {
    if (this.isReady) {
      this.editor.chain().focus().toggleHeading({ level }).run();
    }
  }

  bulletList(): void {
    if (this.isReady) {
      this.editor.chain().focus().toggleBulletList().run();
    }
  }

  orderedList(): void {
    if (this.isReady) {
      this.editor.chain().focus().toggleOrderedList().run();
    }
  }

  /**
   * Get formatting state
   */
  getFormatState(): FormatState {
    if (!this.isReady) {
      return {
        isBold: false,
        isItalic: false,
        isHeading1: false,
        isHeading2: false,
        isHeading3: false,
        isBulletList: false,
        isOrderedList: false
      };
    }

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
  setupToolbar(): void {
    const toolbar = document.getElementById('editorToolbar');
    if (!toolbar) return;

    // Add click handlers to toolbar buttons
    toolbar.addEventListener('click', (e: MouseEvent) => {
      const button = (e.target as HTMLElement).closest('.toolbar-btn') as HTMLElement;
      if (!button) return;

      const action = button.dataset.action as ToolbarAction;
      this.executeToolbarAction(action);
    });

    // Create throttled version of updateToolbarState to avoid excessive calls
    let toolbarUpdateTimeout: NodeJS.Timeout | null = null;
    const throttledUpdateToolbar = () => {
      if (toolbarUpdateTimeout) return; // Skip if already scheduled
      toolbarUpdateTimeout = setTimeout(() => {
        this.updateToolbarState();
        toolbarUpdateTimeout = null;
      }, 50); // Update at most every 50ms
    };

    // Update toolbar button states on selection change and content updates
    // We listen to both events because:
    // - selectionUpdate: Fires when selection changes (e.g., clicking in text)
    // - update: Fires for all editor changes including keyboard shortcuts
    // We throttle updates to avoid excessive calls during rapid changes
    if (this.editor) {
      this.editor.on('selectionUpdate', throttledUpdateToolbar);
      this.editor.on('update', throttledUpdateToolbar);
    }
  }

  /**
   * Execute toolbar action
   */
  private executeToolbarAction(action: ToolbarAction): void {
    if (!this.editor) return;

    const actions: Record<ToolbarAction, () => void> = {
      bold: () => this.editor.chain().focus().toggleBold().run(),
      italic: () => this.editor.chain().focus().toggleItalic().run(),
      strike: () => this.editor.chain().focus().toggleStrike().run(),
      heading1: () => this.editor.chain().focus().toggleHeading({ level: 1 }).run(),
      heading2: () => this.editor.chain().focus().toggleHeading({ level: 2 }).run(),
      heading3: () => this.editor.chain().focus().toggleHeading({ level: 3 }).run(),
      bulletList: () => this.editor.chain().focus().toggleBulletList().run(),
      orderedList: () => this.editor.chain().focus().toggleOrderedList().run(),
      taskList: () => (this.editor.chain().focus() as any).toggleTaskList().run(),
      insertImage: () => this.insertImage(),
      insertTable: () => this.editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
      undo: () => this.editor.chain().focus().undo().run(),
      redo: () => this.editor.chain().focus().redo().run(),
    };

    if (actions[action]) {
      actions[action]();
      // Update toolbar state immediately after action to ensure UI reflects changes
      // This is needed because selectionUpdate event may not fire reliably for all actions
      setTimeout(() => this.updateToolbarState(), 0);
    }
  }

  /**
   * Setup paste event handler for images
   */
  private setupPasteHandler(): void {
    if (!this.element) return;

    this.element.addEventListener('paste', async (event: ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items) return;

      // Check if there's an image in the clipboard
      // Convert DataTransferItemList to array for iteration
      const itemsArray = Array.from(items);
      for (const item of itemsArray) {
        if (item.type.indexOf('image') !== -1) {
          event.preventDefault();

          const file = item.getAsFile();
          if (!file) continue;

          // In Electron mode with AttachmentManager, save as attachment
          if (this.options.attachmentManager && this.currentNoteId) {
            try {
              // Read file as Uint8Array (browser-compatible)
              const arrayBuffer = await file.arrayBuffer();
              const uint8Array = new Uint8Array(arrayBuffer);

              // Save as attachment
              const attachment = await this.options.attachmentManager.saveAttachment(
                this.currentNoteId,
                file.name || `pasted-image-${Date.now()}.png`,
                uint8Array
              );

              console.log('[Editor] Saved pasted image as attachment:', attachment.id);

              // Insert with attachment reference and explicit placeholder src
              // IMPORTANT: src is required by TipTap Image extension - Y.js won't apply defaults during sync
              this.editor.commands.insertContent({
                type: 'image',
                attrs: {
                  attachmentId: attachment.id,
                  src: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><rect fill="transparent" width="1" height="1"/></svg>'
                }
              });
            } catch (err) {
              console.error('[Editor] Failed to save pasted image as attachment:', err);
              // Fall back to base64 if attachment save fails
              const reader = new FileReader();
              reader.onload = (e: ProgressEvent<FileReader>) => {
                const base64 = e.target?.result as string;
                this.editor.commands.insertContent({
                  type: 'image',
                  attrs: {
                    src: base64
                  }
                });
              };
              reader.readAsDataURL(file);
            }
          } else {
            // Non-Electron mode or no attachment manager - use base64
            const reader = new FileReader();
            reader.onload = (e: ProgressEvent<FileReader>) => {
              const base64 = e.target?.result as string;
              this.editor.commands.insertContent({
                type: 'image',
                attrs: {
                  src: base64
                }
              });
            };
            reader.readAsDataURL(file);
          }
          break;
        }
      }
    });
  }

  /**
   * Insert an image using file picker
   */
  private async insertImage(): Promise<void> {
    // Create a hidden file input
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';

    input.onchange = async (e: Event) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      if (!file) return;

      // In Electron mode with AttachmentManager, save as attachment
      if (this.options.attachmentManager && this.currentNoteId) {
        try {
          // Read file as Uint8Array (browser-compatible)
          const arrayBuffer = await file.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);

          // Save as attachment
          const attachment = await this.options.attachmentManager.saveAttachment(
            this.currentNoteId,
            file.name,
            uint8Array
          );

          console.log('[Editor] Saved selected image as attachment:', attachment.id);

          // Insert with attachment reference and explicit placeholder src
          // IMPORTANT: src is required by TipTap Image extension - Y.js won't apply defaults during sync
          this.editor.commands.insertContent({
            type: 'image',
            attrs: {
              attachmentId: attachment.id,
              src: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><rect fill="transparent" width="1" height="1"/></svg>'
            }
          });
        } catch (err) {
          console.error('[Editor] Failed to save selected image as attachment:', err);
          // Fall back to base64 if attachment save fails
          const reader = new FileReader();
          reader.onload = (event: ProgressEvent<FileReader>) => {
            const base64 = event.target?.result as string;
            this.editor.commands.insertContent({
              type: 'image',
              attrs: {
                src: base64
              }
            });
          };
          reader.readAsDataURL(file);
        }
      } else {
        // Non-Electron mode or no attachment manager - use base64
        const reader = new FileReader();
        reader.onload = (event: ProgressEvent<FileReader>) => {
          const base64 = event.target?.result as string;
          this.editor.commands.insertContent({
            type: 'image',
            attrs: {
              src: base64
            }
          });
        };
        reader.readAsDataURL(file);
      }
    };

    input.click();
  }

  /**
   * Update toolbar button active states
   */
  private updateToolbarState(): void {
    if (!this.editor) return;

    const toolbar = document.getElementById('editorToolbar');
    if (!toolbar) return;

    const states: ToolbarStates = {
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
        button.classList.toggle('active', states[action as keyof ToolbarStates]);
      }
    });
  }

  /**
   * Destroy the editor
   */
  destroy(): void {
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
