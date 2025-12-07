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
  type NoteSyncState,
  type FolderSyncState,
  type ActivityLogState,
  type SequenceState,
  type WindowState,
  type WindowBounds,
  type EditorState,
  serializeWindowStates,
  deserializeWindowStates,
} from '../schema';
import type { UUID } from '../../types';

describe('Database Schema', () => {
  describe('SCHEMA_VERSION', () => {
    it('should be defined', () => {
      expect(SCHEMA_VERSION).toBe(7);
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
      // New sync state tables
      expect(SCHEMA_SQL.noteSyncState).toContain('CREATE TABLE IF NOT EXISTS note_sync_state');
      expect(SCHEMA_SQL.folderSyncState).toContain('CREATE TABLE IF NOT EXISTS folder_sync_state');
      expect(SCHEMA_SQL.activityLogState).toContain(
        'CREATE TABLE IF NOT EXISTS activity_log_state'
      );
      expect(SCHEMA_SQL.sequenceState).toContain('CREATE TABLE IF NOT EXISTS sequence_state');
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

    it('should have WindowStates key for window state retention', () => {
      expect(AppStateKey.WindowStates).toBe('windowStates');
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

    it('should accept valid NoteSyncState', () => {
      const syncState: NoteSyncState = {
        noteId: 'note-123',
        sdId: 'sd-456',
        vectorClock: JSON.stringify({
          'inst-abc': { sequence: 10, offset: 5000, file: 'inst-abc_123.crdtlog' },
        }),
        documentState: new Uint8Array([0x01, 0x02, 0x03]),
        updatedAt: Date.now(),
      };

      expect(syncState.noteId).toBe('note-123');
      expect(
        (JSON.parse(syncState.vectorClock) as Record<string, { sequence: number }>)['inst-abc']
          .sequence
      ).toBe(10);
    });

    it('should accept valid FolderSyncState', () => {
      const syncState: FolderSyncState = {
        sdId: 'sd-456',
        vectorClock: JSON.stringify({}),
        documentState: new Uint8Array([0x01]),
        updatedAt: Date.now(),
      };

      expect(syncState.sdId).toBe('sd-456');
    });

    it('should accept valid ActivityLogState', () => {
      const logState: ActivityLogState = {
        sdId: 'sd-456',
        instanceId: 'inst-abc',
        lastOffset: 1024,
        logFile: 'inst-abc.log',
      };

      expect(logState.instanceId).toBe('inst-abc');
      expect(logState.lastOffset).toBe(1024);
    });

    it('should accept valid SequenceState', () => {
      const seqState: SequenceState = {
        sdId: 'sd-456',
        documentId: 'note-123',
        currentSequence: 42,
        currentFile: 'inst-abc_1699028345000.crdtlog',
        currentOffset: 5000,
      };

      expect(seqState.currentSequence).toBe(42);
      expect(seqState.documentId).toBe('note-123');
    });

    it('should accept valid WindowBounds', () => {
      const bounds: WindowBounds = {
        x: 100,
        y: 200,
        width: 1200,
        height: 800,
      };

      expect(bounds.x).toBe(100);
      expect(bounds.width).toBe(1200);
    });

    it('should accept valid EditorState', () => {
      const editorState: EditorState = {
        scrollTop: 150,
        cursorPosition: 42,
      };

      expect(editorState.scrollTop).toBe(150);
      expect(editorState.cursorPosition).toBe(42);
    });

    it('should accept valid WindowState for main window', () => {
      const windowState: WindowState = {
        id: 'window-123',
        type: 'main',
        noteId: 'note-456',
        sdId: 'sd-789',
        bounds: { x: 0, y: 0, width: 1200, height: 800 },
        isMaximized: false,
        isFullScreen: false,
        editorState: { scrollTop: 0, cursorPosition: 0 },
      };

      expect(windowState.type).toBe('main');
      expect(windowState.noteId).toBe('note-456');
    });

    it('should accept valid WindowState for minimal window', () => {
      const windowState: WindowState = {
        id: 'window-456',
        type: 'minimal',
        noteId: 'note-123',
        sdId: 'sd-456',
        bounds: { x: 200, y: 100, width: 800, height: 600 },
        isMaximized: false,
        isFullScreen: false,
      };

      expect(windowState.type).toBe('minimal');
      expect(windowState.editorState).toBeUndefined();
    });

    it('should accept valid WindowState for syncStatus window', () => {
      const windowState: WindowState = {
        id: 'window-sync',
        type: 'syncStatus',
        bounds: { x: 300, y: 200, width: 950, height: 600 },
        isMaximized: false,
        isFullScreen: false,
      };

      expect(windowState.type).toBe('syncStatus');
      expect(windowState.noteId).toBeUndefined();
    });

    it('should accept maximized WindowState', () => {
      const windowState: WindowState = {
        id: 'window-max',
        type: 'main',
        bounds: { x: 0, y: 0, width: 1920, height: 1080 },
        isMaximized: true,
        isFullScreen: false,
      };

      expect(windowState.isMaximized).toBe(true);
      expect(windowState.isFullScreen).toBe(false);
    });
  });

  describe('WindowState Serialization', () => {
    it('should serialize empty window states array', () => {
      const result = serializeWindowStates([]);
      expect(result).toBe('[]');
    });

    it('should serialize single window state', () => {
      const states: WindowState[] = [
        {
          id: 'win-1',
          type: 'main',
          noteId: 'note-1',
          sdId: 'sd-1',
          bounds: { x: 0, y: 0, width: 1200, height: 800 },
          isMaximized: false,
          isFullScreen: false,
        },
      ];

      const serialized = serializeWindowStates(states);
      expect(typeof serialized).toBe('string');

      const parsed = JSON.parse(serialized) as WindowState[];
      expect(parsed).toHaveLength(1);
      expect(parsed[0].id).toBe('win-1');
    });

    it('should serialize multiple window states', () => {
      const states: WindowState[] = [
        {
          id: 'win-main',
          type: 'main',
          noteId: 'note-1',
          bounds: { x: 0, y: 0, width: 1200, height: 800 },
          isMaximized: false,
          isFullScreen: false,
          editorState: { scrollTop: 100, cursorPosition: 50 },
        },
        {
          id: 'win-minimal',
          type: 'minimal',
          noteId: 'note-2',
          sdId: 'sd-1',
          bounds: { x: 100, y: 100, width: 800, height: 600 },
          isMaximized: false,
          isFullScreen: false,
        },
      ];

      const serialized = serializeWindowStates(states);
      const parsed = JSON.parse(serialized) as WindowState[];
      expect(parsed).toHaveLength(2);
    });

    it('should deserialize empty array string', () => {
      const result = deserializeWindowStates('[]');
      expect(result).toEqual([]);
    });

    it('should deserialize null to empty array', () => {
      const result = deserializeWindowStates(null);
      expect(result).toEqual([]);
    });

    it('should deserialize valid window states', () => {
      const input = JSON.stringify([
        {
          id: 'win-1',
          type: 'main',
          noteId: 'note-1',
          bounds: { x: 0, y: 0, width: 1200, height: 800 },
          isMaximized: true,
          isFullScreen: false,
        },
      ]);

      const result = deserializeWindowStates(input);
      expect(result).toHaveLength(1);
      expect(result[0].isMaximized).toBe(true);
    });

    it('should return empty array for invalid JSON', () => {
      const result = deserializeWindowStates('invalid json');
      expect(result).toEqual([]);
    });

    it('should return empty array for non-array JSON', () => {
      const result = deserializeWindowStates('{"foo": "bar"}');
      expect(result).toEqual([]);
    });

    it('should round-trip serialize and deserialize', () => {
      const original: WindowState[] = [
        {
          id: 'win-1',
          type: 'main',
          noteId: 'note-abc',
          sdId: 'sd-xyz',
          bounds: { x: 50, y: 100, width: 1400, height: 900 },
          isMaximized: false,
          isFullScreen: true,
          editorState: { scrollTop: 250, cursorPosition: 123 },
        },
        {
          id: 'win-2',
          type: 'syncStatus',
          bounds: { x: 200, y: 150, width: 950, height: 600 },
          isMaximized: false,
          isFullScreen: false,
        },
      ];

      const serialized = serializeWindowStates(original);
      const deserialized = deserializeWindowStates(serialized);

      expect(deserialized).toEqual(original);
    });
  });
});
