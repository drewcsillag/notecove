/**
 * useNoteScrollPosition Hook Tests
 *
 * Tests for the hook that persists scroll and cursor positions per-note
 * across app restarts.
 */

import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { useNoteScrollPosition, __resetCacheForTesting } from '../useNoteScrollPosition';
import { AppStateKey } from '@notecove/shared';

// Mock the electronAPI
const mockAppState = {
  get: jest.fn(),
  set: jest.fn(),
};

beforeAll(() => {
  // Set up mock window.electronAPI
  Object.defineProperty(window, 'electronAPI', {
    value: { appState: mockAppState },
    writable: true,
  });
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();

  // Reset singleton cache state for each test
  __resetCacheForTesting();

  mockAppState.get.mockResolvedValue(null);
  mockAppState.set.mockResolvedValue(undefined);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useNoteScrollPosition', () => {
  describe('initial load', () => {
    it('should load cache from appState on first mount', async () => {
      const savedState = JSON.stringify({
        'note-1': { scrollTop: 100, cursorPosition: 50 },
        'note-2': { scrollTop: 200, cursorPosition: 75 },
      });
      mockAppState.get.mockResolvedValueOnce(savedState);

      renderHook(() => useNoteScrollPosition());

      // Wait for cache to load
      await act(async () => {
        await jest.runAllTimersAsync();
      });

      expect(mockAppState.get).toHaveBeenCalledWith(AppStateKey.NoteScrollPositions);
    });

    it('should migrate old format (number only) to new format', async () => {
      // Old format: just scroll positions as numbers
      const oldFormatState = JSON.stringify({
        'note-1': 100,
        'note-2': 200,
      });
      mockAppState.get.mockResolvedValueOnce(oldFormatState);

      const { result } = renderHook(() => useNoteScrollPosition());

      // Wait for cache to load
      await act(async () => {
        await jest.runAllTimersAsync();
      });

      // Should return scroll position from migrated data
      const scrollPos = await result.current.getScrollPosition('note-1');
      expect(scrollPos).toBe(100);

      // Cursor position should default to 0 for migrated data
      const cursorPos = await result.current.getCursorPosition('note-1');
      expect(cursorPos).toBe(0);
    });
  });

  describe('getScrollPosition', () => {
    it('should return 0 for unknown note', async () => {
      mockAppState.get.mockResolvedValueOnce(null);

      const { result } = renderHook(() => useNoteScrollPosition());

      await act(async () => {
        await jest.runAllTimersAsync();
      });

      const pos = await result.current.getScrollPosition('unknown-note');
      expect(pos).toBe(0);
    });

    it('should return saved scroll position for known note', async () => {
      const savedState = JSON.stringify({
        'note-1': { scrollTop: 150, cursorPosition: 25 },
      });
      mockAppState.get.mockResolvedValueOnce(savedState);

      const { result } = renderHook(() => useNoteScrollPosition());

      await act(async () => {
        await jest.runAllTimersAsync();
      });

      const pos = await result.current.getScrollPosition('note-1');
      expect(pos).toBe(150);
    });
  });

  describe('getCursorPosition', () => {
    it('should return 0 for unknown note', async () => {
      mockAppState.get.mockResolvedValueOnce(null);

      const { result } = renderHook(() => useNoteScrollPosition());

      await act(async () => {
        await jest.runAllTimersAsync();
      });

      const pos = await result.current.getCursorPosition('unknown-note');
      expect(pos).toBe(0);
    });

    it('should return saved cursor position for known note', async () => {
      const savedState = JSON.stringify({
        'note-1': { scrollTop: 150, cursorPosition: 42 },
      });
      mockAppState.get.mockResolvedValueOnce(savedState);

      const { result } = renderHook(() => useNoteScrollPosition());

      await act(async () => {
        await jest.runAllTimersAsync();
      });

      const pos = await result.current.getCursorPosition('note-1');
      expect(pos).toBe(42);
    });
  });

  describe('getEditorState', () => {
    it('should return default state for unknown note', async () => {
      mockAppState.get.mockResolvedValueOnce(null);

      const { result } = renderHook(() => useNoteScrollPosition());

      await act(async () => {
        await jest.runAllTimersAsync();
      });

      const state = await result.current.getEditorState('unknown-note');
      expect(state).toEqual({ scrollTop: 0, cursorPosition: 0 });
    });

    it('should return saved state for known note', async () => {
      const savedState = JSON.stringify({
        'note-1': { scrollTop: 200, cursorPosition: 100 },
      });
      mockAppState.get.mockResolvedValueOnce(savedState);

      const { result } = renderHook(() => useNoteScrollPosition());

      await act(async () => {
        await jest.runAllTimersAsync();
      });

      const state = await result.current.getEditorState('note-1');
      expect(state).toEqual({ scrollTop: 200, cursorPosition: 100 });
    });
  });

  describe('reportScrollPosition', () => {
    it('should debounce saves', async () => {
      mockAppState.get.mockResolvedValueOnce(null);

      const { result } = renderHook(() => useNoteScrollPosition());

      await act(async () => {
        await jest.runAllTimersAsync();
      });

      // Report multiple scroll positions rapidly
      act(() => {
        result.current.reportScrollPosition('note-1', 100);
        result.current.reportScrollPosition('note-1', 200);
        result.current.reportScrollPosition('note-1', 300);
      });

      // Save should not have happened yet (debounced)
      expect(mockAppState.set).not.toHaveBeenCalled();

      // Fast-forward past debounce time
      await act(async () => {
        jest.advanceTimersByTime(1100);
        await jest.runAllTimersAsync();
      });

      // Should only save once with final value
      expect(mockAppState.set).toHaveBeenCalledTimes(1);
      const savedValue = JSON.parse(mockAppState.set.mock.calls[0][1] as string);
      expect(savedValue['note-1'].scrollTop).toBe(300);
    });

    it('should preserve cursor position when updating scroll', async () => {
      const savedState = JSON.stringify({
        'note-1': { scrollTop: 50, cursorPosition: 25 },
      });
      mockAppState.get.mockResolvedValueOnce(savedState);

      const { result } = renderHook(() => useNoteScrollPosition());

      await act(async () => {
        await jest.runAllTimersAsync();
      });

      act(() => {
        result.current.reportScrollPosition('note-1', 500);
      });

      // Fast-forward past debounce
      await act(async () => {
        jest.advanceTimersByTime(1100);
        await jest.runAllTimersAsync();
      });

      const savedValue = JSON.parse(mockAppState.set.mock.calls[0][1] as string);
      expect(savedValue['note-1']).toEqual({ scrollTop: 500, cursorPosition: 25 });
    });
  });

  describe('reportCursorPosition', () => {
    it('should update cursor position while preserving scroll', async () => {
      const savedState = JSON.stringify({
        'note-1': { scrollTop: 100, cursorPosition: 0 },
      });
      mockAppState.get.mockResolvedValueOnce(savedState);

      const { result } = renderHook(() => useNoteScrollPosition());

      await act(async () => {
        await jest.runAllTimersAsync();
      });

      act(() => {
        result.current.reportCursorPosition('note-1', 75);
      });

      // Fast-forward past debounce
      await act(async () => {
        jest.advanceTimersByTime(1100);
        await jest.runAllTimersAsync();
      });

      const savedValue = JSON.parse(mockAppState.set.mock.calls[0][1] as string);
      expect(savedValue['note-1']).toEqual({ scrollTop: 100, cursorPosition: 75 });
    });
  });

  describe('reportEditorState', () => {
    it('should update both scroll and cursor positions', async () => {
      mockAppState.get.mockResolvedValueOnce(null);

      const { result } = renderHook(() => useNoteScrollPosition());

      await act(async () => {
        await jest.runAllTimersAsync();
      });

      act(() => {
        result.current.reportEditorState('note-1', { scrollTop: 250, cursorPosition: 50 });
      });

      // Fast-forward past debounce
      await act(async () => {
        jest.advanceTimersByTime(1100);
        await jest.runAllTimersAsync();
      });

      const savedValue = JSON.parse(mockAppState.set.mock.calls[0][1] as string);
      expect(savedValue['note-1']).toEqual({ scrollTop: 250, cursorPosition: 50 });
    });

    it('should allow partial updates', async () => {
      const savedState = JSON.stringify({
        'note-1': { scrollTop: 100, cursorPosition: 25 },
      });
      mockAppState.get.mockResolvedValueOnce(savedState);

      const { result } = renderHook(() => useNoteScrollPosition());

      await act(async () => {
        await jest.runAllTimersAsync();
      });

      // Only update scroll
      act(() => {
        result.current.reportEditorState('note-1', { scrollTop: 300 });
      });

      // Fast-forward past debounce
      await act(async () => {
        jest.advanceTimersByTime(1100);
        await jest.runAllTimersAsync();
      });

      const savedValue = JSON.parse(mockAppState.set.mock.calls[0][1] as string);
      expect(savedValue['note-1']).toEqual({ scrollTop: 300, cursorPosition: 25 });
    });
  });

  describe('cache limits', () => {
    it('should limit cache to MAX_TRACKED_NOTES entries', async () => {
      mockAppState.get.mockResolvedValueOnce(null);

      const { result } = renderHook(() => useNoteScrollPosition());

      await act(async () => {
        await jest.runAllTimersAsync();
      });

      // Add 105 notes (more than MAX_TRACKED_NOTES = 100)
      act(() => {
        for (let i = 0; i < 105; i++) {
          result.current.reportScrollPosition(`note-${i}`, i * 10);
        }
      });

      // Fast-forward past debounce
      await act(async () => {
        jest.advanceTimersByTime(1100);
        await jest.runAllTimersAsync();
      });

      const savedValue = JSON.parse(mockAppState.set.mock.calls[0][1] as string) as Record<
        string,
        unknown
      >;
      const noteCount = Object.keys(savedValue).length;
      expect(noteCount).toBeLessThanOrEqual(100);
    });
  });
});
