import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FolderManager } from './folder-manager';
import { NoteManager } from './note-manager';
import { SyncManager } from './sync-manager';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Test folder deletion sync between two instances
 */
describe('Folder Deletion Sync', () => {
  let testDir: string;
  let mockFileSystemAPI: any;

  beforeEach(() => {
    testDir = path.join(os.tmpdir(), `notecove-folder-del-test-${Date.now()}`);
    fs.mkdirSync(testDir, { recursive: true });

    // Mock Electron File System API
    mockFileSystemAPI = {
      exists: (filePath: string) => {
        return Promise.resolve(fs.existsSync(filePath));
      },
      readDir: (dirPath: string) => {
        try {
          const files = fs.readdirSync(dirPath);
          return Promise.resolve({ success: true, files });
        } catch (error: any) {
          return Promise.resolve({ success: false, error: error.message });
        }
      },
      readFile: (filePath: string) => {
        try {
          const content = fs.readFileSync(filePath);
          return Promise.resolve({ success: true, content: Uint8Array.from(content) });
        } catch (error: any) {
          return Promise.resolve({ success: false, error: error.message });
        }
      },
      writeFile: (filePath: string, content: string | Uint8Array) => {
        try {
          const dir = path.dirname(filePath);
          fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(filePath, content, 'utf8');
          return Promise.resolve({ success: true });
        } catch (error: any) {
          return Promise.resolve({ success: false, error: error.message });
        }
      },
      mkdir: (dirPath: string) => {
        try {
          fs.mkdirSync(dirPath, { recursive: true });
          return Promise.resolve({ success: true });
        } catch (error: any) {
          return Promise.resolve({ success: false, error: error.message });
        }
      }
    };

    global.window = {
      electronAPI: {
        isElectron: true,
        fileSystem: mockFileSystemAPI
      }
    } as any;
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    delete (global as any).window;
  });

  it('should sync folder deletion between two instances', async () => {
    const instanceId1 = 'instance-1';
    const instanceId2 = 'instance-2';

    // ============================================================
    // INSTANCE 1: Create a folder
    // ============================================================
    console.log('\n=== INSTANCE 1: Creating folder ===');

    const noteManager1 = new NoteManager();
    const syncManager1 = new SyncManager(noteManager1, testDir, instanceId1);
    await noteManager1.setSyncManager(syncManager1);

    const folderManager1 = noteManager1.getFolderManager();
    console.log('Instance 1 has', folderManager1.folders.size, 'folders');

    // Create a custom folder
    const testFolder = await folderManager1.createFolder('Test Folder', 'root');
    console.log('Created folder:', testFolder.id, testFolder.name);

    // Flush updates to disk
    await syncManager1.updateStore.flush('.folders');
    console.log('Flushed updates to disk');

    // Check that folder exists in CRDT
    const yDoc1 = syncManager1.crdtManager.getDoc('.folders');
    const yMap1 = yDoc1.getMap('folders');
    console.log('Y.Map has', yMap1.size, 'folders');
    expect(yMap1.has(testFolder.id)).toBe(true);

    // ============================================================
    // INSTANCE 2: Load the folder
    // ============================================================
    console.log('\n=== INSTANCE 2: Loading folder ===');

    const noteManager2 = new NoteManager();
    const syncManager2 = new SyncManager(noteManager2, testDir, instanceId2);
    await noteManager2.setSyncManager(syncManager2);

    const folderManager2 = noteManager2.getFolderManager();
    console.log('Instance 2 has', folderManager2.folders.size, 'folders');

    // Check that folder exists in instance 2
    const folder2 = folderManager2.getFolder(testFolder.id);
    expect(folder2).toBeDefined();
    expect(folder2?.name).toBe('Test Folder');
    console.log('Instance 2 loaded folder:', folder2?.id, folder2?.name);

    // ============================================================
    // INSTANCE 1: Delete the folder
    // ============================================================
    console.log('\n=== INSTANCE 1: Deleting folder ===');

    await folderManager1.deleteFolder(testFolder.id);
    console.log('Deleted folder from instance 1');

    // Check that folder is gone from CRDT in instance 1
    expect(yMap1.has(testFolder.id)).toBe(false);
    console.log('Folder removed from Y.Map in instance 1');

    // Flush deletion to disk
    await syncManager1.updateStore.flush('.folders');
    console.log('Flushed deletion to disk');

    // ============================================================
    // INSTANCE 2: Sync and verify deletion
    // ============================================================
    console.log('\n=== INSTANCE 2: Syncing deletion ===');

    // Manually trigger sync (normally happens every 2s)
    await syncManager2.syncFolders();
    console.log('Synced folders in instance 2');

    // Verify folder is deleted in instance 2
    const deletedFolder = folderManager2.getFolder(testFolder.id);
    expect(deletedFolder).toBeNull();
    console.log('Folder successfully deleted from instance 2');

    // Clean up
    await syncManager1.destroy();
    await syncManager2.destroy();
  });
});
