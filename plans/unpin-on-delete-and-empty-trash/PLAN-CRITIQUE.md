# Plan Critique

## Ordering Evaluation

**Current order is correct:**

1. Feature 1 (unpin) and Feature 2 (empty trash) are independent - can be done in either order
2. Within each feature, TDD ordering is followed: test → implement → verify
3. Backend before frontend for Feature 2 is correct - UI needs API to call

**No ordering issues found.**

## Feedback Loop Evaluation

**Feature 1 (Unpin):**

- Gets to testable state quickly: unit test verifies behavior immediately
- Interactive testing possible after step 1.3 by manually deleting a pinned note

**Feature 2 (Empty Trash):**

- Backend work (2.1-2.3) before UI (2.4-2.6) is unavoidable
- However, we could add a simple console test after 2.3 to verify backend works
- **Suggestion**: Consider adding a verification step after 2.3 to test handler directly before building UI

**Verdict**: Order is reasonable. Could add backend verification checkpoint but not critical.

## Debug Tools Evaluation

**Already available:**

- Existing test infrastructure with mocks
- `permanentlyDeleteNote` already tested
- Browser DevTools for UI debugging
- Note events already broadcast for inspection

**No additional debug tools needed.**

## Missing Items Check

**Reviewed and complete:**

- ✅ CRDT metadata update for unpin (mentioned in 1.2)
- ✅ `emptyTrash` needs to unregister in `unregisterNoteHandlers()` - **ADD THIS**
- ✅ Web client stub needs update - **CHECK IF EXISTS**

**Found one missing item:**

- Need to add `emptyTrash` to the handler unregister function in `note-handlers.ts`

## Risk Assessment

**Risks identified:**

1. **Race condition in empty trash**: If user opens context menu, another process adds a note to trash, then user clicks "Empty Trash", the count shown won't match reality
   - **Mitigation**: Fetch count at confirmation time, not menu open time
   - **Severity**: Low - edge case, no data loss risk

2. **Large trash folder performance**: If trash has many notes, emptying could take time
   - **Mitigation**: Could add progress indicator in future, but not needed for MVP
   - **Severity**: Low - unlikely to have hundreds of deleted notes

3. **Multi-window consistency**: If multiple windows open, empty trash in one should update others
   - **Mitigation**: Already handled - `note:permanentDeleted` broadcasts to all windows
   - **Severity**: N/A - already solved

**No additional tests needed beyond what's planned.**

## Recommendations

1. **Minor addition**: In step 2.1, add handler cleanup to `unregisterNoteHandlers()`
2. **Minor addition**: In step 2.3, also update `web-client.ts` if it exists

## Conclusion

Plan is solid. Ordering is correct, TDD is followed, risks are mitigated. Ready for implementation.
