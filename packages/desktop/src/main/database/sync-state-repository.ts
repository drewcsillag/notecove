/**
 * Sync State Repository
 * Handles note and folder sync state operations
 */

import type { DatabaseAdapter, NoteSyncState, FolderSyncState } from '@notecove/shared';

export class SyncStateRepository {
  constructor(private readonly adapter: DatabaseAdapter) {}

  // Note Sync State Operations

  async getNoteSyncState(noteId: string, sdId: string): Promise<NoteSyncState | null> {
    const row = await this.adapter.get<{
      note_id: string;
      sd_id: string;
      vector_clock: string;
      document_state: Buffer;
      updated_at: number;
    }>('SELECT * FROM note_sync_state WHERE note_id = ? AND sd_id = ?', [noteId, sdId]);

    if (!row) return null;

    return {
      noteId: row.note_id,
      sdId: row.sd_id,
      vectorClock: row.vector_clock,
      documentState: new Uint8Array(row.document_state),
      updatedAt: row.updated_at,
    };
  }

  async upsertNoteSyncState(state: NoteSyncState): Promise<void> {
    await this.adapter.exec(
      `INSERT INTO note_sync_state (note_id, sd_id, vector_clock, document_state, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(note_id, sd_id) DO UPDATE SET
         vector_clock = excluded.vector_clock,
         document_state = excluded.document_state,
         updated_at = excluded.updated_at`,
      [
        state.noteId,
        state.sdId,
        state.vectorClock,
        Buffer.from(state.documentState),
        state.updatedAt,
      ]
    );
  }

  async deleteNoteSyncState(noteId: string, sdId: string): Promise<void> {
    await this.adapter.exec('DELETE FROM note_sync_state WHERE note_id = ? AND sd_id = ?', [
      noteId,
      sdId,
    ]);
  }

  async getNoteSyncStatesBySd(sdId: string): Promise<NoteSyncState[]> {
    const rows = await this.adapter.all<{
      note_id: string;
      sd_id: string;
      vector_clock: string;
      document_state: Buffer;
      updated_at: number;
    }>('SELECT * FROM note_sync_state WHERE sd_id = ?', [sdId]);

    return rows.map((row) => ({
      noteId: row.note_id,
      sdId: row.sd_id,
      vectorClock: row.vector_clock,
      documentState: new Uint8Array(row.document_state),
      updatedAt: row.updated_at,
    }));
  }

  async deleteNoteSyncStatesBySd(sdId: string): Promise<void> {
    await this.adapter.exec('DELETE FROM note_sync_state WHERE sd_id = ?', [sdId]);
  }

  // Folder Sync State Operations

  async getFolderSyncState(sdId: string): Promise<FolderSyncState | null> {
    const row = await this.adapter.get<{
      sd_id: string;
      vector_clock: string;
      document_state: Buffer;
      updated_at: number;
    }>('SELECT * FROM folder_sync_state WHERE sd_id = ?', [sdId]);

    if (!row) return null;

    return {
      sdId: row.sd_id,
      vectorClock: row.vector_clock,
      documentState: new Uint8Array(row.document_state),
      updatedAt: row.updated_at,
    };
  }

  async upsertFolderSyncState(state: FolderSyncState): Promise<void> {
    await this.adapter.exec(
      `INSERT INTO folder_sync_state (sd_id, vector_clock, document_state, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(sd_id) DO UPDATE SET
         vector_clock = excluded.vector_clock,
         document_state = excluded.document_state,
         updated_at = excluded.updated_at`,
      [state.sdId, state.vectorClock, Buffer.from(state.documentState), state.updatedAt]
    );
  }

  async deleteFolderSyncState(sdId: string): Promise<void> {
    await this.adapter.exec('DELETE FROM folder_sync_state WHERE sd_id = ?', [sdId]);
  }
}
