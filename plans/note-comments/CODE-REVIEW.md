# Comments Feature - Code Review

**Date:** 2025-12-14
**Reviewer:** Claude Opus 4.5

## Summary

Code review of the comments feature implementation across 5 key files. The code is well-structured and follows good practices. 14 potential issues were identified, with 3 fixes applied immediately.

## Fixes Applied

1. **Uint8Array buffer handling** (High → Fixed)
   - Changed from `new Uint32Array()` to `DataView` for proper byte alignment
   - Location: `CommentPanel.tsx` sorting logic

2. **Memory leak in threadRefs** (High → Fixed)
   - Added cleanup effect to remove refs for deleted threads
   - Location: `CommentPanel.tsx`

3. **Lint errors** (Medium → Fixed)
   - Fixed 8 lint errors in CommentPanel.tsx and MentionAutocomplete.tsx
   - Used `RegExp.exec()` instead of `String.match()`
   - Added braces to void arrow functions

## Remaining Issues (Low Priority)

### Medium Severity - Future Work

| Issue | Description | Location |
|-------|-------------|----------|
| Race condition | Multiple rapid reloads could cause stale data | CommentPanel.tsx loadThreads |
| Stale closures | Large dependency array in keyboard handler | CommentPanel.tsx |
| Missing error boundary | Comment panel errors could crash app | All comment components |

### Low Severity - Technical Debt

| Issue | Description |
|-------|-------------|
| Magic numbers | Hardcoded timeout values without constants |
| Inconsistent error returns | Some handlers return arrays, others return error objects |
| Missing accessibility | No aria-labels on icon buttons |

## Not An Issue

- **XSS concerns**: React automatically escapes text content. The components use `{text}` syntax, not `dangerouslySetInnerHTML`. Content comes from local CRDT/database, not external sources.

## Positive Findings

✅ Good use of `useCallback` for performance
✅ Proper event listener cleanup in useEffect
✅ Good separation of concerns (separate components)
✅ Defensive null checks throughout
✅ Try-catch blocks in async operations
✅ Broadcast events for cross-window sync

## Recommendations

1. Consider adding request deduplication for loadThreads if race conditions become noticeable
2. Add error boundary wrapper around CommentPanel for graceful degradation
3. Consider debouncing mention detection for very long inputs
