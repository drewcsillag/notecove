/**
 * User Repository
 * Handles all user operations
 */

import type { DatabaseAdapter, User, UUID } from '@notecove/shared';

export class UserRepository {
  constructor(private readonly adapter: DatabaseAdapter) {}

  async upsertUser(user: User): Promise<void> {
    await this.adapter.exec(
      `INSERT INTO users (id, username, last_seen)
       VALUES (?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         username = excluded.username,
         last_seen = excluded.last_seen`,
      [user.id, user.username, user.lastSeen]
    );
  }

  async getUser(userId: UUID): Promise<User | null> {
    const row = await this.adapter.get<{
      id: string;
      username: string;
      last_seen: number;
    }>('SELECT * FROM users WHERE id = ?', [userId]);

    return row ? { id: row.id, username: row.username, lastSeen: row.last_seen } : null;
  }

  async getAllUsers(): Promise<User[]> {
    const rows = await this.adapter.all<{
      id: string;
      username: string;
      last_seen: number;
    }>('SELECT * FROM users ORDER BY last_seen DESC');

    return rows.map((row) => ({
      id: row.id,
      username: row.username,
      lastSeen: row.last_seen,
    }));
  }
}
