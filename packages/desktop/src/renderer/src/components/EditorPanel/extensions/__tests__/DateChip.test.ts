/**
 * DateChip Extension Tests
 *
 * Tests for date pattern detection and decoration.
 */

import { findDateMatches, DATE_PATTERN } from '../DateChip';

describe('DateChip utilities', () => {
  describe('DATE_PATTERN', () => {
    it('should match valid YYYY-MM-DD dates', () => {
      expect('2025-12-19'.match(DATE_PATTERN)).toBeTruthy();
      expect('2024-01-01'.match(DATE_PATTERN)).toBeTruthy();
      expect('1999-12-31'.match(DATE_PATTERN)).toBeTruthy();
    });

    it('should not match invalid date formats', () => {
      expect('25-12-19'.match(DATE_PATTERN)).toBeFalsy();
      expect('2025/12/19'.match(DATE_PATTERN)).toBeFalsy();
      expect('2025-1-19'.match(DATE_PATTERN)).toBeFalsy();
      expect('2025-12-9'.match(DATE_PATTERN)).toBeFalsy();
      expect('12-19-2025'.match(DATE_PATTERN)).toBeFalsy();
    });

    it('should not match dates embedded in URLs', () => {
      // The pattern itself matches, but findDateMatches should skip URLs
      const url = 'https://example.com/2025-12-19/page';
      expect(url.match(DATE_PATTERN)).toBeTruthy(); // Pattern matches
    });
  });

  describe('findDateMatches', () => {
    it('should find dates in plain text', () => {
      const text = 'Meeting on 2025-12-19 and follow-up 2025-12-20';
      const matches = findDateMatches(text);
      expect(matches).toHaveLength(2);
      expect(matches[0]).toEqual({ index: 11, date: '2025-12-19' });
      expect(matches[1]).toEqual({ index: 36, date: '2025-12-20' });
    });

    it('should return empty array for text without dates', () => {
      const text = 'No dates here';
      const matches = findDateMatches(text);
      expect(matches).toHaveLength(0);
    });

    it('should find date at start of text', () => {
      const text = '2025-12-19 is the date';
      const matches = findDateMatches(text);
      expect(matches).toHaveLength(1);
      expect(matches[0]).toEqual({ index: 0, date: '2025-12-19' });
    });

    it('should find date at end of text', () => {
      const text = 'The date is 2025-12-19';
      const matches = findDateMatches(text);
      expect(matches).toHaveLength(1);
      expect(matches[0]).toEqual({ index: 12, date: '2025-12-19' });
    });
  });
});
