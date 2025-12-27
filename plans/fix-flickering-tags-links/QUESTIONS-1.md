# Questions: Fix Flickering Tags/Links

## Analysis Summary

I've analyzed the codebase and identified the root causes of both flickering issues:

### Issue 1: Tags Flicker When Typing in Note

**Root Cause:** `Hashtag.ts` lines 129-134

The hashtag plugin regenerates ALL decorations on every document change:

```typescript
apply(transaction, oldState) {
  if (transaction.docChanged) {
    return findHashtags(transaction.doc);  // Full document re-scan
  }
  return oldState.map(transaction.mapping, transaction.doc);
}
```

Every keystroke triggers a full `doc.descendants()` traversal and recreates all tag decorations, even for tags not affected by the edit.

### Issue 2: Links Flicker to "[[Loading..." When Typing in Find Dialog

**Root Cause:** `InterNoteLink.ts` lines 231-236 and 337-411

Multiple issues compound here:

1. **Full re-decoration on any change** (lines 231-236):

```typescript
if (transaction.docChanged || transaction.getMeta('forceDecoration')) {
  return findAndDecorateLinks(transaction.doc, editorView);
}
```

2. **Async title fetches dispatch forceDecoration** (lines 404-411):

```typescript
if (editorView) {
  const tr = (editorView.state as any).tr;
  tr.setMeta('forceDecoration', true);
  editorView.dispatch(tr); // Triggers full re-decoration for ALL links
}
```

3. **No batching/debouncing**: When multiple links exist, each async fetch completion triggers a separate `forceDecoration` dispatch.

4. **Widget factory executes on every decoration**: The factory function reads from cache, but the widget DOM elements are recreated on each decoration cycle.

### Why "Loading..." Can Get Stuck

The `noteTitleCache` is set to `"Loading..."` immediately (line 340) before the async fetch. If:

- The fetch fails silently
- The network is slow
- The editor view is destroyed before fetch completes
- There's a race condition with rapid re-decorations

...the "Loading..." value remains cached.

---

## Questions

### Q1: Reproduce in Tests vs Visual Reproduction

You mentioned you want tests to reproduce the issues before fixing. Decoration flickering is inherently visual - the DOM is updated correctly, but unnecessary rapidly.

**Options for testing:**

1. **Mock-based unit tests**: Count how many times `findHashtags()` or `findAndDecorateLinks()` is called during a typing sequence
2. **Snapshot tests**: Verify decoration state after certain operations
3. **Performance tests**: Measure decoration recalculation time/count

**Question:** Which approach(es) do you prefer? I'd recommend option 1 (counting calls) as it directly tests "is this doing unnecessary work?"

agree, #1 sounds best

### Q2: Cache Invalidation for Links

The `noteTitleCache` is module-level and persists across the app lifetime. There's a `clearNoteTitleCache()` function but:

- It requires knowing which noteIds changed
- It's not called automatically when notes are renamed/deleted

**Question:** Should we address stale cache as part of this fix, or treat it as a separate issue?

yes

### Q3: SearchAndReplace Interaction

The `@sereneinserenade/tiptap-search-and-replace` extension also does full decoration recalculation on document changes (line 382), but it has a guard:

```typescript
if (!docChanged && lastSearchTerm === searchTerm && ...) return oldState;
```

The issue is that when the find dialog is open and you type in it, `setSearchTerm` is called which updates storage, but the document isn't changed. However, typing in the **main editor** while find is open triggers `docChanged` which recalculates search decorations AND causes the hashtag/link decorations to recalculate.

**Question:** Is the flickering happening when typing in the find dialog input, or when typing in the main editor while find is open?

while typing in the find dialog (find in note, not find note, just to be clear)
)

### Q4: Fix Approach

Two main approaches:

**A) Incremental decoration updates**:

- Only update decorations in the affected text range
- More complex but better performance for large documents
- ProseMirror's `map(transaction.mapping, doc)` helps with position tracking

**B) Memoization/comparison**:

- Calculate new decorations but compare with old before updating
- Simpler but still does O(n) work per keystroke

**Question:** Given NoteCove's expected document sizes, which approach do you prefer? (A) is better long-term but more complex.

A

### Q5: Link Loading State UX

The current "[[Loading...]]" UX during async title fetch is jarring. Options:

1. **Keep raw ID until loaded**: Show `[[abc123]]` until title is fetched
2. **Skeleton/shimmer**: Show a loading animation
3. **Instant cache**: Pre-populate cache on note open (fetch all note titles upfront)
4. **Background sync**: Keep a persistent title cache that's updated when notes change

**Question:** Which approach do you prefer? Option 3 or 4 would eliminate "Loading..." entirely for cached notes.

4
