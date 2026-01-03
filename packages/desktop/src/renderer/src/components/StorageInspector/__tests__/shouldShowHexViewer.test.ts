/**
 * Tests for helper functions in StorageInspectorWindow
 */

import { shouldShowHexViewer, extractNoteIdFromPath } from '../StorageInspectorWindow';

describe('shouldShowHexViewer', () => {
  describe('should return true for binary file types', () => {
    it('returns true for crdtlog files', () => {
      expect(shouldShowHexViewer('crdtlog')).toBe(true);
    });

    it('returns true for snapshot files', () => {
      expect(shouldShowHexViewer('snapshot')).toBe(true);
    });

    it('returns true for unknown files', () => {
      expect(shouldShowHexViewer('unknown')).toBe(true);
    });
  });

  describe('should return false for files with dedicated previews', () => {
    it('returns false for image files', () => {
      expect(shouldShowHexViewer('image')).toBe(false);
    });

    it('returns false for activity log files', () => {
      expect(shouldShowHexViewer('activity')).toBe(false);
    });

    it('returns false for profile files', () => {
      expect(shouldShowHexViewer('profile')).toBe(false);
    });

    it('returns false for identity files', () => {
      expect(shouldShowHexViewer('identity')).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('returns false for directory type', () => {
      // Directories don't have file data, but if somehow passed, should not show hex
      expect(shouldShowHexViewer('directory')).toBe(false);
    });

    it('returns true for unrecognized types (safe default)', () => {
      // Unknown types should show hex as fallback for debugging
      expect(shouldShowHexViewer('some-future-type')).toBe(true);
    });
  });
});

describe('extractNoteIdFromPath', () => {
  it('extracts noteId from CRDT log path', () => {
    expect(extractNoteIdFromPath('notes/abc123/logs/file.crdtlog')).toBe('abc123');
  });

  it('extracts noteId from snapshot path', () => {
    expect(extractNoteIdFromPath('notes/xyz789/snapshots/snap.snapshot')).toBe('xyz789');
  });

  it('extracts noteId from note directory', () => {
    expect(extractNoteIdFromPath('notes/note-id-here')).toBe('note-id-here');
  });

  it('returns null for non-note paths', () => {
    expect(extractNoteIdFromPath('activity/file.log')).toBeNull();
    expect(extractNoteIdFromPath('profiles/profile.json')).toBeNull();
    expect(extractNoteIdFromPath('media/image.png')).toBeNull();
  });

  it('returns null for empty path', () => {
    expect(extractNoteIdFromPath('')).toBeNull();
  });

  it('handles noteId with special characters', () => {
    expect(extractNoteIdFromPath('notes/note_with-dashes.123/logs/file.crdtlog')).toBe(
      'note_with-dashes.123'
    );
  });
});
