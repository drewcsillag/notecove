# Fix Note List Display

**Overall Progress:** `100%`

## Summary

Two issues with note list display:

1. **Links show as UUIDs**: `[[uuid]]` appears in titles/snippets instead of the linked note's title
2. **Snippets are broken**: Empty snippets or showing content from wrong place (e.g., code blocks)

## Root Cause Analysis

### Issue 1: Links as UUIDs

- Notes store inter-note links as `[[uuid]]` in CRDT
- Title/snippet extraction pulls raw text, including literal `[[uuid]]`
- The editor uses decorations to display titles, but notes list doesn't

### Issue 2: Broken Snippets

- Text extraction doesn't properly add newlines between block elements
- Current logic: split by `\n`, skip first line (title), take 200 chars
- If no newlines between paragraphs, "skipping first line" fails

**Evidence from database:**

- Note `5ba5c8a5`: content_text has no newlines → snippet is empty
- Note `d7fb06b1`: only newline is inside code block → snippet starts at code block line 2

---

## Design Decisions

1. **Link resolution at extraction time** (main process)
2. **Skip empty lines** in snippet generation
3. **All text types included** in snippets (code, checkboxes, etc.)
4. **Replace `[[uuid]]` with `[[title]]`** for links
5. **One level deep** for link resolution (don't resolve links inside resolved titles)
6. **No re-indexing** - existing notes fix themselves when edited

---

## Tasks

### Phase 0: Investigation

- [x] 🟩 **0.1 Debug Yjs structure**
  - [x] 🟩 Investigated via database queries
  - [x] 🟩 Confirmed newlines missing between paragraphs
  - [x] 🟩 Root cause: text extraction not adding proper separators

### Phase 1: Fix Text Extraction (Snippets)

- [x] 🟩 **1.1 Write failing tests for text extraction**
  - [x] 🟩 Test: paragraphs should be separated by newlines
  - [x] 🟩 Test: code blocks should preserve internal newlines
  - [x] 🟩 Test: headings should be separated by newlines
  - [x] 🟩 Test: snippet should skip empty lines

- [x] 🟩 **1.2 Create shared text extraction utility**
  - [x] 🟩 Create `packages/shared/src/crdt/text-extractor.ts`
  - [x] 🟩 Extract all text with proper newlines between blocks
  - [x] 🟩 Export from shared package

- [x] 🟩 **1.3 Create snippet generation utility**
  - [x] 🟩 Create function to extract snippet (skip title, skip empty lines)
  - [x] 🟩 Take first N characters of actual content
  - [x] 🟩 Add tests

- [x] 🟩 **1.4 Update extraction call sites**
  - [x] 🟩 Update `packages/desktop/src/main/index.ts` (~line 500)
  - [x] 🟩 Update `packages/desktop/src/main/sd-watcher-callbacks.ts` (~line 128)
  - [x] 🟩 Update `packages/desktop/src/main/sd-watcher-helpers.ts` (~line 44)

### Phase 2: Resolve Links in Title/Snippet

- [x] 🟩 **2.1 Write failing tests for link resolution**
  - [x] 🟩 Test: `[[uuid]]` in title replaced with linked note's title
  - [x] 🟩 Test: `[[uuid]]` in snippet replaced with linked note's title
  - [x] 🟩 Test: broken link (deleted/nonexistent note) shows fallback
  - [x] 🟩 Test: multiple links resolved correctly
  - [x] 🟩 Test: circular links don't cause infinite recursion

- [x] 🟩 **2.2 Create link resolution utility**
  - [x] 🟩 Create `packages/shared/src/utils/resolve-links.ts`
  - [x] 🟩 Replace `[[uuid]]` with `[[title]]` using database lookup
  - [x] 🟩 Handle broken links gracefully (show `[[deleted note]]`)
  - [x] 🟩 One level deep only - resolve to raw title, don't recurse

- [x] 🟩 **2.3 Integrate link resolution into extraction**
  - [x] 🟩 After extracting title, resolve any links
  - [x] 🟩 After extracting snippet, resolve any links
  - [x] 🟩 Pass database interface to extraction functions

### Phase 3: Testing & Validation

- [x] 🟩 **3.1 Run existing tests**
  - [x] 🟩 All 972 shared package tests pass
  - [x] 🟩 Title-extractor tests still pass
  - [x] 🟩 Link-extractor tests still pass

- [x] 🟩 **3.2 E2E testing**
  - [x] 🟩 Created `e2e/note-list-display.spec.ts` with 7 tests
  - [x] 🟩 Tests verify UUID links resolve to note titles
  - [x] 🟩 Tests verify snippets show correct content from paragraphs
  - [x] 🟩 Tests verify broken links show "deleted note"
  - [x] 🟩 All 7 tests pass

- [ ] 🟥 **3.3 Run CI before commit**

---

## Files Modified

| File                                                                        | Change                                           |
| --------------------------------------------------------------------------- | ------------------------------------------------ |
| `packages/shared/src/crdt/text-extractor.ts`                                | NEW: text extraction with proper newlines        |
| `packages/shared/src/crdt/__tests__/text-extractor.test.ts`                 | NEW: tests                                       |
| `packages/shared/src/crdt/index.ts`                                         | Export new utilities                             |
| `packages/shared/src/utils/resolve-links.ts`                                | NEW: link resolution utility                     |
| `packages/shared/src/utils/__tests__/resolve-links.test.ts`                 | NEW: tests                                       |
| `packages/shared/src/utils/index.ts`                                        | Export new utilities                             |
| `packages/shared/src/index.ts`                                              | Export new utilities                             |
| `packages/desktop/src/main/index.ts`                                        | Use new extraction utilities                     |
| `packages/desktop/src/main/sd-watcher-callbacks.ts`                         | Use new extraction utilities                     |
| `packages/desktop/src/main/sd-watcher-helpers.ts`                           | Use new extraction utilities                     |
| `packages/desktop/src/main/ipc/handlers.ts`                                 | Use extractSnippet + resolveLinks for live edits |
| `packages/desktop/src/renderer/src/components/EditorPanel/TipTapEditor.tsx` | Use newlines instead of spaces between blocks    |
| `packages/desktop/e2e/note-list-display.spec.ts`                            | NEW: E2E tests for note list display             |

---

## Related Files

- [PLAN-CRITIQUE.md](./PLAN-CRITIQUE.md) - Critique notes and decisions
- [QUESTIONS-1.md](./QUESTIONS-1.md) - Initial questions and answers
