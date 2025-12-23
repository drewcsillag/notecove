# Plan Critique

## 1. Ordering Analysis

**Current ordering looks correct:**

- Phase 1 creates the infrastructure (event, metadata updates)
- Phase 2 enhances existing event
- Phase 3 adds renderer-side handling
- Phase 4 verifies cross-machine sync

**No circular dependencies identified.**

## 2. Feedback Loop - Getting to Testable State Faster

The plan is already ordered well for quick feedback:

- Phase 1.1 writes tests first (TDD)
- By end of Phase 1, we can manually verify timestamps update in database
- Phase 3 completes the visible UI change

**Suggestion:** Consider adding a debug log in Phase 1 that outputs to console when `modified` is updated. This gives immediate feedback even before renderer changes.

## 3. Debug Tools

Existing console.log infrastructure is sufficient. No additional debug tooling needed.

## 4. Missing Items Identified

### 4.1 CRDT Metadata Update Triggers Its Own Persistence

When `applyUpdate` calls `noteDoc.updateMetadata({ modified: now })`, this creates a new Y.Doc update. This update will go through `handleUpdate` (since it has no 'ipc' origin), which persists it to disk.

**This is correct behavior** - the metadata change naturally flows through the existing persistence path. No changes needed to `handleUpdate`.

**Action:** Add clarifying comment in code.

### 4.2 Title Changes Also Update Content

When user changes the title (first line), this is a content change that goes through `applyUpdate`. So title changes will automatically update `modified` through our new content-change path.

The existing `handleUpdateTitle` will ALSO update `modified` 300ms later (due to debounce). This results in two updates but is harmless - the later timestamp wins.

**No action needed** - this is acceptable behavior.

### 4.3 Pre-existing Inconsistency

Currently, `handleUpdateTitle` updates `modified` in the database but NOT in CRDT metadata. This means cross-machine sync doesn't propagate the `modified` time for title-only changes.

**Our plan fixes this:** Since title changes are content changes, they'll update CRDT metadata's `modified` via our new `applyUpdate` logic.

## 5. Risk Assessment

### 5.1 Performance with Rapid Updates

Typing "hello" creates 5 CRDT updates → 5 metadata updates → 5 database updates → 5 broadcasts.

**Mitigation already in plan:** Renderer debounces the list re-sort (500ms).

**Optional optimization:** Debounce `modified` update in main process (100ms). This would reduce overhead but adds complexity. **Recommend deferring** unless performance issues observed.

### 5.2 Race Conditions

Two updates racing to set `modified` will both set it to `Date.now()`. The later one wins, which is correct behavior.

### 5.3 Note Not Loaded

`applyUpdate` throws if note isn't loaded. This is correct - we only track `modified` for active notes.

## 6. Additional Considerations

### 6.1 What if Note is Open in Multiple Windows?

Each window sends its own CRDT updates. Each update goes through `applyUpdate` and updates `modified`. The CRDT handles conflict resolution. This works correctly.

### 6.2 Broadcast to Same Window

When window A edits a note, the `note:modified-updated` broadcast goes to ALL windows including window A. Window A's NotesListPanel will receive the event and re-sort. This is fine - it's idempotent.

## 7. Questions to Clarify

None - the answers in QUESTIONS-1.md are sufficient.

## 8. Recommended Plan Updates

1. **Add clarifying comments** about CRDT metadata update flow in implementation
2. **Add Phase 1 debug logging** for immediate feedback
3. **Document the optimization opportunity** for debouncing in main process (defer implementation)

## Verdict

**Plan is sound.** Proceed to implementation after minor updates.
