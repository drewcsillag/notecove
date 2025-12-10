/**
 * Database tests
 */

/* eslint-disable @typescript-eslint/no-unsafe-argument */

import { rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { BetterSqliteAdapter } from '../adapter';
import { SqliteDatabase } from '../database';
import type { NoteCache, FolderCache, User, UUID } from '@notecove/shared';

describe('SqliteDatabase', () => {
  let db: SqliteDatabase;
  let dbPath: string;

  beforeEach(async () => {
    // Create temporary database for each test
    dbPath = join(tmpdir(), `test-${Date.now()}-${Math.random()}.db`);
    const adapter = new BetterSqliteAdapter(dbPath);
    db = new SqliteDatabase(adapter);
    await db.initialize();
  });

  afterEach(async () => {
    await db.close();
    // Clean up test database
    try {
      await rm(dbPath);
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Schema initialization', () => {
    it('should initialize database schema', async () => {
      // Database is initialized in beforeEach
      const version = await db.getCurrentVersion();
      expect(version).toBe(7); // Version 7 adds instance_id to profile_presence_cache
    });

    it('should create all required tables', async () => {
      // Try to query each table to verify it exists
      await expect(db.getActiveNotes()).resolves.toEqual([]);
      await expect(db.getFoldersBySd('test-sd')).resolves.toEqual([]);
      await expect(db.getAllTags()).resolves.toEqual([]);
      await expect(db.getAllState()).resolves.toEqual([]);
      await expect(db.getAllUsers()).resolves.toEqual([]);
    });
  });

  describe('Note cache operations', () => {
    const testNote: NoteCache = {
      id: 'note-1' as any,
      title: 'Test Note',
      sdId: 'sd-1',
      folderId: 'folder-1' as any,
      created: Date.now(),
      modified: Date.now(),
      deleted: false,
      pinned: false,
      contentPreview: 'This is a test note',
      contentText: 'This is a test note with full content',
    };

    it('should upsert a note', async () => {
      await db.upsertNote(testNote);
      const retrieved = await db.getNote(testNote.id);
      expect(retrieved).toEqual(testNote);
    });

    it('should update existing note on upsert', async () => {
      await db.upsertNote(testNote);
      const updated = { ...testNote, title: 'Updated Title' };
      await db.upsertNote(updated);
      const retrieved = await db.getNote(testNote.id);
      expect(retrieved!.title).toBe('Updated Title');
    });

    it('should get notes by folder', async () => {
      await db.upsertNote(testNote);
      await db.upsertNote({ ...testNote, id: 'note-2' as any, folderId: 'folder-2' as any });

      const notes = await db.getNotesByFolder(testNote.folderId);
      expect(notes).toHaveLength(1);
      expect(notes[0]!.id).toBe(testNote.id);
    });

    it('should get notes with null folderId (orphan notes)', async () => {
      const orphanNote = { ...testNote, id: 'orphan-1' as any, folderId: null };
      await db.upsertNote(orphanNote);
      await db.upsertNote(testNote);

      const orphans = await db.getNotesByFolder(null);
      expect(orphans).toHaveLength(1);
      expect(orphans[0]!.id).toBe('orphan-1');
    });

    it('should get notes by SD', async () => {
      await db.upsertNote(testNote);
      await db.upsertNote({ ...testNote, id: 'note-2' as any, sdId: 'sd-2' });

      const notes = await db.getNotesBySd('sd-1');
      expect(notes).toHaveLength(1);
      expect(notes[0]!.id).toBe(testNote.id);
    });

    it('should get active notes (not deleted)', async () => {
      await db.upsertNote(testNote);
      await db.upsertNote({ ...testNote, id: 'note-2' as any, deleted: true });

      const active = await db.getActiveNotes();
      expect(active).toHaveLength(1);
      expect(active[0]!.id).toBe(testNote.id);
    });

    it('should get deleted notes', async () => {
      await db.upsertNote(testNote);
      await db.upsertNote({ ...testNote, id: 'note-2' as any, deleted: true });

      const deleted = await db.getDeletedNotes();
      expect(deleted).toHaveLength(1);
      expect(deleted[0]!.id).toBe('note-2');
    });

    it('should delete a note', async () => {
      await db.upsertNote(testNote);
      await db.deleteNote(testNote.id);

      const retrieved = await db.getNote(testNote.id);
      expect(retrieved).toBeNull();
    });
  });

  describe('Folder cache operations', () => {
    const testFolder: FolderCache = {
      id: 'folder-1' as any,
      name: 'Test Folder',
      parentId: null,
      sdId: 'sd-1',
      order: 1,
      deleted: false,
    };

    it('should upsert a folder', async () => {
      await db.upsertFolder(testFolder);
      const retrieved = await db.getFolder(testFolder.id);
      expect(retrieved).toEqual(testFolder);
    });

    it('should get folders by SD', async () => {
      await db.upsertFolder(testFolder);
      await db.upsertFolder({ ...testFolder, id: 'folder-2' as any, sdId: 'sd-2' });

      const folders = await db.getFoldersBySd('sd-1');
      expect(folders).toHaveLength(1);
      expect(folders[0]!.id).toBe(testFolder.id);
    });

    it('should get root folders', async () => {
      await db.upsertFolder(testFolder);
      await db.upsertFolder({ ...testFolder, id: 'folder-2' as any, parentId: 'folder-1' as any });

      const roots = await db.getRootFolders('sd-1');
      expect(roots).toHaveLength(1);
      expect(roots[0]!.id).toBe(testFolder.id);
    });

    it('should get child folders', async () => {
      await db.upsertFolder(testFolder);
      const child = { ...testFolder, id: 'folder-2' as any, parentId: testFolder.id };
      await db.upsertFolder(child);

      const children = await db.getChildFolders(testFolder.id);
      expect(children).toHaveLength(1);
      expect(children[0]!.id).toBe('folder-2');
    });

    it('should delete a folder', async () => {
      await db.upsertFolder(testFolder);
      await db.deleteFolder(testFolder.id);

      const retrieved = await db.getFolder(testFolder.id);
      expect(retrieved).toBeNull();
    });
  });

  describe('Tag operations', () => {
    it('should create a tag', async () => {
      const tag = await db.createTag('test-tag');
      expect(tag.name).toBe('test-tag');
      expect(tag.id).toBeTruthy();
    });

    it('should return existing tag if name already exists (case-insensitive)', async () => {
      const tag1 = await db.createTag('MyTag');
      const tag2 = await db.createTag('mytag');
      expect(tag1.id).toBe(tag2.id);
    });

    it('should get tag by name (case-insensitive)', async () => {
      const created = await db.createTag('TestTag');
      const retrieved = await db.getTagByName('testtag');
      expect(retrieved?.id).toBe(created.id);
    });

    it('should get all tags', async () => {
      // Create a note first to associate tags with
      const note: NoteCache = {
        id: 'note-1' as any,
        title: 'Test',
        sdId: 'sd-1',
        folderId: null,
        created: Date.now(),
        modified: Date.now(),
        deleted: false,
        pinned: false,
        contentPreview: 'test',
        contentText: 'test',
      };
      await db.upsertNote(note);

      const tag1 = await db.createTag('tag1');
      const tag2 = await db.createTag('tag2');

      // Associate tags with the note
      await db.addTagToNote(note.id, tag1.id);
      await db.addTagToNote(note.id, tag2.id);

      const tags = await db.getAllTags();
      expect(tags).toHaveLength(2);
    });

    it('should add tag to note', async () => {
      // Create a note first
      const note: NoteCache = {
        id: 'note-1' as any,
        title: 'Test',
        sdId: 'sd-1',
        folderId: null,
        created: Date.now(),
        modified: Date.now(),
        deleted: false,
        pinned: false,
        contentPreview: 'test',
        contentText: 'test',
      };
      await db.upsertNote(note);

      const tag = await db.createTag('test-tag');
      await db.addTagToNote('note-1' as any, tag.id);

      const tags = await db.getTagsForNote('note-1' as any);
      expect(tags).toHaveLength(1);
      expect(tags[0]!.id).toBe(tag.id);
    });

    it('should remove tag from note', async () => {
      // Create a note first
      const note: NoteCache = {
        id: 'note-1' as any,
        title: 'Test',
        sdId: 'sd-1',
        folderId: null,
        created: Date.now(),
        modified: Date.now(),
        deleted: false,
        pinned: false,
        contentPreview: 'test',
        contentText: 'test',
      };
      await db.upsertNote(note);

      const tag = await db.createTag('test-tag');
      await db.addTagToNote('note-1' as any, tag.id);
      await db.removeTagFromNote('note-1' as any, tag.id);

      const tags = await db.getTagsForNote('note-1' as any);
      expect(tags).toHaveLength(0);
    });

    it('should get notes with tag', async () => {
      const tag = await db.createTag('test-tag');
      const note: NoteCache = {
        id: 'note-1' as any,
        title: 'Test',
        sdId: 'sd-1',
        folderId: null,
        created: Date.now(),
        modified: Date.now(),
        deleted: false,
        pinned: false,
        contentPreview: 'test',
        contentText: 'test',
      };
      await db.upsertNote(note);
      await db.addTagToNote(note.id, tag.id);

      const notes = await db.getNotesWithTag(tag.id);
      expect(notes).toHaveLength(1);
      expect(notes[0]!.id).toBe(note.id);
    });

    it('should delete a tag', async () => {
      const tag = await db.createTag('test-tag');
      await db.deleteTag(tag.id);

      const retrieved = await db.getTag(tag.id);
      expect(retrieved).toBeNull();
    });
  });

  describe('App state operations', () => {
    it('should set and get app state', async () => {
      await db.setState('key1', 'value1');
      const value = await db.getState('key1');
      expect(value).toBe('value1');
    });

    it('should update existing state', async () => {
      await db.setState('key1', 'value1');
      await db.setState('key1', 'value2');
      const value = await db.getState('key1');
      expect(value).toBe('value2');
    });

    it('should delete state', async () => {
      await db.setState('key1', 'value1');
      await db.deleteState('key1');
      const value = await db.getState('key1');
      expect(value).toBeNull();
    });

    it('should get all state', async () => {
      await db.setState('key1', 'value1');
      await db.setState('key2', 'value2');

      const allState = await db.getAllState();
      expect(allState).toHaveLength(2);
    });
  });

  describe('User operations', () => {
    const testUser: User = {
      id: 'user-1' as any,
      username: 'testuser',
      lastSeen: Date.now(),
    };

    it('should upsert a user', async () => {
      await db.upsertUser(testUser);
      const retrieved = await db.getUser(testUser.id);
      expect(retrieved).toEqual(testUser);
    });

    it('should update existing user', async () => {
      await db.upsertUser(testUser);
      const updated = { ...testUser, username: 'newname' };
      await db.upsertUser(updated);
      const retrieved = await db.getUser(testUser.id);
      expect(retrieved!.username).toBe('newname');
    });

    it('should get all users', async () => {
      await db.upsertUser(testUser);
      await db.upsertUser({ ...testUser, id: 'user-2' as any });

      const users = await db.getAllUsers();
      expect(users).toHaveLength(2);
    });
  });

  describe('FTS5 full-text search', () => {
    beforeEach(async () => {
      // Insert test notes
      await db.upsertNote({
        id: 'note-1' as any,
        title: 'JavaScript Tutorial',
        sdId: 'sd-1',
        folderId: null,
        created: Date.now(),
        modified: Date.now(),
        deleted: false,
        pinned: false,
        contentPreview: 'Learn JavaScript basics',
        contentText: 'Learn JavaScript basics including variables, functions, and objects',
      });

      await db.upsertNote({
        id: 'note-2' as any,
        title: 'TypeScript Guide',
        sdId: 'sd-1',
        folderId: null,
        created: Date.now(),
        modified: Date.now(),
        deleted: false,
        pinned: false,
        contentPreview: 'TypeScript is a superset',
        contentText: 'TypeScript is a superset of JavaScript with static typing',
      });

      await db.upsertNote({
        id: 'note-3' as any,
        title: 'Python Basics',
        sdId: 'sd-1',
        folderId: null,
        created: Date.now(),
        modified: Date.now(),
        deleted: false,
        pinned: false,
        contentPreview: 'Python programming language',
        contentText: 'Python is a high-level programming language',
      });
    });

    it('should search notes by content', async () => {
      const results = await db.searchNotes('JavaScript');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((r) => r.noteId === 'note-1')).toBe(true);
    });

    it('should search notes by title', async () => {
      const results = await db.searchNotes('TypeScript');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((r) => r.noteId === 'note-2')).toBe(true);
    });

    it('should limit search results', async () => {
      const results = await db.searchNotes('programming OR JavaScript OR TypeScript', 2);
      expect(results.length).toBeLessThanOrEqual(2);
    });

    it('should return results with snippets', async () => {
      const results = await db.searchNotes('JavaScript');
      expect(results[0]!.snippet).toBeTruthy();
      expect(results[0]!.title).toBeTruthy();
    });

    it('should search for hashtag content without error', async () => {
      // Insert a note with a hashtag
      await db.upsertNote({
        id: 'note-hashtag' as any,
        title: 'Note with hashtag',
        sdId: 'sd-1',
        folderId: null,
        created: Date.now(),
        modified: Date.now(),
        deleted: false,
        pinned: false,
        contentPreview: 'This note has #work tag',
        contentText: 'This note has #work tag and some other content',
      });

      // Searching for #work should not throw an error
      const results = await db.searchNotes('#work');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((r) => r.noteId === 'note-hashtag')).toBe(true);
    });

    it('should not match notes without the # when searching for #hashtag', async () => {
      // Insert a note with just "work" (no hashtag)
      await db.upsertNote({
        id: 'note-no-hashtag' as any,
        title: 'Note without hashtag',
        sdId: 'sd-1',
        folderId: null,
        created: Date.now(),
        modified: Date.now(),
        deleted: false,
        pinned: false,
        contentPreview: 'This note mentions work without hashtag',
        contentText: 'This note mentions work without hashtag, just the word work',
      });

      // Insert a note with the actual #work hashtag
      await db.upsertNote({
        id: 'note-with-hashtag' as any,
        title: 'Note with hashtag',
        sdId: 'sd-1',
        folderId: null,
        created: Date.now(),
        modified: Date.now(),
        deleted: false,
        pinned: false,
        contentPreview: 'This note has #work tag',
        contentText: 'This note has #work tag',
      });

      // Searching for #work should only find the note with #work, not just "work"
      const results = await db.searchNotes('#work');
      expect(results.some((r) => r.noteId === 'note-with-hashtag')).toBe(true);
      expect(results.some((r) => r.noteId === 'note-no-hashtag')).toBe(false);
    });

    it('should reindex notes and report progress', async () => {
      // Insert some notes
      await db.upsertNote({
        id: 'note-reindex-1' as any,
        title: 'Reindex Test 1',
        sdId: 'sd-1',
        folderId: null,
        created: Date.now(),
        modified: Date.now(),
        deleted: false,
        pinned: false,
        contentPreview: 'Note with #project tag',
        contentText: 'Note with #project tag for reindex testing',
      });

      await db.upsertNote({
        id: 'note-reindex-2' as any,
        title: 'Reindex Test 2',
        sdId: 'sd-1',
        folderId: null,
        created: Date.now(),
        modified: Date.now(),
        deleted: false,
        pinned: false,
        contentPreview: 'Another note with project word',
        contentText: 'Another note with project word but no hashtag',
      });

      // Track progress calls
      const progressCalls: { current: number; total: number }[] = [];
      await db.reindexNotes((current, total) => {
        progressCalls.push({ current, total });
      });

      // Should have made progress calls for each note
      expect(progressCalls.length).toBeGreaterThan(0);
      const lastCall = progressCalls[progressCalls.length - 1];
      expect(lastCall?.current).toBe(lastCall?.total);

      // After reindex, hashtag search should work correctly
      const results = await db.searchNotes('#project');
      expect(results.some((r) => r.noteId === 'note-reindex-1')).toBe(true);
      expect(results.some((r) => r.noteId === 'note-reindex-2')).toBe(false);
    });
  });

  describe('Transactions', () => {
    it('should commit transaction on success', async () => {
      await db.transaction(async () => {
        await db.setState('key1', 'value1');
        await db.setState('key2', 'value2');
      });

      const value1 = await db.getState('key1');
      const value2 = await db.getState('key2');
      expect(value1).toBe('value1');
      expect(value2).toBe('value2');
    });

    it('should rollback transaction on error', async () => {
      await db.setState('key1', 'original');

      await expect(
        db.transaction(async () => {
          await db.setState('key1', 'modified');
          throw new Error('Test error');
        })
      ).rejects.toThrow('Test error');

      const value = await db.getState('key1');
      expect(value).toBe('original');
    });
  });

  describe('Storage Directories', () => {
    let sdTestDir: string;

    beforeEach(async () => {
      sdTestDir = join(tmpdir(), `sd-test-${Date.now()}-${Math.random()}`);
    });

    afterEach(async () => {
      try {
        await rm(sdTestDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    });

    it('should create a storage directory', async () => {
      const sd = await db.createStorageDir('sd-1', 'My Storage', sdTestDir);
      expect(sd.id).toBe('sd-1');
      expect(sd.name).toBe('My Storage');
      expect(sd.path).toBe(sdTestDir);
      // First storage directory is automatically made active
      expect(sd.isActive).toBe(true);
    });

    it('should get storage directory by id', async () => {
      await db.createStorageDir('sd-1', 'My Storage', sdTestDir);
      const sd = await db.getStorageDir('sd-1');
      expect(sd).not.toBeNull();
      expect(sd?.name).toBe('My Storage');
    });

    it('should return null for non-existent storage directory', async () => {
      const sd = await db.getStorageDir('non-existent');
      expect(sd).toBeNull();
    });

    it('should get all storage directories', async () => {
      const sd1Path = join(sdTestDir, 'sd1');
      const sd2Path = join(sdTestDir, 'sd2');
      await db.createStorageDir('sd-1', 'Storage 1', sd1Path);
      await db.createStorageDir('sd-2', 'Storage 2', sd2Path);
      const sds = await db.getAllStorageDirs();
      expect(sds.length).toBe(2);
    });

    it('should set and get active storage directory', async () => {
      const sd1Path = join(sdTestDir, 'sd1');
      const sd2Path = join(sdTestDir, 'sd2');
      await db.createStorageDir('sd-1', 'Storage 1', sd1Path);
      await db.createStorageDir('sd-2', 'Storage 2', sd2Path);

      await db.setActiveStorageDir('sd-1');
      const active = await db.getActiveStorageDir();
      expect(active?.id).toBe('sd-1');

      // Change active
      await db.setActiveStorageDir('sd-2');
      const newActive = await db.getActiveStorageDir();
      expect(newActive?.id).toBe('sd-2');
    });

    it('should delete storage directory', async () => {
      await db.createStorageDir('sd-1', 'Storage 1', sdTestDir);
      await db.deleteStorageDir('sd-1');
      const sd = await db.getStorageDir('sd-1');
      expect(sd).toBeNull();
    });

    it('should update storage directory path', async () => {
      await db.createStorageDir('sd-1', 'Storage 1', sdTestDir);
      const newPath = '/new/path/to/storage';
      await db.updateStorageDirPath('sd-1', newPath);
      const sd = await db.getStorageDir('sd-1');
      expect(sd?.path).toBe(newPath);
    });

    it('should get storage directory by UUID', async () => {
      const sd = await db.createStorageDir('sd-1', 'Storage 1', sdTestDir);
      const found = await db.getStorageDirByUuid(sd.uuid!);
      expect(found?.id).toBe('sd-1');
    });

    // =========================================================================
    // Storage Directory Rename Tests (updateStorageDirName)
    // =========================================================================

    describe('updateStorageDirName', () => {
      it('should rename a storage directory', async () => {
        await db.createStorageDir('sd-1', 'Original Name', sdTestDir);
        await db.updateStorageDirName('sd-1', 'New Name');
        const sd = await db.getStorageDir('sd-1');
        expect(sd?.name).toBe('New Name');
      });

      it('should trim whitespace from name', async () => {
        await db.createStorageDir('sd-1', 'Original', sdTestDir);
        await db.updateStorageDirName('sd-1', '  Trimmed Name  ');
        const sd = await db.getStorageDir('sd-1');
        expect(sd?.name).toBe('Trimmed Name');
      });

      it('should reject empty name', async () => {
        await db.createStorageDir('sd-1', 'Original', sdTestDir);
        await expect(db.updateStorageDirName('sd-1', '')).rejects.toThrow(
          'Storage directory name cannot be empty'
        );
      });

      it('should reject whitespace-only name', async () => {
        await db.createStorageDir('sd-1', 'Original', sdTestDir);
        await expect(db.updateStorageDirName('sd-1', '   ')).rejects.toThrow(
          'Storage directory name cannot be empty'
        );
      });

      it('should reject name longer than 255 characters', async () => {
        await db.createStorageDir('sd-1', 'Original', sdTestDir);
        const longName = 'a'.repeat(256);
        await expect(db.updateStorageDirName('sd-1', longName)).rejects.toThrow(
          'Storage directory name cannot exceed 255 characters'
        );
      });

      it('should accept name exactly 255 characters', async () => {
        await db.createStorageDir('sd-1', 'Original', sdTestDir);
        const maxName = 'a'.repeat(255);
        await db.updateStorageDirName('sd-1', maxName);
        const sd = await db.getStorageDir('sd-1');
        expect(sd?.name).toBe(maxName);
      });

      it('should reject duplicate name', async () => {
        const sd1Path = join(sdTestDir, 'sd1');
        const sd2Path = join(sdTestDir, 'sd2');
        await db.createStorageDir('sd-1', 'First', sd1Path);
        await db.createStorageDir('sd-2', 'Second', sd2Path);
        await expect(db.updateStorageDirName('sd-2', 'First')).rejects.toThrow(
          'A storage directory with this name already exists'
        );
      });

      it('should allow renaming to same name (no-op)', async () => {
        await db.createStorageDir('sd-1', 'Same Name', sdTestDir);
        // Should not throw - renaming to same name is allowed
        await db.updateStorageDirName('sd-1', 'Same Name');
        const sd = await db.getStorageDir('sd-1');
        expect(sd?.name).toBe('Same Name');
      });

      it('should allow renaming to same name with different whitespace', async () => {
        await db.createStorageDir('sd-1', 'Trimmed', sdTestDir);
        // After trimming, this is the same name - should succeed
        await db.updateStorageDirName('sd-1', '  Trimmed  ');
        const sd = await db.getStorageDir('sd-1');
        expect(sd?.name).toBe('Trimmed');
      });

      it('should throw error for non-existent SD', async () => {
        await expect(db.updateStorageDirName('non-existent', 'New Name')).rejects.toThrow(
          'Storage directory not found'
        );
      });
    });
  });

  describe('Note Counts', () => {
    let sdTestDir: string;
    const now = Date.now();

    beforeEach(async () => {
      sdTestDir = join(tmpdir(), `sd-count-test-${Date.now()}-${Math.random()}`);
      await db.createStorageDir('sd-1', 'Storage 1', sdTestDir);
    });

    afterEach(async () => {
      try {
        await rm(sdTestDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    });

    it('should get note count for folder', async () => {
      await db.upsertNote({
        id: 'note-1' as UUID,
        title: 'Note 1',
        sdId: 'sd-1',
        folderId: 'folder-1' as UUID,
        deleted: false,
        pinned: false,
        created: now,
        modified: now,
        contentPreview: 'Test content',
        contentText: 'Test content',
      });
      await db.upsertNote({
        id: 'note-2' as UUID,
        title: 'Note 2',
        sdId: 'sd-1',
        folderId: 'folder-1' as UUID,
        deleted: false,
        pinned: false,
        created: now,
        modified: now,
        contentPreview: 'Test content',
        contentText: 'Test content',
      });

      const count = await db.getNoteCountForFolder('sd-1', 'folder-1');
      expect(count).toBe(2);
    });

    it('should get all notes count for SD', async () => {
      await db.upsertNote({
        id: 'note-1' as UUID,
        title: 'Note 1',
        sdId: 'sd-1',
        folderId: null,
        deleted: false,
        pinned: false,
        created: now,
        modified: now,
        contentPreview: 'Test content',
        contentText: 'Test content',
      });
      await db.upsertNote({
        id: 'note-2' as UUID,
        title: 'Note 2',
        sdId: 'sd-1',
        folderId: 'folder-1' as UUID,
        deleted: false,
        pinned: false,
        created: now,
        modified: now,
        contentPreview: 'Test content',
        contentText: 'Test content',
      });

      const count = await db.getAllNotesCount('sd-1');
      expect(count).toBe(2);
    });

    it('should get deleted note count', async () => {
      await db.upsertNote({
        id: 'note-1' as UUID,
        title: 'Note 1',
        sdId: 'sd-1',
        folderId: null,
        deleted: true,
        pinned: false,
        created: now,
        modified: now,
        contentPreview: 'Test content',
        contentText: 'Test content',
      });
      await db.upsertNote({
        id: 'note-2' as UUID,
        title: 'Note 2',
        sdId: 'sd-1',
        folderId: null,
        deleted: false,
        pinned: false,
        created: now,
        modified: now,
        contentPreview: 'Test content',
        contentText: 'Test content',
      });

      const count = await db.getDeletedNoteCount('sd-1');
      expect(count).toBe(1);
    });
  });

  describe('Links', () => {
    let sdTestDir: string;
    const now = Date.now();

    beforeEach(async () => {
      sdTestDir = join(tmpdir(), `sd-link-test-${Date.now()}-${Math.random()}`);
      await db.createStorageDir('sd-1', 'Storage 1', sdTestDir);
      await db.upsertNote({
        id: 'note-1' as UUID,
        title: 'Source Note',
        sdId: 'sd-1',
        folderId: null,
        deleted: false,
        pinned: false,
        created: now,
        modified: now,
        contentPreview: 'Test content',
        contentText: 'Test content',
      });
      await db.upsertNote({
        id: 'note-2' as UUID,
        title: 'Target Note',
        sdId: 'sd-1',
        folderId: null,
        deleted: false,
        pinned: false,
        created: now,
        modified: now,
        contentPreview: 'Test content',
        contentText: 'Test content',
      });
    });

    afterEach(async () => {
      try {
        await rm(sdTestDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    });

    it('should add a link between notes', async () => {
      await db.addLink('note-1', 'note-2');
      const links = await db.getLinksFromNote('note-1');
      expect(links).toContain('note-2');
    });

    it('should get links to a note', async () => {
      await db.addLink('note-1', 'note-2');
      const links = await db.getLinksToNote('note-2');
      expect(links).toContain('note-1');
    });

    it('should remove a link', async () => {
      await db.addLink('note-1', 'note-2');
      await db.removeLink('note-1', 'note-2');
      const links = await db.getLinksFromNote('note-1');
      expect(links).not.toContain('note-2');
    });

    it('should remove all links from a note', async () => {
      await db.upsertNote({
        id: 'note-3' as UUID,
        title: 'Third Note',
        sdId: 'sd-1',
        folderId: null,
        deleted: false,
        pinned: false,
        created: now,
        modified: now,
        contentPreview: 'Test content',
        contentText: 'Test content',
      });
      await db.addLink('note-1', 'note-2');
      await db.addLink('note-1', 'note-3');
      await db.removeAllLinksFromNote('note-1');
      const links = await db.getLinksFromNote('note-1');
      expect(links.length).toBe(0);
    });

    it('should remove all links to a note', async () => {
      await db.upsertNote({
        id: 'note-3' as UUID,
        title: 'Third Note',
        sdId: 'sd-1',
        folderId: null,
        deleted: false,
        pinned: false,
        created: now,
        modified: now,
        contentPreview: 'Test content',
        contentText: 'Test content',
      });
      await db.addLink('note-1', 'note-2');
      await db.addLink('note-3', 'note-2');
      await db.removeAllLinksToNote('note-2');
      const linksFrom1 = await db.getLinksFromNote('note-1');
      const linksFrom3 = await db.getLinksFromNote('note-3');
      expect(linksFrom1).not.toContain('note-2');
      expect(linksFrom3).not.toContain('note-2');
    });

    it('should get backlinks for a note', async () => {
      // Add a third note that also links to note-2
      await db.upsertNote({
        id: 'note-3' as UUID,
        title: 'Third Note',
        sdId: 'sd-1',
        folderId: null,
        deleted: false,
        pinned: false,
        created: now,
        modified: now,
        contentPreview: 'Test content',
        contentText: 'Test content',
      });

      // Create links: note-1 -> note-2, note-3 -> note-2
      await db.addLink('note-1', 'note-2');
      await db.addLink('note-3', 'note-2');

      // Get backlinks to note-2 (should return note-1 and note-3)
      const backlinks = await db.getBacklinks('note-2' as UUID);

      expect(backlinks).toHaveLength(2);
      expect(backlinks.map((n) => n.id)).toContain('note-1');
      expect(backlinks.map((n) => n.id)).toContain('note-3');
    });

    it('should not include deleted notes in backlinks', async () => {
      // Create a deleted note that links to note-2
      await db.upsertNote({
        id: 'note-deleted' as UUID,
        title: 'Deleted Note',
        sdId: 'sd-1',
        folderId: null,
        deleted: true,
        pinned: false,
        created: now,
        modified: now,
        contentPreview: 'Test content',
        contentText: 'Test content',
      });

      // Create links
      await db.addLink('note-1', 'note-2');
      await db.addLink('note-deleted', 'note-2');

      // Get backlinks (should only return note-1, not deleted note)
      const backlinks = await db.getBacklinks('note-2' as UUID);

      expect(backlinks).toHaveLength(1);
      expect(backlinks[0]?.id).toBe('note-1');
    });

    it('should return empty array when no backlinks exist', async () => {
      const backlinks = await db.getBacklinks('note-2' as UUID);
      expect(backlinks).toEqual([]);
    });
  });

  describe('Note Sync State', () => {
    let sdTestDir: string;

    beforeEach(async () => {
      sdTestDir = join(tmpdir(), `sd-sync-test-${Date.now()}-${Math.random()}`);
      await db.createStorageDir('sd-1', 'Storage 1', sdTestDir);
    });

    afterEach(async () => {
      try {
        await rm(sdTestDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    });

    it('should upsert and get note sync state', async () => {
      await db.upsertNoteSyncState({
        noteId: 'note-1',
        sdId: 'sd-1',
        vectorClock: JSON.stringify({}),
        documentState: new Uint8Array([1, 2, 3]),
        updatedAt: Date.now(),
      });

      const state = await db.getNoteSyncState('note-1', 'sd-1');
      expect(state).not.toBeNull();
      expect(state?.noteId).toBe('note-1');
    });

    it('should get note sync states by SD', async () => {
      await db.upsertNoteSyncState({
        noteId: 'note-1',
        sdId: 'sd-1',
        vectorClock: JSON.stringify({}),
        documentState: new Uint8Array([1, 2, 3]),
        updatedAt: Date.now(),
      });
      await db.upsertNoteSyncState({
        noteId: 'note-2',
        sdId: 'sd-1',
        vectorClock: JSON.stringify({}),
        documentState: new Uint8Array([4, 5, 6]),
        updatedAt: Date.now(),
      });

      const states = await db.getNoteSyncStatesBySd('sd-1');
      expect(states.length).toBe(2);
    });

    it('should delete note sync state', async () => {
      await db.upsertNoteSyncState({
        noteId: 'note-1',
        sdId: 'sd-1',
        vectorClock: JSON.stringify({}),
        documentState: new Uint8Array([1, 2, 3]),
        updatedAt: Date.now(),
      });
      await db.deleteNoteSyncState('note-1', 'sd-1');
      const state = await db.getNoteSyncState('note-1', 'sd-1');
      expect(state).toBeNull();
    });

    it('should delete all note sync states by SD', async () => {
      await db.upsertNoteSyncState({
        noteId: 'note-1',
        sdId: 'sd-1',
        vectorClock: JSON.stringify({}),
        documentState: new Uint8Array([1, 2, 3]),
        updatedAt: Date.now(),
      });
      await db.deleteNoteSyncStatesBySd('sd-1');
      const states = await db.getNoteSyncStatesBySd('sd-1');
      expect(states.length).toBe(0);
    });
  });

  describe('Folder Sync State', () => {
    let sdTestDir: string;

    beforeEach(async () => {
      sdTestDir = join(tmpdir(), `sd-folder-sync-test-${Date.now()}-${Math.random()}`);
      await db.createStorageDir('sd-1', 'Storage 1', sdTestDir);
    });

    afterEach(async () => {
      try {
        await rm(sdTestDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    });

    it('should upsert and get folder sync state', async () => {
      await db.upsertFolderSyncState({
        sdId: 'sd-1',
        vectorClock: JSON.stringify({}),
        documentState: new Uint8Array([1, 2, 3]),
        updatedAt: Date.now(),
      });

      const state = await db.getFolderSyncState('sd-1');
      expect(state).not.toBeNull();
      expect(state?.sdId).toBe('sd-1');
    });

    it('should delete folder sync state', async () => {
      await db.upsertFolderSyncState({
        sdId: 'sd-1',
        vectorClock: JSON.stringify({}),
        documentState: new Uint8Array([1, 2, 3]),
        updatedAt: Date.now(),
      });
      await db.deleteFolderSyncState('sd-1');
      const state = await db.getFolderSyncState('sd-1');
      expect(state).toBeNull();
    });
  });

  describe('Get Note', () => {
    let sdTestDir: string;

    beforeEach(async () => {
      sdTestDir = join(tmpdir(), `sd-get-note-test-${Date.now()}-${Math.random()}`);
      await db.createStorageDir('sd-1', 'Storage 1', sdTestDir);
    });

    afterEach(async () => {
      try {
        await rm(sdTestDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    });

    it('should get a note by id', async () => {
      const now = Date.now();
      await db.upsertNote({
        id: 'note-1' as UUID,
        title: 'Test Note',
        sdId: 'sd-1',
        folderId: null,
        deleted: false,
        pinned: true,
        created: now,
        modified: now,
        contentPreview: 'Test content',
        contentText: 'Test content',
      });

      const note = await db.getNote('note-1');
      expect(note).not.toBeNull();
      expect(note?.title).toBe('Test Note');
      expect(note?.pinned).toBe(true);
    });

    it('should return null for non-existent note', async () => {
      const note = await db.getNote('non-existent');
      expect(note).toBeNull();
    });
  });

  describe('Auto Cleanup Deleted Notes', () => {
    let sdTestDir: string;

    beforeEach(async () => {
      sdTestDir = join(tmpdir(), `sd-cleanup-test-${Date.now()}-${Math.random()}`);
      await db.createStorageDir('sd-1', 'Storage 1', sdTestDir);
    });

    afterEach(async () => {
      try {
        await rm(sdTestDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    });

    it('should identify notes deleted beyond threshold', async () => {
      const oldDate = Date.now() - 31 * 24 * 60 * 60 * 1000; // 31 days ago
      await db.upsertNote({
        id: 'old-deleted-note' as UUID,
        title: 'Old Deleted',
        sdId: 'sd-1',
        folderId: null,
        deleted: true,
        pinned: false,
        created: oldDate,
        modified: oldDate,
        contentPreview: 'Test content',
        contentText: 'Test content',
      });

      const recentDate = Date.now() - 5 * 24 * 60 * 60 * 1000; // 5 days ago
      await db.upsertNote({
        id: 'recent-deleted-note' as UUID,
        title: 'Recent Deleted',
        sdId: 'sd-1',
        folderId: null,
        deleted: true,
        pinned: false,
        created: recentDate,
        modified: recentDate,
        contentPreview: 'Test content',
        contentText: 'Test content',
      });

      // autoCleanupDeletedNotes only returns IDs, it doesn't delete
      const noteIdsToCleanup = await db.autoCleanupDeletedNotes(30);
      expect(noteIdsToCleanup).toContain('old-deleted-note');
      expect(noteIdsToCleanup).not.toContain('recent-deleted-note');
    });
  });

  describe('Schema Version', () => {
    it('should get current version', async () => {
      const version = await db.getCurrentVersion();
      expect(version).toBe(7);
    });

    it('should get version history', async () => {
      const history = await db.getVersionHistory();
      expect(history.length).toBeGreaterThan(0);
      expect(history.some((v) => v.version === 7)).toBe(true);
    });
  });

  describe('Orphaned Data Cleanup', () => {
    let sdTestDir1: string;

    beforeEach(async () => {
      sdTestDir1 = join(tmpdir(), `sd-cleanup-test1-${Date.now()}-${Math.random()}`);
    });

    afterEach(async () => {
      try {
        await rm(sdTestDir1, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    });

    it('should return cleanup stats even when no orphaned data exists', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      // Create an SD with notes and folders
      await db.createStorageDir('sd-1', 'Storage 1', sdTestDir1);
      await db.upsertNote({
        id: 'note-1' as UUID,
        title: 'Note 1',
        sdId: 'sd-1',
        folderId: null,
        deleted: false,
        pinned: false,
        created: Date.now(),
        modified: Date.now(),
        contentPreview: 'Test',
        contentText: 'Test',
      });

      // Run cleanup (should find nothing to clean)
      const result = await db.cleanupOrphanedData();

      expect(result.notesDeleted).toBe(0);
      expect(result.foldersDeleted).toBe(0);
      expect(result.tagAssociationsDeleted).toBe(0);
      expect(result.unusedTagsDeleted).toBe(0);

      // Should have logged the cleanup message
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[Database] Cleaning up'));

      consoleSpy.mockRestore();
    });

    it('should handle cleanup with logging', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      // Run cleanup on empty database
      const result = await db.cleanupOrphanedData();

      // Verify result structure
      expect(typeof result.notesDeleted).toBe('number');
      expect(typeof result.foldersDeleted).toBe('number');
      expect(typeof result.tagAssociationsDeleted).toBe('number');
      expect(typeof result.unusedTagsDeleted).toBe('number');

      consoleSpy.mockRestore();
    });
  });

  describe('Profile Presence Cache', () => {
    let sdTestDir: string;

    beforeEach(async () => {
      sdTestDir = join(tmpdir(), `sd-presence-test-${Date.now()}-${Math.random()}`);
      await db.createStorageDir('sd-1', 'Storage 1', sdTestDir);
    });

    afterEach(async () => {
      try {
        await rm(sdTestDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    });

    it('should upsert and get profile presence cache', async () => {
      const presence = {
        profileId: 'profile-1',
        instanceId: 'instance-1',
        sdId: 'sd-1',
        profileName: 'Test Profile',
        user: '@testuser',
        username: 'Test User',
        hostname: 'test-host',
        platform: 'darwin',
        appVersion: '1.0.0',
        lastUpdated: Date.now(),
        cachedAt: Date.now(),
      };

      await db.upsertProfilePresenceCache(presence);
      const retrieved = await db.getProfilePresenceCache('profile-1', 'sd-1');

      expect(retrieved).not.toBeNull();
      expect(retrieved?.profileId).toBe('profile-1');
      expect(retrieved?.instanceId).toBe('instance-1');
      expect(retrieved?.profileName).toBe('Test Profile');
      expect(retrieved?.user).toBe('@testuser');
      expect(retrieved?.hostname).toBe('test-host');
    });

    it('should return null for non-existent presence cache', async () => {
      const retrieved = await db.getProfilePresenceCache('non-existent', 'sd-1');
      expect(retrieved).toBeNull();
    });

    it('should get presence cache by instance ID', async () => {
      const presence = {
        profileId: 'profile-1',
        instanceId: 'instance-123',
        sdId: 'sd-1',
        profileName: 'Test Profile',
        user: '@testuser',
        username: 'Test User',
        hostname: 'test-host',
        platform: 'darwin',
        appVersion: '1.0.0',
        lastUpdated: Date.now(),
        cachedAt: Date.now(),
      };

      await db.upsertProfilePresenceCache(presence);
      const retrieved = await db.getProfilePresenceCacheByInstanceId('instance-123', 'sd-1');

      expect(retrieved).not.toBeNull();
      expect(retrieved?.instanceId).toBe('instance-123');
      expect(retrieved?.profileId).toBe('profile-1');
    });

    it('should return null for non-existent instance ID', async () => {
      const retrieved = await db.getProfilePresenceCacheByInstanceId('non-existent', 'sd-1');
      expect(retrieved).toBeNull();
    });

    it('should get all presence caches for an SD', async () => {
      const presence1 = {
        profileId: 'profile-1',
        instanceId: 'instance-1',
        sdId: 'sd-1',
        profileName: 'Profile 1',
        user: '@user1',
        username: 'User 1',
        hostname: 'host-1',
        platform: 'darwin',
        appVersion: '1.0.0',
        lastUpdated: Date.now(),
        cachedAt: Date.now(),
      };
      const presence2 = {
        profileId: 'profile-2',
        instanceId: 'instance-2',
        sdId: 'sd-1',
        profileName: 'Profile 2',
        user: '@user2',
        username: 'User 2',
        hostname: 'host-2',
        platform: 'win32',
        appVersion: '1.0.0',
        lastUpdated: Date.now(),
        cachedAt: Date.now(),
      };

      await db.upsertProfilePresenceCache(presence1);
      await db.upsertProfilePresenceCache(presence2);

      const presences = await db.getProfilePresenceCacheBySd('sd-1');
      expect(presences).toHaveLength(2);
      expect(presences.map((p) => p.profileId)).toContain('profile-1');
      expect(presences.map((p) => p.profileId)).toContain('profile-2');
    });

    it('should return empty array for SD with no presence caches', async () => {
      const presences = await db.getProfilePresenceCacheBySd('sd-1');
      expect(presences).toEqual([]);
    });

    it('should update existing presence on upsert', async () => {
      const presence = {
        profileId: 'profile-1',
        instanceId: 'instance-1',
        sdId: 'sd-1',
        profileName: 'Original Name',
        user: '@user',
        username: 'User',
        hostname: 'host',
        platform: 'darwin',
        appVersion: '1.0.0',
        lastUpdated: Date.now(),
        cachedAt: Date.now(),
      };

      await db.upsertProfilePresenceCache(presence);

      // Update the presence
      const updatedPresence = {
        ...presence,
        profileName: 'Updated Name',
        hostname: 'new-host',
      };
      await db.upsertProfilePresenceCache(updatedPresence);

      const retrieved = await db.getProfilePresenceCache('profile-1', 'sd-1');
      expect(retrieved?.profileName).toBe('Updated Name');
      expect(retrieved?.hostname).toBe('new-host');
    });

    it('should delete profile presence cache', async () => {
      const presence = {
        profileId: 'profile-1',
        instanceId: 'instance-1',
        sdId: 'sd-1',
        profileName: 'Test Profile',
        user: '@user',
        username: 'User',
        hostname: 'host',
        platform: 'darwin',
        appVersion: '1.0.0',
        lastUpdated: Date.now(),
        cachedAt: Date.now(),
      };

      await db.upsertProfilePresenceCache(presence);
      await db.deleteProfilePresenceCache('profile-1', 'sd-1');

      const retrieved = await db.getProfilePresenceCache('profile-1', 'sd-1');
      expect(retrieved).toBeNull();
    });

    it('should delete all presence caches for an SD', async () => {
      const presence1 = {
        profileId: 'profile-1',
        instanceId: 'instance-1',
        sdId: 'sd-1',
        profileName: 'Profile 1',
        user: '@user1',
        username: 'User 1',
        hostname: 'host-1',
        platform: 'darwin',
        appVersion: '1.0.0',
        lastUpdated: Date.now(),
        cachedAt: Date.now(),
      };
      const presence2 = {
        profileId: 'profile-2',
        instanceId: 'instance-2',
        sdId: 'sd-1',
        profileName: 'Profile 2',
        user: '@user2',
        username: 'User 2',
        hostname: 'host-2',
        platform: 'win32',
        appVersion: '1.0.0',
        lastUpdated: Date.now(),
        cachedAt: Date.now(),
      };

      await db.upsertProfilePresenceCache(presence1);
      await db.upsertProfilePresenceCache(presence2);

      await db.deleteProfilePresenceCacheBySd('sd-1');

      const presences = await db.getProfilePresenceCacheBySd('sd-1');
      expect(presences).toEqual([]);
    });
  });
});
