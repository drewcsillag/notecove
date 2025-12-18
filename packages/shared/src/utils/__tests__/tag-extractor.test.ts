/**
 * Unit tests for tag extraction utilities
 */

import { extractTags, HASHTAG_PATTERN, MAX_TAG_LENGTH } from '../tag-extractor';

describe('tag-extractor', () => {
  describe('extractTags', () => {
    it('should extract a single hashtag', () => {
      const tags = extractTags('This is a note with #work');
      expect(tags).toEqual(['work']);
    });

    it('should extract multiple hashtags', () => {
      const tags = extractTags('Meeting about #work and #project');
      expect(tags).toEqual(expect.arrayContaining(['work', 'project']));
      expect(tags).toHaveLength(2);
    });

    it('should extract hashtags with numbers and underscores', () => {
      const tags = extractTags('Tags: #web3 #react_native #v2_0');
      expect(tags).toEqual(expect.arrayContaining(['web3', 'react_native', 'v2_0']));
      expect(tags).toHaveLength(3);
    });

    it('should normalize tags to lowercase', () => {
      const tags = extractTags('Tags: #Work #PROJECT #React');
      expect(tags).toEqual(expect.arrayContaining(['work', 'project', 'react']));
    });

    it('should deduplicate tags (case-insensitive)', () => {
      const tags = extractTags('Tags: #work #Work #WORK');
      expect(tags).toEqual(['work']);
      expect(tags).toHaveLength(1);
    });

    it('should not match hashtag with only numbers', () => {
      const tags = extractTags('Price: #50 or #123');
      expect(tags).toEqual([]);
    });

    it('should not match standalone # without alphanumeric characters', () => {
      const tags = extractTags('Just # or #-test or #@invalid');
      expect(tags).toEqual([]);
    });

    it('should extract hashtags at different positions', () => {
      const tags = extractTags('#start middle #middle end #end');
      expect(tags).toEqual(expect.arrayContaining(['start', 'middle', 'end']));
      expect(tags).toHaveLength(3);
    });

    it('should handle empty string', () => {
      const tags = extractTags('');
      expect(tags).toEqual([]);
    });

    it('should handle string with no hashtags', () => {
      const tags = extractTags('This has no tags at all');
      expect(tags).toEqual([]);
    });

    it('should handle null input gracefully', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
      const tags = extractTags(null as any);
      expect(tags).toEqual([]);
    });

    it('should handle undefined input gracefully', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
      const tags = extractTags(undefined as any);
      expect(tags).toEqual([]);
    });

    it('should handle non-string input gracefully', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
      const tags = extractTags(123 as any);
      expect(tags).toEqual([]);
    });

    it('should truncate tags longer than MAX_TAG_LENGTH', () => {
      const longTag = 'a'.repeat(MAX_TAG_LENGTH + 10);
      const text = `This has a very #${longTag} tag`;
      const tags = extractTags(text);

      expect(tags).toHaveLength(1);
      expect(tags[0]).toHaveLength(MAX_TAG_LENGTH);
      expect(tags[0]).toBe('a'.repeat(MAX_TAG_LENGTH));
    });

    it('should handle tags with exactly MAX_TAG_LENGTH characters', () => {
      const exactTag = 'a'.repeat(MAX_TAG_LENGTH);
      const text = `This has #${exactTag}`;
      const tags = extractTags(text);

      expect(tags).toEqual([exactTag]);
      expect(tags[0]).toHaveLength(MAX_TAG_LENGTH);
    });

    it('should handle hashtags in multiline text', () => {
      const text = `Line 1 with #tag1
Line 2 with #tag2
Line 3 with #tag3`;
      const tags = extractTags(text);
      expect(tags).toEqual(expect.arrayContaining(['tag1', 'tag2', 'tag3']));
      expect(tags).toHaveLength(3);
    });

    it('should not extract hashtags followed by certain punctuation as part of the tag', () => {
      const tags = extractTags('Check out #work! and #project, also #test.');
      expect(tags).toEqual(expect.arrayContaining(['work', 'project', 'test']));
      expect(tags).toHaveLength(3);
    });

    // URL fragment tests - hashtags inside URLs should NOT be extracted
    describe('URL fragment handling', () => {
      it('should NOT extract hashtag that is a URL fragment', () => {
        const tags = extractTags('See https://example.com/page#section for more');
        expect(tags).toEqual([]);
      });

      it('should extract hashtag before URL but not URL fragment', () => {
        const tags = extractTags('#work See https://example.com#section');
        expect(tags).toEqual(['work']);
      });

      it('should extract hashtag after URL but not URL fragment', () => {
        const tags = extractTags('Link https://example.com#section then #project');
        expect(tags).toEqual(['project']);
      });

      it('should NOT extract hashtag from markdown link URL fragment', () => {
        const tags = extractTags('Click [here](https://example.com#anchor) for info');
        expect(tags).toEqual([]);
      });

      it('should NOT extract hashtag when URL has multiple fragments', () => {
        // Edge case: technically invalid but possible
        const tags = extractTags('See https://example.com#foo#bar');
        expect(tags).toEqual([]);
      });

      it('should NOT extract hashtag from URL query param', () => {
        const tags = extractTags('Link https://example.com?tag=#test here');
        expect(tags).toEqual([]);
      });

      it('should handle mixed content with real tags and URL fragments', () => {
        const tags = extractTags(
          '#start https://example.com#section #middle http://test.com#anchor #end'
        );
        expect(tags).toEqual(expect.arrayContaining(['start', 'middle', 'end']));
        expect(tags).toHaveLength(3);
      });

      it('should handle URL at start of text', () => {
        const tags = extractTags('https://example.com#section is a link');
        expect(tags).toEqual([]);
      });

      it('should handle URL at end of text', () => {
        const tags = extractTags('Visit https://example.com#section');
        expect(tags).toEqual([]);
      });

      it('should handle multiple URLs with fragments', () => {
        const tags = extractTags('https://a.com#one and https://b.com#two');
        expect(tags).toEqual([]);
      });
    });
  });

  describe('HASHTAG_PATTERN', () => {
    it('should be a global regex', () => {
      expect(HASHTAG_PATTERN.global).toBe(true);
    });

    it('should match valid hashtags', () => {
      const regex = new RegExp(HASHTAG_PATTERN.source, HASHTAG_PATTERN.flags);
      expect('#work'.match(regex)).toBeTruthy();
      expect('#Work123'.match(regex)).toBeTruthy();
      expect('#test_case'.match(regex)).toBeTruthy();
    });

    it('should not match invalid hashtags', () => {
      const regex = new RegExp(HASHTAG_PATTERN.source, HASHTAG_PATTERN.flags);
      expect('#123'.match(regex)).toBeNull();
      expect('#-test'.match(regex)).toBeNull();
      expect('#'.match(regex)).toBeNull();
    });
  });

  describe('MAX_TAG_LENGTH', () => {
    it('should be a positive number', () => {
      expect(MAX_TAG_LENGTH).toBeGreaterThan(0);
    });

    it('should be 50 characters (current specification)', () => {
      expect(MAX_TAG_LENGTH).toBe(50);
    });
  });
});
