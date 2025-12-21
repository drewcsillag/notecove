# Web Links Feature Implementation Plan

**Overall Progress:** `67%`

**Related Documents:**

- [Open Questions](./PLAN-WEBLINKS-QUESTIONS.md) — unresolved decisions

---

## Summary

Add support for web links (http/https) in the note editor with:

- Auto-detection of bare URLs (on space/enter/paste)
- Markdown-style `[text](url)` syntax (rendered as clean text)
- Single-click popover (copy/edit/visit/remove)
- Cmd+click to open directly
- Toolbar button and Cmd+K shortcut
- Blue underlined styling (distinct from internal links)
- iOS shared utilities from start

---

## Architecture Decision

**Web Links use TipTap's mark-based approach** (different from InterNoteLink's decoration approach):

| Aspect  | Web Links                    | Inter-Note Links               |
| ------- | ---------------------------- | ------------------------------ |
| Storage | Mark with `href` attr        | Plain text `[[uuid]]`          |
| Syntax  | Replaced on input            | Persists in document           |
| Why     | Standard, href is sufficient | UUID needed for sync/backlinks |

See [QUESTIONS.md](./PLAN-WEBLINKS-QUESTIONS.md#architecture-marks-vs-decorations) for details.

---

## Risk Register

| Risk                                         | Likelihood | Impact | Mitigation                                                                                                               |
| -------------------------------------------- | ---------- | ------ | ------------------------------------------------------------------------------------------------------------------------ |
| Bare URL text↔href sync complexity           | High       | Medium | Spike in Phase 1, may need custom mark behavior. See [Q10](./PLAN-WEBLINKS-QUESTIONS.md#q10-bare-url-edit--non-url-text) |
| Markdown input rule edge cases               | Medium     | Low    | Use battle-tested regex from established parser                                                                          |
| Popover positioning edge cases               | Low        | Low    | Reuse tippy.js pattern from InterNoteLink                                                                                |
| Confusion between mark/decoration approaches | Low        | Medium | Documented in Architecture section                                                                                       |

---

## Tasks

### Phase 1: Minimal Working Link (Get Interactive Fast)

- [x] 🟩 **Step 1: Basic extension scaffold**
  - [x] 🟩 Install `@tiptap/extension-link` dependency
  - [x] 🟩 Create minimal `WebLink.ts` extending base Link
  - [x] 🟩 Add to editor in `TipTapEditor.tsx`
  - [x] 🟩 Add basic CSS (blue underline) inline for now
  - [ ] 🟥 **Manual test:** Type URL + space → link appears and is clickable

- [x] 🟩 **Step 2: Debug tooling**
  - [x] 🟩 Add dev-mode console logging for link operations
  - [x] 🟩 Log: link created, link clicked, mark applied/removed
  - [ ] 🟥 **Verify:** Can trace link lifecycle in console

### Phase 2: Core Interactions

- [x] 🟩 **Step 3: Cmd+click to open**
  - [x] 🟩 Write e2e test: Cmd+click opens external browser
  - [x] 🟩 Add click handler detecting Cmd key
  - [x] 🟩 Call `shell.openExternal(href)`
  - [ ] 🟥 **Manual test:** Cmd+click link opens browser

- [x] 🟩 **Step 4: Single-click popover (basic)**
  - [x] 🟩 Create `LinkPopover.tsx` with visit/copy buttons only
  - [x] 🟩 Write e2e test: single-click shows popover
  - [x] 🟩 Add click handler (non-Cmd) to show popover
  - [x] 🟩 Position using tippy.js (copy InterNoteLink pattern)
  - [x] 🟩 Implement visit action
  - [x] 🟩 Implement copy action
  - [ ] 🟥 **Manual test:** Click link → popover appears

- [x] 🟩 **Step 5: Popover edit/remove**
  - [x] 🟩 Write e2e test: edit changes href
  - [x] 🟩 Write e2e test: remove unlinks but keeps text
  - [x] 🟩 Add edit mode to popover (inline URL input)
  - [x] 🟩 Implement remove action (`unsetLink`)
  - [ ] 🟥 **Manual test:** Edit URL, remove link

### Phase 3: Input Methods

- [x] 🟩 **Step 6: Auto-detection refinement**
  - [x] 🟩 Write e2e test: paste URL creates link immediately
  - [x] 🟩 Write e2e test: URL + enter creates link
  - [x] 🟩 Configure/verify `autolink` for space/enter
  - [x] 🟩 Add paste handler for immediate linkification
  - [ ] 🟥 **Manual test:** All three input methods work

- [x] 🟩 **Step 7: Markdown syntax support**
  - [x] 🟩 Write e2e test: `[text](url)` becomes link with text only visible
  - [x] 🟩 Add input rule for `[text](url)` → link mark
  - [x] 🟩 Handle edge cases (nested brackets, parens in URL)
  - [ ] 🟥 **Manual test:** Type markdown link syntax

- [x] 🟩 **Step 8: Toolbar link button**
  - [x] 🟩 Write e2e test: button appears in toolbar
  - [x] 🟩 Write e2e test: with selection, prompts for URL
  - [x] 🟩 Write e2e test: in existing link, opens edit popover
  - [x] 🟩 Add Link icon button to `EditorToolbar.tsx`
  - [x] 🟩 Implement URL prompt (reuse popover component)
  - [ ] 🟥 **Manual test:** Toolbar button works

- [x] 🟩 **Step 9: Cmd+K keyboard shortcut**
  - [x] 🟩 Write e2e test: Cmd+K with selection prompts for URL only
  - [x] 🟩 Write e2e test: Cmd+K in link opens edit popover
  - [x] 🟩 Write e2e test: Cmd+K no selection shows dialog for text AND URL
  - [x] 🟩 Add keyboard shortcut to extension
  - [x] 🟩 Implement text+URL dialog for no-selection case
  - [ ] 🟥 **Manual test:** Cmd+K with selection
  - [ ] 🟥 **Manual test:** Cmd+K in existing link
  - [ ] 🟥 **Manual test:** Cmd+K with no selection → text+URL dialog

- [ ] 🟥 **Step 10: Paste detection for selected text**
  - [ ] 🟥 Write e2e test: URL on clipboard + selected text → linkifies
  - [ ] 🟥 Detect URL on clipboard when text selected
  - [ ] 🟥 Auto-linkify or show prompt
  - [ ] 🟥 **Manual test:** Select text, paste URL

### Phase 4: Bare URL Edit Behavior

- [ ] 🟥 **Step 11: Bare URL text↔href sync**
  - [ ] 🟥 Write test: editing bare URL text updates href
  - [ ] 🟥 Write test: editing to non-URL keeps href unchanged (text diverges)
  - [ ] 🟥 Detect when link text equals href (bare URL)
  - [ ] 🟥 Implement sync behavior on text edit
  - [ ] 🟥 **Manual test:** Edit bare URL text → href updates
  - [ ] 🟥 **Manual test:** Edit to non-URL → href preserved, text diverges

### Phase 5: Styling & Polish

- [ ] 🟥 **Step 12: Final styling**
  - [ ] 🟥 Move CSS from inline to proper stylesheet
  - [ ] 🟥 Style `.web-link` (blue, solid underline)
  - [ ] 🟥 Ensure distinct from `.inter-note-link` (dotted)
  - [ ] 🟥 Style popover to match app theme
  - [ ] 🟥 Add hover/focus states

- [ ] 🟥 **Step 13: Edge cases**
  - [ ] 🟥 Write test: URLs in code blocks NOT linkified
  - [ ] 🟥 Write test: trailing punctuation handled (`https://x.com.` → period excluded)
  - [ ] 🟥 Write test: parentheses in URLs work (Wikipedia)
  - [ ] 🟥 Write test: undo/redo works
  - [ ] 🟥 Fix any edge cases found

### Phase 6: Shared Utilities (iOS Support)

- [ ] 🟥 **Step 14: Shared package utilities**
  - [ ] 🟥 Write tests for `WEB_LINK_PATTERN` regex
  - [ ] 🟥 Write tests for `MARKDOWN_LINK_PATTERN` regex
  - [ ] 🟥 Write tests for `extractWebLinks()` function
  - [ ] 🟥 Write tests for `isValidWebUrl()` validation
  - [ ] 🟥 Implement patterns and functions
  - [ ] 🟥 Export from `@notecove/shared`

- [ ] 🟥 **Step 15: Final verification**
  - [ ] 🟥 Run full CI test suite
  - [ ] 🟥 Manual testing checklist
  - [ ] 🟥 Remove debug logging (or gate behind flag)
  - [ ] 🟥 Code review

---

## Files to Create/Modify

### New Files

- `packages/desktop/src/renderer/src/components/EditorPanel/extensions/WebLink.ts`
- `packages/desktop/src/renderer/src/components/EditorPanel/LinkPopover.tsx`
- `packages/shared/src/utils/web-link-extractor.ts`
- `packages/shared/src/utils/web-link-extractor.test.ts`

### Modified Files

- `packages/desktop/package.json` (add @tiptap/extension-link)
- `packages/desktop/src/renderer/src/components/EditorPanel/TipTapEditor.tsx`
- `packages/desktop/src/renderer/src/components/EditorPanel/EditorToolbar.tsx`
- `packages/shared/src/utils/index.ts`
- `packages/shared/src/index.ts`

---

## Manual Testing Checklist

_(For Step 15)_

- [ ] Type `https://example.com` + space → link created
- [ ] Type `https://example.com` + enter → link created
- [ ] Paste `https://example.com` → link created immediately
- [ ] Type `[click here](https://example.com)` → shows "click here" as link
- [ ] Single-click link → popover appears
- [ ] Popover Copy → URL copied to clipboard
- [ ] Popover Visit → opens in browser
- [ ] Popover Edit → can change URL
- [ ] Popover Remove → text remains, link removed
- [ ] Cmd+click link → opens directly in browser
- [ ] Select text + Cmd+K → prompted for URL
- [ ] Cursor in link + Cmd+K → edit popover opens
- [ ] No selection + Cmd+K → dialog for text AND URL
- [ ] Select text + paste URL → text becomes link
- [ ] Toolbar link button works
- [ ] URL in code block → NOT linkified
- [ ] Undo after creating link → link removed
- [ ] Edit bare URL text → href updates to match
- [ ] Edit bare URL to non-URL text → href preserved, link still works
- [ ] Web link visually distinct from `[[internal link]]`
