/**
 * Schema Repository
 * Handles schema version tracking and migrations
 */

import { SCHEMA_SQL, SCHEMA_VERSION } from '@notecove/shared';
import type { DatabaseAdapter, SchemaVersionRecord } from '@notecove/shared';

export class SchemaRepository {
  constructor(private readonly adapter: DatabaseAdapter) {}

  async getCurrentVersion(): Promise<number | null> {
    const row = await this.adapter.get<{ version: number }>(
      'SELECT version FROM schema_version ORDER BY version DESC LIMIT 1'
    );

    return row?.version ?? null;
  }

  async getVersionHistory(): Promise<SchemaVersionRecord[]> {
    const rows = await this.adapter.all<{
      version: number;
      applied_at: number;
      description: string;
    }>('SELECT * FROM schema_version ORDER BY version DESC');

    return rows.map((row) => ({
      version: row.version,
      appliedAt: row.applied_at,
      description: row.description,
    }));
  }

  async recordVersion(version: number, description: string): Promise<void> {
    await this.adapter.exec(
      'INSERT OR IGNORE INTO schema_version (version, applied_at, description) VALUES (?, ?, ?)',
      [version, Date.now(), description]
    );
  }

  /**
   * Create database schema
   */
  async createSchema(): Promise<void> {
    // Create tables in order (respecting foreign keys)
    await this.adapter.exec(SCHEMA_SQL.version);
    await this.adapter.exec(SCHEMA_SQL.storageDirs);
    await this.adapter.exec(SCHEMA_SQL.noteMoves);
    await this.adapter.exec(SCHEMA_SQL.notes);

    // Create FTS5 table without external content for simplicity
    // This stores its own copy of the data
    await this.adapter.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
        note_id UNINDEXED,
        title,
        content
      );
    `);

    // Triggers to keep FTS index in sync
    // Use transform_hashtags() to convert #tag to __hashtag__tag for proper hashtag search
    await this.adapter.exec(`
      CREATE TRIGGER IF NOT EXISTS notes_ai AFTER INSERT ON notes BEGIN
        INSERT INTO notes_fts(note_id, title, content)
        VALUES (new.id, transform_hashtags(new.title), transform_hashtags(new.content_text));
      END;
    `);

    await this.adapter.exec(`
      CREATE TRIGGER IF NOT EXISTS notes_ad AFTER DELETE ON notes BEGIN
        DELETE FROM notes_fts WHERE note_id = old.id;
      END;
    `);

    await this.adapter.exec(`
      CREATE TRIGGER IF NOT EXISTS notes_au AFTER UPDATE ON notes BEGIN
        UPDATE notes_fts SET title = transform_hashtags(new.title), content = transform_hashtags(new.content_text)
        WHERE note_id = new.id;
      END;
    `);

    await this.adapter.exec(SCHEMA_SQL.folders);
    await this.adapter.exec(SCHEMA_SQL.tags);
    await this.adapter.exec(SCHEMA_SQL.noteTags);
    await this.adapter.exec(SCHEMA_SQL.noteLinks);
    await this.adapter.exec(SCHEMA_SQL.checkboxes);
    await this.adapter.exec(SCHEMA_SQL.users);
    await this.adapter.exec(SCHEMA_SQL.appState);

    // New tables for append-only log storage format (v6)
    await this.adapter.exec(SCHEMA_SQL.noteSyncState);
    await this.adapter.exec(SCHEMA_SQL.folderSyncState);
    await this.adapter.exec(SCHEMA_SQL.activityLogState);
    await this.adapter.exec(SCHEMA_SQL.sequenceState);

    // Profile presence cache for Stale Sync UI
    await this.adapter.exec(SCHEMA_SQL.profilePresenceCache);

    // Images table for image metadata (v8)
    await this.adapter.exec(SCHEMA_SQL.images);

    // Comment tables for note comments (v9)
    await this.adapter.exec(SCHEMA_SQL.commentThreads);
    await this.adapter.exec(SCHEMA_SQL.commentReplies);
    await this.adapter.exec(SCHEMA_SQL.commentReactions);
  }

  /**
   * Ensure schema version is current
   */
  async ensureSchemaVersion(): Promise<void> {
    const currentVersion = await this.getCurrentVersion();

    if (currentVersion === null) {
      // First time setup - run all migrations to ensure indexes etc are created
      // Migrations are idempotent so this is safe
      await this.runMigrations(0);
      await this.recordVersion(SCHEMA_VERSION, 'Initial schema');
    } else if (currentVersion < SCHEMA_VERSION) {
      // Run migrations sequentially
      await this.runMigrations(currentVersion);
    }
  }

  /**
   * Run migrations from currentVersion to SCHEMA_VERSION
   */
  async runMigrations(fromVersion: number): Promise<void> {
    console.log(`[Database] Running migrations from v${fromVersion} to v${SCHEMA_VERSION}`);

    // Migration v6 -> v7: Add instance_id column to profile_presence_cache
    if (fromVersion < 7) {
      await this.migrateToVersion7();
    }

    // Migration v7 -> v8: Add images table
    if (fromVersion < 8) {
      await this.migrateToVersion8();
    }

    // Migration v8 -> v9: Add comment tables
    if (fromVersion < 9) {
      await this.migrateToVersion9();
    }

    // Migration v9 -> v10: Clear contentText to force re-extraction with proper newlines
    if (fromVersion < 10) {
      await this.migrateToVersion10();
    }

    // Add future migrations here following the pattern:
    // if (fromVersion < N) { await this.migrateToVersionN(); }
  }

  /**
   * Migration to version 7:
   * - Add instance_id column to profile_presence_cache table
   * - Add index on (instance_id, sd_id) for efficient lookups
   */
  private async migrateToVersion7(): Promise<void> {
    console.log('[Database] Migrating to v7: Adding instance_id to profile_presence_cache');

    // Check if the column already exists (idempotent migration)
    const tableInfo = await this.adapter.all<{ name: string }>(
      "PRAGMA table_info('profile_presence_cache')"
    );
    const hasInstanceId = tableInfo.some((col) => col.name === 'instance_id');

    if (!hasInstanceId) {
      // Add the instance_id column
      await this.adapter.exec('ALTER TABLE profile_presence_cache ADD COLUMN instance_id TEXT');
      console.log('[Database] Added instance_id column to profile_presence_cache');
    }

    // Create the index if it doesn't exist (CREATE INDEX IF NOT EXISTS is safe)
    await this.adapter.exec(
      'CREATE INDEX IF NOT EXISTS idx_profile_presence_cache_instance_id ON profile_presence_cache(instance_id, sd_id)'
    );
    console.log('[Database] Created/verified idx_profile_presence_cache_instance_id index');

    // Record the migration
    await this.recordVersion(7, 'Added instance_id column and index to profile_presence_cache');
    console.log('[Database] Migration to v7 complete');
  }

  /**
   * Migration to version 8:
   * - Add images table for image metadata caching
   */
  private async migrateToVersion8(): Promise<void> {
    console.log('[Database] Migrating to v8: Adding images table');

    // Create the images table (CREATE TABLE IF NOT EXISTS is safe)
    await this.adapter.exec(SCHEMA_SQL.images);
    console.log('[Database] Created/verified images table');

    // Record the migration
    await this.recordVersion(8, 'Added images table for image metadata');
    console.log('[Database] Migration to v8 complete');
  }

  /**
   * Migration to version 9:
   * - Add comment_threads, comment_replies, comment_reactions tables for note comments
   */
  private async migrateToVersion9(): Promise<void> {
    console.log('[Database] Migrating to v9: Adding comment tables');

    // Create the comment tables (CREATE TABLE IF NOT EXISTS is safe)
    await this.adapter.exec(SCHEMA_SQL.commentThreads);
    console.log('[Database] Created/verified comment_threads table');

    await this.adapter.exec(SCHEMA_SQL.commentReplies);
    console.log('[Database] Created/verified comment_replies table');

    await this.adapter.exec(SCHEMA_SQL.commentReactions);
    console.log('[Database] Created/verified comment_reactions table');

    // Record the migration
    await this.recordVersion(9, 'Added comment tables for note comments');
    console.log('[Database] Migration to v9 complete');
  }

  /**
   * Migration to version 10:
   * - No-op migration, just records version bump
   * - The actual fix is in TipTapEditor.tsx (using newlines between blocks)
   * - Snippets will be regenerated when notes are edited
   */
  private async migrateToVersion10(): Promise<void> {
    console.log('[Database] Migrating to v10: Schema version bump for snippet fix');

    // Record the migration - the actual fix is in code, not database
    // Snippets are regenerated when notes are edited
    await this.recordVersion(10, 'Schema version bump for snippet extraction fix');
    console.log('[Database] Migration to v10 complete');
  }
}
