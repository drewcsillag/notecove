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
  // IMPORTANT: We maintain TWO separate Y.Docs per note:
  // 1. contentDocs: Content (Y.XmlFragment) - TipTap's domain, never touched by our code
  // 2. metadataDocs: Metadata (Y.Map) - Our domain, programmatic updates only
  // This separation prevents our metadata updates from interfering with TipTap's cursor tracking
  contentDocs: Map<string, Y.Doc>;
  metadataDocs: Map<string, Y.Doc>;
  contentUpdateHandlers: Map<string, UpdateHandler>;
  metadataUpdateHandlers: Map<string, UpdateHandler>;
  listeners: Set<CRDTListener>;
  pendingContentUpdates: Map<string, number[][]>;
  pendingMetadataUpdates: Map<string, number[][]>;

  constructor() {
    // Map of noteId -> content Y.Doc (contains only Y.XmlFragment 'default')
    this.contentDocs = new Map();

    // Map of noteId -> metadata Y.Doc (contains only Y.Map 'metadata')
    this.metadataDocs = new Map();

    // Map of noteId -> update handlers for content
    this.contentUpdateHandlers = new Map();

    // Map of noteId -> update handlers for metadata
    this.metadataUpdateHandlers = new Map();

    // Listeners for CRDT events
    this.listeners = new Set();

    // Track pending updates that need to be written
    // Separate tracking for content and metadata updates
    this.pendingContentUpdates = new Map();
    this.pendingMetadataUpdates = new Map();
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
   * Get or create content Y.Doc for a note
   * Content Y.Doc contains ONLY Y.XmlFragment 'default' for TipTap
   * @param noteId - Note ID
   * @returns Content Y.Doc
   */
  getContentDoc(noteId: string): Y.Doc {
    if (!this.contentDocs.has(noteId)) {
      const doc = new Y.Doc();
      this.contentDocs.set(noteId, doc);

      // Set up update handler for content
      const updateHandler: UpdateHandler = (update, origin) => {
        const originStr = typeof origin === 'string' ? origin :
                         origin === null ? 'null' :
                         origin === undefined ? 'undefined' :
                         'editor';

        // Skip updates from remote/load/silent
        if (originStr !== 'remote' && originStr !== 'load' && originStr !== 'silent') {
          console.log(`[🔔 CONTENT] Generated content update for ${noteId}, origin="${originStr}"`);

          // Store content update
          if (!this.pendingContentUpdates.has(noteId)) {
            this.pendingContentUpdates.set(noteId, []);
          }
          this.pendingContentUpdates.get(noteId)!.push(Array.from(update));

          const updateCount = this.pendingContentUpdates.get(noteId)!.length;
          console.log(`[🔔 CONTENT] Stored content update #${updateCount} for ${noteId}`);

          this.notify('content-updated', {
            noteId,
            update: Array.from(update),
            updateCount,
            timestamp: new Date()
          });
        }
      };

      doc.on('update', updateHandler);
      this.contentUpdateHandlers.set(noteId, updateHandler);

      console.log('Created new content Y.Doc for note:', noteId);
    }

    return this.contentDocs.get(noteId)!;
  }

  /**
   * Get or create metadata Y.Doc for a note
   * Metadata Y.Doc contains ONLY Y.Map 'metadata' for programmatic updates
   * @param noteId - Note ID
   * @returns Metadata Y.Doc
   */
  getMetadataDoc(noteId: string): Y.Doc {
    if (!this.metadataDocs.has(noteId)) {
      const doc = new Y.Doc();
      this.metadataDocs.set(noteId, doc);

      // Set up update handler for metadata
      const updateHandler: UpdateHandler = (update, origin) => {
        const originStr = typeof origin === 'string' ? origin :
                         origin === null ? 'null' :
                         origin === undefined ? 'undefined' :
                         'metadata';

        // Skip updates from remote/load/silent
        if (originStr !== 'remote' && originStr !== 'load' && originStr !== 'silent') {
          const yMetadata = doc.getMap('metadata');
          const keys = Array.from(yMetadata.keys());
          console.log(`[🔔 METADATA] Generated metadata update for ${noteId}, origin="${originStr}", keys: [${keys.join(', ')}]`);

          // Store metadata update
          if (!this.pendingMetadataUpdates.has(noteId)) {
            this.pendingMetadataUpdates.set(noteId, []);
          }
          this.pendingMetadataUpdates.get(noteId)!.push(Array.from(update));

          const updateCount = this.pendingMetadataUpdates.get(noteId)!.length;
          console.log(`[🔔 METADATA] Stored metadata update #${updateCount} for ${noteId}`);

          this.notify('metadata-updated', {
            noteId,
            update: Array.from(update),
            updateCount,
            timestamp: new Date()
          });
        }
      };

      doc.on('update', updateHandler);
      this.metadataUpdateHandlers.set(noteId, updateHandler);

      console.log('Created new metadata Y.Doc for note:', noteId);
    }

    return this.metadataDocs.get(noteId)!;
  }

  /**
   * DEPRECATED: Get or create Y.Doc for a note (old single-doc API)
   * Use getContentDoc() or getMetadataDoc() instead
   * This is kept temporarily for backward compatibility during migration
   * Returns the content doc for backward compatibility
   * @param noteId - Note ID
   * @returns Content Y.Doc
   */
  getDoc(noteId: string): Y.Doc {
    console.warn('[CRDTManager] getDoc() is deprecated - use getContentDoc() or getMetadataDoc()');
    return this.getContentDoc(noteId);
  }

  /**
   * Check if content Y.Doc exists for a note (without creating one)
   * @param noteId - Note ID
   * @returns true if content doc exists in memory
   */
  hasContentDoc(noteId: string): boolean {
    return this.contentDocs.has(noteId);
  }

  /**
   * Check if metadata Y.Doc exists for a note (without creating one)
   * @param noteId - Note ID
   * @returns true if metadata doc exists in memory
   */
  hasMetadataDoc(noteId: string): boolean {
    return this.metadataDocs.has(noteId);
  }

  /**
   * DEPRECATED: Check if a Y.Doc exists for a note
   * Use hasContentDoc() or hasMetadataDoc() instead
   * @param noteId - Note ID
   * @returns true if content doc exists in memory
   */
  hasDoc(noteId: string): boolean {
    console.warn('[CRDTManager] hasDoc() is deprecated - use hasContentDoc() or hasMetadataDoc()');
    return this.hasContentDoc(noteId);
  }

  /**
   * Get pending content update count for a note
   * @param noteId - Note ID
   * @returns Number of pending content updates
   */
  getPendingContentUpdateCount(noteId: string): number {
    return this.pendingContentUpdates.get(noteId)?.length || 0;
  }

  /**
   * Get pending metadata update count for a note
   * @param noteId - Note ID
   * @returns Number of pending metadata updates
   */
  getPendingMetadataUpdateCount(noteId: string): number {
    return this.pendingMetadataUpdates.get(noteId)?.length || 0;
  }

  /**
   * Get and clear pending content updates for a note
   * Used by UpdateStore when flushing to disk
   * @param noteId - Note ID
   * @returns Array of pending content updates
   */
  getPendingContentUpdates(noteId: string): number[][] {
    const updates = this.pendingContentUpdates.get(noteId) || [];
    this.pendingContentUpdates.delete(noteId);
    return updates;
  }

  /**
   * Get and clear pending metadata updates for a note
   * Used by UpdateStore when flushing to disk
   * @param noteId - Note ID
   * @returns Array of pending metadata updates
   */
  getPendingMetadataUpdates(noteId: string): number[][] {
    const updates = this.pendingMetadataUpdates.get(noteId) || [];
    this.pendingMetadataUpdates.delete(noteId);
    return updates;
  }

  /**
   * Initialize a note's CRDT documents (both content and metadata)
   * This is used for TipTap integration
   * @param noteId - Note ID
   * @param note - Note object with content
   */
  initializeNote(noteId: string, note: Note): void {
    console.log(`[CRDTManager] initializeNote called:`, {
      noteId,
      title: note.title,
      titleType: typeof note.title,
      created: note.created,
      hasContent: !!(note.content && note.content.length > 0),
      fullNote: JSON.stringify(note)
    });

    // Initialize metadata Y.Doc
    const metadataDoc = this.getMetadataDoc(noteId);
    const yMetadata = metadataDoc.getMap('metadata');

    // Use 'init' origin so update listener doesn't auto-update modified timestamp
    metadataDoc.transact(() => {
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
        yMetadata.set('contentVersion', 0); // Track correlation with content updates

        console.log(`  - Verified title in Y.Map:`, yMetadata.get('title'));
      } else {
        console.log(`[CRDTManager] Metadata already exists for ${noteId}, skipping init`);
        console.log(`  - Current title:`, yMetadata.get('title'));
      }
    }, 'init');

    // Initialize content Y.Doc if content provided
    if (note.content && note.content.length > 0) {
      this.setContentFromHTML(noteId, note.content);
    }
    // IMPORTANT: For empty notes, do NOT pre-initialize any content structure
    // Let TipTap's Collaboration extension create the initial document structure
    // when the editor attaches. This ensures perfect alignment between TipTap's
    // internal state and the Y.XmlFragment structure.

    console.log('Initialized CRDT documents (content + metadata) for note:', noteId);
  }

  /**
   * Set content from HTML string
   * Creates a temporary editor to parse HTML and sync it to the Y.XmlFragment
   * @param noteId - Note ID
   * @param htmlContent - HTML content string
   */
  setContentFromHTML(noteId: string, htmlContent: string): void {
    const contentDoc = this.getContentDoc(noteId);
    const fragment = contentDoc.getXmlFragment('default');

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
      contentDoc.transact(() => {
        // Convert ProseMirror state to Y.XmlFragment
        // We'll manually insert the content
        const pmDoc = state.doc;

        // Simple approach: convert each node
        pmDoc.content.forEach((node, _offset, _index) => {
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
            yElement.setAttribute(key, String(value));
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
    const contentDoc = this.getContentDoc(noteId);
    // TipTap's Collaboration extension uses a fragment named 'default'
    return contentDoc.getXmlFragment('default');
  }

  /**
   * Extract note data from both Y.Docs (content + metadata)
   * @param noteId - Note ID
   * @returns Note object
   */
  getNoteFromDoc(noteId: string): Note {
    // Get metadata from metadata Y.Doc
    const metadataDoc = this.getMetadataDoc(noteId);
    const yMetadata = metadataDoc.getMap('metadata');

    // Debug: log what's in metadata
    console.log(`[CRDTManager] getNoteFromDoc(${noteId}):`, {
      metadataSize: yMetadata.size,
      title: yMetadata.get('title'),
      created: yMetadata.get('created'),
      modified: yMetadata.get('modified'),
      tags: yMetadata.get('tags'),
      folderId: yMetadata.get('folderId'),
      contentVersion: yMetadata.get('contentVersion')
    });

    // Get content from content Y.Doc
    const contentDoc = this.getContentDoc(noteId);
    const fragment = contentDoc.getXmlFragment('default');

    // Convert Y.XmlFragment to HTML string
    let content = '<p></p>'; // Empty content by default
    if (fragment.length > 0) {
      // Extract actual HTML content from content Y.Doc
      content = this.getHTMLFromDoc(contentDoc);
    }

    // Get title from metadata, or extract from content if empty/untitled
    let title = yMetadata.get('title') as string | undefined;
    console.log(`[CRDTManager] getNoteFromDoc - title from metadata: "${title}", typeof: ${typeof title}, content length: ${content.length}`);

    // Always extract title from content if metadata title is missing or generic
    const needsExtraction = !title ||
                           (typeof title === 'string' && (title.trim() === '' || title.trim().toLowerCase() === 'untitled'));

    if (needsExtraction && content && content.length > 0) {
      // Prefer extracting from H1 if present
      const h1Match = content.match(/<h1[^>]*>(.*?)<\/h1>/i);
      if (h1Match && h1Match[1]) {
        // Extract text from H1, removing any nested HTML tags
        const h1Text = h1Match[1].replace(/<[^>]*>/g, '').trim();
        if (h1Text) {
          title = h1Text;
          console.log(`[CRDTManager] Extracted title from H1: "${title}"`);
        }
      }

      // Fallback: Extract from first line of any content
      if (!title || title === 'Untitled') {
        // Replace block-level HTML elements with newlines to preserve structure
        const textWithNewlines = content
          .replace(/<\/(p|div|h[1-6]|li|br)>/gi, '\n')  // Add newline after closing block tags
          .replace(/<br\s*\/?>/gi, '\n');                 // Convert <br> to newline
        const textContent = textWithNewlines.replace(/<[^>]*>/g, ''); // Strip remaining HTML tags
        const firstLine = textContent.split('\n')[0].trim();
        const extractedTitle = firstLine || 'Untitled';
        console.log(`[CRDTManager] Extracted title from first line: "${extractedTitle}"`);
        title = extractedTitle;
      }
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
    const metadataDoc = this.getMetadataDoc(noteId);

    console.log(`[CRDTManager] updateMetadata(${noteId}):`, updates);

    // Use 'metadata' origin so update listener knows not to auto-update modified timestamp
    metadataDoc.transact(() => {
      const yMetadata = metadataDoc.getMap('metadata');

      // Update contentVersion to track correlation with content updates
      const contentUpdateCount = this.getPendingContentUpdateCount(noteId);
      yMetadata.set('contentVersion', contentUpdateCount);

      // Log ALL metadata keys BEFORE any changes
      const keysBefore = Array.from(yMetadata.keys());
      console.log(`  - BEFORE: ${keysBefore.length} keys: [${keysBefore.join(', ')}]`);
      console.log(`  - BEFORE values: title="${yMetadata.get('title')}", tags=${JSON.stringify(yMetadata.get('tags'))}, folderId="${yMetadata.get('folderId')}", deleted=${yMetadata.get('deleted')}`);

      // IMPORTANT: Only call set() if the value is actually changing
      // Redundant set() calls can create problematic Y.js updates that corrupt metadata when loaded from disk

      if (updates.title !== undefined && yMetadata.get('title') !== updates.title) {
        console.log(`  - Setting title to:`, updates.title);
        yMetadata.set('title', updates.title);
      }

      // Only update modified timestamp if explicitly provided
      // Don't auto-update it for metadata-only changes (title/tags extraction)
      if (updates.modified !== undefined && yMetadata.get('modified') !== updates.modified) {
        yMetadata.set('modified', updates.modified);
      }

      if (updates.tags !== undefined) {
        // For arrays, compare by JSON stringification since Y.js Array comparison might not work as expected
        const currentTags = yMetadata.get('tags');
        const tagsChanged = JSON.stringify(currentTags) !== JSON.stringify(updates.tags);
        if (tagsChanged) {
          console.log(`  - Setting tags to:`, updates.tags);
          yMetadata.set('tags', updates.tags);
        }
      }

      if (updates.folderId !== undefined && yMetadata.get('folderId') !== updates.folderId) {
        console.log(`  - Setting folderId to:`, updates.folderId);
        yMetadata.set('folderId', updates.folderId);
      }

      if (updates.deleted !== undefined && yMetadata.get('deleted') !== updates.deleted) {
        console.log(`  - Setting deleted to:`, updates.deleted);
        yMetadata.set('deleted', updates.deleted);
      }

      // Log ALL metadata keys AFTER changes
      const keysAfter = Array.from(yMetadata.keys());
      console.log(`  - AFTER: ${keysAfter.length} keys: [${keysAfter.join(', ')}]`);
      console.log(`  - AFTER values: title="${yMetadata.get('title')}", tags=${JSON.stringify(yMetadata.get('tags'))}, folderId="${yMetadata.get('folderId')}", deleted=${yMetadata.get('deleted')}`);
    }, 'metadata'); // Pass origin so update listener knows this is metadata-only

    console.log('Updated metadata for note:', noteId);
  }

  /**
   * Update the modified timestamp for a note
   * This should be called at safe times (e.g., on blur, on save) to avoid
   * interfering with TipTap's cursor tracking
   * @param noteId - Note ID
   */
  updateModifiedTimestamp(noteId: string): void {
    const metadataDoc = this.getMetadataDoc(noteId);

    metadataDoc.transact(() => {
      const yMetadata = metadataDoc.getMap('metadata');
      yMetadata.set('modified', new Date().toISOString());

      // Update contentVersion to track correlation
      const contentUpdateCount = this.getPendingContentUpdateCount(noteId);
      yMetadata.set('contentVersion', contentUpdateCount);
    }, 'metadata'); // Use 'metadata' origin to prevent re-triggering update handler
  }

  /**
   * Check if docs are empty (both content and metadata)
   * @param noteId - Note ID
   * @returns True if both docs are empty
   */
  isDocEmpty(noteId: string): boolean {
    // For folder documents, check the old single-doc structure
    if (noteId === '.folders') {
      if (!this.contentDocs.has(noteId)) {
        return true;
      }
      const doc = this.getContentDoc(noteId);
      const yFolders = doc.getMap('folders');
      return yFolders.size === 0;
    }

    // For note documents, check BOTH content and metadata Y.Docs
    // Content might sync before metadata is initialized
    if (!this.contentDocs.has(noteId) && !this.metadataDocs.has(noteId)) {
      return true;
    }

    const contentDoc = this.getContentDoc(noteId);
    const metadataDoc = this.getMetadataDoc(noteId);

    const yMetadata = metadataDoc.getMap('metadata');
    const yContent = contentDoc.getXmlFragment('default');

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
   * Clear all docs (content and metadata) by destroying and recreating them
   * This is necessary because simply deleting content doesn't reset the internal state vector
   * @param noteId - Note ID
   */
  clearDoc(noteId: string): void {
    // Clear content doc
    if (this.contentDocs.has(noteId)) {
      const oldHandler = this.contentUpdateHandlers.get(noteId);
      if (oldHandler) {
        const oldDoc = this.contentDocs.get(noteId)!;
        oldDoc.off('update', oldHandler);
        this.contentUpdateHandlers.delete(noteId);
      }
      this.contentDocs.delete(noteId);
      this.pendingContentUpdates.delete(noteId);
    }

    // Clear metadata doc
    if (this.metadataDocs.has(noteId)) {
      const oldHandler = this.metadataUpdateHandlers.get(noteId);
      if (oldHandler) {
        const oldDoc = this.metadataDocs.get(noteId)!;
        oldDoc.off('update', oldHandler);
        this.metadataUpdateHandlers.delete(noteId);
      }
      this.metadataDocs.delete(noteId);
      this.pendingMetadataUpdates.delete(noteId);
    }

    // Next calls to getContentDoc/getMetadataDoc will create fresh ones
  }

  /**
   * Apply content update from external source (e.g., loading from disk)
   * @param noteId - Note ID
   * @param state - State update
   * @param origin - Origin marker (default: 'load')
   */
  applyContentUpdate(noteId: string, state: number[] | Uint8Array, origin = 'load'): void {
    const contentDoc = this.getContentDoc(noteId);
    const update = state instanceof Uint8Array ? state : new Uint8Array(state);
    Y.applyUpdate(contentDoc, update, origin);
  }

  /**
   * Apply metadata update from external source (e.g., loading from disk)
   * @param noteId - Note ID
   * @param state - State update
   * @param origin - Origin marker (default: 'load')
   */
  applyMetadataUpdate(noteId: string, state: number[] | Uint8Array, origin = 'load'): void {
    const metadataDoc = this.getMetadataDoc(noteId);
    const update = state instanceof Uint8Array ? state : new Uint8Array(state);
    Y.applyUpdate(metadataDoc, update, origin);
  }

  /**
   * DEPRECATED: Apply CRDT state update from external source
   * Use applyContentUpdate() or applyMetadataUpdate() instead
   * @param noteId - Note ID
   * @param state - State update
   * @param origin - Origin marker (default: 'remote')
   */
  applyUpdate(noteId: string, state: number[] | Uint8Array, origin = 'remote'): void {
    console.warn('[CRDTManager] applyUpdate() is deprecated - use applyContentUpdate() or applyMetadataUpdate()');
    // For backward compatibility, apply to content doc
    this.applyContentUpdate(noteId, state, origin);
  }

  /**
   * DEPRECATED: Get pending updates for a note
   * Use getPendingContentUpdates() or getPendingMetadataUpdates() instead
   * @param noteId - Note ID
   * @returns Array of content updates (for backward compatibility)
   */
  getPendingUpdates(noteId: string): number[][] {
    console.warn('[CRDTManager] getPendingUpdates() is deprecated - use getPendingContentUpdates() or getPendingMetadataUpdates()');
    return this.pendingContentUpdates.get(noteId) || [];
  }

  /**
   * DEPRECATED: Clear pending updates after they've been written
   * Use getPendingContentUpdates/getPendingMetadataUpdates which auto-clear
   * @param noteId - Note ID
   */
  clearPendingUpdates(noteId: string): void {
    console.warn('[CRDTManager] clearPendingUpdates() is deprecated');
    this.pendingContentUpdates.delete(noteId);
    this.pendingMetadataUpdates.delete(noteId);
  }

  /**
   * Remove a note's CRDT documents (both content and metadata)
   * @param noteId - Note ID
   */
  removeDoc(noteId: string): void {
    // Remove content doc
    const contentDoc = this.contentDocs.get(noteId);
    if (contentDoc) {
      const handler = this.contentUpdateHandlers.get(noteId);
      if (handler) {
        contentDoc.off('update', handler);
        this.contentUpdateHandlers.delete(noteId);
      }
      contentDoc.destroy();
      this.contentDocs.delete(noteId);
      this.pendingContentUpdates.delete(noteId);
    }

    // Remove metadata doc
    const metadataDoc = this.metadataDocs.get(noteId);
    if (metadataDoc) {
      const handler = this.metadataUpdateHandlers.get(noteId);
      if (handler) {
        metadataDoc.off('update', handler);
        this.metadataUpdateHandlers.delete(noteId);
      }
      metadataDoc.destroy();
      this.metadataDocs.delete(noteId);
      this.pendingMetadataUpdates.delete(noteId);
    }

    console.log('Removed CRDT documents (content + metadata) for note:', noteId);
  }

  /**
   * Get statistics about CRDT state
   * @returns Statistics
   */
  getStats(): CRDTStats {
    // Count unique note IDs across both doc types
    const allNoteIds = new Set([
      ...this.contentDocs.keys(),
      ...this.metadataDocs.keys()
    ]);

    // Combine pending updates from both types
    const pendingUpdates: Array<{ noteId: string; updateCount: number }> = [];
    for (const noteId of allNoteIds) {
      const contentCount = this.pendingContentUpdates.get(noteId)?.length || 0;
      const metadataCount = this.pendingMetadataUpdates.get(noteId)?.length || 0;
      if (contentCount > 0 || metadataCount > 0) {
        pendingUpdates.push({
          noteId,
          updateCount: contentCount + metadataCount
        });
      }
    }

    return {
      documentCount: allNoteIds.size,
      documents: Array.from(allNoteIds),
      pendingUpdates
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
   * Clean up resources (both content and metadata docs)
   */
  destroy(): void {
    // Destroy all content docs
    for (const [noteId, doc] of this.contentDocs.entries()) {
      const handler = this.contentUpdateHandlers.get(noteId);
      if (handler) {
        doc.off('update', handler);
      }
      doc.destroy();
    }

    // Destroy all metadata docs
    for (const [noteId, doc] of this.metadataDocs.entries()) {
      const handler = this.metadataUpdateHandlers.get(noteId);
      if (handler) {
        doc.off('update', handler);
      }
      doc.destroy();
    }

    // Clear all maps
    this.contentDocs.clear();
    this.metadataDocs.clear();
    this.contentUpdateHandlers.clear();
    this.metadataUpdateHandlers.clear();
    this.listeners.clear();
    this.pendingContentUpdates.clear();
    this.pendingMetadataUpdates.clear();

    console.log('CRDT Manager destroyed (content + metadata docs)');
  }
}
