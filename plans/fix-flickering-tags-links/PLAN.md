# Fix Flickering Tags/Links Implementation Plan

**Overall Progress:** `20%`

## Summary

Fix two flickering issues:

1. Tags flicker when typing anywhere in a note
2. Links flicker to "[[Loading..." when typing in the Find dialog

**Approach:**

- Incremental decoration updates (only update affected regions)
- Background-synced title cache using existing `note:title-updated` IPC event
- Test-driven development with function call counting

## Architecture Decisions (from investigation)

1. **Transaction range helpers**: Keep local to renderer (ProseMirror-specific, not cross-platform)
2. **Title cache service**: Module-level singleton with IPC listeners (matches existing pattern)
3. **CRDT detection**: Use transaction origin (`'remote'`, `'load'`) to detect full syncs
4. **Cache cold start**: Acceptable to fetch on first access; subsequent access is instant
5. **IPC events available**: `note:title-updated`, `note:deleted`, `note:created` already exist

## Tasks

### Phase 0: Investigation ✅

- [x] 🟩 **0.1: Trace find dialog transactions**
  - [x] 🟩 Add debug logging to see what transactions fire when typing in find dialog
  - [x] 🟩 Verify if `docChanged` is true/false
  - [x] 🟩 Identify why link decorations recalculate
  - **Finding:** `setSearchTerm` does NOT dispatch transactions. Tags/links don't regenerate on search.
  - **Finding:** Real issue is `docChanged` triggering full regeneration on ANY edit.
  - **Finding:** `forceDecoration` after title fetch triggers full regeneration of ALL links.

### Phase 1: Test Infrastructure ✅

- [x] 🟩 **1.1: Create test harness for counting decoration recalculations**
  - [x] 🟩 Add spy-able wrapper for `findHashtags()` in Hashtag.ts
  - [x] 🟩 Add spy-able wrapper for `findAndDecorateLinks()` in InterNoteLink.ts
  - [x] 🟩 Create test utilities for simulating typing sequences

- [x] 🟩 **1.2: Write failing tests for tag flickering**
  - [x] 🟩 Test: typing in middle of document should not recalculate all tags (FAILS - expected)
  - [x] 🟩 Test: typing near a tag should only update that tag's region (PASSES)
  - [x] 🟩 Test: typing in find dialog should not trigger tag recalculation (PASSES)

- [x] 🟩 **1.3: Write failing tests for link flickering**
  - [x] 🟩 Test: typing in find dialog should not trigger link recalculation (PASSES)
  - [x] 🟩 Test: link title fetch completion should not re-render ALL links (FAILS - expected)
  - [x] 🟩 Test: cached links should never show "Loading..." (not yet tested)

### Phase 2: Background Title Cache

- [ ] 🟥 **2.1: Create NoteTitleCacheService**
  - [ ] 🟥 Module-level singleton following existing IPC listener pattern
  - [ ] 🟥 Subscribe to `note:title-updated` for real-time updates
  - [ ] 🟥 Subscribe to `note:deleted` to remove stale entries
  - [ ] 🟥 Sync lookup: `get(noteId): string | undefined`
  - [ ] 🟥 Fetch on miss: `fetchIfMissing(noteId): Promise<string>`

- [ ] 🟥 **2.2: Integrate with app lifecycle**
  - [ ] 🟥 Initialize on app start (no blocking)
  - [ ] 🟥 Clear on SD switch
  - [ ] 🟥 Cleanup listeners on unmount

- [ ] 🟥 **2.3: Write tests for cache service**
  - [ ] 🟥 Test: returns cached value when available
  - [ ] 🟥 Test: updates on `note:title-updated` event
  - [ ] 🟥 Test: removes entry on `note:deleted` event

### Phase 3: Incremental Hashtag Decorations

- [ ] 🟥 **3.1: Create transaction range utility**
  - [ ] 🟥 `getChangedRanges(transaction): {from, to}[]`
  - [ ] 🟥 Handle insertions, deletions, replacements
  - [ ] 🟥 Unit tests for range calculation

- [ ] 🟥 **3.2: Implement incremental updates in Hashtag.ts**
  - [ ] 🟥 If `!transaction.docChanged`, return oldState unchanged
  - [ ] 🟥 Check transaction origin for full-doc reload (`'remote'`, `'load'`)
  - [ ] 🟥 For local edits: map existing decorations, update only affected ranges
  - [ ] 🟥 For full reload: do full re-scan (existing behavior)

- [ ] 🟥 **3.3: Manual test checkpoint**
  - [ ] 🟥 Type with multiple tags visible - no flicker

- [ ] 🟥 **3.4: Verify automated tests pass**

### Phase 4: Incremental Link Decorations

- [ ] 🟥 **4.1: Refactor InterNoteLink.ts to use cache service**
  - [ ] 🟥 Replace module-level `noteTitleCache` Map with `NoteTitleCacheService`
  - [ ] 🟥 Sync lookup in widget factory (no "Loading..." if cached)
  - [ ] 🟥 Async fetch only if truly missing from cache

- [ ] 🟥 **4.2: Implement incremental updates**
  - [ ] 🟥 If `!transaction.docChanged` and no `forceDecoration`, return oldState
  - [ ] 🟥 Check transaction origin for full-doc reload
  - [ ] 🟥 For local edits: map existing decorations, update only affected ranges
  - [ ] 🟥 For full reload: do full re-scan

- [ ] 🟥 **4.3: Fix forceDecoration anti-pattern**
  - [ ] 🟥 Remove `forceDecoration` dispatch after title fetch
  - [ ] 🟥 Instead: update only the specific link decoration that was fetched
  - [ ] 🟥 Or: batch fetches and do single targeted update

- [ ] 🟥 **4.4: Handle broken links**
  - [ ] 🟥 Use `note:deleted` event to mark links as broken
  - [ ] 🟥 Style broken links differently (existing `inter-note-link-broken` class)

- [ ] 🟥 **4.5: Manual test checkpoint**
  - [ ] 🟥 Type with multiple links visible - no flicker
  - [ ] 🟥 Open find dialog, type - no link flicker

- [ ] 🟥 **4.6: Verify automated tests pass**

### Phase 5: Integration & Cleanup

- [ ] 🟥 **5.1: Run full test suite (ci-runner)**
- [ ] 🟥 **5.2: Extended manual testing**
  - [ ] 🟥 Create note with many tags and links
  - [ ] 🟥 Type rapidly - verify no flicker
  - [ ] 🟥 Open find dialog, search - verify no flicker
  - [ ] 🟥 Rename a note - verify link titles update
  - [ ] 🟥 Delete a note - verify links show as broken
- [ ] 🟥 **5.3: Remove console.log debug statements**
- [ ] 🟥 **5.4: Self code review**

## Architecture: Transaction Range Utility

```typescript
// packages/desktop/src/renderer/src/components/EditorPanel/extensions/utils/transaction-ranges.ts

interface ChangedRange {
  from: number;
  to: number;
}

/**
 * Get document ranges that were modified by this transaction.
 * Uses transaction.mapping to find affected positions.
 */
export function getChangedRanges(transaction: Transaction): ChangedRange[] {
  const ranges: ChangedRange[] = [];

  transaction.mapping.maps.forEach((stepMap, i) => {
    stepMap.forEach((oldStart, oldEnd, newStart, newEnd) => {
      ranges.push({ from: newStart, to: newEnd });
    });
  });

  return mergeOverlappingRanges(ranges);
}

/**
 * Check if this transaction is a full document reload (from CRDT sync).
 */
export function isFullDocumentReload(transaction: Transaction): boolean {
  // Check for origins that indicate full reload
  const origin = transaction.getMeta('y-sync$');
  return origin === 'remote' || origin === 'load';
}
```

## Architecture: NoteTitleCacheService

```typescript
// packages/desktop/src/renderer/src/services/note-title-cache.ts

class NoteTitleCacheService {
  private cache = new Map<string, string>();
  private pendingFetches = new Set<string>();
  private cleanupFns: (() => void)[] = [];

  init(): void {
    // Subscribe to IPC events
    this.cleanupFns.push(
      window.electronAPI.note.onTitleUpdated((noteId, title) => {
        this.cache.set(noteId, title);
      })
    );
    this.cleanupFns.push(
      window.electronAPI.note.onDeleted((noteId) => {
        this.cache.delete(noteId);
      })
    );
  }

  get(noteId: string): string | undefined {
    return this.cache.get(noteId);
  }

  async fetchIfMissing(noteId: string): Promise<string> {
    const cached = this.cache.get(noteId);
    if (cached) return cached;

    if (this.pendingFetches.has(noteId)) {
      // Already fetching, wait for it
      return new Promise((resolve) => {
        const check = setInterval(() => {
          const title = this.cache.get(noteId);
          if (title) {
            clearInterval(check);
            resolve(title);
          }
        }, 50);
      });
    }

    this.pendingFetches.add(noteId);
    try {
      const notes = await window.electronAPI.link.searchNotesForAutocomplete('');
      const note = notes.find((n) => n.id === noteId);
      const title = note?.title ?? '[Note not found]';
      this.cache.set(noteId, title);
      return title;
    } finally {
      this.pendingFetches.delete(noteId);
    }
  }

  clear(): void {
    this.cache.clear();
  }

  destroy(): void {
    this.cleanupFns.forEach((fn) => fn());
    this.cleanupFns = [];
    this.cache.clear();
  }
}

export const noteTitleCache = new NoteTitleCacheService();
```

## Related Files

- `packages/desktop/src/renderer/src/components/EditorPanel/extensions/Hashtag.ts`
- `packages/desktop/src/renderer/src/components/EditorPanel/extensions/InterNoteLink.ts`
- `packages/desktop/src/renderer/src/components/EditorPanel/SearchPanel.tsx`
- `packages/desktop/src/preload/api/note-api.ts` (existing IPC definitions)
- New: `packages/desktop/src/renderer/src/services/note-title-cache.ts`
- New: `packages/desktop/src/renderer/src/components/EditorPanel/extensions/utils/transaction-ranges.ts`

## Risks & Mitigations

| Risk                                  | Mitigation                                                    |
| ------------------------------------- | ------------------------------------------------------------- |
| CRDT sync not detected correctly      | Check for `y-sync$` meta; fall back to full scan if uncertain |
| Cache out of sync with database       | IPC events ensure real-time sync; clear on SD switch          |
| Range calculation edge cases          | Comprehensive unit tests for range utility                    |
| Performance regression for small docs | Benchmark; incremental overhead is minimal                    |
