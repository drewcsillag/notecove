# Questions: Searchability (Follow-up to Q12)

## Context

You want chips to be findable via cmd-f (in-note search) and cmd-shift-f (cross-note search):

- Date chips: searchable by the date text (e.g., `2025-12-19`)
- Mention chips: searchable by both `@handle` AND `username` (e.g., `@drew` and `Drew Colthorp`)

## Q12a: How Current Search Works

**Findings:**

1. **In-note search (Cmd-Shift-F)**: Uses `@sereneinserenade/tiptap-search-and-replace` extension. Searches the live ProseMirror document text. Decorations don't affect searchability - they're visual overlays on text.

2. **Cross-note search (Cmd-F)**: Uses SQLite FTS5 on the `notes_fts` table. Content is extracted from Yjs documents as plain text (`contentText` field). Hashtags get special transformation (`#work` → `__hashtag__work`) for distinct searching.

## Q12b: My Recommendation

### For Date Chips

**Use decoration pattern (like Hashtag extension):**

- Store as plain text: `2025-12-19`
- Apply visual styling via ProseMirror decoration plugin
- Click detection via decoration event handler → shows date picker
- **Searchable:** Naturally, both in-note and cross-note

### For Mention Chips

**Use mark pattern with dual-text storage:**

- Store in document: `@drew Drew Colthorp` (handle + space + name)
- Apply a `mention` mark to the entire span
- Mark attributes: `{ profileId: 'uuid' }`
- **Rendering:** Custom NodeView or toDOM that only displays the name as a chip (hides the `@drew ` prefix via CSS `display:none` or similar)
- **In-note search:** Naturally finds both `@drew` and `Drew Colthorp` (they're in the text)
- **Cross-note search:** Both are extracted to contentText and indexed in FTS

**Why this approach:**

1. Both handle and name are in the actual document text = automatic searchability
2. No need to extend search to look at mark attributes
3. The rendering hides what we don't want to display
4. Mark carries the profileId for click behavior (show popover, filter notes)
5. Consistent with existing patterns (marks for metadata, decorations for styling)

### Alternative Considered

Could store just `Drew Colthorp` with mark attributes `{ profileId, handle }`, then extend search. But that's more work for the same result. The dual-text approach is simpler and uses existing search infrastructure.

## Q12c: Search Extension

Not needed with the recommended approach - the dual-text storage gives us natural searchability without extending the search system.

---

**Status:** Ready for Phase 2 (Plan Creation)
