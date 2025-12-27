# Plan Critique & Questions

## Critique as Staff Engineer

### 1. Ordering Issues

**Problem:** Phase 5 (Find Dialog Investigation) is at the end, but we should understand what's happening FIRST.

The current plan assumes the fix is "incremental decorations," but we haven't verified WHY typing in the find dialog triggers link re-rendering. The find dialog doesn't modify the document, so `docChanged` should be false.

**Proposed reorder:**

1. Phase 5 → Move to Phase 1 (investigate first)
2. Then write tests based on findings
3. Then implement fixes

### 2. Shared Utilities Missing

Both Hashtag and InterNoteLink need the same "get changed ranges from transaction" logic. This should be:

- A shared utility function
- Tested independently
- Used by both extensions

**Question:** Should we create a `packages/shared` utility for ProseMirror transaction range helpers, or keep it local to the renderer?

### 3. Cache Service Location

The `NoteTitleCacheService` needs to:

- Make IPC calls (renderer → main)
- Listen for IPC events (main → renderer) for note changes
- Be accessible from the InterNoteLink extension

**Question:** Where should this service live?

- Option A: Global singleton in renderer (like current approach)
- Option B: Passed to InterNoteLink extension via options
- Option C: React context that wraps the editor

### 4. CRDT Sync Detection

The plan mentions "full document reload from CRDT" as an edge case but doesn't specify how to detect it. Options:

1. Check if transaction replaces entire document content
2. Use specific meta flag for CRDT transactions
3. Check transaction steps for ReplaceStep covering full doc

**Question:** Does the CRDT integration already mark its transactions with metadata? If so, what's the pattern?

### 5. Feedback Loop Improvement

Current plan delays interactive testing until Phase 6. For faster feedback:

- After Phase 3.1 (hashtag incremental), we can manually test hashtags
- After Phase 4.2 (link incremental), we can manually test links

**Suggestion:** Add manual testing checkpoints after each major feature, not just at the end.

### 6. Risk: Cache Not Ready

If the app just opened and the cache isn't populated yet, links would have no title. Options:

1. Block editor until cache is ready (bad UX)
2. Fall back to showing noteId
3. Show "Loading..." only on first load, then cache persists

**Question:** Is option 3 acceptable? (First load might show Loading briefly, but subsequent views are instant)

### 7. Existing IPC for Note Changes

**Question:** Is there already an IPC mechanism that fires when notes are renamed or deleted? Or do we need to create one?

---

## Summary of Questions

1. Shared utility location: `packages/shared` or local to renderer?
2. Cache service architecture: singleton, extension option, or React context?
3. CRDT transaction detection: existing metadata pattern?
4. Cache cold start: acceptable to show "Loading..." on first app launch?
5. IPC for note changes: existing or needs creation?
