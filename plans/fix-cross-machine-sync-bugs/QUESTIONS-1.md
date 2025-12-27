# Questions for Fix Cross-Machine Sync Bugs

## Approach Questions

### Q1: Debugging Strategy

Both bugs have complex async sync chains. Before implementing fixes, I should add diagnostic logging to pinpoint exactly where each chain breaks.

**Options:**

1. **Add temporary logging first** - Instrument the code, run tests with logging, analyze output, then fix
2. **Fix based on analysis** - The investigation identified likely causes; proceed directly to fixes
3. **Both sequentially** - Add logging, confirm hypothesis, then fix

**Recommendation:** Option 1 - the sync chains are complex enough that confirming the exact failure point will save time vs. guessing

option 1

---

### Q2: Comments Sync - Likely Fix

The investigation suggests the thread Y.Map might exist but have incomplete data during merge.

**Options:**

1. **Validate in getCommentThreads()** - Skip threads with missing required fields (author, content, anchorStart)
2. **Delay observer notification** - Wait for transaction to complete before firing `comment:threadAdded`
3. **Retry in CommentPanel** - If loadThreads() returns empty but badge shows count, retry after delay
4. **Ensure atomic thread creation** - Wrap all thread property sets in single Y.js transaction

**Recommendation:** Option 4 seems most correct (fix at source), but Option 3 is a safer fallback

## 4

### Q3: Deletion Sync - Likely Fix

The investigation identified several possible failure points. Most likely:

- Activity log entry not created for metadata-only updates
- Or `note:deleted` event not broadcast after sync

**Options:**

1. **Explicit deletion activity** - Record `delete` action type in activity log, not just note modification
2. **Ensure broadcast after sync** - Add explicit `note:deleted` broadcast in sd-watcher-callbacks.ts
3. **Poll-based UI refresh** - NotesListPanel periodically refetches instead of relying on events
4. **Deletion-specific CRDT log** - Separate log for deletions that syncs independently

**Recommendation:** Option 2 seems simplest - ensure the existing `note:deleted` broadcast happens reliably

## option 2

### Q4: Test Stability

These e2e tests are inherently timing-sensitive (cross-machine sync simulation). Even after fixing the bugs:

**Options:**

1. **Keep as-is** - Tests document the fix works; occasional flakiness is acceptable
2. **Increase timeouts** - Give sync more time to complete
3. **Add retry assertions** - Use Playwright's built-in retry for final assertions
4. **Add explicit sync barriers** - Wait for specific sync completion signals before asserting

**Recommendation:** Option 3 + 4 - retry assertions handle timing variance, sync barriers ensure determinism

## agreee, 3+4

## Please Answer

1. Which debugging strategy? (Q1)
2. Which comments sync fix approach? (Q2)
3. Which deletion sync fix approach? (Q3)
4. How to handle test stability? (Q4)

Or if you have different ideas, let me know.
