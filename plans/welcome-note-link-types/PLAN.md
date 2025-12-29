# Feature: Welcome Note Link Types

**Overall Progress:** `100%`

## Summary

Add support for specifying link display modes in markdown using Pandoc-style attribute syntax (`{.link}`, `{.chip}`, `{.unfurl}`), and update the welcome note to demonstrate all three link types.

## Decisions (from [QUESTIONS-1.md](./QUESTIONS-1.md))

- **Approach**: Extended markdown syntax (Option A)
- **Syntax**: `[text](url){.displayMode}` (Pandoc-style class attribute)
- **URLs**:
  - Plain link: `https://github.com/drewcsillag/notecove`
  - Chip: `https://theonion.com/heroic-dog-saves-family-of-5-from-herb-roasted-chicken/`
  - Unfurl: `https://www.youtube.com/watch?v=qXD9HnrNrvk`
- **Secure mode**: Respect it (all links appear as plain text in secure mode)

## Decisions (from [QUESTIONS-PLAN-1.md](./QUESTIONS-PLAN-1.md))

- **Attribute syntax scope**: Only support exactly `{.link}`, `{.chip}`, `{.unfurl}` - ignore other Pandoc attributes
- **Whitespace handling**: Be lenient - `[text](url) {.chip}` (with space) should work

## Tasks

### Phase 1: Extend Markdown Parser

- [x] 🟩 **1.1 Write tests for markdown link display mode parsing**
  - Test: `[text](url){.link}` → link mark with `displayMode: 'link'`
  - Test: `[text](url){.chip}` → link mark with `displayMode: 'chip'`
  - Test: `[text](url){.unfurl}` → link mark with `displayMode: 'unfurl'`
  - Test: `[text](url)` (no attribute) → link mark without displayMode attribute
  - Test: `[text](url){.invalid}` → ignores invalid attribute, leaves `{.invalid}` as text
  - Test: `[text](url) {.chip}` (whitespace before) → works, displayMode: 'chip'
  - Test: Multiple links with attributes in one paragraph

- [x] 🟩 **1.2 Implement displayMode parsing in markdown-to-prosemirror.ts**
  - Add post-processing to detect `{.displayMode}` after links
  - Modify the link mark to include `displayMode` attribute when found
  - Handle edge cases (whitespace, multiple attributes)

### Phase 2: Update Welcome Note

- [x] 🟩 **2.1 Update welcome.md with link preview section**
  - Add "Link Previews" section with examples of all three types
  - Use the specified URLs:
    - Plain: `https://github.com/drewcsillag/notecove`
    - Chip: `https://theonion.com/heroic-dog-saves-family-of-5-from-herb-roasted-chicken/`
    - Unfurl: `https://www.youtube.com/watch?v=qXD9HnrNrvk`

### Phase 3: Handle Unfurl Links Properly

- [x] 🟩 **3.1 Fix getEffectiveDisplayMode for unfurl in non-paragraph context**
  - Unfurl links in lists, headings, etc. should fall back to chip display
  - Added context check in `linkContext.ts`

- [x] 🟩 **3.2 Create oEmbedUnfurl blocks for unfurl links in markdown**
  - Added `insertUnfurlBlocks()` function to markdown-to-prosemirror.ts
  - Creates oEmbedUnfurl block nodes after paragraphs containing unfurl links
  - Only processes top-level paragraphs (unfurls don't work in lists)

- [x] 🟩 **3.3 Update welcome note structure**
  - Moved unfurl example to standalone paragraph (not in list)
  - Unfurls require paragraph context to work properly

### Phase 4: Markdown Export

- [x] 🟩 **4.1 Add displayMode attribute when exporting to markdown**
  - When exporting ProseMirror to markdown, preserve the `{.displayMode}` syntax
  - Links with `displayMode: 'link'` → `[text](url){.link}`
  - Links with `displayMode: 'chip'` → `[text](url){.chip}`
  - Links with `displayMode: 'unfurl'` → `[text](url){.unfurl}`
  - Links without displayMode or `displayMode: 'auto'` → `[text](url)` (no attribute)

- [x] 🟩 **4.2 Handle oEmbedUnfurl block export**
  - oEmbedUnfurl blocks export as `[title](url){.unfurl}`
  - Added `getDisplayModeSuffix()` helper function

### Phase 5: Integration Testing

- [ ] 🟨 **5.1 Manual testing**
  - Test welcome note displays correctly in new workspace
  - Test all three link types render as expected
  - Test secure mode shows all as plain links
  - Test different global preferences don't override explicit displayMode

## Files Modified

1. `packages/shared/src/markdown/markdown-to-prosemirror.ts` - Add displayMode parsing and oEmbedUnfurl block creation
2. `packages/shared/src/markdown/__tests__/markdown-to-prosemirror.test.ts` - Add tests (13 new tests)
3. `packages/desktop/resources/welcome.md` - Add link preview section
4. `packages/desktop/src/renderer/src/components/EditorPanel/utils/linkContext.ts` - Fix unfurl fallback for non-paragraph context
5. `packages/desktop/src/renderer/src/utils/markdown-export.ts` - Add displayMode export for links and unfurl blocks
6. `packages/desktop/src/renderer/src/utils/__tests__/markdown-export.test.ts` - Add/update tests (7 new tests)

## Technical Notes

### Parsing Strategy

The markdown-it library parses `[text](url)` as a link. The `{.displayMode}` suffix is not standard markdown and will be parsed as plain text following the link.

**Approach**: Post-process the ProseMirror JSON after conversion to:

1. Find text nodes that start with `{.link}`, `{.chip}`, or `{.unfurl}`
2. Look at the preceding node - if it has a link mark, update that link's displayMode
3. Remove the `{.displayMode}` text from the document

This is cleaner than trying to modify markdown-it's parsing, and handles the attribute as a post-processing step.

### Edge Cases to Handle

- `{.chip}` at start of paragraph (no preceding link) → leave as plain text
- Multiple links with attributes: `[a](url1){.chip} and [b](url2){.unfurl}` → both should work
- Whitespace: `[text](url) {.chip}` (space before attribute) → should still work
- Invalid modes: `{.foo}` → ignore, leave as text
