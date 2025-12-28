/**
 * SD ID Unification Tests
 *
 * Tests for Phase 3: Unifying SD ID files to use SD_ID standard
 *
 * Problem: Two different SD ID systems exist:
 * - `.sd-id` (hidden) - used by handleCreateStorageDir in handlers.ts
 * - `SD_ID` (visible) - used by SdUuidManager in shared package
 *
 * Solution: Switch to SD_ID as the single source of truth
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { SdUuidManager } from '@notecove/shared';
import { NodeFileSystemAdapter } from '../../storage/node-fs-adapter';

describe('SD ID Unification', () => {
  let tempDir: string;

  beforeEach(async () => {
    // Create a fresh temp directory for each test
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sd-id-test-'));
  });

  afterEach(async () => {
    // Clean up temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('3.1 Unified ID Behavior', () => {
    it('should only create SD_ID file when creating new SD (not .sd-id)', async () => {
      // Create an SD path
      const sdPath = path.join(tempDir, 'test-sd');
      await fs.mkdir(sdPath, { recursive: true });

      // Use SdUuidManager to create UUID
      const fsAdapter = new NodeFileSystemAdapter();
      const manager = new SdUuidManager(fsAdapter);

      // Create UUID via the manager
      const result = await manager.initializeUuid(sdPath);

      // Verify SD_ID file exists
      const sdIdPath = path.join(sdPath, 'SD_ID');
      const sdIdExists = await fs
        .access(sdIdPath)
        .then(() => true)
        .catch(() => false);
      expect(sdIdExists).toBe(true);

      // Verify .sd-id file does NOT exist
      const dotSdIdPath = path.join(sdPath, '.sd-id');
      const dotSdIdExists = await fs
        .access(dotSdIdPath)
        .then(() => true)
        .catch(() => false);
      expect(dotSdIdExists).toBe(false);

      // Verify UUID was generated
      expect(result.uuid).toMatch(/^[A-Za-z0-9_-]{22}$/);
    });

    it('should use existing SD_ID when present', async () => {
      const sdPath = path.join(tempDir, 'test-sd');
      await fs.mkdir(sdPath, { recursive: true });

      // Pre-create an SD_ID file
      const existingUuid = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
      await fs.writeFile(path.join(sdPath, 'SD_ID'), existingUuid);

      const fsAdapter = new NodeFileSystemAdapter();
      const manager = new SdUuidManager(fsAdapter);

      const result = await manager.initializeUuid(sdPath);

      expect(result.uuid).toBe(existingUuid);
      expect(result.wasGenerated).toBe(false);
    });

    it('should store same value in database id and uuid columns', async () => {
      const sdPath = path.join(tempDir, 'test-sd');
      await fs.mkdir(sdPath, { recursive: true });

      // Migrate/create SD_ID
      const { migrateAndGetSdId } = await import('../../sd-id-migration');
      const result = await migrateAndGetSdId(sdPath);

      // Mock database to verify what values get passed
      const insertValues: unknown[] = [];
      const mockAdapter: import('@notecove/shared').DatabaseAdapter = {
        initialize: jest.fn().mockResolvedValue(undefined),
        close: jest.fn().mockResolvedValue(undefined),
        exec: jest.fn().mockImplementation((_sql: string, params?: unknown[]) => {
          if (params) insertValues.push(...params);
          return Promise.resolve();
        }),
        run: jest.fn().mockResolvedValue({ changes: 1 }),
        get: jest.fn().mockResolvedValue(null),
        all: jest.fn().mockResolvedValue([]),
        beginTransaction: jest.fn().mockResolvedValue(undefined),
        commit: jest.fn().mockResolvedValue(undefined),
        rollback: jest.fn().mockResolvedValue(undefined),
      };

      // Import SqliteDatabase and call createStorageDir
      const { SqliteDatabase } = await import('../../database/database');
      const db = new SqliteDatabase(mockAdapter);

      // Manually set up the mock for getAllStorageDirs since SqliteDatabase wraps it
      jest.spyOn(db, 'getAllStorageDirs').mockResolvedValue([]);

      await db.createStorageDir(result.id, 'Test SD', sdPath);

      // Verify adapter.exec was called with same id for both columns
      // Insert order: id, name, path, uuid, created, is_active
      expect(mockAdapter.exec).toHaveBeenCalled();
      const [id, , , uuid] = insertValues;
      expect(id).toBe(uuid); // id and uuid columns should have same value
      expect(id).toBe(result.id);
    });
  });

  describe('3.4 Legacy .sd-id Migration', () => {
    it('should migrate .sd-id to SD_ID when only .sd-id exists', async () => {
      const sdPath = path.join(tempDir, 'test-sd');
      await fs.mkdir(sdPath, { recursive: true });

      // Create only .sd-id (legacy)
      const legacyUuid = 'd3772c38-1234-4567-89ab-cdef01234567';
      await fs.writeFile(path.join(sdPath, '.sd-id'), legacyUuid);

      // Import the migration function (to be implemented)
      const { migrateAndGetSdId } = await import('../../sd-id-migration');

      const result = await migrateAndGetSdId(sdPath);

      // Should use the legacy ID
      expect(result.id).toBe(legacyUuid);
      expect(result.migrated).toBe(true);

      // SD_ID should now exist with the same value
      const sdIdContent = await fs.readFile(path.join(sdPath, 'SD_ID'), 'utf-8');
      expect(sdIdContent.trim()).toBe(legacyUuid);
    });

    it('should prefer .sd-id when both files exist with different IDs', async () => {
      const sdPath = path.join(tempDir, 'test-sd');
      await fs.mkdir(sdPath, { recursive: true });

      // Create both files with different UUIDs (must be valid v4 UUIDs)
      const legacyUuid = 'd3772c38-1234-4567-89ab-cdef01234567';
      const newUuid = 'c3e42263-9876-4321-8edc-ba0987654321'; // Fixed: 4th group starts with 8
      await fs.writeFile(path.join(sdPath, '.sd-id'), legacyUuid);
      await fs.writeFile(path.join(sdPath, 'SD_ID'), newUuid);

      // Import the migration function
      const { migrateAndGetSdId } = await import('../../sd-id-migration');

      const result = await migrateAndGetSdId(sdPath);

      // Should use .sd-id value (what app has been using)
      expect(result.id).toBe(legacyUuid);
      expect(result.migrated).toBe(true);
      expect(result.hadConflict).toBe(true);

      // SD_ID should be overwritten with legacy value
      const sdIdContent = await fs.readFile(path.join(sdPath, 'SD_ID'), 'utf-8');
      expect(sdIdContent.trim()).toBe(legacyUuid);
    });

    it('should use SD_ID when only SD_ID exists (no migration needed)', async () => {
      const sdPath = path.join(tempDir, 'test-sd');
      await fs.mkdir(sdPath, { recursive: true });

      // Create only SD_ID (new standard) - must be valid v4 UUID
      const uuid = 'c3e42263-9876-4321-8edc-ba0987654321'; // Fixed: 4th group starts with 8
      await fs.writeFile(path.join(sdPath, 'SD_ID'), uuid);

      const { migrateAndGetSdId } = await import('../../sd-id-migration');

      const result = await migrateAndGetSdId(sdPath);

      expect(result.id).toBe(uuid);
      expect(result.migrated).toBe(false);
    });

    it('should generate new UUID when neither file exists', async () => {
      const sdPath = path.join(tempDir, 'test-sd');
      await fs.mkdir(sdPath, { recursive: true });

      const { migrateAndGetSdId } = await import('../../sd-id-migration');

      const result = await migrateAndGetSdId(sdPath);

      // Should have generated a new UUID
      expect(result.id).toMatch(/^[A-Za-z0-9_-]{22}$/);
      expect(result.migrated).toBe(false);
      expect(result.wasGenerated).toBe(true);

      // SD_ID should exist
      const sdIdContent = await fs.readFile(path.join(sdPath, 'SD_ID'), 'utf-8');
      expect(sdIdContent.trim()).toBe(result.id);

      // .sd-id should NOT exist
      const dotSdIdExists = await fs
        .access(path.join(sdPath, '.sd-id'))
        .then(() => true)
        .catch(() => false);
      expect(dotSdIdExists).toBe(false);
    });

    it('should delete .sd-id after successful migration', async () => {
      const sdPath = path.join(tempDir, 'test-sd');
      await fs.mkdir(sdPath, { recursive: true });

      // Create .sd-id (legacy)
      const legacyUuid = 'd3772c38-1234-4567-89ab-cdef01234567';
      await fs.writeFile(path.join(sdPath, '.sd-id'), legacyUuid);

      const { migrateAndGetSdId } = await import('../../sd-id-migration');

      await migrateAndGetSdId(sdPath);

      // .sd-id should be deleted
      const dotSdIdExists = await fs
        .access(path.join(sdPath, '.sd-id'))
        .then(() => true)
        .catch(() => false);
      expect(dotSdIdExists).toBe(false);
    });

    it('should ignore invalid UUID in .sd-id file and generate new UUID', async () => {
      const sdPath = path.join(tempDir, 'test-sd');
      await fs.mkdir(sdPath, { recursive: true });

      // Create .sd-id with invalid content
      await fs.writeFile(path.join(sdPath, '.sd-id'), 'not-a-valid-uuid');

      const { migrateAndGetSdId } = await import('../../sd-id-migration');

      const result = await migrateAndGetSdId(sdPath);

      // Should generate a new UUID instead of using invalid one
      expect(result.wasGenerated).toBe(true);
      expect(result.id).toMatch(/^[A-Za-z0-9_-]{22}$/);

      // SD_ID should be created with the new UUID
      const sdIdContent = await fs.readFile(path.join(sdPath, 'SD_ID'), 'utf-8');
      expect(sdIdContent.trim()).toBe(result.id);
    });

    it('should use SD_ID when .sd-id contains invalid UUID', async () => {
      const sdPath = path.join(tempDir, 'test-sd');
      await fs.mkdir(sdPath, { recursive: true });

      // Create both: invalid .sd-id and valid SD_ID
      const validUuid = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
      await fs.writeFile(path.join(sdPath, '.sd-id'), 'garbage-data');
      await fs.writeFile(path.join(sdPath, 'SD_ID'), validUuid);

      const { migrateAndGetSdId } = await import('../../sd-id-migration');

      const result = await migrateAndGetSdId(sdPath);

      // Should use SD_ID since .sd-id is invalid
      expect(result.id).toBe(validUuid);
      expect(result.migrated).toBe(false);
      expect(result.wasGenerated).toBe(false);
    });
  });
});
