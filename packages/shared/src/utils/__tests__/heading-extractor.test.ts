/**
 * Tests for Heading Extraction Utilities
 */

import {
  generateHeadingSlug,
  generateHeadingId,
  isValidHeadingId,
  extractHeadingsFromText,
  extractHeadingsFromProseMirrorDoc,
  findHeadingById,
  findHeadingBySlug,
  type HeadingInfo,
} from '../heading-extractor';

describe('heading-extractor', () => {
  describe('generateHeadingSlug', () => {
    it('should convert heading text to lowercase slug', () => {
      expect(generateHeadingSlug('My Heading')).toBe('my-heading');
      expect(generateHeadingSlug('Introduction')).toBe('introduction');
    });

    it('should replace spaces with hyphens', () => {
      expect(generateHeadingSlug('Getting Started Guide')).toBe('getting-started-guide');
      expect(generateHeadingSlug('  Multiple   Spaces  ')).toBe('multiple-spaces');
    });

    it('should remove special characters', () => {
      expect(generateHeadingSlug("What's New?")).toBe('whats-new');
      expect(generateHeadingSlug('Section #1: Overview')).toBe('section-1-overview');
      expect(generateHeadingSlug('FAQ (Frequently Asked)')).toBe('faq-frequently-asked');
    });

    it('should collapse multiple hyphens', () => {
      expect(generateHeadingSlug('Hello - World')).toBe('hello-world');
      expect(generateHeadingSlug('A -- B --- C')).toBe('a-b-c');
    });

    it('should trim leading and trailing hyphens', () => {
      expect(generateHeadingSlug('- Leading Hyphen')).toBe('leading-hyphen');
      expect(generateHeadingSlug('Trailing Hyphen -')).toBe('trailing-hyphen');
      expect(generateHeadingSlug('- Both -')).toBe('both');
    });

    it('should handle numbers', () => {
      expect(generateHeadingSlug('Chapter 1')).toBe('chapter-1');
      expect(generateHeadingSlug('2024 Update')).toBe('2024-update');
      expect(generateHeadingSlug('Version 2.0')).toBe('version-20');
    });

    it('should handle empty or whitespace-only input', () => {
      expect(generateHeadingSlug('')).toBe('');
      expect(generateHeadingSlug('   ')).toBe('');
      expect(generateHeadingSlug('...')).toBe('');
    });

    it('should handle single character headings', () => {
      expect(generateHeadingSlug('A')).toBe('a');
      expect(generateHeadingSlug('1')).toBe('1');
    });

    it('should preserve existing hyphens in text', () => {
      expect(generateHeadingSlug('Self-Hosted Setup')).toBe('self-hosted-setup');
      expect(generateHeadingSlug('pre-release-notes')).toBe('pre-release-notes');
    });
  });

  describe('generateHeadingId', () => {
    it('should generate ID with h_ prefix', () => {
      const id = generateHeadingId();
      expect(id.startsWith('h_')).toBe(true);
    });

    it('should generate ID with correct length (10 chars total)', () => {
      const id = generateHeadingId();
      expect(id).toHaveLength(10); // h_ + 8 chars
    });

    it('should generate unique IDs', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateHeadingId());
      }
      expect(ids.size).toBe(100);
    });

    it('should only use base64url characters', () => {
      const id = generateHeadingId();
      expect(id).toMatch(/^h_[A-Za-z0-9_-]{8}$/);
    });
  });

  describe('isValidHeadingId', () => {
    it('should return true for valid heading IDs', () => {
      expect(isValidHeadingId('h_Abc12xYz')).toBe(true);
      expect(isValidHeadingId('h_AAAAAAAA')).toBe(true);
      expect(isValidHeadingId('h_12345678')).toBe(true);
      expect(isValidHeadingId('h_a_b-c_d-')).toBe(true);
    });

    it('should return false for invalid heading IDs', () => {
      expect(isValidHeadingId('h_Abc12x')).toBe(false); // Too short
      expect(isValidHeadingId('h_Abc12xYzZ')).toBe(false); // Too long
      expect(isValidHeadingId('Abc12xYz')).toBe(false); // Missing prefix
      expect(isValidHeadingId('x_Abc12xYz')).toBe(false); // Wrong prefix
      expect(isValidHeadingId('')).toBe(false);
      expect(isValidHeadingId('h_')).toBe(false);
    });
  });

  describe('extractHeadingsFromText', () => {
    it('should extract markdown-style headings from text', () => {
      const text = `
# Introduction
Some content here.

## Getting Started
More content.

### Setup Guide
Even more content.
`;
      const headings = extractHeadingsFromText(text);

      expect(headings).toHaveLength(3);
      expect(headings[0].text).toBe('Introduction');
      expect(headings[0].level).toBe(1);
      expect(isValidHeadingId(headings[0].id)).toBe(true);

      expect(headings[1].text).toBe('Getting Started');
      expect(headings[1].level).toBe(2);

      expect(headings[2].text).toBe('Setup Guide');
      expect(headings[2].level).toBe(3);
    });

    it('should handle all heading levels (h1-h6)', () => {
      const text = `
# H1
## H2
### H3
#### H4
##### H5
###### H6
`;
      const headings = extractHeadingsFromText(text);

      expect(headings).toHaveLength(6);
      expect(headings.map((h) => h.level)).toEqual([1, 2, 3, 4, 5, 6]);
    });

    it('should ignore non-heading lines', () => {
      const text = `
# Real Heading
This is not a heading
#Not a heading (no space)
Also not a heading #
`;
      const headings = extractHeadingsFromText(text);

      expect(headings).toHaveLength(1);
      expect(headings[0].text).toBe('Real Heading');
    });

    it('should generate unique IDs for duplicate headings', () => {
      const text = `
## Introduction
Some content.

## Introduction
More content.

## Introduction
Even more.
`;
      const headings = extractHeadingsFromText(text);

      expect(headings).toHaveLength(3);
      // Each heading should have a unique ID even with same text
      const ids = headings.map((h) => h.id);
      expect(new Set(ids).size).toBe(3);
    });

    it('should return empty array for text without headings', () => {
      const text = 'Just some plain text\nwith multiple lines\nbut no headings.';
      const headings = extractHeadingsFromText(text);

      expect(headings).toEqual([]);
    });

    it('should handle empty input', () => {
      expect(extractHeadingsFromText('')).toEqual([]);
      expect(extractHeadingsFromText('   ')).toEqual([]);
    });

    it('should trim heading text', () => {
      const text = '#   Heading With Extra Spaces   ';
      const headings = extractHeadingsFromText(text);

      expect(headings).toHaveLength(1);
      expect(headings[0].text).toBe('Heading With Extra Spaces');
    });
  });

  describe('extractHeadingsFromProseMirrorDoc', () => {
    it('should extract headings with existing IDs', () => {
      const doc = {
        content: [
          {
            type: 'heading',
            attrs: { level: 1, id: 'h_existAAA' },
            content: [{ text: 'Introduction' }],
          },
          {
            type: 'paragraph',
            content: [{ text: 'Some text' }],
          },
          {
            type: 'heading',
            attrs: { level: 2, id: 'h_existBBB' },
            content: [{ text: 'Getting Started' }],
          },
        ],
      };

      const headings = extractHeadingsFromProseMirrorDoc(doc);

      expect(headings).toHaveLength(2);
      expect(headings[0]).toEqual({
        text: 'Introduction',
        level: 1,
        id: 'h_existAAA',
      });
      expect(headings[1]).toEqual({
        text: 'Getting Started',
        level: 2,
        id: 'h_existBBB',
      });
    });

    it('should generate IDs for headings without IDs', () => {
      const doc = {
        content: [
          {
            type: 'heading',
            attrs: { level: 1 },
            content: [{ text: 'No ID Heading' }],
          },
        ],
      };

      const headings = extractHeadingsFromProseMirrorDoc(doc);

      expect(headings).toHaveLength(1);
      expect(headings[0].text).toBe('No ID Heading');
      expect(isValidHeadingId(headings[0].id)).toBe(true);
    });

    it('should generate IDs for headings with invalid IDs', () => {
      const doc = {
        content: [
          {
            type: 'heading',
            attrs: { level: 1, id: 'invalid-id' },
            content: [{ text: 'Invalid ID Heading' }],
          },
        ],
      };

      const headings = extractHeadingsFromProseMirrorDoc(doc);

      expect(headings).toHaveLength(1);
      expect(headings[0].id).not.toBe('invalid-id');
      expect(isValidHeadingId(headings[0].id)).toBe(true);
    });

    it('should handle empty document', () => {
      expect(extractHeadingsFromProseMirrorDoc({})).toEqual([]);
      expect(extractHeadingsFromProseMirrorDoc({ content: [] })).toEqual([]);
    });
  });

  describe('findHeadingById', () => {
    const headings: HeadingInfo[] = [
      { text: 'Introduction', level: 1, id: 'h_intro001' },
      { text: 'Getting Started', level: 2, id: 'h_started1' },
      { text: 'Setup Guide', level: 3, id: 'h_setup001' },
    ];

    it('should find heading by ID', () => {
      const result = findHeadingById(headings, 'h_intro001');
      expect(result).toEqual({ text: 'Introduction', level: 1, id: 'h_intro001' });
    });

    it('should return null for non-existent ID', () => {
      const result = findHeadingById(headings, 'h_notfound');
      expect(result).toBeNull();
    });

    it('should handle empty headings array', () => {
      const result = findHeadingById([], 'h_intro001');
      expect(result).toBeNull();
    });

    it('should be case-sensitive for ID matching', () => {
      const result = findHeadingById(headings, 'H_INTRO001');
      expect(result).toBeNull(); // IDs are case-sensitive
    });
  });

  describe('findHeadingBySlug', () => {
    const headings: HeadingInfo[] = [
      { text: 'Introduction', level: 1, id: 'h_intro001' },
      { text: 'Getting Started', level: 2, id: 'h_started1' },
      { text: 'Setup Guide', level: 3, id: 'h_setup001' },
      { text: 'Introduction', level: 2, id: 'h_intro002' }, // Duplicate text
    ];

    it('should find heading by slug (first match)', () => {
      const result = findHeadingBySlug(headings, 'introduction');
      expect(result).toEqual({ text: 'Introduction', level: 1, id: 'h_intro001' });
    });

    it('should find heading with hyphenated slug', () => {
      const result = findHeadingBySlug(headings, 'getting-started');
      expect(result).toEqual({ text: 'Getting Started', level: 2, id: 'h_started1' });
    });

    it('should return null for non-existent slug', () => {
      const result = findHeadingBySlug(headings, 'nonexistent');
      expect(result).toBeNull();
    });

    it('should handle empty headings array', () => {
      const result = findHeadingBySlug([], 'introduction');
      expect(result).toBeNull();
    });

    it('should be case-insensitive for slug matching', () => {
      const result = findHeadingBySlug(headings, 'INTRODUCTION');
      expect(result).toEqual({ text: 'Introduction', level: 1, id: 'h_intro001' });
    });
  });
});
