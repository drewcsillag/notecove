/**
 * Folder Repository
 * Handles all folder cache operations
 */

import type { DatabaseAdapter, FolderCache, UUID } from '@notecove/shared';

export class FolderRepository {
  constructor(private readonly adapter: DatabaseAdapter) {}

  async upsertFolder(folder: FolderCache): Promise<void> {
    await this.adapter.exec(
      `INSERT INTO folders (id, name, parent_id, sd_id, "order", deleted)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         parent_id = excluded.parent_id,
         sd_id = excluded.sd_id,
         "order" = excluded."order",
         deleted = excluded.deleted`,
      [folder.id, folder.name, folder.parentId, folder.sdId, folder.order, folder.deleted ? 1 : 0]
    );
  }

  async getFolder(folderId: UUID): Promise<FolderCache | null> {
    const row = await this.adapter.get<{
      id: string;
      name: string;
      parent_id: string | null;
      sd_id: string;
      order: number;
      deleted: number;
    }>('SELECT * FROM folders WHERE id = ?', [folderId]);

    return row ? this.mapFolderRow(row) : null;
  }

  async getFoldersBySd(sdId: string): Promise<FolderCache[]> {
    const rows = await this.adapter.all<{
      id: string;
      name: string;
      parent_id: string | null;
      sd_id: string;
      order: number;
      deleted: number;
    }>('SELECT * FROM folders WHERE sd_id = ? AND deleted = 0 ORDER BY "order"', [sdId]);

    return rows.map((row) => this.mapFolderRow(row));
  }

  async getRootFolders(sdId: string): Promise<FolderCache[]> {
    const rows = await this.adapter.all<{
      id: string;
      name: string;
      parent_id: string | null;
      sd_id: string;
      order: number;
      deleted: number;
    }>(
      'SELECT * FROM folders WHERE sd_id = ? AND parent_id IS NULL AND deleted = 0 ORDER BY "order"',
      [sdId]
    );

    return rows.map((row) => this.mapFolderRow(row));
  }

  async getChildFolders(parentId: UUID): Promise<FolderCache[]> {
    const rows = await this.adapter.all<{
      id: string;
      name: string;
      parent_id: string | null;
      sd_id: string;
      order: number;
      deleted: number;
    }>('SELECT * FROM folders WHERE parent_id = ? AND deleted = 0 ORDER BY "order"', [parentId]);

    return rows.map((row) => this.mapFolderRow(row));
  }

  async deleteFolder(folderId: UUID): Promise<void> {
    await this.adapter.exec('DELETE FROM folders WHERE id = ?', [folderId]);
  }

  private mapFolderRow(row: {
    id: string;
    name: string;
    parent_id: string | null;
    sd_id: string;
    order: number;
    deleted: number;
  }): FolderCache {
    return {
      id: row.id,
      name: row.name,
      parentId: row.parent_id,
      sdId: row.sd_id,
      order: row.order,
      deleted: row.deleted === 1,
    };
  }
}
