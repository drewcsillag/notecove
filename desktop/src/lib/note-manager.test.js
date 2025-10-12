import { describe, it, expect, beforeEach } from 'vitest';
import { NoteManager } from './note-manager.js';

// Mock localStorage for web mode
global.localStorage = {
  data: {},
  getItem: function(key) { return this.data[key] || null; },
  setItem: function(key, value) { this.data[key] = value; },
  removeItem: function(key) { delete this.data[key]; },
  clear: function() { this.data = {}; }
};

describe('NoteManager', () => {
  let noteManager;

  beforeEach(() => {
    localStorage.clear();
    noteManager = new NoteManager();
  });

  describe('note creation', () => {
    it('should create a new note with default values', () => {
      const note = noteManager.createNote();

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

    it('should create a note with custom data', () => {
      const customData = {
        title: 'Test Note',
        content: 'Test content',
        tags: ['test']
      };

      const note = noteManager.createNote(customData);

      expect(note.title).toBe('Test Note');
      expect(note.content).toBe('Test content');
      expect(note.tags).toEqual(['test']);
    });
  });

  describe('note retrieval', () => {
    it('should get all notes excluding deleted ones', () => {
      const note1 = noteManager.createNote({ title: 'Note 1' });
      const note2 = noteManager.createNote({ title: 'Note 2' });
      noteManager.deleteNote(note2.id);

      const allNotes = noteManager.getAllNotes();

      expect(allNotes).toHaveLength(3); // 2 sample notes + 1 new note (note2 is deleted)
      expect(allNotes.find(n => n.id === note1.id)).toBeTruthy();
      expect(allNotes.find(n => n.id === note2.id)).toBeFalsy();
    });

    it('should get note by ID', () => {
      const note = noteManager.createNote({ title: 'Test Note' });

      const retrieved = noteManager.getNote(note.id);

      expect(retrieved).toEqual(note);
    });

    it('should return null for non-existent note', () => {
      const retrieved = noteManager.getNote('non-existent-id');

      expect(retrieved).toBeNull();
    });
  });

  describe('note updates', () => {
    it('should update note properties', async () => {
      const note = noteManager.createNote({ title: 'Original' });

      // Small delay to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      const updated = noteManager.updateNote(note.id, {
        title: 'Updated',
        content: 'New content'
      });

      expect(updated.title).toBe('Updated');
      expect(updated.content).toBe('New content');
      expect(updated.modified).not.toBe(note.modified);
    });

    it('should return null for non-existent note', () => {
      const result = noteManager.updateNote('non-existent-id', { title: 'Test' });

      expect(result).toBeNull();
    });

    it('should not update deleted note', () => {
      const note = noteManager.createNote({ title: 'Test' });
      noteManager.deleteNote(note.id);

      const result = noteManager.updateNote(note.id, { title: 'Updated' });

      expect(result).toBeNull();
    });
  });

  describe('note deletion', () => {
    it('should soft delete a note', () => {
      const note = noteManager.createNote({ title: 'Test' });

      const success = noteManager.deleteNote(note.id);

      expect(success).toBe(true);
      const deletedNote = noteManager.getNote(note.id);
      expect(deletedNote.deleted).toBe(true);
    });

    it('should permanently delete a note', () => {
      const note = noteManager.createNote({ title: 'Test' });

      const success = noteManager.permanentlyDeleteNote(note.id);

      expect(success).toBe(true);
      const deletedNote = noteManager.getNote(note.id);
      expect(deletedNote).toBeNull();
    });

    it('should restore a deleted note', () => {
      const note = noteManager.createNote({ title: 'Test' });
      noteManager.deleteNote(note.id);

      const restored = noteManager.restoreNote(note.id);

      expect(restored.deleted).toBe(false);
      expect(restored.id).toBe(note.id);
    });
  });

  describe('search functionality', () => {
    beforeEach(() => {
      noteManager.createNote({
        title: 'JavaScript Tutorial',
        content: 'Learn about functions and variables',
        tags: ['programming', 'js']
      });
      noteManager.createNote({
        title: 'Python Guide',
        content: 'Python is a great language for beginners',
        tags: ['programming', 'python']
      });
    });

    it('should search by title', () => {
      const results = noteManager.searchNotes('JavaScript');

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('JavaScript Tutorial');
    });

    it('should search by content', () => {
      const results = noteManager.searchNotes('functions');

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('JavaScript Tutorial');
    });

    it('should search by tags', () => {
      const results = noteManager.searchNotes('programming');

      expect(results).toHaveLength(2);
    });

    it('should return all notes for empty query', () => {
      const results = noteManager.searchNotes('');

      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('tag management', () => {
    beforeEach(() => {
      noteManager.createNote({ title: 'Note 1', tags: ['tag1', 'common'] });
      noteManager.createNote({ title: 'Note 2', tags: ['tag2', 'common'] });
      noteManager.createNote({ title: 'Note 3', tags: ['tag1'] });
    });

    it('should get all unique tags with counts', () => {
      const tags = noteManager.getAllTags();

      expect(tags).toContainEqual({ name: 'common', count: 2 });
      expect(tags).toContainEqual({ name: 'tag1', count: 2 });
      expect(tags).toContainEqual({ name: 'tag2', count: 1 });
    });

    it('should get notes by tag', () => {
      const notes = noteManager.getNotesByTag('common');

      expect(notes).toHaveLength(2);
      expect(notes.map(n => n.title)).toContain('Note 1');
      expect(notes.map(n => n.title)).toContain('Note 2');
    });
  });
});