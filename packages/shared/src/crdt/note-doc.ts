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

  constructor(noteId: UUID) {
    this.doc = new Y.Doc({ guid: noteId });
    this.metadata = this.doc.getMap('metadata');
    this.content = this.doc.getXmlFragment('content');
  }

  /**
   * Initialize a new note with metadata
   */
  initializeNote(meta: NoteMetadata): void {
    this.doc.transact(() => {
      this.metadata.set('id', meta.id);
      this.metadata.set('created', meta.created);
      this.metadata.set('modified', meta.modified);
      this.metadata.set('sdId', meta.sdId);
      this.metadata.set('folderId', meta.folderId);
      this.metadata.set('deleted', meta.deleted);
    });
  }

  /**
   * Get current note metadata
   */
  getMetadata(): NoteMetadata {
    return {
      id: this.metadata.get('id') as UUID,
      created: this.metadata.get('created') as number,
      modified: this.metadata.get('modified') as number,
      sdId: this.metadata.get('sdId') as UUID,
      folderId: (this.metadata.get('folderId') as UUID | null) ?? null,
      deleted: this.metadata.get('deleted') as boolean,
    };
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
