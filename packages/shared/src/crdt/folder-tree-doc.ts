import * as Y from 'yjs';
import type { UUID, FolderData } from '../types';

/**
 * CRDT document for folder tree within a single Sync Directory (SD)
 * Each SD has its own independent folder hierarchy
 */
export class FolderTreeDoc {
  readonly doc: Y.Doc;
  readonly folders: Y.Map<Y.Map<unknown>>;

  constructor(sdId: string) {
    this.doc = new Y.Doc({ guid: `folder-tree:${sdId}` });
    this.folders = this.doc.getMap('folders');
  }

  /**
   * Create a new folder
   * @param folder Folder data
   * @param origin Optional origin for the transaction (e.g., 'load' to prevent persistence)
   */
  createFolder(folder: FolderData, origin?: unknown): void {
    this.doc.transact(() => {
      const folderMap = new Y.Map<unknown>();
      folderMap.set('id', folder.id);
      folderMap.set('name', folder.name);
      folderMap.set('parentId', folder.parentId);
      folderMap.set('sdId', folder.sdId);
      folderMap.set('order', folder.order);
      folderMap.set('deleted', folder.deleted);

      this.folders.set(folder.id, folderMap);
    }, origin);
  }

  /**
   * Update an existing folder
   */
  updateFolder(folderId: UUID, updates: Partial<Omit<FolderData, 'id' | 'sdId'>>): void {
    const folder = this.folders.get(folderId);
    if (!folder) {
      throw new Error(`Folder ${folderId} not found`);
    }

    console.log(`[FolderTreeDoc] updateFolder ${folderId}:`, {
      before: {
        name: folder.get('name'),
        parentId: folder.get('parentId'),
        order: folder.get('order'),
        deleted: folder.get('deleted'),
      },
      updates,
    });

    this.doc.transact(() => {
      if (updates.name !== undefined) {
        folder.set('name', updates.name);
      }
      if (updates.parentId !== undefined) {
        folder.set('parentId', updates.parentId);
      }
      if (updates.order !== undefined) {
        folder.set('order', updates.order);
      }
      if (updates.deleted !== undefined) {
        folder.set('deleted', updates.deleted);
      }
    });

    console.log(`[FolderTreeDoc] updateFolder ${folderId} after:`, {
      name: folder.get('name'),
      parentId: folder.get('parentId'),
      order: folder.get('order'),
      deleted: folder.get('deleted'),
    });
  }

  /**
   * Get a folder by ID
   */
  getFolder(folderId: UUID): FolderData | null {
    const folderMap = this.folders.get(folderId);
    if (!folderMap) {
      return null;
    }

    return {
      id: folderMap.get('id') as UUID,
      name: folderMap.get('name') as string,
      parentId: (folderMap.get('parentId') as UUID | null) ?? null,
      sdId: folderMap.get('sdId') as string,
      order: folderMap.get('order') as number,
      deleted: folderMap.get('deleted') as boolean,
    };
  }

  /**
   * Get all folders (including deleted)
   */
  getAllFolders(): FolderData[] {
    const result: FolderData[] = [];
    console.log(`[FolderTreeDoc] getAllFolders: folders.size = ${this.folders.size}`);
    this.folders.forEach((folderMap, key) => {
      const folderData = {
        id: folderMap.get('id') as UUID,
        name: folderMap.get('name') as string,
        parentId: (folderMap.get('parentId') as UUID | null) ?? null,
        sdId: folderMap.get('sdId') as string,
        order: folderMap.get('order') as number,
        deleted: folderMap.get('deleted') as boolean,
      };
      console.log(`[FolderTreeDoc]   folder ${key}:`, folderData);
      result.push(folderData);
    });
    console.log(`[FolderTreeDoc] getAllFolders returning ${result.length} folders`);
    return result;
  }

  /**
   * Get all non-deleted folders
   */
  getActiveFolders(): FolderData[] {
    return this.getAllFolders().filter((f) => !f.deleted);
  }

  /**
   * Get root-level folders (parentId === null)
   */
  getRootFolders(): FolderData[] {
    return this.getActiveFolders().filter((f) => f.parentId === null);
  }

  /**
   * Get child folders of a parent
   */
  getChildFolders(parentId: UUID): FolderData[] {
    return this.getActiveFolders().filter((f) => f.parentId === parentId);
  }

  /**
   * Mark folder as deleted (soft delete)
   */
  deleteFolder(folderId: UUID): void {
    this.updateFolder(folderId, { deleted: true });
  }

  /**
   * Get the current state as an update
   */
  encodeStateAsUpdate(): Uint8Array {
    return Y.encodeStateAsUpdate(this.doc);
  }

  /**
   * Apply an update from another instance
   * @param update Update bytes
   * @param origin Optional origin (e.g., 'load', 'external') to prevent re-persistence
   */
  applyUpdate(update: Uint8Array, origin?: unknown): void {
    Y.applyUpdate(this.doc, update, origin);
  }

  /**
   * Load from existing state
   */
  static fromUpdate(sdId: string, update: Uint8Array): FolderTreeDoc {
    const treeDoc = new FolderTreeDoc(sdId);
    treeDoc.applyUpdate(update);
    return treeDoc;
  }

  /**
   * Destroy the document and free resources
   */
  destroy(): void {
    this.doc.destroy();
  }
}
