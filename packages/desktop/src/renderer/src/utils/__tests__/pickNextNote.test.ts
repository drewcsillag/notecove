/**
 * pickNextNote Utility Tests
 *
 * Tests for the utility function that picks the next note to select
 * after the current note is deleted.
 */

import { pickNextNote } from '../pickNextNote';
import type { NoteCache } from '@notecove/shared';

// Helper to create mock note cache entry
const createNote = (id: string, modified: number, deleted = false): NoteCache => ({
  id,
  sdId: 'test-sd',
  folderId: 'test-folder',
  title: `Note ${id}`,
  contentPreview: '',
  contentText: '',
  created: 1000,
  modified,
  deleted,
  pinned: false,
});

describe('pickNextNote', () => {
  it('should return null when notes array is empty', () => {
    expect(pickNextNote([])).toBeNull();
  });

  it('should return the only note when there is one note', () => {
    const notes = [createNote('note-1', 1000)];
    expect(pickNextNote(notes)).toBe('note-1');
  });

  it('should return the most recently modified note', () => {
    const notes = [
      createNote('note-1', 1000),
      createNote('note-2', 3000), // Most recent
      createNote('note-3', 2000),
    ];
    expect(pickNextNote(notes)).toBe('note-2');
  });

  it('should exclude specified note IDs', () => {
    const notes = [
      createNote('note-1', 1000),
      createNote('note-2', 3000), // Most recent, but excluded
      createNote('note-3', 2000),
    ];
    expect(pickNextNote(notes, ['note-2'])).toBe('note-3');
  });

  it('should exclude multiple note IDs', () => {
    const notes = [
      createNote('note-1', 1000),
      createNote('note-2', 3000),
      createNote('note-3', 2000),
    ];
    expect(pickNextNote(notes, ['note-2', 'note-3'])).toBe('note-1');
  });

  it('should return null when all notes are excluded', () => {
    const notes = [createNote('note-1', 1000), createNote('note-2', 2000)];
    expect(pickNextNote(notes, ['note-1', 'note-2'])).toBeNull();
  });

  it('should handle notes with same modified timestamp', () => {
    const notes = [createNote('note-1', 1000), createNote('note-2', 1000)];
    // Should return one of them (implementation detail - first one found after sort)
    const result = pickNextNote(notes);
    expect(['note-1', 'note-2']).toContain(result);
  });

  it('should skip deleted notes', () => {
    const notes = [
      createNote('note-1', 1000),
      createNote('note-2', 3000, true), // Deleted
      createNote('note-3', 2000),
    ];
    expect(pickNextNote(notes)).toBe('note-3');
  });

  it('should work with empty exclude array', () => {
    const notes = [createNote('note-1', 1000), createNote('note-2', 3000)];
    expect(pickNextNote(notes, [])).toBe('note-2');
  });
});
