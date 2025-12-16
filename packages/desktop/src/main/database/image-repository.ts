/**
 * Image Repository
 * Handles image cache operations
 */

import type { DatabaseAdapter, ImageCache, UUID } from '@notecove/shared';

export class ImageRepository {
  constructor(private readonly adapter: DatabaseAdapter) {}

  async upsertImage(image: ImageCache): Promise<void> {
    await this.adapter.exec(
      `INSERT INTO images (id, sd_id, filename, mime_type, width, height, size, created)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         sd_id = excluded.sd_id,
         filename = excluded.filename,
         mime_type = excluded.mime_type,
         width = excluded.width,
         height = excluded.height,
         size = excluded.size,
         created = excluded.created`,
      [
        image.id,
        image.sdId,
        image.filename,
        image.mimeType,
        image.width,
        image.height,
        image.size,
        image.created,
      ]
    );
  }

  async getImage(imageId: UUID): Promise<ImageCache | null> {
    const row = await this.adapter.get<{
      id: string;
      sd_id: string;
      filename: string;
      mime_type: string;
      width: number | null;
      height: number | null;
      size: number;
      created: number;
    }>('SELECT * FROM images WHERE id = ?', [imageId]);

    if (!row) return null;

    return {
      id: row.id,
      sdId: row.sd_id,
      filename: row.filename,
      mimeType: row.mime_type,
      width: row.width,
      height: row.height,
      size: row.size,
      created: row.created,
    };
  }

  async getImagesBySd(sdId: string): Promise<ImageCache[]> {
    const rows = await this.adapter.all<{
      id: string;
      sd_id: string;
      filename: string;
      mime_type: string;
      width: number | null;
      height: number | null;
      size: number;
      created: number;
    }>('SELECT * FROM images WHERE sd_id = ? ORDER BY created DESC', [sdId]);

    return rows.map((row) => ({
      id: row.id,
      sdId: row.sd_id,
      filename: row.filename,
      mimeType: row.mime_type,
      width: row.width,
      height: row.height,
      size: row.size,
      created: row.created,
    }));
  }

  async deleteImage(imageId: UUID): Promise<void> {
    await this.adapter.exec('DELETE FROM images WHERE id = ?', [imageId]);
  }

  async imageExists(imageId: UUID): Promise<boolean> {
    const row = await this.adapter.get<{ count: number }>(
      'SELECT COUNT(*) as count FROM images WHERE id = ?',
      [imageId]
    );
    return (row?.count ?? 0) > 0;
  }

  async getImageStorageSize(sdId: string): Promise<number> {
    const row = await this.adapter.get<{ total: number | null }>(
      'SELECT SUM(size) as total FROM images WHERE sd_id = ?',
      [sdId]
    );
    return row?.total ?? 0;
  }

  async getImageCount(sdId: string): Promise<number> {
    const row = await this.adapter.get<{ count: number }>(
      'SELECT COUNT(*) as count FROM images WHERE sd_id = ?',
      [sdId]
    );
    return row?.count ?? 0;
  }
}
