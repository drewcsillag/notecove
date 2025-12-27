/**
 * Tests for UUID encoding utilities
 *
 * Converts between standard UUID format (36 chars with dashes)
 * and compact base64url format (22 chars, no padding)
 */

import {
  uuidToCompact,
  compactToUuid,
  isCompactUuid,
  isFullUuid,
  normalizeUuid,
  generateCompactId,
} from '../uuid-encoding';

describe('uuid-encoding', () => {
  // Test vectors - known UUID to compact mappings
  const testVectors = [
    {
      uuid: '00000000-0000-0000-0000-000000000000',
      compact: 'AAAAAAAAAAAAAAAAAAAAAA',
    },
    {
      uuid: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
      compact: '_____________________w',
    },
    {
      uuid: '550e8400-e29b-41d4-a716-446655440000',
      compact: 'VQ6EAOKbQdSnFkRmVUQAAA',
    },
    {
      uuid: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
      compact: 'a6e4EJ2tEdGAtADAT9QwyA',
    },
  ];

  describe('uuidToCompact', () => {
    it('should convert standard UUID to 22-char compact format', () => {
      for (const { uuid, compact } of testVectors) {
        expect(uuidToCompact(uuid)).toBe(compact);
      }
    });

    it('should handle uppercase UUIDs', () => {
      const uuid = '550E8400-E29B-41D4-A716-446655440000';
      const compact = uuidToCompact(uuid);
      expect(compact).toBe('VQ6EAOKbQdSnFkRmVUQAAA');
    });

    it('should produce only URL-safe characters', () => {
      // Generate several random UUIDs and verify output
      for (let i = 0; i < 100; i++) {
        const uuid = crypto.randomUUID();
        const compact = uuidToCompact(uuid);
        // base64url uses only a-zA-Z0-9, hyphen, underscore
        expect(compact).toMatch(/^[a-zA-Z0-9_-]{22}$/);
      }
    });

    it('should throw on invalid UUID format', () => {
      expect(() => uuidToCompact('not-a-uuid')).toThrow();
      expect(() => uuidToCompact('550e8400-e29b-41d4-a716')).toThrow();
      expect(() => uuidToCompact('')).toThrow();
    });

    it('should return exactly 22 characters', () => {
      for (const { uuid } of testVectors) {
        expect(uuidToCompact(uuid)).toHaveLength(22);
      }
    });
  });

  describe('compactToUuid', () => {
    it('should convert compact format back to standard UUID', () => {
      for (const { uuid, compact } of testVectors) {
        expect(compactToUuid(compact)).toBe(uuid.toLowerCase());
      }
    });

    it('should produce lowercase UUID with dashes', () => {
      const compact = 'VQ6EAOKbQdSnFkRmVUQAAA';
      const uuid = compactToUuid(compact);
      expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });

    it('should throw on invalid compact format', () => {
      expect(() => compactToUuid('too-short')).toThrow();
      expect(() => compactToUuid('this-is-way-too-long-to-be-valid')).toThrow();
      expect(() => compactToUuid('')).toThrow();
      // Invalid base64url character
      expect(() => compactToUuid('VQ6EAOKbQdSnFkRm!@#$%^')).toThrow();
    });
  });

  describe('round-trip conversion', () => {
    it('should preserve data through uuid -> compact -> uuid', () => {
      for (const { uuid } of testVectors) {
        const compact = uuidToCompact(uuid);
        const restored = compactToUuid(compact);
        expect(restored).toBe(uuid.toLowerCase());
      }
    });

    it('should preserve data through compact -> uuid -> compact', () => {
      for (const { compact } of testVectors) {
        const uuid = compactToUuid(compact);
        const restored = uuidToCompact(uuid);
        expect(restored).toBe(compact);
      }
    });

    it('should work with randomly generated UUIDs', () => {
      for (let i = 0; i < 100; i++) {
        const original = crypto.randomUUID();
        const compact = uuidToCompact(original);
        const restored = compactToUuid(compact);
        expect(restored).toBe(original.toLowerCase());
      }
    });
  });

  describe('isCompactUuid', () => {
    it('should return true for valid compact UUIDs', () => {
      for (const { compact } of testVectors) {
        expect(isCompactUuid(compact)).toBe(true);
      }
    });

    it('should return false for standard UUIDs', () => {
      for (const { uuid } of testVectors) {
        expect(isCompactUuid(uuid)).toBe(false);
      }
    });

    it('should return false for invalid strings', () => {
      expect(isCompactUuid('')).toBe(false);
      expect(isCompactUuid('too-short')).toBe(false);
      expect(isCompactUuid('this-is-way-too-long-string')).toBe(false);
      expect(isCompactUuid('VQ6EAOKbQdSnFkRm!@#$%^')).toBe(false);
    });
  });

  describe('isFullUuid', () => {
    it('should return true for valid standard UUIDs', () => {
      for (const { uuid } of testVectors) {
        expect(isFullUuid(uuid)).toBe(true);
      }
    });

    it('should return true for uppercase UUIDs', () => {
      expect(isFullUuid('550E8400-E29B-41D4-A716-446655440000')).toBe(true);
    });

    it('should return false for compact UUIDs', () => {
      for (const { compact } of testVectors) {
        expect(isFullUuid(compact)).toBe(false);
      }
    });

    it('should return false for invalid strings', () => {
      expect(isFullUuid('')).toBe(false);
      expect(isFullUuid('not-a-uuid')).toBe(false);
      expect(isFullUuid('550e8400-e29b-41d4-a716')).toBe(false);
    });
  });

  describe('normalizeUuid', () => {
    it('should return compact format when given full UUID', () => {
      for (const { uuid, compact } of testVectors) {
        expect(normalizeUuid(uuid)).toBe(compact);
      }
    });

    it('should return compact format unchanged when given compact UUID', () => {
      for (const { compact } of testVectors) {
        expect(normalizeUuid(compact)).toBe(compact);
      }
    });

    it('should handle uppercase full UUIDs', () => {
      const uuid = '550E8400-E29B-41D4-A716-446655440000';
      expect(normalizeUuid(uuid)).toBe('VQ6EAOKbQdSnFkRmVUQAAA');
    });

    it('should throw on invalid format', () => {
      expect(() => normalizeUuid('invalid')).toThrow();
      expect(() => normalizeUuid('')).toThrow();
    });
  });

  describe('generateCompactId', () => {
    it('should generate valid compact UUID format', () => {
      const id = generateCompactId();
      expect(id).toMatch(/^[a-zA-Z0-9_-]{22}$/);
    });

    it('should generate unique IDs', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 1000; i++) {
        ids.add(generateCompactId());
      }
      expect(ids.size).toBe(1000);
    });

    it('should be convertible back to valid UUID', () => {
      for (let i = 0; i < 100; i++) {
        const compact = generateCompactId();
        const uuid = compactToUuid(compact);
        expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      }
    });

    it('should produce valid v4 UUIDs when decoded', () => {
      for (let i = 0; i < 100; i++) {
        const compact = generateCompactId();
        const uuid = compactToUuid(compact);
        // UUID v4 has version nibble = 4 and variant bits = 10xx
        const versionChar = uuid[14];
        const variantChar = uuid[19];
        expect(versionChar).toBe('4');
        expect(['8', '9', 'a', 'b']).toContain(variantChar);
      }
    });
  });
});
