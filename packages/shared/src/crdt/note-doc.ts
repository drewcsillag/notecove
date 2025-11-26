import * as Y from 'yjs';
import type { UUID, NoteMetadata } from '../types';

/**
 * CRDT document for a single note
 * Uses Y.XmlFragment for rich text content (compatible with TipTap/ProseMirror)
 */
export class NoteDoc {
  readonly doc: Y.Doc;
  readonly metadata: Y.Map<unknown>;
  readonly content: Y.XmlFragment;

  constructor(noteId: UUID, existingDoc?: Y.Doc) {
    this.doc = existingDoc ?? new Y.Doc({ guid: noteId });
    this.metadata = this.doc.getMap('metadata');
    this.content = this.doc.getXmlFragment('content');
  }

  /**
   * Initialize a new note with metadata and empty content structure
   */
  initializeNote(meta: NoteMetadata): void {
    this.doc.transact(() => {
      // Set metadata
      this.metadata.set('id', meta.id);
      this.metadata.set('created', meta.created);
      this.metadata.set('modified', meta.modified);
      this.metadata.set('sdId', meta.sdId);
      this.metadata.set('folderId', meta.folderId);
      this.metadata.set('deleted', meta.deleted);
      this.metadata.set('pinned', meta.pinned);

      // Initialize empty ProseMirror structure
      // This ensures iOS can extract a title (even if empty) instead of "Untitled"
      if (this.content.length === 0) {
        const paragraph = new Y.XmlElement('paragraph');
        this.content.insert(0, [paragraph]);
      }
    });
  }

  /**
   * Get current note metadata
   *
   * Provides defensive fallbacks for fields that may be undefined when loading
   * notes from another instance's CRDT (cross-machine sync scenario).
   * This prevents NOT NULL constraint failures in SQLite.
   *
   * Note: id and sdId do not have fallbacks as they are critical identifiers
   * that must be set during note initialization.
   */
  getMetadata(): NoteMetadata {
    const now = Date.now();
    return {
      id: this.metadata.get('id') as UUID,
      // Fallback to current time if created/modified are undefined (partial sync)
      created: (this.metadata.get('created') as number | undefined) ?? now,
      modified: (this.metadata.get('modified') as number | undefined) ?? now,
      sdId: this.metadata.get('sdId') as UUID,
      folderId: (this.metadata.get('folderId') as UUID | null) ?? null,
      // Fallback to false if deleted is undefined (common during cross-instance sync)
      deleted: (this.metadata.get('deleted') as boolean | undefined) ?? false,
      // Fallback to false if pinned is undefined (common during cross-instance sync)
      pinned: (this.metadata.get('pinned') as boolean | undefined) ?? false,
    };
  }

  /**
   * Check if this note has been initialized with metadata.
   * Returns false if any required metadata fields are missing.
   */
  hasMetadata(): boolean {
    return (
      this.metadata.has('id') &&
      this.metadata.has('sdId') &&
      this.metadata.has('created') &&
      this.metadata.has('modified')
    );
  }

  /**
   * Update note metadata (e.g., move to different folder)
   */
  updateMetadata(updates: Partial<Omit<NoteMetadata, 'id' | 'created'>>): void {
    this.doc.transact(() => {
      if (updates.modified !== undefined) {
        this.metadata.set('modified', updates.modified);
      }
      if (updates.sdId !== undefined) {
        this.metadata.set('sdId', updates.sdId);
      }
      if (updates.folderId !== undefined) {
        this.metadata.set('folderId', updates.folderId);
      }
      if (updates.deleted !== undefined) {
        this.metadata.set('deleted', updates.deleted);
      }
      if (updates.pinned !== undefined) {
        this.metadata.set('pinned', updates.pinned);
      }
    });
  }

  /**
   * Mark note as deleted (soft delete)
   */
  markDeleted(): void {
    this.updateMetadata({
      deleted: true,
      modified: Date.now(),
    });
  }

  /**
   * Mark note as restored (undelete)
   */
  markRestored(): void {
    this.updateMetadata({
      deleted: false,
      modified: Date.now(),
    });
  }

  /**
   * Get the current state as an update
   */
  encodeStateAsUpdate(): Uint8Array {
    return Y.encodeStateAsUpdate(this.doc);
  }

  /**
   * Apply an update from another instance
   */
  applyUpdate(update: Uint8Array): void {
    Y.applyUpdate(this.doc, update);
  }

  /**
   * Load from existing state
   */
  static fromUpdate(noteId: UUID, update: Uint8Array): NoteDoc {
    const noteDoc = new NoteDoc(noteId);
    noteDoc.applyUpdate(update);
    return noteDoc;
  }

  /**
   * Destroy the document and free resources
   */
  destroy(): void {
    this.doc.destroy();
  }
}
