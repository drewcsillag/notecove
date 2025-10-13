/**
 * CRDT Manager - Handles conflict-free replication using Yjs
 * Integrates with TipTap's Collaboration extension for real-time editing
 * Uses append-only update files for robust multi-instance sync
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

    // Track pending updates that need to be written
    // Map of noteId -> Array of updates
    this.pendingUpdates = new Map();
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
        // Only track local changes (not 'remote' or 'silent')
        if (origin !== 'remote' && origin !== 'silent') {
          // Store the update to be written as an append-only file
          if (!this.pendingUpdates.has(noteId)) {
            this.pendingUpdates.set(noteId, []);
          }
          this.pendingUpdates.get(noteId).push(Array.from(update));

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
   * This is used for TipTap integration
   * @param {string} noteId - Note ID
   * @param {object} note - Note object with content
   */
  initializeNote(noteId, note) {
    const doc = this.getDoc(noteId);

    // Use transact with 'silent' to avoid triggering update events
    doc.transact(() => {
      // Store metadata in a Y.Map
      const yMetadata = doc.getMap('metadata');

      // Only initialize if empty
      if (yMetadata.size === 0) {
        yMetadata.set('title', note.title || 'Untitled');
        yMetadata.set('created', note.created || new Date().toISOString());
        yMetadata.set('modified', note.modified || new Date().toISOString());
        yMetadata.set('tags', note.tags || []);
        yMetadata.set('folder', note.folder || null);
      }

      // For TipTap Collaboration: the content is stored in a Y.XmlFragment
      // named 'prosemirror' (this is what TipTap's Collaboration extension uses)
      // We don't manually initialize it here - TipTap will do it when the editor connects

    }, 'silent');

    console.log('Initialized CRDT document for note:', noteId);
  }

  /**
   * Get the Y.XmlFragment that TipTap uses for content
   * @param {string} noteId - Note ID
   * @returns {Y.XmlFragment} The fragment TipTap will use
   */
  getContentFragment(noteId) {
    const doc = this.getDoc(noteId);
    // TipTap's Collaboration extension uses a fragment named 'default'
    return doc.getXmlFragment('default');
  }

  /**
   * Extract note data from Y.Doc
   * @param {string} noteId - Note ID
   * @returns {object} Note object
   */
  getNoteFromDoc(noteId) {
    const doc = this.getDoc(noteId);

    const yMetadata = doc.getMap('metadata');

    // For content, we need to convert the Y.XmlFragment to TipTap JSON
    // This is used when loading notes
    const fragment = doc.getXmlFragment('default');

    // Convert Y.XmlFragment to plain object for storage
    // TipTap will handle the reverse when loading
    let content = { type: 'doc', content: [] };
    if (fragment.length > 0) {
      // The fragment contains the ProseMirror document structure
      // We'll let TipTap handle the serialization through its own methods
      content = null; // Will be handled by TipTap's getJSON()
    }

    return {
      id: noteId,
      title: yMetadata.get('title') || 'Untitled',
      content: content,
      created: yMetadata.get('created'),
      modified: yMetadata.get('modified'),
      tags: yMetadata.get('tags') || [],
      folder: yMetadata.get('folder') || null
    };
  }

  /**
   * Update note metadata (not content - content is handled by TipTap)
   * @param {string} noteId - Note ID
   * @param {object} updates - Updates to apply
   */
  updateMetadata(noteId, updates) {
    const doc = this.getDoc(noteId);

    doc.transact(() => {
      const yMetadata = doc.getMap('metadata');

      if (updates.title !== undefined) {
        yMetadata.set('title', updates.title);
      }

      // Update timestamp
      yMetadata.set('modified', new Date().toISOString());

      if (updates.tags !== undefined) {
        yMetadata.set('tags', updates.tags);
      }
      if (updates.folder !== undefined) {
        yMetadata.set('folder', updates.folder);
      }
    });

    console.log('Updated metadata for note:', noteId);
  }

  /**
   * Check if a doc is empty
   * @param {string} noteId - Note ID
   * @returns {boolean} True if doc is empty
   */
  isDocEmpty(noteId) {
    if (!this.docs.has(noteId)) {
      return true;
    }
    const doc = this.getDoc(noteId);
    const yMetadata = doc.getMap('metadata');
    return yMetadata.size === 0;
  }

  /**
   * Get CRDT state for serialization (full state)
   * @param {string} noteId - Note ID
   * @returns {Uint8Array} State vector as Uint8Array
   */
  getState(noteId) {
    const doc = this.getDoc(noteId);
    return Y.encodeStateAsUpdate(doc);
  }

  /**
   * Apply CRDT state update from external source
   * @param {string} noteId - Note ID
   * @param {Array|Uint8Array} state - State update
   * @param {string} origin - Origin marker (default: 'remote')
   */
  applyUpdate(noteId, state, origin = 'remote') {
    const doc = this.getDoc(noteId);
    const update = state instanceof Uint8Array ? state : new Uint8Array(state);
    Y.applyUpdate(doc, update, origin);
    console.log('Applied update for note:', noteId);
  }

  /**
   * Get pending updates for a note (to be written to files)
   * @param {string} noteId - Note ID
   * @returns {Array} Array of updates
   */
  getPendingUpdates(noteId) {
    const updates = this.pendingUpdates.get(noteId) || [];
    return updates;
  }

  /**
   * Clear pending updates after they've been written
   * @param {string} noteId - Note ID
   */
  clearPendingUpdates(noteId) {
    this.pendingUpdates.delete(noteId);
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
      this.pendingUpdates.delete(noteId);

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
      documents: Array.from(this.docs.keys()),
      pendingUpdates: Array.from(this.pendingUpdates.entries()).map(([noteId, updates]) => ({
        noteId,
        updateCount: updates.length
      }))
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
    this.pendingUpdates.clear();

    console.log('CRDT Manager destroyed');
  }
}
