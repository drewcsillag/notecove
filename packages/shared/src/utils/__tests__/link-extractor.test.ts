/**
 * Tests for Link Extraction Utilities
 */

import {
  extractLinks,
  hasLinks,
  LINK_PATTERN,
  LINK_WITH_HEADING_PATTERN,
  extractHeadingFromLink,
  isSameNoteLink,
  parseLink,
} from '../link-extractor';

describe('link-extractor', () => {
  describe('LINK_PATTERN', () => {
    it('should match valid full UUID links (36-char)', () => {
      const validLinks = [
        '[[550e8400-e29b-41d4-a716-446655440000]]',
        '[[AAAAAAAA-BBBB-CCCC-DDDD-123456789ABC]]', // Uppercase
        '[[00000000-0000-0000-0000-000000000000]]', // All zeros
      ];

      validLinks.forEach((link) => {
        const regex = new RegExp(LINK_PATTERN.source, LINK_PATTERN.flags);
        expect(regex.test(link)).toBe(true);
      });
    });

    it('should match valid compact UUID links (22-char)', () => {
      const validLinks = [
        '[[VQ6EAOKbQdSnFkRmVUQAAA]]', // Standard compact
        '[[j1wOGksuTX-MOzqR0uPzSg]]', // With hyphen
        '[[AAAAAAAAAAAAAAAAAAAAAA]]', // All A's
        '[[____________________AA]]', // With underscores
      ];

      validLinks.forEach((link) => {
        const regex = new RegExp(LINK_PATTERN.source, LINK_PATTERN.flags);
        expect(regex.test(link)).toBe(true);
      });
    });

    it('should not match invalid link formats', () => {
      const invalidLinks = [
        '[[not-a-uuid]]', // Invalid format (too short, not base64url)
        '[[12345678-1234-1234-1234-12345678901]]', // Too short for full UUID
        '[[12345678-1234-1234-1234-1234567890123]]', // Too long for full UUID
        '[550e8400-e29b-41d4-a716-446655440000]', // Single brackets
        '[[550e8400-e29b-41d4-a716-446655440000]', // Mismatched brackets
        '[[550e8400e29b41d4a716446655440000]]', // Missing hyphens, wrong length for compact
        '[[AAAAAAAAAAAAAAAAAAAAA]]', // 21 chars (too short for compact)
        '[[AAAAAAAAAAAAAAAAAAAAAAA]]', // 23 chars (too long for compact)
        '', // Empty
      ];

      invalidLinks.forEach((link) => {
        const regex = new RegExp(LINK_PATTERN.source, LINK_PATTERN.flags);
        expect(regex.test(link)).toBe(false);
      });
    });
  });

  describe('extractLinks', () => {
    it('should extract single full UUID link from text', () => {
      const text = 'Check out this note: [[550e8400-e29b-41d4-a716-446655440000]]';
      const links = extractLinks(text);

      expect(links).toHaveLength(1);
      expect(links[0]).toBe('550e8400-e29b-41d4-a716-446655440000');
    });

    it('should extract single compact UUID link from text', () => {
      const text = 'Check out this note: [[VQ6EAOKbQdSnFkRmVUQAAA]]';
      const links = extractLinks(text);

      expect(links).toHaveLength(1);
      expect(links[0]).toBe('VQ6EAOKbQdSnFkRmVUQAAA');
    });

    it('should extract mixed full and compact UUID links', () => {
      const text = `
        Full UUID: [[550e8400-e29b-41d4-a716-446655440000]]
        Compact: [[VQ6EAOKbQdSnFkRmVUQAAA]]
      `;
      const links = extractLinks(text);

      expect(links).toHaveLength(2);
      expect(links).toContain('550e8400-e29b-41d4-a716-446655440000');
      expect(links).toContain('VQ6EAOKbQdSnFkRmVUQAAA');
    });

    it('should extract multiple links from text', () => {
      const text = `
        First link: [[550e8400-e29b-41d4-a716-446655440000]]
        Second link: [[660e8400-e29b-41d4-a716-446655440111]]
        Third link: [[770e8400-e29b-41d4-a716-446655440222]]
      `;
      const links = extractLinks(text);

      expect(links).toHaveLength(3);
      expect(links).toContain('550e8400-e29b-41d4-a716-446655440000');
      expect(links).toContain('660e8400-e29b-41d4-a716-446655440111');
      expect(links).toContain('770e8400-e29b-41d4-a716-446655440222');
    });

    it('should remove duplicate links', () => {
      const text = `
        First mention: [[550e8400-e29b-41d4-a716-446655440000]]
        Second mention: [[550e8400-e29b-41d4-a716-446655440000]]
      `;
      const links = extractLinks(text);

      expect(links).toHaveLength(1);
      expect(links[0]).toBe('550e8400-e29b-41d4-a716-446655440000');
    });

    it('should normalize UUIDs to lowercase', () => {
      const text = '[[550E8400-E29B-41D4-A716-446655440000]]'; // Uppercase
      const links = extractLinks(text);

      expect(links).toHaveLength(1);
      expect(links[0]).toBe('550e8400-e29b-41d4-a716-446655440000'); // Lowercase
    });

    it('should handle mixed case duplicates', () => {
      const text = `
        [[550e8400-e29b-41d4-a716-446655440000]]
        [[550E8400-E29B-41D4-A716-446655440000]]
      `;
      const links = extractLinks(text);

      expect(links).toHaveLength(1);
      expect(links[0]).toBe('550e8400-e29b-41d4-a716-446655440000');
    });

    it('should return empty array for text without links', () => {
      const texts = [
        'No links here',
        'Invalid link [[not-a-uuid]]',
        'Single bracket [550e8400-e29b-41d4-a716-446655440000]',
        '',
      ];

      texts.forEach((text) => {
        expect(extractLinks(text)).toEqual([]);
      });
    });

    it('should handle null and undefined inputs', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
      expect(extractLinks(null as any)).toEqual([]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
      expect(extractLinks(undefined as any)).toEqual([]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
      expect(extractLinks(123 as any)).toEqual([]);
    });

    it('should extract links at start, middle, and end of text', () => {
      const text = `[[550e8400-e29b-41d4-a716-446655440000]] at start
      Middle link [[660e8400-e29b-41d4-a716-446655440111]] here
      At end [[770e8400-e29b-41d4-a716-446655440222]]`;

      const links = extractLinks(text);

      expect(links).toHaveLength(3);
    });

    it('should handle adjacent links', () => {
      const text =
        '[[550e8400-e29b-41d4-a716-446655440000]][[660e8400-e29b-41d4-a716-446655440111]]';
      const links = extractLinks(text);

      expect(links).toHaveLength(2);
      expect(links).toContain('550e8400-e29b-41d4-a716-446655440000');
      expect(links).toContain('660e8400-e29b-41d4-a716-446655440111');
    });

    it('should ignore partial matches', () => {
      const text = `
        Incomplete: [[550e8400-e29b-41d4-a716-4466554400
        Valid: [[550e8400-e29b-41d4-a716-446655440000]]
      `;
      const links = extractLinks(text);

      expect(links).toHaveLength(1);
      expect(links[0]).toBe('550e8400-e29b-41d4-a716-446655440000');
    });

    it('should work with multiline text', () => {
      const text = `
        Line 1
        Link on line 2: [[550e8400-e29b-41d4-a716-446655440000]]
        Line 3
        Another link: [[660e8400-e29b-41d4-a716-446655440111]]
        Line 5
      `;
      const links = extractLinks(text);

      expect(links).toHaveLength(2);
    });
  });

  describe('hasLinks', () => {
    it('should return true for text with links', () => {
      const text = 'Check this [[550e8400-e29b-41d4-a716-446655440000]]';
      expect(hasLinks(text)).toBe(true);
    });

    it('should return false for text without links', () => {
      const texts = ['No links here', '[[not-a-uuid]]', '[single-bracket]', ''];

      texts.forEach((text) => {
        expect(hasLinks(text)).toBe(false);
      });
    });

    it('should handle null and undefined inputs', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
      expect(hasLinks(null as any)).toBe(false);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
      expect(hasLinks(undefined as any)).toBe(false);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
      expect(hasLinks(123 as any)).toBe(false);
    });

    it('should return true for text with multiple links', () => {
      const text = `
        [[550e8400-e29b-41d4-a716-446655440000]]
        [[660e8400-e29b-41d4-a716-446655440111]]
      `;
      expect(hasLinks(text)).toBe(true);
    });
  });

  describe('LINK_WITH_HEADING_PATTERN', () => {
    it('should match links without heading (backward compatible)', () => {
      const validLinks = [
        '[[550e8400-e29b-41d4-a716-446655440000]]',
        '[[VQ6EAOKbQdSnFkRmVUQAAA]]',
      ];

      validLinks.forEach((link) => {
        const regex = new RegExp(LINK_WITH_HEADING_PATTERN.source, LINK_WITH_HEADING_PATTERN.flags);
        expect(regex.test(link)).toBe(true);
      });
    });

    it('should match links with heading ID', () => {
      const validLinks = [
        '[[550e8400-e29b-41d4-a716-446655440000#h_Abc12xYz]]',
        '[[550e8400-e29b-41d4-a716-446655440000#h_AAAAAAAA]]',
        '[[550e8400-e29b-41d4-a716-446655440000#h_12345678]]',
        '[[VQ6EAOKbQdSnFkRmVUQAAA#h_a_b-c_d-]]',
      ];

      validLinks.forEach((link) => {
        const regex = new RegExp(LINK_WITH_HEADING_PATTERN.source, LINK_WITH_HEADING_PATTERN.flags);
        expect(regex.test(link)).toBe(true);
      });
    });

    it('should match same-note heading links (no note ID)', () => {
      const validLinks = [
        '[[#h_Abc12xYz]]',
        '[[#h_AAAAAAAA]]',
        '[[#h_12345678]]',
        '[[#h_a_b-c_d-]]',
      ];

      validLinks.forEach((link) => {
        const regex = new RegExp(LINK_WITH_HEADING_PATTERN.source, LINK_WITH_HEADING_PATTERN.flags);
        expect(regex.test(link)).toBe(true);
      });
    });

    it('should not match invalid heading IDs', () => {
      const invalidLinks = [
        '[[550e8400-e29b-41d4-a716-446655440000#]]', // Empty heading
        '[[550e8400-e29b-41d4-a716-446655440000#my-heading]]', // Not h_ format
        '[[550e8400-e29b-41d4-a716-446655440000#h_short]]', // Too short
        '[[550e8400-e29b-41d4-a716-446655440000#h_toolongid]]', // Too long
        '[[#]]', // Empty same-note heading
        '[[#introduction]]', // Not h_ format
      ];

      invalidLinks.forEach((link) => {
        const regex = new RegExp(LINK_WITH_HEADING_PATTERN.source, LINK_WITH_HEADING_PATTERN.flags);
        expect(regex.test(link)).toBe(false);
      });
    });

    it('should capture note ID and heading ID separately', () => {
      const regex = new RegExp(LINK_WITH_HEADING_PATTERN.source, LINK_WITH_HEADING_PATTERN.flags);

      // Full UUID with heading
      let match = regex.exec('[[550e8400-e29b-41d4-a716-446655440000#h_Abc12xYz]]');
      expect(match).not.toBeNull();
      expect(match![1]).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(match![2]).toBe('h_Abc12xYz');

      // Reset regex
      regex.lastIndex = 0;

      // Compact UUID with heading
      match = regex.exec('[[VQ6EAOKbQdSnFkRmVUQAAA#h_intro123]]');
      expect(match).not.toBeNull();
      expect(match![1]).toBe('VQ6EAOKbQdSnFkRmVUQAAA');
      expect(match![2]).toBe('h_intro123');

      // Reset regex
      regex.lastIndex = 0;

      // Same-note link (no note ID)
      match = regex.exec('[[#h_Abc12xYz]]');
      expect(match).not.toBeNull();
      expect(match![1]).toBeUndefined();
      expect(match![2]).toBe('h_Abc12xYz');

      // Reset regex
      regex.lastIndex = 0;

      // Note link without heading
      match = regex.exec('[[550e8400-e29b-41d4-a716-446655440000]]');
      expect(match).not.toBeNull();
      expect(match![1]).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(match![2]).toBeUndefined();
    });
  });

  describe('extractHeadingFromLink', () => {
    it('should extract heading ID from link with heading', () => {
      // Heading IDs are case-sensitive (base64url encoding)
      expect(
        extractHeadingFromLink('[[550e8400-e29b-41d4-a716-446655440000#h_Abc12xYz]]')
      ).toBe('h_Abc12xYz');
      expect(extractHeadingFromLink('[[VQ6EAOKbQdSnFkRmVUQAAA#h_intro123]]')).toBe('h_intro123');
      expect(extractHeadingFromLink('[[#h_section1]]')).toBe('h_section1');
    });

    it('should return null for links without heading', () => {
      expect(extractHeadingFromLink('[[550e8400-e29b-41d4-a716-446655440000]]')).toBeNull();
      expect(extractHeadingFromLink('[[VQ6EAOKbQdSnFkRmVUQAAA]]')).toBeNull();
    });

    it('should return null for invalid links', () => {
      expect(extractHeadingFromLink('not a link')).toBeNull();
      expect(extractHeadingFromLink('[[invalid]]')).toBeNull();
      expect(extractHeadingFromLink('')).toBeNull();
    });
  });

  describe('isSameNoteLink', () => {
    it('should return true for same-note heading links', () => {
      expect(isSameNoteLink('[[#h_Abc12xYz]]')).toBe(true);
      expect(isSameNoteLink('[[#h_intro123]]')).toBe(true);
      expect(isSameNoteLink('[[#h_section1]]')).toBe(true);
    });

    it('should return false for links with note ID', () => {
      expect(isSameNoteLink('[[550e8400-e29b-41d4-a716-446655440000]]')).toBe(false);
      expect(isSameNoteLink('[[550e8400-e29b-41d4-a716-446655440000#h_Abc12xYz]]')).toBe(false);
      expect(isSameNoteLink('[[VQ6EAOKbQdSnFkRmVUQAAA]]')).toBe(false);
      expect(isSameNoteLink('[[VQ6EAOKbQdSnFkRmVUQAAA#h_intro123]]')).toBe(false);
    });

    it('should return false for invalid links', () => {
      expect(isSameNoteLink('not a link')).toBe(false);
      expect(isSameNoteLink('[[invalid]]')).toBe(false);
      expect(isSameNoteLink('')).toBe(false);
    });
  });

  describe('parseLink', () => {
    it('should parse link with note ID only', () => {
      const result = parseLink('[[550e8400-e29b-41d4-a716-446655440000]]');
      expect(result).toEqual({
        noteId: '550e8400-e29b-41d4-a716-446655440000',
        headingId: null,
      });
    });

    it('should parse link with note ID and heading', () => {
      // Heading IDs are case-sensitive (base64url encoding)
      const result = parseLink('[[550e8400-e29b-41d4-a716-446655440000#h_Abc12xYz]]');
      expect(result).toEqual({
        noteId: '550e8400-e29b-41d4-a716-446655440000',
        headingId: 'h_Abc12xYz',
      });
    });

    it('should parse same-note heading link', () => {
      // Heading IDs are case-sensitive (base64url encoding)
      const result = parseLink('[[#h_Abc12xYz]]');
      expect(result).toEqual({
        noteId: null,
        headingId: 'h_Abc12xYz',
      });
    });

    it('should parse compact UUID links', () => {
      expect(parseLink('[[VQ6EAOKbQdSnFkRmVUQAAA]]')).toEqual({
        noteId: 'VQ6EAOKbQdSnFkRmVUQAAA',
        headingId: null,
      });
      expect(parseLink('[[VQ6EAOKbQdSnFkRmVUQAAA#h_intro123]]')).toEqual({
        noteId: 'VQ6EAOKbQdSnFkRmVUQAAA',
        headingId: 'h_intro123',
      });
    });

    it('should normalize full UUIDs to lowercase but keep heading ID case', () => {
      // Note IDs (full UUIDs) are normalized to lowercase
      // But heading IDs are case-sensitive (base64url encoding)
      const result = parseLink('[[550E8400-E29B-41D4-A716-446655440000#h_Abc12xYz]]');
      expect(result).toEqual({
        noteId: '550e8400-e29b-41d4-a716-446655440000',
        headingId: 'h_Abc12xYz', // Heading ID keeps original case
      });
    });

    it('should return null for invalid links', () => {
      expect(parseLink('not a link')).toBeNull();
      expect(parseLink('[[invalid]]')).toBeNull();
      expect(parseLink('')).toBeNull();
      expect(parseLink('[[#]]')).toBeNull(); // Empty heading
      expect(parseLink('[[#my-heading]]')).toBeNull(); // Invalid heading format
    });
  });
});
