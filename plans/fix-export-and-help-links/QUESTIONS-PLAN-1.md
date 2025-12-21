# Plan Critique Questions

## Cross-SD Note Links

You mentioned having "a link that links to a note in another SD".

Currently, even with the fix, `noteTitleLookup` only contains notes from the **active SD**. Links to notes in other SDs won't resolve properly in the exported markdown.

**Question**: Should we handle cross-SD note link resolution? Options:

1. **Minimal fix (recommended for now)**: Only fix the current bug (use `allNotesInSD`). Cross-SD links will show as `[Note Title](note-id)` without resolving to a filename. This is the current behavior and matches what single-note export does.

2. **Enhanced fix**: Fetch notes from ALL SDs to build a complete lookup. More complex, and exported links would point to files that don't exist (since we only export from one SD).

I recommend option 1 for this fix, and we can address cross-SD export as a separate feature if needed.

**Your preference?**

The Enhanced fix -- at least with the title, I'd more easily know which note was intended to be linked to
