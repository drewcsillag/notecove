/**
 * AtMention Extension Tests
 *
 * Tests for the @ mention extension that provides date keywords
 * and user mentions with autocomplete.
 */

import { format, subDays, addDays } from 'date-fns';

// Helper functions that will be exported from AtMention.ts
// Testing the logic separately from the TipTap extension

describe('AtMention date utilities', () => {
  describe('getDateKeywords', () => {
    it('should return all date keywords when query is empty', () => {
      const keywords = getDateKeywords('');
      expect(keywords).toHaveLength(4);
      expect(keywords.map((k) => k.id)).toEqual(['today', 'yesterday', 'tomorrow', 'date']);
    });

    it('should filter keywords by query', () => {
      expect(getDateKeywords('tod').map((k) => k.id)).toEqual(['today']);
      expect(getDateKeywords('yes').map((k) => k.id)).toEqual(['yesterday']);
      expect(getDateKeywords('tom').map((k) => k.id)).toEqual(['tomorrow']);
      expect(getDateKeywords('dat').map((k) => k.id)).toEqual(['date']);
    });

    it('should be case insensitive', () => {
      expect(getDateKeywords('TOD').map((k) => k.id)).toEqual(['today']);
      expect(getDateKeywords('Today').map((k) => k.id)).toEqual(['today']);
    });

    it('should return empty array for non-matching query', () => {
      expect(getDateKeywords('xyz')).toEqual([]);
    });
  });

  describe('resolveDateKeyword', () => {
    it('should resolve today to current date', () => {
      const result = resolveDateKeyword('today');
      const expected = format(new Date(), 'yyyy-MM-dd');
      expect(result).toBe(expected);
    });

    it('should resolve yesterday to previous date', () => {
      const result = resolveDateKeyword('yesterday');
      const expected = format(subDays(new Date(), 1), 'yyyy-MM-dd');
      expect(result).toBe(expected);
    });

    it('should resolve tomorrow to next date', () => {
      const result = resolveDateKeyword('tomorrow');
      const expected = format(addDays(new Date(), 1), 'yyyy-MM-dd');
      expect(result).toBe(expected);
    });

    it('should return null for date keyword (requires picker)', () => {
      const result = resolveDateKeyword('date');
      expect(result).toBeNull();
    });

    it('should return null for unknown keyword', () => {
      const result = resolveDateKeyword('unknown');
      expect(result).toBeNull();
    });
  });
});

// Import the actual functions after mocking
// These will be implemented in AtMention.ts
import { getDateKeywords, resolveDateKeyword } from '../AtMention';
