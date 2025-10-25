/**
 * App State Storage
 *
 * Temporary in-memory implementation for storing app state.
 *
 * TODO: Replace with SQLite (better-sqlite3) implementation.
 * Database schema is already defined in packages/shared/src/database/schema.ts
 * The implementation was deferred from Phase 1.5 and should be completed
 * in a dedicated phase for database operations (likely before Phase 3).
 */

export class AppStateStorage {
  private state = new Map<string, string>();

  // eslint-disable-next-line @typescript-eslint/require-await
  async get(key: string): Promise<string | null> {
    return this.state.get(key) ?? null;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async set(key: string, value: string): Promise<void> {
    this.state.set(key, value);
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async delete(key: string): Promise<void> {
    this.state.delete(key);
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async clear(): Promise<void> {
    this.state.clear();
  }
}

// Global instance
export const appStateStorage = new AppStateStorage();
