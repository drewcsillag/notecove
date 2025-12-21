/**
 * Tests for transaction range utilities
 */

import {
  mergeOverlappingRanges,
  isInChangedRange,
  expandRanges,
  decorationsAffected,
  type ChangedRange,
} from '../transaction-ranges';

describe('mergeOverlappingRanges', () => {
  it('should return empty array for empty input', () => {
    expect(mergeOverlappingRanges([])).toEqual([]);
  });

  it('should return single range unchanged', () => {
    const ranges: ChangedRange[] = [{ from: 10, to: 20 }];
    expect(mergeOverlappingRanges(ranges)).toEqual([{ from: 10, to: 20 }]);
  });

  it('should merge overlapping ranges', () => {
    const ranges: ChangedRange[] = [
      { from: 10, to: 20 },
      { from: 15, to: 25 },
    ];
    expect(mergeOverlappingRanges(ranges)).toEqual([{ from: 10, to: 25 }]);
  });

  it('should merge adjacent ranges', () => {
    const ranges: ChangedRange[] = [
      { from: 10, to: 20 },
      { from: 21, to: 30 },
    ];
    expect(mergeOverlappingRanges(ranges)).toEqual([{ from: 10, to: 30 }]);
  });

  it('should not merge non-overlapping ranges', () => {
    const ranges: ChangedRange[] = [
      { from: 10, to: 20 },
      { from: 30, to: 40 },
    ];
    expect(mergeOverlappingRanges(ranges)).toEqual([
      { from: 10, to: 20 },
      { from: 30, to: 40 },
    ]);
  });

  it('should handle unsorted input', () => {
    const ranges: ChangedRange[] = [
      { from: 30, to: 40 },
      { from: 10, to: 20 },
      { from: 15, to: 35 },
    ];
    expect(mergeOverlappingRanges(ranges)).toEqual([{ from: 10, to: 40 }]);
  });

  it('should handle contained ranges', () => {
    const ranges: ChangedRange[] = [
      { from: 10, to: 40 },
      { from: 15, to: 25 },
    ];
    expect(mergeOverlappingRanges(ranges)).toEqual([{ from: 10, to: 40 }]);
  });
});

describe('isInChangedRange', () => {
  const ranges: ChangedRange[] = [
    { from: 10, to: 20 },
    { from: 30, to: 40 },
  ];

  it('should return true for position in range', () => {
    expect(isInChangedRange(15, ranges)).toBe(true);
    expect(isInChangedRange(35, ranges)).toBe(true);
  });

  it('should return true for position at range boundary', () => {
    expect(isInChangedRange(10, ranges)).toBe(true);
    expect(isInChangedRange(20, ranges)).toBe(true);
    expect(isInChangedRange(30, ranges)).toBe(true);
    expect(isInChangedRange(40, ranges)).toBe(true);
  });

  it('should return false for position outside ranges', () => {
    expect(isInChangedRange(5, ranges)).toBe(false);
    expect(isInChangedRange(25, ranges)).toBe(false);
    expect(isInChangedRange(50, ranges)).toBe(false);
  });

  it('should return false for empty ranges', () => {
    expect(isInChangedRange(15, [])).toBe(false);
  });
});

describe('expandRanges', () => {
  it('should expand ranges by given amount', () => {
    const ranges: ChangedRange[] = [{ from: 20, to: 30 }];
    expect(expandRanges(ranges, 5, 100)).toEqual([{ from: 15, to: 35 }]);
  });

  it('should clamp to document boundaries', () => {
    const ranges: ChangedRange[] = [{ from: 2, to: 98 }];
    expect(expandRanges(ranges, 10, 100)).toEqual([{ from: 0, to: 100 }]);
  });

  it('should merge ranges that become overlapping after expansion', () => {
    const ranges: ChangedRange[] = [
      { from: 10, to: 15 },
      { from: 20, to: 25 },
    ];
    expect(expandRanges(ranges, 5, 100)).toEqual([{ from: 5, to: 30 }]);
  });
});

describe('decorationsAffected', () => {
  const ranges: ChangedRange[] = [
    { from: 10, to: 20 },
    { from: 40, to: 50 },
  ];

  it('should return true when decoration overlaps range', () => {
    expect(decorationsAffected(ranges, [{ from: 15, to: 25 }])).toBe(true);
    expect(decorationsAffected(ranges, [{ from: 5, to: 15 }])).toBe(true);
  });

  it('should return true when decoration is inside range', () => {
    expect(decorationsAffected(ranges, [{ from: 12, to: 18 }])).toBe(true);
  });

  it('should return true when decoration contains range', () => {
    expect(decorationsAffected(ranges, [{ from: 5, to: 25 }])).toBe(true);
  });

  it('should return false when decoration is outside all ranges', () => {
    expect(decorationsAffected(ranges, [{ from: 25, to: 35 }])).toBe(false);
  });

  it('should return false for empty decorations', () => {
    expect(decorationsAffected(ranges, [])).toBe(false);
  });

  it('should return false for empty ranges', () => {
    expect(decorationsAffected([], [{ from: 10, to: 20 }])).toBe(false);
  });
});
