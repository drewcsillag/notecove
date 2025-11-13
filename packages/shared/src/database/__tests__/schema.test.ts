import {
  SCHEMA_SQL,
  SCHEMA_VERSION,
  AppStateKey,
  type NoteCache,
  type FolderCache,
  type Tag,
  type NoteTag,
  type User,
  type AppState,
  type SearchResult,
  type SchemaVersionRecord,
} from '../schema';
import type { UUID } from '../../types';

describe('Database Schema', () => {
  describe('SCHEMA_VERSION', () => {
    it('should be defined', () => {
      expect(SCHEMA_VERSION).toBe(4);
    });
  });

  describe('SCHEMA_SQL', () => {
    it('should have all required tables', () => {
      expect(SCHEMA_SQL.notes).toContain('CREATE TABLE IF NOT EXISTS notes');
      expect(SCHEMA_SQL.notesFts).toContain('CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts');
      expect(SCHEMA_SQL.folders).toContain('CREATE TABLE IF NOT EXISTS folders');
      expect(SCHEMA_SQL.tags).toContain('CREATE TABLE IF NOT EXISTS tags');
      expect(SCHEMA_SQL.noteTags).toContain('CREATE TABLE IF NOT EXISTS note_tags');
      expect(SCHEMA_SQL.users).toContain('CREATE TABLE IF NOT EXISTS users');
      expect(SCHEMA_SQL.storageDirs).toContain('CREATE TABLE IF NOT EXISTS storage_dirs');
      expect(SCHEMA_SQL.noteMoves).toContain('CREATE TABLE IF NOT EXISTS note_moves');
      expect(SCHEMA_SQL.appState).toContain('CREATE TABLE IF NOT EXISTS app_state');
      expect(SCHEMA_SQL.version).toContain('CREATE TABLE IF NOT EXISTS schema_version');
    });

    it('should create indices for notes table', () => {
      expect(SCHEMA_SQL.notes).toContain('CREATE INDEX IF NOT EXISTS idx_notes_sd_id');
      expect(SCHEMA_SQL.notes).toContain('CREATE INDEX IF NOT EXISTS idx_notes_folder_id');
      expect(SCHEMA_SQL.notes).toContain('CREATE INDEX IF NOT EXISTS idx_notes_deleted');
      expect(SCHEMA_SQL.notes).toContain('CREATE INDEX IF NOT EXISTS idx_notes_modified');
    });

    it('should create FTS5 triggers for notes', () => {
      expect(SCHEMA_SQL.notesFts).toContain('CREATE TRIGGER IF NOT EXISTS notes_ai');
      expect(SCHEMA_SQL.notesFts).toContain('CREATE TRIGGER IF NOT EXISTS notes_ad');
      expect(SCHEMA_SQL.notesFts).toContain('CREATE TRIGGER IF NOT EXISTS notes_au');
    });

    it('should create indices for folders table', () => {
      expect(SCHEMA_SQL.folders).toContain('CREATE INDEX IF NOT EXISTS idx_folders_sd_id');
      expect(SCHEMA_SQL.folders).toContain('CREATE INDEX IF NOT EXISTS idx_folders_parent_id');
    });

    it('should create case-insensitive index for tags', () => {
      expect(SCHEMA_SQL.tags).toContain('COLLATE NOCASE');
    });

    it('should create foreign keys for note_tags', () => {
      expect(SCHEMA_SQL.noteTags).toContain('FOREIGN KEY (note_id) REFERENCES notes(id)');
      expect(SCHEMA_SQL.noteTags).toContain('FOREIGN KEY (tag_id) REFERENCES tags(id)');
      expect(SCHEMA_SQL.noteTags).toContain('ON DELETE CASCADE');
    });
  });

  describe('AppStateKey', () => {
    it('should have all required keys', () => {
      expect(AppStateKey.LastOpenedNote).toBe('lastOpenedNote');
      expect(AppStateKey.LeftPanelWidth).toBe('leftPanelWidth');
      expect(AppStateKey.RightPanelWidth).toBe('rightPanelWidth');
      expect(AppStateKey.FolderCollapseState).toBe('folderCollapseState');
      expect(AppStateKey.TagFilters).toBe('tagFilters');
      expect(AppStateKey.SearchText).toBe('searchText');
      expect(AppStateKey.WindowPosition).toBe('windowPosition');
      expect(AppStateKey.WindowSize).toBe('windowSize');
    });
  });

  describe('Type Definitions', () => {
    it('should accept valid NoteCache', () => {
      const note: NoteCache = {
        id: 'note-123' as UUID,
        title: 'Test Note',
        sdId: 'sd-456',
        folderId: 'folder-789' as UUID,
        created: Date.now(),
        modified: Date.now(),
        deleted: false,
        pinned: false,
        contentPreview: 'This is a preview...',
        contentText: 'Full content text for search',
      };

      expect(note.id).toBe('note-123');
      expect(note.title).toBe('Test Note');
      expect(note.deleted).toBe(false);
    });

    it('should accept NoteCache with null folderId', () => {
      const note: NoteCache = {
        id: 'note-123' as UUID,
        title: 'Orphan Note',
        sdId: 'sd-456',
        folderId: null,
        created: Date.now(),
        modified: Date.now(),
        deleted: false,
        pinned: false,
        contentPreview: 'Preview',
        contentText: 'Content',
      };

      expect(note.folderId).toBeNull();
    });

    it('should accept valid FolderCache', () => {
      const folder: FolderCache = {
        id: 'folder-123' as UUID,
        name: 'Work',
        parentId: null,
        sdId: 'sd-456',
        order: 0,
        deleted: false,
      };

      expect(folder.name).toBe('Work');
      expect(folder.parentId).toBeNull();
    });

    it('should accept valid Tag', () => {
      const tag: Tag = {
        id: 'tag-123' as UUID,
        name: 'important',
      };

      expect(tag.name).toBe('important');
    });

    it('should accept valid NoteTag', () => {
      const noteTag: NoteTag = {
        noteId: 'note-123' as UUID,
        tagId: 'tag-456' as UUID,
      };

      expect(noteTag.noteId).toBe('note-123');
      expect(noteTag.tagId).toBe('tag-456');
    });

    it('should accept valid User', () => {
      const user: User = {
        id: 'user-123' as UUID,
        username: 'testuser',
        lastSeen: Date.now(),
      };

      expect(user.username).toBe('testuser');
    });

    it('should accept valid AppState', () => {
      const state: AppState = {
        key: AppStateKey.LastOpenedNote,
        value: JSON.stringify({ noteId: 'note-123' }),
      };

      expect(state.key).toBe('lastOpenedNote');
    });

    it('should accept valid SearchResult', () => {
      const result: SearchResult = {
        noteId: 'note-123' as UUID,
        title: 'Test Note',
        snippet: 'This is a <b>highlighted</b> snippet',
        rank: 0.95,
      };

      expect(result.noteId).toBe('note-123');
      expect(result.rank).toBe(0.95);
    });

    it('should accept valid SchemaVersionRecord', () => {
      const versionRecord: SchemaVersionRecord = {
        version: 1,
        appliedAt: Date.now(),
        description: 'Initial schema',
      };

      expect(versionRecord.version).toBe(1);
      expect(versionRecord.description).toBe('Initial schema');
    });
  });
});
