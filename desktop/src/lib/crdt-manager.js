/**
 * CRDT Manager - Handles conflict-free replication using Yjs
 * Provides CRDT-based document synchronization for multi-device editing
 */
import * as Y from 'yjs';

export class CRDTManager {
  constructor() {
    // Map of noteId -> Y.Doc
    this.docs = new Map();

    // Map of noteId -> update handlers
    this.updateHandlers = new Map();

    // Listeners for CRDT events
    this.listeners = new Set();
  }

  /**
   * Add a listener for CRDT events
   * @param {Function} listener - Callback for CRDT events
   */
  addListener(listener) {
    this.listeners.add(listener);
  }

  /**
   * Remove a listener
   * @param {Function} listener - Listener to remove
   */
  removeListener(listener) {
    this.listeners.delete(listener);
  }

  /**
   * Notify all listeners of CRDT events
   * @param {string} event - Event type
   * @param {object} data - Event data
   */
  notify(event, data) {
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
   * @param {string} noteId - Note ID
   * @returns {Y.Doc} Yjs document
   */
  getDoc(noteId) {
    if (!this.docs.has(noteId)) {
      const doc = new Y.Doc();
      this.docs.set(noteId, doc);

      // Set up update handler to track changes
      const updateHandler = (update, origin) => {
        if (origin !== 'silent') {
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

    return this.docs.get(noteId);
  }

  /**
   * Initialize a note's CRDT document with content
   * @param {string} noteId - Note ID
   * @param {object} note - Note object with content
   */
  initializeNote(noteId, note) {
    const doc = this.getDoc(noteId);

    // Get the shared types
    const yTitle = doc.getText('title');
    const yContent = doc.getText('content');
    const yMetadata = doc.getMap('metadata');

    // Initialize with note data (transact to batch updates)
    doc.transact(() => {
      // Only initialize if empty
      if (yTitle.length === 0 && note.title) {
        yTitle.insert(0, note.title);
      }

      if (yContent.length === 0 && note.content) {
        // For TipTap content, we store the JSON string
        const contentStr = typeof note.content === 'string'
          ? note.content
          : JSON.stringify(note.content);
        yContent.insert(0, contentStr);
      }

      // Store metadata
      yMetadata.set('created', note.created || new Date().toISOString());
      yMetadata.set('modified', note.modified || new Date().toISOString());
      if (note.tags) yMetadata.set('tags', note.tags);
      if (note.folder) yMetadata.set('folder', note.folder);
    }, 'silent'); // Use 'silent' to avoid triggering update events during initialization

    console.log('Initialized CRDT document for note:', noteId);
  }

  /**
   * Extract note data from Y.Doc
   * @param {string} noteId - Note ID
   * @returns {object} Note object
   */
  getNoteFromDoc(noteId) {
    const doc = this.getDoc(noteId);

    const yTitle = doc.getText('title');
    const yContent = doc.getText('content');
    const yMetadata = doc.getMap('metadata');

    // Extract content and parse if it's JSON
    let content = yContent.toString();
    try {
      // Try to parse as JSON for TipTap format
      const parsed = JSON.parse(content);
      if (parsed && typeof parsed === 'object') {
        content = parsed;
      }
    } catch (e) {
      // If not JSON, keep as string
    }

    return {
      id: noteId,
      title: yTitle.toString() || 'Untitled',
      content: content,
      created: yMetadata.get('created'),
      modified: yMetadata.get('modified'),
      tags: yMetadata.get('tags') || [],
      folder: yMetadata.get('folder') || null
    };
  }

  /**
   * Update note content in CRDT
   * @param {string} noteId - Note ID
   * @param {object} updates - Updates to apply
   */
  updateNote(noteId, updates) {
    const doc = this.getDoc(noteId);

    doc.transact(() => {
      if (updates.title !== undefined) {
        const yTitle = doc.getText('title');
        yTitle.delete(0, yTitle.length);
        yTitle.insert(0, updates.title);
      }

      if (updates.content !== undefined) {
        const yContent = doc.getText('content');
        const contentStr = typeof updates.content === 'string'
          ? updates.content
          : JSON.stringify(updates.content);
        yContent.delete(0, yContent.length);
        yContent.insert(0, contentStr);
      }

      // Update metadata
      const yMetadata = doc.getMap('metadata');
      yMetadata.set('modified', new Date().toISOString());

      if (updates.tags !== undefined) {
        yMetadata.set('tags', updates.tags);
      }
      if (updates.folder !== undefined) {
        yMetadata.set('folder', updates.folder);
      }
    });

    console.log('Updated CRDT document for note:', noteId);
  }

  /**
   * Merge external note data using CRDT
   * @param {string} noteId - Note ID
   * @param {object} externalNote - External note data
   * @returns {object} Merged note
   */
  mergeExternalNote(noteId, externalNote) {
    // Get or create the doc
    const doc = this.getDoc(noteId);

    // If the doc is empty, initialize it with external note
    if (this.isDocEmpty(noteId)) {
      this.initializeNote(noteId, externalNote);
      return this.getNoteFromDoc(noteId);
    }

    // If doc has content, we need to merge
    // Check if external note has CRDT state
    if (externalNote.crdtState) {
      // Apply the CRDT state update
      try {
        const update = new Uint8Array(externalNote.crdtState);
        Y.applyUpdate(doc, update, 'remote');
        console.log('Applied CRDT update from external source for note:', noteId);
      } catch (error) {
        console.error('Error applying CRDT update:', error);
        // Fall back to manual merge
        this.manualMerge(noteId, externalNote);
      }
    } else {
      // No CRDT state - do a manual merge
      this.manualMerge(noteId, externalNote);
    }

    return this.getNoteFromDoc(noteId);
  }

  /**
   * Manual merge when CRDT state is not available
   * @param {string} noteId - Note ID
   * @param {object} externalNote - External note
   */
  manualMerge(noteId, externalNote) {
    const doc = this.getDoc(noteId);
    const currentNote = this.getNoteFromDoc(noteId);

    doc.transact(() => {
      const yMetadata = doc.getMap('metadata');

      // Use timestamps to decide what to keep
      const currentModified = new Date(currentNote.modified || 0).getTime();
      const externalModified = new Date(externalNote.modified || 0).getTime();

      // If external is newer, update content
      if (externalModified > currentModified) {
        if (externalNote.title !== undefined) {
          const yTitle = doc.getText('title');
          yTitle.delete(0, yTitle.length);
          yTitle.insert(0, externalNote.title);
        }

        if (externalNote.content !== undefined) {
          const yContent = doc.getText('content');
          const contentStr = typeof externalNote.content === 'string'
            ? externalNote.content
            : JSON.stringify(externalNote.content);
          yContent.delete(0, yContent.length);
          yContent.insert(0, contentStr);
        }

        yMetadata.set('modified', externalNote.modified);
      }

      // Merge tags (union of both sets)
      if (externalNote.tags) {
        const currentTags = new Set(currentNote.tags || []);
        const externalTags = new Set(externalNote.tags || []);
        const mergedTags = [...new Set([...currentTags, ...externalTags])];
        yMetadata.set('tags', mergedTags);
      }

      // Keep the earlier created timestamp
      const currentCreated = new Date(currentNote.created || Date.now()).getTime();
      const externalCreated = new Date(externalNote.created || Date.now()).getTime();
      if (externalCreated < currentCreated) {
        yMetadata.set('created', externalNote.created);
      }
    }, 'remote');

    console.log('Manual merge completed for note:', noteId);
  }

  /**
   * Check if a doc is empty
   * @param {string} noteId - Note ID
   * @returns {boolean} True if doc is empty
   */
  isDocEmpty(noteId) {
    const doc = this.getDoc(noteId);
    const yTitle = doc.getText('title');
    const yContent = doc.getText('content');
    return yTitle.length === 0 && yContent.length === 0;
  }

  /**
   * Get CRDT state for serialization
   * @param {string} noteId - Note ID
   * @returns {Array} State vector as array
   */
  getState(noteId) {
    const doc = this.getDoc(noteId);
    const state = Y.encodeStateAsUpdate(doc);
    return Array.from(state);
  }

  /**
   * Apply CRDT state update
   * @param {string} noteId - Note ID
   * @param {Array|Uint8Array} state - State update
   */
  applyState(noteId, state) {
    const doc = this.getDoc(noteId);
    const update = state instanceof Uint8Array ? state : new Uint8Array(state);
    Y.applyUpdate(doc, update, 'remote');
    console.log('Applied state update for note:', noteId);
  }

  /**
   * Create a snapshot of current state
   * @param {string} noteId - Note ID
   * @returns {object} Snapshot with note data and CRDT state
   */
  createSnapshot(noteId) {
    const note = this.getNoteFromDoc(noteId);
    const crdtState = this.getState(noteId);

    return {
      ...note,
      crdtState,
      snapshotAt: new Date().toISOString()
    };
  }

  /**
   * Remove a note's CRDT document
   * @param {string} noteId - Note ID
   */
  removeDoc(noteId) {
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

      console.log('Removed CRDT document for note:', noteId);
    }
  }

  /**
   * Get statistics about CRDT state
   * @returns {object} Statistics
   */
  getStats() {
    return {
      documentCount: this.docs.size,
      documents: Array.from(this.docs.keys())
    };
  }

  /**
   * Clean up resources
   */
  destroy() {
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

    console.log('CRDT Manager destroyed');
  }
}
