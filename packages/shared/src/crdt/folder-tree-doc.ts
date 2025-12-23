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
   * Get all non-deleted folders, sorted by order field (with name as secondary sort)
   */
  getActiveFolders(): FolderData[] {
    return this.getAllFolders()
      .filter((f) => !f.deleted)
      .sort((a, b) => {
        // Primary sort by order
        if (a.order !== b.order) {
          return a.order - b.order;
        }
        // Secondary sort by name (case-insensitive) for stability
        return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
      });
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
   * Get all descendant folders (children, grandchildren, etc.)
   * Returns folders in breadth-first order
   */
  getDescendants(folderId: UUID): FolderData[] {
    const allFolders = this.getAllFolders();
    const descendants: FolderData[] = [];
    const queue: UUID[] = [folderId];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      // Find all direct children of the current folder
      const children = allFolders.filter(
        (f) => f.parentId === currentId && !f.deleted && f.id !== folderId
      );
      for (const child of children) {
        descendants.push(child);
        queue.push(child.id);
      }
    }

    return descendants;
  }

  /**
   * Check if a folder has any deleted ancestor
   * Used to filter out orphaned folders whose parent was deleted
   */
  hasDeletedAncestor(folderId: UUID): boolean {
    let currentId: UUID | null = folderId;
    const allFolders = this.getAllFolders();

    while (currentId !== null) {
      const folder = allFolders.find((f) => f.id === currentId);
      if (!folder) {
        // Folder not found - treat as orphaned
        return true;
      }

      if (folder.parentId === null) {
        // Reached root without finding deleted ancestor
        return false;
      }

      const parent = allFolders.find((f) => f.id === folder.parentId);
      if (!parent) {
        // Parent not found - orphaned
        return true;
      }

      if (parent.deleted) {
        // Found a deleted ancestor
        return true;
      }

      currentId = parent.id;
    }

    return false;
  }

  /**
   * Get all visible folders (non-deleted AND without deleted ancestors)
   * This filters out both directly deleted folders and orphaned children
   */
  getVisibleFolders(): FolderData[] {
    return this.getAllFolders()
      .filter((f) => !f.deleted && !this.hasDeletedAncestor(f.id))
      .sort((a, b) => {
        // Primary sort by order
        if (a.order !== b.order) {
          return a.order - b.order;
        }
        // Secondary sort by name (case-insensitive) for stability
        return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
      });
  }

  /**
   * Mark folder as deleted (soft delete)
   */
  deleteFolder(folderId: UUID): void {
    this.updateFolder(folderId, { deleted: true });
  }

  /**
   * Get siblings of a folder (folders with the same parentId, including itself)
   */
  getSiblings(folderId: UUID): FolderData[] {
    const folder = this.getFolder(folderId);
    if (!folder) {
      return [];
    }

    return this.getActiveFolders().filter((f) => f.parentId === folder.parentId);
  }

  /**
   * Reorder a folder to a new position among its siblings.
   * This renumbers all siblings to maintain consecutive order values (0, 1, 2, ...).
   *
   * @param folderId The folder to reorder
   * @param newIndex The new position (0-based) among siblings
   */
  reorderFolder(folderId: UUID, newIndex: number): void {
    const folder = this.getFolder(folderId);
    if (!folder) {
      throw new Error(`Folder ${folderId} not found`);
    }

    // Get all siblings (including this folder), sorted by current order
    const siblings = this.getSiblings(folderId).sort((a, b) => a.order - b.order);

    if (siblings.length <= 1) {
      // Single folder or no siblings - ensure order is 0
      this.updateFolder(folderId, { order: 0 });
      return;
    }

    // Clamp newIndex to valid range
    const clampedIndex = Math.max(0, Math.min(newIndex, siblings.length - 1));

    // Remove the folder from its current position
    const currentIndex = siblings.findIndex((f) => f.id === folderId);
    if (currentIndex === -1) {
      return; // Shouldn't happen, but safety check
    }

    // Create new order by removing and inserting at new position
    const reordered = [...siblings];
    const [removed] = reordered.splice(currentIndex, 1);
    if (removed) {
      reordered.splice(clampedIndex, 0, removed);
    }

    // Update all siblings with consecutive order values
    this.doc.transact(() => {
      reordered.forEach((sibling, index) => {
        const folderMap = this.folders.get(sibling.id);
        if (folderMap && folderMap.get('order') !== index) {
          folderMap.set('order', index);
        }
      });
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
