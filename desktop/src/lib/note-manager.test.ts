import { describe, it, expect, beforeEach } from 'vitest';
import { NoteManager } from './note-manager';
import type { Note } from './note-manager';

// Mock localStorage for web mode
interface MockLocalStorage {
  data: { [key: string]: string };
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  clear(): void;
}

(global as any).localStorage = {
  data: {} as { [key: string]: string },
  getItem: function(key: string): string | null { return this.data[key] || null; },
  setItem: function(key: string, value: string): void { this.data[key] = value; },
  removeItem: function(key: string): void { delete this.data[key]; },
  clear: function(): void { this.data = {}; }
} as MockLocalStorage;

describe('NoteManager', () => {
  let noteManager: NoteManager;

  beforeEach(() => {
    localStorage.clear();
    noteManager = new NoteManager();
  });

  describe('note creation', () => {
    it('should create a new note with default values', async () => {
      const note: Note = await noteManager.createNote();

      expect(note).toMatchObject({
        id: expect.any(String),
        title: '',
        content: '',
        created: expect.any(String),
        modified: expect.any(String),
        tags: [],
        deleted: false
      });
    });

    it('should create a note with custom data', async () => {
      const customData: Partial<Note> = {
        title: 'Test Note',
        content: 'Test content',
        tags: ['test']
      };

      const note: Note = await noteManager.createNote(customData);

      expect(note.title).toBe('Test Note');
      expect(note.content).toBe('Test content');
      expect(note.tags).toEqual(['test']);
    });
  });

  describe('note retrieval', () => {
    it('should get all notes excluding deleted ones', async () => {
      const note1: Note = await noteManager.createNote({ title: 'Note 1' });
      const note2: Note = await noteManager.createNote({ title: 'Note 2' });
      noteManager.deleteNote(note2.id);

      const allNotes: Note[] = noteManager.getAllNotes();

      // Only note1 should be returned (note2 is deleted, sample notes not loaded in tests)
      expect(allNotes).toHaveLength(1);
      expect(allNotes.find((n: Note) => n.id === note1.id)).toBeTruthy();
      expect(allNotes.find((n: Note) => n.id === note2.id)).toBeFalsy();
    });

    it('should get note by ID', async () => {
      const note: Note = await noteManager.createNote({ title: 'Test Note' });

      const retrieved: Note | null = noteManager.getNote(note.id);

      expect(retrieved).toEqual(note);
    });

    it('should return null for non-existent note', () => {
      const retrieved: Note | null = noteManager.getNote('non-existent-id');

      expect(retrieved).toBeNull();
    });
  });

  describe('note updates', () => {
    it('should update note properties', async () => {
      const note: Note = await noteManager.createNote({ title: 'Original' });

      // Small delay to ensure timestamp difference
      await new Promise((resolve: (value: void) => void) => setTimeout(resolve, 10));

      const updated: Note | null = noteManager.updateNote(note.id, {
        title: 'Updated',
        content: 'New content'
      });

      expect(updated!.title).toBe('Updated');
      expect(updated!.content).toBe('New content');
      expect(updated!.modified).not.toBe(note.modified);
    });

    it('should return null for non-existent note', () => {
      const result: Note | null = noteManager.updateNote('non-existent-id', { title: 'Test' });

      expect(result).toBeNull();
    });

    it('should not update deleted note', async () => {
      const note: Note = await noteManager.createNote({ title: 'Test' });
      noteManager.deleteNote(note.id);

      const result: Note | null = noteManager.updateNote(note.id, { title: 'Updated' });

      expect(result).toBeNull();
    });
  });

  describe('note deletion', () => {
    it('should soft delete a note', async () => {
      const note: Note = await noteManager.createNote({ title: 'Test' });

      const success: boolean = await noteManager.deleteNote(note.id);

      expect(success).toBe(true);
      const deletedNote: Note | null = noteManager.getNote(note.id);
      expect(deletedNote!.deleted).toBe(true);
    });

    it('should permanently delete a note', async () => {
      const note: Note = await noteManager.createNote({ title: 'Test' });

      const success: boolean = await noteManager.permanentlyDeleteNote(note.id);

      expect(success).toBe(true);
      const deletedNote: Note | null = noteManager.getNote(note.id);
      expect(deletedNote).toBeNull();
    });

    it('should restore a deleted note', async () => {
      const note: Note = await noteManager.createNote({ title: 'Test' });
      noteManager.deleteNote(note.id);

      const restored: Note | null = noteManager.restoreNote(note.id);

      expect(restored!.deleted).toBe(false);
      expect(restored!.id).toBe(note.id);
    });
  });

  describe('search functionality', () => {
    beforeEach(async () => {
      await noteManager.createNote({
        title: 'JavaScript Tutorial',
        content: 'Learn about functions and variables',
        tags: ['programming', 'js']
      });
      await noteManager.createNote({
        title: 'Python Guide',
        content: 'Python is a great language for beginners',
        tags: ['programming', 'python']
      });
    });

    it('should search by title', () => {
      const results: Note[] = noteManager.searchNotes('JavaScript');

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('JavaScript Tutorial');
    });

    it('should search by content', () => {
      const results: Note[] = noteManager.searchNotes('functions');

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('JavaScript Tutorial');
    });

    it('should search by tags', () => {
      const results: Note[] = noteManager.searchNotes('programming');

      expect(results).toHaveLength(2);
    });

    it('should return all notes for empty query', () => {
      const results: Note[] = noteManager.searchNotes('');

      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('tag management', () => {
    beforeEach(async () => {
      await noteManager.createNote({ title: 'Note 1', tags: ['tag1', 'common'] });
      await noteManager.createNote({ title: 'Note 2', tags: ['tag2', 'common'] });
      await noteManager.createNote({ title: 'Note 3', tags: ['tag1'] });
    });

    it('should get all unique tags with counts', () => {
      const tags: Array<{ name: string; count: number }> = noteManager.getAllTags();

      expect(tags).toContainEqual({ name: 'common', count: 2 });
      expect(tags).toContainEqual({ name: 'tag1', count: 2 });
      expect(tags).toContainEqual({ name: 'tag2', count: 1 });
    });

    it('should get notes by tag', () => {
      const notes: Note[] = noteManager.getNotesByTag('common');

      expect(notes).toHaveLength(2);
      expect(notes.map((n: Note) => n.title)).toContain('Note 1');
      expect(notes.map((n: Note) => n.title)).toContain('Note 2');
    });
  });
});
