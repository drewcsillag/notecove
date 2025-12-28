/**
 * Folder Handlers
 *
 * IPC handlers for folder operations: list, create, rename, delete, move, reorder.
 */

import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import type { HandlerContext } from './types';
import type { FolderData, NoteCache } from '@notecove/shared';
import { generateCompactId } from '@notecove/shared';

/**
 * Register all folder-related IPC handlers
 */
export function registerFolderHandlers(ctx: HandlerContext): void {
  ipcMain.handle('folder:list', handleListFolders(ctx));
  ipcMain.handle('folder:listAll', handleListAllFolders(ctx));
  ipcMain.handle('folder:get', handleGetFolder(ctx));
  ipcMain.handle('folder:getChildInfo', handleGetFolderChildInfo(ctx));
  ipcMain.handle('folder:create', handleCreateFolder(ctx));
  ipcMain.handle('folder:rename', handleRenameFolder(ctx));
  ipcMain.handle('folder:delete', handleDeleteFolder(ctx));
  ipcMain.handle('folder:move', handleMoveFolder(ctx));
  ipcMain.handle('folder:emitSelected', handleEmitFolderSelected(ctx));
  ipcMain.handle('folder:reorder', handleReorderFolder(ctx));
}

/**
 * Unregister all folder-related IPC handlers
 */
export function unregisterFolderHandlers(): void {
  ipcMain.removeHandler('folder:list');
  ipcMain.removeHandler('folder:listAll');
  ipcMain.removeHandler('folder:get');
  ipcMain.removeHandler('folder:getChildInfo');
  ipcMain.removeHandler('folder:create');
  ipcMain.removeHandler('folder:rename');
  ipcMain.removeHandler('folder:delete');
  ipcMain.removeHandler('folder:move');
  ipcMain.removeHandler('folder:emitSelected');
  ipcMain.removeHandler('folder:reorder');
}

// =============================================================================
// Handler Factories
// =============================================================================

function handleListFolders(ctx: HandlerContext) {
  return async (_event: IpcMainInvokeEvent, sdId: string): Promise<FolderData[]> => {
    const folderTree = await ctx.crdtManager.loadFolderTree(sdId);
    // Use getVisibleFolders to exclude orphaned folders (those with deleted ancestors)
    return folderTree.getVisibleFolders();
  };
}

function handleListAllFolders(ctx: HandlerContext) {
  return async (
    _event: IpcMainInvokeEvent
  ): Promise<{ sdId: string; sdName: string; folders: FolderData[] }[]> => {
    const { crdtManager, database } = ctx;

    const sds = await database.getAllStorageDirs();

    const allFolders = await Promise.all(
      sds.map(async (sd) => {
        const folderTree = await crdtManager.loadFolderTree(sd.id);
        return {
          sdId: sd.id,
          sdName: sd.name,
          // Use getVisibleFolders to exclude orphaned folders (those with deleted ancestors)
          folders: folderTree.getVisibleFolders(),
        };
      })
    );

    return allFolders;
  };
}

function handleGetFolder(ctx: HandlerContext) {
  return async (
    _event: IpcMainInvokeEvent,
    sdId: string,
    folderId: string
  ): Promise<FolderData | null> => {
    const folderTree = await ctx.crdtManager.loadFolderTree(sdId);
    return folderTree.getFolder(folderId);
  };
}

function handleCreateFolder(ctx: HandlerContext) {
  return async (
    _event: IpcMainInvokeEvent,
    sdId: string,
    parentId: string | null,
    name: string
  ): Promise<string> => {
    const { crdtManager, database, broadcastToAll } = ctx;

    // Validate name
    if (!name || name.trim().length === 0) {
      throw new Error('Folder name cannot be empty');
    }

    const trimmedName = name.trim();

    // Check for name conflicts with siblings
    const folderTree = await crdtManager.loadFolderTree(sdId);
    const siblings =
      parentId === null ? folderTree.getRootFolders() : folderTree.getChildFolders(parentId);

    const nameConflict = siblings.some((f) => f.name.toLowerCase() === trimmedName.toLowerCase());

    if (nameConflict) {
      throw new Error(`A folder named "${trimmedName}" already exists in this location`);
    }

    // Generate new folder ID
    const folderId = generateCompactId();

    // Find alphabetical insertion position among siblings (case-insensitive)
    const sortedSiblings = [...siblings].sort((a, b) =>
      a.name.toLowerCase().localeCompare(b.name.toLowerCase())
    );
    const insertIndex = sortedSiblings.findIndex(
      (f) => f.name.toLowerCase().localeCompare(trimmedName.toLowerCase()) > 0
    );
    const alphabeticalPosition = insertIndex === -1 ? sortedSiblings.length : insertIndex;

    // Create folder with a temporary order (will be corrected by reorder)
    const maxOrder = siblings.reduce((max, f) => Math.max(max, f.order), -1);
    const tempOrder = maxOrder + 1;

    // Create folder data
    const folderData: FolderData = {
      id: folderId,
      name: trimmedName,
      parentId,
      sdId,
      order: tempOrder,
      deleted: false,
    };

    // Update CRDT
    folderTree.createFolder(folderData);

    // Now reorder to the alphabetical position (this renumbers all siblings)
    if (siblings.length > 0) {
      folderTree.reorderFolder(folderId, alphabeticalPosition);
    }

    // Update SQLite cache for all siblings (reorder may have changed their orders)
    const updatedFolder = folderTree.getFolder(folderId);
    if (updatedFolder) {
      const allSiblings = folderTree.getSiblings(folderId);
      for (const sibling of allSiblings) {
        await database.upsertFolder(sibling);
      }
    }

    // Broadcast folder update to all windows
    broadcastToAll('folder:updated', { sdId, operation: 'create', folderId });

    return folderId;
  };
}

function handleRenameFolder(ctx: HandlerContext) {
  return async (
    _event: IpcMainInvokeEvent,
    sdId: string,
    folderId: string,
    newName: string
  ): Promise<void> => {
    const { crdtManager, database, broadcastToAll } = ctx;

    // Validate name
    if (!newName || newName.trim().length === 0) {
      throw new Error('Folder name cannot be empty');
    }

    const trimmedName = newName.trim();
    const folderTree = await crdtManager.loadFolderTree(sdId);
    const folder = folderTree.getFolder(folderId);

    if (!folder) {
      throw new Error(`Folder ${folderId} not found`);
    }

    // Check for name conflicts with siblings
    const siblings =
      folder.parentId === null
        ? folderTree.getRootFolders()
        : folderTree.getChildFolders(folder.parentId);

    const nameConflict = siblings.some(
      (f) => f.id !== folderId && f.name.toLowerCase() === trimmedName.toLowerCase()
    );

    if (nameConflict) {
      throw new Error(`A folder named "${trimmedName}" already exists in this location`);
    }

    // Update CRDT
    folderTree.updateFolder(folderId, { name: trimmedName });

    // Update SQLite cache
    await database.upsertFolder({
      ...folder,
      name: trimmedName,
    });

    // Broadcast folder update to all windows
    broadcastToAll('folder:updated', { sdId, operation: 'rename', folderId });
  };
}

/**
 * Get info about folder's children for confirmation dialog
 */
function handleGetFolderChildInfo(ctx: HandlerContext) {
  return async (
    _event: IpcMainInvokeEvent,
    sdId: string,
    folderId: string
  ): Promise<{ hasChildren: boolean; childCount: number; descendantCount: number }> => {
    const { crdtManager } = ctx;

    const folderTree = await crdtManager.loadFolderTree(sdId);
    const folder = folderTree.getFolder(folderId);

    if (!folder) {
      throw new Error(`Folder ${folderId} not found`);
    }

    const children = folderTree.getChildFolders(folderId);
    const descendants = folderTree.getDescendants(folderId);

    return {
      hasChildren: children.length > 0,
      childCount: children.length,
      descendantCount: descendants.length,
    };
  };
}

/**
 * Helper to move a note to a new folder, updating both CRDT and database
 */
async function moveNoteToFolder(
  ctx: HandlerContext,
  note: NoteCache,
  newFolderId: string | null
): Promise<void> {
  const { crdtManager, database, broadcastToAll } = ctx;
  const oldFolderId = note.folderId;

  // Update CRDT metadata
  let noteDoc = crdtManager.getNoteDoc(note.id);
  if (!noteDoc) {
    await crdtManager.loadNote(note.id, note.sdId);
    noteDoc = crdtManager.getNoteDoc(note.id);
  }

  if (noteDoc) {
    noteDoc.updateMetadata({
      folderId: newFolderId,
      modified: Date.now(),
    });
  } else {
    console.error(`[Folder] Failed to load NoteDoc for ${note.id}`);
  }

  // Update database
  await database.upsertNote({
    ...note,
    folderId: newFolderId,
    modified: Date.now(),
  });

  // Broadcast note:moved event
  broadcastToAll('note:moved', {
    noteId: note.id,
    oldFolderId,
    newFolderId,
  });
}

/**
 * Delete folder with mode:
 * - 'simple': Just delete the folder (no children check - UI handles confirmation)
 * - 'cascade': Delete folder and all descendants, move all notes to parent
 * - 'reparent': Delete folder only, move children to parent, move notes to parent
 */
function handleDeleteFolder(ctx: HandlerContext) {
  return async (
    _event: IpcMainInvokeEvent,
    sdId: string,
    folderId: string,
    mode: 'simple' | 'cascade' | 'reparent' = 'simple'
  ): Promise<void> => {
    const { crdtManager, database, broadcastToAll } = ctx;

    const folderTree = await crdtManager.loadFolderTree(sdId);
    const folder = folderTree.getFolder(folderId);

    if (!folder) {
      throw new Error(`Folder ${folderId} not found`);
    }

    const parentFolderId = folder.parentId; // null means root

    if (mode === 'cascade') {
      // Get all descendants before deleting
      const descendants = folderTree.getDescendants(folderId);
      const allFolderIds = [folderId, ...descendants.map((d) => d.id)];

      // Move all notes from all deleted folders to the parent folder
      for (const deletedFolderId of allFolderIds) {
        const notes = await database.getNotesByFolder(deletedFolderId);
        for (const note of notes) {
          await moveNoteToFolder(ctx, note, parentFolderId);
        }
      }

      // Delete all folders (folder + all descendants)
      for (const deletedFolderId of allFolderIds) {
        const folderToDelete = folderTree.getFolder(deletedFolderId);
        if (folderToDelete) {
          folderTree.deleteFolder(deletedFolderId);
          await database.upsertFolder({
            ...folderToDelete,
            deleted: true,
          });
        }
      }
    } else if (mode === 'reparent') {
      // Move notes from this folder to parent
      const notes = await database.getNotesByFolder(folderId);
      for (const note of notes) {
        await moveNoteToFolder(ctx, note, parentFolderId);
      }

      // Move child folders to parent
      const children = folderTree.getChildFolders(folderId);
      for (const child of children) {
        folderTree.updateFolder(child.id, { parentId: parentFolderId });
        await database.upsertFolder({
          ...child,
          parentId: parentFolderId,
        });
      }

      // Delete just this folder
      folderTree.deleteFolder(folderId);
      await database.upsertFolder({
        ...folder,
        deleted: true,
      });
    } else {
      // Simple mode - just delete the folder (legacy behavior)
      folderTree.deleteFolder(folderId);
      await database.upsertFolder({
        ...folder,
        deleted: true,
      });
    }

    // Broadcast folder update to all windows
    broadcastToAll('folder:updated', { sdId, operation: 'delete', folderId });
  };
}

function handleMoveFolder(ctx: HandlerContext) {
  return async (
    _event: IpcMainInvokeEvent,
    sdId: string,
    folderId: string,
    newParentId: string | null
  ): Promise<void> => {
    const { crdtManager, database, broadcastToAll } = ctx;

    const folderTree = await crdtManager.loadFolderTree(sdId);
    const folder = folderTree.getFolder(folderId);

    if (!folder) {
      throw new Error(`Folder ${folderId} not found`);
    }

    // Prevent moving folder to be its own descendant (circular reference)
    if (newParentId !== null) {
      const isDescendant = (ancestorId: string, descendantId: string): boolean => {
        let current = folderTree.getFolder(descendantId);
        while (current) {
          if (current.id === ancestorId) {
            return true;
          }
          if (current.parentId === null) {
            break;
          }
          current = folderTree.getFolder(current.parentId);
        }
        return false;
      };

      if (isDescendant(folderId, newParentId)) {
        throw new Error('Cannot move folder to be its own descendant');
      }
    }

    // Calculate new order (append to end of siblings)
    const siblings =
      newParentId === null ? folderTree.getRootFolders() : folderTree.getChildFolders(newParentId);

    const maxOrder = siblings.reduce((max, f) => Math.max(max, f.order), -1);
    const newOrder = maxOrder + 1;

    // Update CRDT
    folderTree.updateFolder(folderId, { parentId: newParentId, order: newOrder });

    // Update SQLite cache
    await database.upsertFolder({
      ...folder,
      parentId: newParentId,
      order: newOrder,
    });

    // Broadcast folder update to all windows
    broadcastToAll('folder:updated', { sdId, operation: 'move', folderId });
  };
}

function handleEmitFolderSelected(ctx: HandlerContext) {
  return (_event: IpcMainInvokeEvent, folderId: string): void => {
    ctx.broadcastToAll('folder:selected', folderId);
  };
}

function handleReorderFolder(ctx: HandlerContext) {
  return async (
    _event: IpcMainInvokeEvent,
    sdId: string,
    folderId: string,
    newIndex: number
  ): Promise<void> => {
    const { crdtManager, database, broadcastToAll } = ctx;

    const folderTree = await crdtManager.loadFolderTree(sdId);

    // Reorder in CRDT (this also renumbers all siblings)
    folderTree.reorderFolder(folderId, newIndex);

    // Update SQLite cache for all affected siblings
    const folder = folderTree.getFolder(folderId);
    if (folder) {
      const siblings = folderTree.getSiblings(folderId);
      for (const sibling of siblings) {
        await database.upsertFolder(sibling);
      }
    }

    // Broadcast folder update to all windows
    broadcastToAll('folder:updated', { sdId, operation: 'reorder', folderId });
  };
}
