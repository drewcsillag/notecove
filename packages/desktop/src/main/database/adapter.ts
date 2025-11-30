/**
 * SQLite Database Adapter using better-sqlite3
 *
 * Implements the DatabaseAdapter interface for Node.js using better-sqlite3.
 * This provides synchronous SQLite operations which are faster and simpler
 * than async alternatives in Node.js.
 */

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-require-imports
const BetterSqlite3 = require('better-sqlite3');
import type { DatabaseAdapter } from '@notecove/shared';
import type BetterSqlite3Type from 'better-sqlite3';

/**
 * Transforms hashtags in text to a tokenizer-friendly format.
 * Converts #tag to __hashtag__tag so FTS5 can distinguish hashtags from plain words.
 */
export function transformHashtags(text: string): string {
  // Match hashtags: # followed by word characters (letters, numbers, underscore)
  // This regex handles hashtags at word boundaries
  return text.replace(/#(\w+)/g, '__hashtag__$1');
}

export class BetterSqliteAdapter implements DatabaseAdapter {
  private db: BetterSqlite3Type.Database | null = null;

  constructor(private readonly dbPath: string) {}

  // eslint-disable-next-line @typescript-eslint/require-await
  async initialize(): Promise<void> {
    // better-sqlite3 is synchronous, so we just wrap in Promise
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    this.db = new BetterSqlite3(this.dbPath) as BetterSqlite3Type.Database;
    // Enable foreign keys
    this.db.pragma('foreign_keys = ON');

    // Register custom function for hashtag transformation in FTS indexing
    this.db.function('transform_hashtags', transformHashtags);
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async exec(sql: string, params: unknown[] = []): Promise<void> {
    this.ensureInitialized();
    // If params are provided, use prepare/run for single statement
    // If no params, use exec() which supports multiple statements
    if (params.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const stmt = this.db!.prepare(sql);
      stmt.run(...params);
    } else {
      // exec() supports multiple statements and doesn't return results
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      this.db!.exec(sql);
    }
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async run(sql: string, params: unknown[] = []): Promise<{ changes: number }> {
    this.ensureInitialized();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const stmt = this.db!.prepare(sql);
    const result = stmt.run(...params);
    return { changes: result.changes };
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async get<T>(sql: string, params: unknown[] = []): Promise<T | null> {
    this.ensureInitialized();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const stmt = this.db!.prepare(sql);
    const result = stmt.get(...params);
    return (result as T) ?? null;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async all<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    this.ensureInitialized();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const stmt = this.db!.prepare(sql);
    const results = stmt.all(...params);
    return results as T[];
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async beginTransaction(): Promise<void> {
    this.ensureInitialized();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    this.db!.exec('BEGIN TRANSACTION');
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async commit(): Promise<void> {
    this.ensureInitialized();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    this.db!.exec('COMMIT');
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async rollback(): Promise<void> {
    this.ensureInitialized();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    this.db!.exec('ROLLBACK');
  }

  private ensureInitialized(): void {
    if (!this.db) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
  }
}
