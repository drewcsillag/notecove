# Scroll Position Recall - Bug Fix Plan

**Overall Progress:** `100%`

## Summary

The scroll position recall feature was already implemented but had bugs preventing it from working. This plan documents the bugs found and fixes applied.

## Bugs Found

### Bug 1: Race Condition in State Restoration

**Location:** `useEditorStateRestoration.ts`

**Problem:** The hook used a `useRef` to store saved state, but the loading was async. When `isLoading` changed to `false`, both the loading effect and restoration effect would run. The loading effect started an async fetch, but the restoration effect checked `savedStateRef.current` which was still null (async not complete).

```javascript
// Before: Using ref (doesn't trigger re-render when set)
const savedStateRef = useRef<{ scrollTop: number; cursorPosition: number } | null>(null);
// ... async load sets savedStateRef.current, but restoration effect already ran
```

**Fix:** Changed from `useRef` to `useState` so that when the async load completes and sets state, it triggers a re-render and the restoration effect runs again.

### Bug 2: Early Scroll Positions Dropped

**Location:** `useNoteScrollPosition.ts`

**Problem:** The singleton cache was initialized as `null`, and `reportScrollPosition` silently dropped positions if the cache wasn't loaded yet.

```javascript
// Before: Cache starts as null
let scrollPositionsCache: ScrollPositionsCache | null = null;

// Positions dropped if cache not loaded
if (scrollPositionsCache) {
  scrollPositionsCache[noteId] = scrollTop;
}
```

**Fix:** Initialize cache as empty object `{}` immediately. When the async load from database completes, merge the loaded positions with any already recorded (preferring recently recorded positions).

## Enhancements Added

### Cursor Position Persistence

Extended the per-note storage to also persist cursor positions across app restarts:

- Changed data structure from `{ noteId: scrollTop }` to `{ noteId: { scrollTop, cursorPosition } }`
- Added migration function to handle old format data
- Added `getCursorPosition`, `reportCursorPosition`, `getEditorState`, `reportEditorState` functions

## Tasks

- [x] 🟩 **Step 1: Investigate bugs**
  - [x] 🟩 Trace through code to find race condition
  - [x] 🟩 Identify cache initialization issue

- [x] 🟩 **Step 2: Fix race condition**
  - [x] 🟩 Change from useRef to useState for savedState
  - [x] 🟩 Add savedState to restoration effect dependencies

- [x] 🟩 **Step 3: Fix cache initialization**
  - [x] 🟩 Initialize cache as empty object
  - [x] 🟩 Merge loaded positions with already-recorded positions

- [x] 🟩 **Step 4: Add cursor position persistence**
  - [x] 🟩 Update data structure to store both scroll and cursor
  - [x] 🟩 Add migration for old format
  - [x] 🟩 Add cursor reporting to useEditorStateRestoration

- [x] 🟩 **Step 5: Write tests**
  - [x] 🟩 Create test file for useNoteScrollPosition hook
  - [x] 🟩 Test scroll position save/load
  - [x] 🟩 Test cursor position save/load
  - [x] 🟩 Test old format migration
  - [x] 🟩 Test debouncing
  - [x] 🟩 Test cache limits

## Files Modified

1. `packages/desktop/src/renderer/src/components/EditorPanel/useEditorStateRestoration.ts`
   - Changed savedStateRef from useRef to useState
   - Updated dependencies arrays
   - Added per-note cursor position reporting

2. `packages/desktop/src/renderer/src/hooks/useNoteScrollPosition.ts`
   - Fixed cache initialization (start as {} not null)
   - Changed data structure to store both scroll and cursor
   - Added migration function for old format
   - Added new API: getCursorPosition, reportCursorPosition, getEditorState, reportEditorState
   - Added \_\_resetCacheForTesting for test isolation

3. `packages/desktop/src/renderer/src/hooks/__tests__/useNoteScrollPosition.test.ts` (new)
   - 14 tests covering all functionality
