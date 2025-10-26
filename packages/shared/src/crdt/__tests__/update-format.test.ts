import {
  UpdateType,
  parseUpdateFilename,
  generateUpdateFilename,
  encodeUpdateFile,
  decodeUpdateFile,
} from '../update-format';

describe('update-format', () => {
  describe('parseUpdateFilename', () => {
    it('should parse note update filename', () => {
      const filename = 'inst-123_note-456_1234567890.yjson';
      const metadata = parseUpdateFilename(filename);

      expect(metadata).not.toBeNull();
      expect(metadata?.type).toBe(UpdateType.Note);
      expect(metadata?.instanceId).toBe('inst-123');
      expect(metadata?.documentId).toBe('note-456');
      expect(metadata?.timestamp).toBe(1234567890);
    });

    it('should parse folder-tree update filename', () => {
      const filename = 'inst-123_folder-tree_sd-789_1234567890.yjson';
      const metadata = parseUpdateFilename(filename);

      expect(metadata).not.toBeNull();
      expect(metadata?.type).toBe(UpdateType.FolderTree);
      expect(metadata?.instanceId).toBe('inst-123');
      expect(metadata?.documentId).toBe('sd-789');
      expect(metadata?.timestamp).toBe(1234567890);
    });

    it('should handle note IDs with underscores', () => {
      const filename = 'inst-123_note_with_underscores_1234567890.yjson';
      const metadata = parseUpdateFilename(filename);

      expect(metadata).not.toBeNull();
      expect(metadata?.documentId).toBe('note_with_underscores');
    });

    it('should handle SD IDs with underscores in folder-tree', () => {
      const filename = 'inst-123_folder-tree_sd_with_underscores_1234567890.yjson';
      const metadata = parseUpdateFilename(filename);

      expect(metadata).not.toBeNull();
      expect(metadata?.type).toBe(UpdateType.FolderTree);
      expect(metadata?.documentId).toBe('sd_with_underscores');
    });

    it('should return null for invalid extension', () => {
      const filename = 'inst-123_note-456_1234567890.txt';
      const metadata = parseUpdateFilename(filename);

      expect(metadata).toBeNull();
    });

    it('should return null for too few parts', () => {
      const filename = 'inst-123_1234567890.yjson';
      const metadata = parseUpdateFilename(filename);

      expect(metadata).toBeNull();
    });

    it('should return null for invalid timestamp', () => {
      const filename = 'inst-123_note-456_notanumber.yjson';
      const metadata = parseUpdateFilename(filename);

      expect(metadata).toBeNull();
    });
  });

  describe('generateUpdateFilename', () => {
    it('should generate note update filename', () => {
      const filename = generateUpdateFilename(UpdateType.Note, 'inst-123', 'note-456', 1234567890);

      // Should match format: inst-123_note-456_1234567890-XXXX.yjson (where XXXX is random 4 digits)
      expect(filename).toMatch(/^inst-123_note-456_1234567890-\d{4}\.yjson$/);
    });

    it('should generate folder-tree update filename', () => {
      const filename = generateUpdateFilename(
        UpdateType.FolderTree,
        'inst-123',
        'sd-789',
        1234567890
      );

      // Should match format: inst-123_folder-tree_sd-789_1234567890-XXXX.yjson (where XXXX is random 4 digits)
      expect(filename).toMatch(/^inst-123_folder-tree_sd-789_1234567890-\d{4}\.yjson$/);
    });

    it('should use current timestamp when not provided', () => {
      const before = Date.now();
      const filename = generateUpdateFilename(UpdateType.Note, 'inst-123', 'note-456');
      const after = Date.now();

      const metadata = parseUpdateFilename(filename);
      expect(metadata?.timestamp).toBeGreaterThanOrEqual(before);
      expect(metadata?.timestamp).toBeLessThanOrEqual(after);
    });

    it('should handle document IDs with underscores', () => {
      const filename = generateUpdateFilename(
        UpdateType.Note,
        'inst-123',
        'note_with_underscores',
        1234567890
      );

      // Should match format with random suffix
      expect(filename).toMatch(/^inst-123_note_with_underscores_1234567890-\d{4}\.yjson$/);

      // Should be parseable
      const metadata = parseUpdateFilename(filename);
      expect(metadata?.documentId).toBe('note_with_underscores');
    });
  });

  describe('encodeUpdateFile / decodeUpdateFile', () => {
    it('should encode and decode update data', () => {
      const originalData = new Uint8Array([1, 2, 3, 4, 5]);

      const encoded = encodeUpdateFile(originalData);
      const decoded = decodeUpdateFile(encoded);

      expect(decoded).toEqual(originalData);
    });

    it('should handle empty update data', () => {
      const originalData = new Uint8Array([]);

      const encoded = encodeUpdateFile(originalData);
      const decoded = decodeUpdateFile(encoded);

      expect(decoded).toEqual(originalData);
    });

    it('should handle large update data', () => {
      const originalData = new Uint8Array(10000);
      for (let i = 0; i < originalData.length; i++) {
        originalData[i] = i % 256;
      }

      const encoded = encodeUpdateFile(originalData);
      const decoded = decodeUpdateFile(encoded);

      expect(decoded).toEqual(originalData);
    });
  });

  describe('round-trip integration', () => {
    it('should correctly round-trip filename generation and parsing', () => {
      const type = UpdateType.Note;
      const instanceId = 'inst-abc-123';
      const documentId = 'note-def-456';
      const timestamp = 1234567890;

      const filename = generateUpdateFilename(type, instanceId, documentId, timestamp);
      const metadata = parseUpdateFilename(filename);

      expect(metadata).not.toBeNull();
      expect(metadata?.type).toBe(type);
      expect(metadata?.instanceId).toBe(instanceId);
      expect(metadata?.documentId).toBe(documentId);
      expect(metadata?.timestamp).toBe(timestamp);
    });

    it('should correctly round-trip for folder-tree updates', () => {
      const type = UpdateType.FolderTree;
      const instanceId = 'inst-xyz-789';
      const documentId = 'sd-main';
      const timestamp = 9876543210;

      const filename = generateUpdateFilename(type, instanceId, documentId, timestamp);
      const metadata = parseUpdateFilename(filename);

      expect(metadata).not.toBeNull();
      expect(metadata?.type).toBe(type);
      expect(metadata?.instanceId).toBe(instanceId);
      expect(metadata?.documentId).toBe(documentId);
      expect(metadata?.timestamp).toBe(timestamp);
    });
  });
});
