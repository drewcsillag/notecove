/**
 * Database tests
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { BetterSqliteAdapter } from '../adapter';
import { SqliteDatabase } from '../database';
import type { NoteCache, FolderCache, User } from '@notecove/shared';

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
      expect(version).toBe(5);
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
});
