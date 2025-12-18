/**
 * Tests for shouldShowHexViewer helper function
 *
 * The hex viewer should only be shown for file types where raw binary
 * inspection is useful. Files with dedicated previews (images, text files)
 * don't need hex dumps.
 */

import { shouldShowHexViewer } from '../StorageInspectorWindow';

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
