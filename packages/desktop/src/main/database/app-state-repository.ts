/**
 * App State Repository
 * Handles all app state operations
 */

import type { DatabaseAdapter, AppState } from '@notecove/shared';

export class AppStateRepository {
  constructor(private readonly adapter: DatabaseAdapter) {}

  async getState(key: string): Promise<string | null> {
    const row = await this.adapter.get<{ value: string }>(
      'SELECT value FROM app_state WHERE key = ?',
      [key]
    );

    return row?.value ?? null;
  }

  async setState(key: string, value: string): Promise<void> {
    await this.adapter.exec(
      'INSERT INTO app_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      [key, value]
    );
  }

  async deleteState(key: string): Promise<void> {
    await this.adapter.exec('DELETE FROM app_state WHERE key = ?', [key]);
  }

  async getAllState(): Promise<AppState[]> {
    const rows = await this.adapter.all<{ key: string; value: string }>('SELECT * FROM app_state');

    return rows.map((row) => ({ key: row.key, value: row.value }));
  }
}
