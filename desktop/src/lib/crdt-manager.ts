/**
 * CRDT Manager - Handles conflict-free replication using Yjs
 * Integrates with TipTap's Collaboration extension for real-time editing
 * Uses append-only update files for robust multi-instance sync
 */
import * as Y from 'yjs';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import { Hashtag } from './extensions/hashtag';
import { TaskList } from './extensions/task-list';
import { TaskItem } from './extensions/task-item';
import { ResizableImage } from './extensions/resizable-image';
import type { Note } from './utils';

type UpdateHandler = (update: Uint8Array, origin: any) => void;
type CRDTListener = (event: string, data: any) => void;

interface CRDTStats {
  documentCount: number;
  documents: string[];
  pendingUpdates: Array<{
    noteId: string;
    updateCount: number;
  }>;
}

export class CRDTManager {
  docs: Map<string, Y.Doc>;
  updateHandlers: Map<string, UpdateHandler>;
  listeners: Set<CRDTListener>;
  pendingUpdates: Map<string, number[][]>;

  constructor() {
    // Map of noteId -> Y.Doc
    this.docs = new Map();

    // Map of noteId -> update handlers
    this.updateHandlers = new Map();

    // Listeners for CRDT events
    this.listeners = new Set();

    // Track pending updates that need to be written
    // Map of noteId -> Array of updates
    this.pendingUpdates = new Map();
  }

  /**
   * Add a listener for CRDT events
   * @param listener - Callback for CRDT events
   */
  addListener(listener: CRDTListener): void {
    this.listeners.add(listener);
  }

  /**
   * Remove a listener
   * @param listener - Listener to remove
   */
  removeListener(listener: CRDTListener): void {
    this.listeners.delete(listener);
  }

  /**
   * Notify all listeners of CRDT events
   * @param event - Event type
   * @param data - Event data
   */
  notify(event: string, data: any): void {
    this.listeners.forEach(listener => {
      try {
        listener(event, data);
      } catch (error) {
        console.error('Error in CRDT listener:', error);
      }
    });
  }

  /**
   * Get or create Y.Doc for a note
   * @param noteId - Note ID
   * @returns Yjs document
   */
  getDoc(noteId: string): Y.Doc {
    if (!this.docs.has(noteId)) {
      const doc = new Y.Doc();
      this.docs.set(noteId, doc);

      // Set up update handler to track changes
      const updateHandler: UpdateHandler = (update, origin) => {
        // Skip updates from remote instances AND from loading (don't re-store loaded updates)
        // Also skip 'silent' origin updates (used for internal operations that shouldn't trigger saves)
        // We want to save all local changes (including those from editor, programmatic updates, etc.)
        if (origin !== 'remote' && origin !== 'load' && origin !== 'silent' && origin !== 'auto-modified') {
          // Update modified timestamp for content changes (not metadata-only updates)
          // Skip auto-update for: metadata-only changes, initialization
          // Use 'auto-modified' origin to prevent infinite loop when updating timestamp
          if (origin !== 'metadata' && origin !== 'init') {
            doc.transact(() => {
              const yMetadata = doc.getMap('metadata');
              yMetadata.set('modified', new Date().toISOString());
            }, 'auto-modified');
          }

          // Store the update to be written as an append-only file
          if (!this.pendingUpdates.has(noteId)) {
            this.pendingUpdates.set(noteId, []);
          }
          this.pendingUpdates.get(noteId)!.push(Array.from(update));

          this.notify('doc-updated', {
            noteId,
            update: Array.from(update),
            timestamp: new Date()
          });
        }
      };

      doc.on('update', updateHandler);
      this.updateHandlers.set(noteId, updateHandler);

      console.log('Created new Y.Doc for note:', noteId);
    }

    return this.docs.get(noteId)!;
  }

  /**
   * Initialize a note's CRDT document with content
   * This is used for TipTap integration
   * @param noteId - Note ID
   * @param note - Note object with content
   */
  initializeNote(noteId: string, note: Note): void {
    const doc = this.getDoc(noteId);

    console.log(`[CRDTManager] initializeNote called:`, {
      noteId,
      title: note.title,
      titleType: typeof note.title,
      created: note.created,
      isEmpty: doc.getMap('metadata').size === 0,
      hasContent: !!(note.content && note.content.length > 0),
      fullNote: JSON.stringify(note)
    });

    // Use 'init' origin so update listener doesn't auto-update modified timestamp
    // We want to preserve the original modified timestamp from the note
    doc.transact(() => {
      // Store metadata in a Y.Map
      const yMetadata = doc.getMap('metadata');

      // Only initialize if empty
      if (yMetadata.size === 0) {
        const titleToSet = note.title || 'Untitled';
        console.log(`[CRDTManager] Initializing metadata for ${noteId}`);
        console.log(`  - Setting title to:`, titleToSet, `(type: ${typeof titleToSet})`);
        yMetadata.set('title', titleToSet);
        yMetadata.set('created', note.created || new Date().toISOString());
        yMetadata.set('modified', note.modified || new Date().toISOString());
        yMetadata.set('tags', note.tags || []);
        yMetadata.set('folderId', note.folderId || null);
        yMetadata.set('deleted', note.deleted || false);

        // Verify what was actually set
        console.log(`  - Verified title in Y.Map:`, yMetadata.get('title'));
      } else {
        console.log(`[CRDTManager] Metadata already exists for ${noteId}, skipping init`);
        console.log(`  - Current title:`, yMetadata.get('title'));
      }
    }, 'init'); // Use 'init' origin to prevent auto-update of modified timestamp

    // Initialize content if provided
    if (note.content && note.content.length > 0) {
      this.setContentFromHTML(noteId, note.content);
    }

    console.log('Initialized CRDT document for note:', noteId);
  }

  /**
   * Set content from HTML string
   * Creates a temporary editor to parse HTML and sync it to the Y.XmlFragment
   * @param noteId - Note ID
   * @param htmlContent - HTML content string
   */
  setContentFromHTML(noteId: string, htmlContent: string): void {
    const doc = this.getDoc(noteId);
    const fragment = doc.getXmlFragment('default');

    // Only set content if fragment is empty
    if (fragment.length > 0) {
      console.log(`[CRDTManager] Content already exists for ${noteId}, skipping`);
      return;
    }

    console.log(`[CRDTManager] Setting content from HTML for ${noteId}`);

    // Create a temporary container element
    const tempContainer = document.createElement('div');
    tempContainer.style.display = 'none';
    document.body.appendChild(tempContainer);

    try {
      // Create a temporary editor with full extensions
      const tempEditor = new Editor({
        element: tempContainer,
        extensions: [
          StarterKit,
          Table,
          TableRow,
          TableHeader,
          TableCell,
          Hashtag,
          TaskList,
          TaskItem,
          ResizableImage
        ],
        content: htmlContent,
        editable: false
      });

      // Get the ProseMirror state
      const state = tempEditor.state;

      // Destroy the temporary editor
      tempEditor.destroy();

      // Now apply the content to the Y.XmlFragment
      // We need to do this in a transaction
      doc.transact(() => {
        // Convert ProseMirror state to Y.XmlFragment
        // We'll manually insert the content
        const pmDoc = state.doc;

        // Simple approach: convert each node
        pmDoc.content.forEach((node, offset, index) => {
          this.insertPMNodeToFragment(fragment, node);
        });
      });

      console.log(`[CRDTManager] Content set successfully for ${noteId}`);
    } catch (error) {
      console.error(`[CRDTManager] Error setting content for ${noteId}:`, error);
    } finally {
      // Clean up temp container
      document.body.removeChild(tempContainer);
    }
  }

  /**
   * Helper to insert a ProseMirror node into Y.XmlFragment
   * @param fragment - Y.XmlFragment to insert into
   * @param pmNode - ProseMirror node
   */
  private insertPMNodeToFragment(fragment: Y.XmlFragment, pmNode: any): void {
    if (pmNode.isText) {
      const yText = new Y.XmlText(pmNode.text);
      // Apply marks if any
      if (pmNode.marks && pmNode.marks.length > 0) {
        pmNode.marks.forEach((mark: any) => {
          yText.setAttribute(mark.type.name, mark.attrs || true);
        });
      }
      fragment.push([yText]);
    } else {
      const yElement = new Y.XmlElement(pmNode.type.name);

      // Set attributes
      if (pmNode.attrs) {
        Object.entries(pmNode.attrs).forEach(([key, value]) => {
          if (value !== null && value !== undefined) {
            yElement.setAttribute(key, value);
          }
        });
      }

      // Add child nodes
      if (pmNode.content && pmNode.content.size > 0) {
        pmNode.content.forEach((childNode: any) => {
          this.insertPMNodeToFragment(yElement, childNode);
        });
      }

      fragment.push([yElement]);
    }
  }

  /**
   * Get the Y.XmlFragment that TipTap uses for content
   * @param noteId - Note ID
   * @returns The fragment TipTap will use
   */
  getContentFragment(noteId: string): Y.XmlFragment {
    const doc = this.getDoc(noteId);
    // TipTap's Collaboration extension uses a fragment named 'default'
    return doc.getXmlFragment('default');
  }

  /**
   * Extract note data from Y.Doc
   * @param noteId - Note ID
   * @returns Note object
   */
  getNoteFromDoc(noteId: string): Note {
    const doc = this.getDoc(noteId);

    const yMetadata = doc.getMap('metadata');

    // Debug: log what's in metadata
    console.log(`[CRDTManager] getNoteFromDoc(${noteId}):`, {
      metadataSize: yMetadata.size,
      title: yMetadata.get('title'),
      created: yMetadata.get('created'),
      modified: yMetadata.get('modified'),
      tags: yMetadata.get('tags'),
      folderId: yMetadata.get('folderId')
    });

    // For content, we need to convert the Y.XmlFragment to HTML string
    // This is used when loading notes
    const fragment = doc.getXmlFragment('default');

    // Convert Y.XmlFragment to HTML string
    let content = '<p></p>'; // Empty content by default
    if (fragment.length > 0) {
      // Extract actual HTML content from Y.Doc
      content = this.getHTMLFromDoc(doc);
    }

    // Get title from metadata, or extract from content if empty/untitled
    let title = yMetadata.get('title') as string | undefined;
    console.log(`[CRDTManager] getNoteFromDoc - title from metadata: "${title}", typeof: ${typeof title}, content length: ${content.length}`);

    // Always extract title from content if metadata title is missing or generic
    const needsExtraction = !title ||
                           (typeof title === 'string' && (title.trim() === '' || title.trim().toLowerCase() === 'untitled'));

    if (needsExtraction && content && content.length > 0) {
      // Extract title from content (first line of text)
      // Replace block-level HTML elements with newlines to preserve structure
      const textWithNewlines = content
        .replace(/<\/(p|div|h[1-6]|li|br)>/gi, '\n')  // Add newline after closing block tags
        .replace(/<br\s*\/?>/gi, '\n');                 // Convert <br> to newline
      const textContent = textWithNewlines.replace(/<[^>]*>/g, ''); // Strip remaining HTML tags
      const firstLine = textContent.split('\n')[0].trim();
      const extractedTitle = firstLine || 'Untitled';
      console.log(`[CRDTManager] Extracted title from content: "${extractedTitle}"`);
      title = extractedTitle;
    } else if (!title) {
      title = 'Untitled';
    }

    return {
      id: noteId,
      title: title,
      content: content,
      created: (yMetadata.get('created') as string) || new Date().toISOString(),
      modified: (yMetadata.get('modified') as string) || new Date().toISOString(),
      tags: (yMetadata.get('tags') as string[]) || [],
      deleted: (yMetadata.get('deleted') as boolean) || false,
      folderId: (yMetadata.get('folderId') as string) || 'all-notes'
    };
  }

  /**
   * Update note metadata (not content - content is handled by TipTap)
   * @param noteId - Note ID
   * @param updates - Updates to apply
   */
  updateMetadata(noteId: string, updates: Partial<Note>): void {
    const doc = this.getDoc(noteId);

    console.log(`[CRDTManager] updateMetadata(${noteId}):`, updates);

    // Use 'metadata' origin so update listener knows not to auto-update modified timestamp
    doc.transact(() => {
      const yMetadata = doc.getMap('metadata');

      console.log(`  - Current title before update:`, yMetadata.get('title'));

      if (updates.title !== undefined) {
        console.log(`  - Setting title to:`, updates.title);
        yMetadata.set('title', updates.title);
      }

      // Only update modified timestamp if explicitly provided
      // Don't auto-update it for metadata-only changes (title/tags extraction)
      if (updates.modified !== undefined) {
        yMetadata.set('modified', updates.modified);
      }

      if (updates.tags !== undefined) {
        yMetadata.set('tags', updates.tags);
      }
      if (updates.folderId !== undefined) {
        console.log(`  - Setting folderId to:`, updates.folderId);
        yMetadata.set('folderId', updates.folderId);
      }
      if (updates.deleted !== undefined) {
        yMetadata.set('deleted', updates.deleted);
      }

      console.log(`  - Title after update:`, yMetadata.get('title'));
      console.log(`  - FolderId after update:`, yMetadata.get('folderId'));
    }, 'metadata'); // Pass origin so update listener knows this is metadata-only

    console.log('Updated metadata for note:', noteId);
  }

  /**
   * Check if a doc is empty
   * @param noteId - Note ID
   * @returns True if doc is empty
   */
  isDocEmpty(noteId: string): boolean {
    if (!this.docs.has(noteId)) {
      return true;
    }
    const doc = this.getDoc(noteId);

    // For folder documents, check the 'folders' map
    if (noteId === '.folders') {
      const yFolders = doc.getMap('folders');
      return yFolders.size === 0;
    }

    // For note documents, check BOTH metadata AND content
    // Content might sync before metadata is initialized
    const yMetadata = doc.getMap('metadata');
    const yContent = doc.getXmlFragment('default');

    // Doc is only empty if BOTH metadata and content are empty
    return yMetadata.size === 0 && yContent.length === 0;
  }

  /**
   * Get CRDT state for serialization (full state)
   * @param noteId - Note ID
   * @returns State vector as Uint8Array
   */
  getState(noteId: string): Uint8Array {
    const doc = this.getDoc(noteId);
    return Y.encodeStateAsUpdate(doc);
  }

  /**
   * Clear all content from a Y.Doc by destroying and recreating it
   * This is necessary because simply deleting content doesn't reset the internal state vector
   * @param noteId - Note ID
   */
  clearDoc(noteId: string): void {
    if (!this.docs.has(noteId)) {
      return; // Doc doesn't exist yet, nothing to clear
    }

    // Remove the old update handler
    const oldHandler = this.updateHandlers.get(noteId);
    if (oldHandler) {
      const oldDoc = this.docs.get(noteId)!;
      oldDoc.off('update', oldHandler);
      this.updateHandlers.delete(noteId);
    }

    // Clear pending updates for this note
    if (this.pendingUpdates.has(noteId)) {
      this.pendingUpdates.delete(noteId);
    }

    // Remove the old doc
    this.docs.delete(noteId);

    // Next call to getDoc will create a fresh one with a new update handler
  }

  /**
   * Apply CRDT state update from external source
   * @param noteId - Note ID
   * @param state - State update
   * @param origin - Origin marker (default: 'remote')
   */
  applyUpdate(noteId: string, state: number[] | Uint8Array, origin = 'remote'): void {
    const doc = this.getDoc(noteId);
    const update = state instanceof Uint8Array ? state : new Uint8Array(state);
    Y.applyUpdate(doc, update, origin);
  }

  /**
   * Get pending updates for a note (to be written to files)
   * @param noteId - Note ID
   * @returns Array of updates
   */
  getPendingUpdates(noteId: string): number[][] {
    const updates = this.pendingUpdates.get(noteId) || [];
    return updates;
  }

  /**
   * Clear pending updates after they've been written
   * @param noteId - Note ID
   */
  clearPendingUpdates(noteId: string): void {
    this.pendingUpdates.delete(noteId);
  }

  /**
   * Remove a note's CRDT document
   * @param noteId - Note ID
   */
  removeDoc(noteId: string): void {
    const doc = this.docs.get(noteId);
    if (doc) {
      // Remove update handler
      const handler = this.updateHandlers.get(noteId);
      if (handler) {
        doc.off('update', handler);
        this.updateHandlers.delete(noteId);
      }

      // Destroy doc
      doc.destroy();
      this.docs.delete(noteId);
      this.pendingUpdates.delete(noteId);

      console.log('Removed CRDT document for note:', noteId);
    }
  }

  /**
   * Get statistics about CRDT state
   * @returns Statistics
   */
  getStats(): CRDTStats {
    return {
      documentCount: this.docs.size,
      documents: Array.from(this.docs.keys()),
      pendingUpdates: Array.from(this.pendingUpdates.entries()).map(([noteId, updates]) => ({
        noteId,
        updateCount: updates.length
      }))
    };
  }

  /**
   * Convert Y.Doc to HTML using a temporary TipTap editor
   * This is used for generating note previews
   * @param doc - Y.Doc to convert
   * @returns HTML content
   */
  getHTMLFromDoc(doc: Y.Doc): string {
    try {
      // Get the Y.XmlFragment directly and convert to HTML
      // IMPORTANT: Don't create a TipTap editor with Collaboration here,
      // as it can interfere with the Y.Doc state during loading
      const fragment = doc.getXmlFragment('default');

      if (fragment.length === 0) {
        return '<p></p>';
      }

      // Use TipTap's prosemirrorJSONToYXmlFragment in reverse
      // to convert Y.XmlFragment to HTML
      // Create a temporary editor WITHOUT Collaboration to convert to HTML
      const tempEditor = new Editor({
        extensions: [
          StarterKit.configure({
            heading: { levels: [1, 2, 3] },
            bulletList: { keepMarks: true },
            orderedList: { keepMarks: true }
          }),
          Table.configure({ resizable: false }),
          TableRow,
          TableHeader,
          TableCell,
          Hashtag,
          TaskList,
          TaskItem,
          ResizableImage
          // NOTE: NO Collaboration extension - we don't want to sync with Y.Doc
        ],
        content: this.yXmlFragmentToHTML(fragment)
      });

      // Get HTML from the editor
      const html = tempEditor.getHTML();

      // Clean up
      tempEditor.destroy();

      return html || '<p></p>';
    } catch (error) {
      console.error('[CRDTManager] Error converting Y.Doc to HTML:', error);
      return '<p></p>';
    }
  }

  /**
   * Convert Y.XmlFragment to HTML string
   * @param fragment - Y.XmlFragment to convert
   * @returns HTML string
   */
  yXmlFragmentToHTML(fragment: Y.XmlFragment): string {
    // Simple conversion: iterate through fragment and build HTML
    let html = '';
    fragment.forEach((item) => {
      html += this.yXmlElementToHTML(item);
    });
    return html || '<p></p>';
  }

  /**
   * Convert Y.XmlElement to HTML string recursively
   * @param element - Element to convert
   * @returns HTML string
   */
  yXmlElementToHTML(element: Y.XmlElement | Y.XmlText): string {
    if (element instanceof Y.XmlText) {
      return element.toString();
    }

    if (element instanceof Y.XmlElement) {
      const tag = element.nodeName;
      const attrs = element.getAttributes();

      // Build attributes string
      let attrsStr = '';
      for (const [key, value] of Object.entries(attrs)) {
        attrsStr += ` ${key}="${value}"`;
      }

      // Build children HTML
      let childrenHTML = '';
      element.forEach((child) => {
        childrenHTML += this.yXmlElementToHTML(child);
      });

      return `<${tag}${attrsStr}>${childrenHTML}</${tag}>`;
    }

    return '';
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    // Destroy all docs
    for (const [noteId, doc] of this.docs.entries()) {
      const handler = this.updateHandlers.get(noteId);
      if (handler) {
        doc.off('update', handler);
      }
      doc.destroy();
    }

    this.docs.clear();
    this.updateHandlers.clear();
    this.listeners.clear();
    this.pendingUpdates.clear();

    console.log('CRDT Manager destroyed');
  }
}
