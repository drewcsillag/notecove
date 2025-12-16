/**
 * Storage Directory Repository
 * Handles all storage directory operations
 */

import * as fs from 'fs';
import * as path from 'path';
import type { DatabaseAdapter, StorageDirCache } from '@notecove/shared';

export class StorageDirRepository {
  constructor(private readonly adapter: DatabaseAdapter) {}

  async createStorageDir(id: string, name: string, sdPath: string): Promise<StorageDirCache> {
    const created = Date.now();

    // Check if this is the first SD - if so, make it active
    const existing = await this.getAllStorageDirs();
    const isActive = existing.length === 0;

    // Create the directory on disk if it doesn't exist
    if (!fs.existsSync(sdPath)) {
      fs.mkdirSync(sdPath, { recursive: true });
    }

    // Create required subdirectories
    const notesDir = path.join(sdPath, 'notes');
    if (!fs.existsSync(notesDir)) {
      fs.mkdirSync(notesDir, { recursive: true });
    }

    // Note: SD_ID file is already created/migrated by handleCreateStorageDir
    // using migrateAndGetSdId(). We use the same id for both columns.
    await this.adapter.exec(
      'INSERT INTO storage_dirs (id, name, path, uuid, created, is_active) VALUES (?, ?, ?, ?, ?, ?)',
      [id, name, sdPath, id, created, isActive ? 1 : 0]
    );

    return { id, name, path: sdPath, uuid: id, created, isActive };
  }

  async getStorageDir(id: string): Promise<StorageDirCache | null> {
    const row = await this.adapter.get<{
      id: string;
      name: string;
      path: string;
      uuid: string | null;
      created: number;
      is_active: number;
    }>('SELECT * FROM storage_dirs WHERE id = ?', [id]);

    return row ? this.mapStorageDirRow(row) : null;
  }

  async getStorageDirByUuid(uuid: string): Promise<StorageDirCache | null> {
    const row = await this.adapter.get<{
      id: string;
      name: string;
      path: string;
      uuid: string | null;
      created: number;
      is_active: number;
    }>('SELECT * FROM storage_dirs WHERE uuid = ?', [uuid]);

    return row ? this.mapStorageDirRow(row) : null;
  }

  async getAllStorageDirs(): Promise<StorageDirCache[]> {
    const rows = await this.adapter.all<{
      id: string;
      name: string;
      path: string;
      uuid: string | null;
      created: number;
      is_active: number;
    }>('SELECT * FROM storage_dirs ORDER BY created ASC');

    return rows.map((row) => this.mapStorageDirRow(row));
  }

  async getActiveStorageDir(): Promise<StorageDirCache | null> {
    const row = await this.adapter.get<{
      id: string;
      name: string;
      path: string;
      uuid: string | null;
      created: number;
      is_active: number;
    }>('SELECT * FROM storage_dirs WHERE is_active = 1 LIMIT 1');

    return row ? this.mapStorageDirRow(row) : null;
  }

  async setActiveStorageDir(id: string): Promise<void> {
    // First, deactivate all SDs
    await this.adapter.exec('UPDATE storage_dirs SET is_active = 0');

    // Then activate the specified SD
    await this.adapter.exec('UPDATE storage_dirs SET is_active = 1 WHERE id = ?', [id]);
  }

  async deleteStorageDir(id: string): Promise<void> {
    // Delete all notes from this SD
    await this.adapter.exec('DELETE FROM notes WHERE sd_id = ?', [id]);

    // Delete all folders from this SD
    await this.adapter.exec('DELETE FROM folders WHERE sd_id = ?', [id]);

    // Delete the SD itself
    await this.adapter.exec('DELETE FROM storage_dirs WHERE id = ?', [id]);
  }

  /**
   * Clean up orphaned data (notes/folders/tags from deleted SDs)
   * This should be called on startup to ensure database integrity
   */
  async cleanupOrphanedData(): Promise<{
    notesDeleted: number;
    foldersDeleted: number;
    tagAssociationsDeleted: number;
    unusedTagsDeleted: number;
  }> {
    console.log('[Database] Cleaning up orphaned data...');

    // Cast adapter to a type with run() method
    const adapter = this.adapter as DatabaseAdapter & {
      run(sql: string, params?: unknown[]): Promise<{ changes: number }>;
    };

    // Delete orphaned notes (notes from SDs that no longer exist)
    const notesResult = await adapter.run(
      'DELETE FROM notes WHERE sd_id NOT IN (SELECT id FROM storage_dirs)'
    );

    // Delete orphaned folders
    const foldersResult = await adapter.run(
      'DELETE FROM folders WHERE sd_id NOT IN (SELECT id FROM storage_dirs)'
    );

    // Delete orphaned tag associations (tags for notes that no longer exist)
    const tagAssociationsResult = await adapter.run(
      'DELETE FROM note_tags WHERE note_id NOT IN (SELECT id FROM notes)'
    );

    // Delete unused tags (tags with no note associations)
    const unusedTagsResult = await adapter.run(
      'DELETE FROM tags WHERE id NOT IN (SELECT DISTINCT tag_id FROM note_tags)'
    );

    const notesDeleted = notesResult.changes;
    const foldersDeleted = foldersResult.changes;
    const tagAssociationsDeleted = tagAssociationsResult.changes;
    const unusedTagsDeleted = unusedTagsResult.changes;

    const result = {
      notesDeleted,
      foldersDeleted,
      tagAssociationsDeleted,
      unusedTagsDeleted,
    };

    if (
      result.notesDeleted > 0 ||
      result.foldersDeleted > 0 ||
      result.tagAssociationsDeleted > 0 ||
      result.unusedTagsDeleted > 0
    ) {
      console.log(
        `[Database] Cleaned up ${result.notesDeleted} orphaned note(s), ${result.foldersDeleted} orphaned folder(s), ${result.tagAssociationsDeleted} orphaned tag association(s), ${result.unusedTagsDeleted} unused tag(s)`
      );
    } else {
      console.log('[Database] No orphaned data found');
    }

    return result;
  }

  async updateStorageDirPath(id: string, newPath: string): Promise<void> {
    await this.adapter.exec('UPDATE storage_dirs SET path = ? WHERE id = ?', [newPath, id]);
  }

  /**
   * Rename a storage directory
   * @param id Storage directory ID
   * @param newName New name (1-255 chars, will be trimmed)
   * @throws Error if name is empty, whitespace-only, too long, already exists, or SD not found
   */
  async updateStorageDirName(id: string, newName: string): Promise<void> {
    // Trim whitespace from name
    const trimmedName = newName.trim();

    // Validate: non-empty
    if (trimmedName.length === 0) {
      throw new Error('Storage directory name cannot be empty');
    }

    // Validate: max length
    if (trimmedName.length > 255) {
      throw new Error('Storage directory name cannot exceed 255 characters');
    }

    // Check that the SD exists
    const existing = await this.getStorageDir(id);
    if (!existing) {
      throw new Error('Storage directory not found');
    }

    // Check for duplicate name (excluding self)
    const duplicate = await this.adapter.get<{ id: string }>(
      'SELECT id FROM storage_dirs WHERE name = ? AND id != ?',
      [trimmedName, id]
    );
    if (duplicate) {
      throw new Error('A storage directory with this name already exists');
    }

    // Update the name
    await this.adapter.exec('UPDATE storage_dirs SET name = ? WHERE id = ?', [trimmedName, id]);
  }

  private mapStorageDirRow(row: {
    id: string;
    name: string;
    path: string;
    uuid: string | null;
    created: number;
    is_active: number;
  }): StorageDirCache {
    return {
      id: row.id,
      name: row.name,
      path: row.path,
      uuid: row.uuid,
      created: row.created,
      isActive: row.is_active === 1,
    };
  }
}
