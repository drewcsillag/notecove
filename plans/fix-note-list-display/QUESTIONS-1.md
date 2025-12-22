# Questions - Fix Note List Display

## Current State Analysis

I've analyzed the codebase and understand the two issues:

### Issue 1: Links in titles/snippets show as UUIDs

**How it works now:**

- Notes store inter-note links as `[[uuid]]` in the CRDT document (e.g., `[[550e8400-e29b-41d4-a716-446655440000]]`)
- When extracting title/preview for the notes list, we extract **raw plain text** from the CRDT
- The editor uses ProseMirror decorations to **display** `[[Note Title]]` instead of `[[uuid]]`, but this only works in the editor
- The notes list displays raw text, so you see the UUID

**Relevant code:**

- Title extraction: `packages/shared/src/crdt/title-extractor.ts` - extracts raw text from first non-empty element
- Preview extraction: `packages/desktop/src/main/index.ts:500-524` - extracts all text, skips first line, takes first 200 chars
- Display: `packages/desktop/src/renderer/src/components/NotesListPanel/DraggableNoteItem.tsx:119,136`

### Issue 2: Snippets are "hit and miss"

**Observation:** Most notes don't have snippets, or snippets show text from way down in the note.

**How it works now:**

- `contentText` = concatenate ALL text from all elements, separated by `\n`
- `contentPreview` = skip first line (title), take first 200 chars of the rest
- The first line is determined by splitting on `\n`

**Potential problems:**

1. If the first element has no text but subsequent elements do, the "first line" skip might not skip the title
2. If the title spans multiple lines or the note has empty paragraphs, the snippet logic might be off
3. If the CRDT structure has unusual nesting, text extraction order might be unexpected

---

## Questions

### Q1: For links in titles - should we resolve them?

When a link appears in a note's title (first line), should we:

- **Option A**: Replace `[[uuid]]` with the linked note's title (e.g., `Check out [[My Other Note]]`)
- **Option B**: Strip links entirely from the title (e.g., `Check out`)
- **Option C**: Show just the link brackets without UUID (e.g., `Check out [[...]]`)

My recommendation: **Option A** - it gives the most context.

A

### Q2: For links in snippets - same question

Same options as above for snippets. My recommendation: **Option A** again.

A

### Q3: Should link resolution happen on the main process or renderer?

**Option A - Main process (at extraction time):**

- Pro: Data is consistent in database, works for search too
- Con: Requires querying database for each linked note during extraction; could slow down initial load
- Con: Cached titles could become stale if linked note is renamed

**Option B - Renderer (at display time):**

- Pro: Always up-to-date
- Con: Requires async title resolution in the list component; adds complexity

My recommendation: **Option A** - resolve at extraction time. The database is SQLite and fast. If a linked note's title changes, we can update referring notes' cached titles.

A

### Q4: Regarding snippets being "hit and miss" - can you describe?

I see the logic: skip first line, take first 200 chars. Can you give me an example of:

1. A note where you expect to see a snippet but don't
2. A note where the snippet shows text from "way down"

This will help me understand if it's a text extraction ordering issue or something else.

1. /Users/drew/Library/Mobile Documents/com~apple~CloudDocs/NoteCove/Dev One/notes/5ba5c8a5-943c-47f2-a39f-0d441e734425

2. /Users/drew/Library/Mobile Documents/com~apple~CloudDocs/NoteCove/Dev One/notes/d7fb06b1-8a33-44b8-bf4d-b067f4ed43c5 shows `console.log(greeting);` where I'd expect something like `Your notes, beautifully organized and always in sync`

### Q5: Should empty paragraphs be collapsed?

Notes might have structure like:

```
Title line
<empty paragraph>
<empty paragraph>
First real content here
```

The current logic would show an empty snippet. Should we:

- Skip empty lines/paragraphs when generating the snippet
- Show "first 200 chars of actual text content after title"

My recommendation: Yes, skip empty lines when finding snippet content.

Agree with recommendation

### Q6: What about other node types?

The snippet might include:

- Raw checkbox text (e.g., `[ ] todo item`)
- Image alt text or captions
- Code blocks
- etc.

Should any of these be excluded from snippets, or is "all text" fine?

all text is fine
