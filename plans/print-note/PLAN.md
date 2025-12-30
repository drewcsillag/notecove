# Print Note Feature - Implementation Plan

**Overall Progress:** `95%` (Phase 1-6.2 complete, awaiting final manual test + CI)

**Original Prompt:** [PROMPT.md](./PROMPT.md)

**Questions & Answers:** [QUESTIONS-1.md](./QUESTIONS-1.md) | [QUESTIONS-PLAN-1.md](./QUESTIONS-PLAN-1.md)

---

## Summary

Implement Cmd-P (Mac) / Ctrl-P (Windows/Linux) to print the current note with:

- Comments as endnotes with superscript reference numbers
- Chips, unfurls, hashtags rendered visually
- Task items with checkbox symbols (☐ ☑ ☒)
- Code blocks with syntax highlighting
- Print preview window with resolved comments toggle
- Light-mode styling, 11pt base font

---

## Tasks

### Phase 1: Minimal End-to-End (Get Visual Feedback Early)

- [x] 🟩 **1.1: Add print menu item and keyboard shortcut**
  - [x] 🟩 Add "Print..." menu item to File menu with CmdOrCtrl+P accelerator
  - [x] 🟩 Send `menu:print` IPC event to focused window
  - [x] 🟩 Update PLAN.md

- [x] 🟩 **1.2: Create print preview window infrastructure**
  - [x] 🟩 Add `printPreview` window type to `createWindow` options
  - [x] 🟩 Pass noteId via URL parameter
  - [x] 🟩 Create minimal PrintPreview component that receives noteId
  - [x] 🟩 Update PLAN.md

- [x] 🟩 **1.3: Basic HTML generation (paragraphs, headings only)**
  - [x] 🟩 Write tests for basic HTML generation (15 tests pass)
  - [x] 🟩 Create `generatePrintHtml` function in new print service
  - [x] 🟩 Handle paragraphs and headings (h1-h6), plus bold/italic/code marks
  - [x] 🟩 Update PLAN.md

- [x] 🟩 **1.4: Wire up basic print preview**
  - [x] 🟩 Handle `menu:print` in App.tsx to open print preview window
  - [x] 🟩 PrintPreview fetches note content via IPC (uses export API)
  - [x] 🟩 Display generated HTML with basic print CSS (11pt, light mode)
  - [x] 🟩 Add Print button that calls `window.print()`
  - [x] 🟩 **MILESTONE: Can now see basic output and iterate**
  - [x] 🟩 Update PLAN.md

### Phase 2: Content Types (Incremental, Testable)

- [x] 🟩 **2.1: Lists and blockquotes**
  - [x] 🟩 Write tests
  - [x] 🟩 Implement bullet lists, numbered lists, blockquotes
  - [x] 🟩 Update PLAN.md

- [x] 🟩 **2.2: Task items**
  - [x] 🟩 Write tests
  - [x] 🟩 Render tri-state checkboxes as symbols (☐ ☑ ☒)
  - [x] 🟩 Update PLAN.md

- [x] 🟩 **2.3: Code blocks with syntax highlighting**
  - [x] 🟩 Write tests
  - [x] 🟩 Render code blocks with language class for styling
  - [x] 🟩 Update PLAN.md

- [x] 🟩 **2.4: Images**
  - [x] 🟩 Write tests
  - [x] 🟩 Render images with max-width: 100% for page fit
  - [x] 🟩 Update PLAN.md

- [x] 🟩 **2.5: Tables**
  - [x] 🟩 Write tests
  - [x] 🟩 Render tables with proper structure (th/td, colspan/rowspan)
  - [x] 🟩 Update PLAN.md

- [x] 🟩 **2.6: Hashtags**
  - [x] 🟩 Write tests
  - [x] 🟩 Render hashtags with colored styling
  - [x] 🟩 Update PLAN.md

### Phase 3: Chips and Unfurls

- [x] 🟩 **3.1: Link chips**
  - [x] 🟩 Write tests (3 tests)
  - [x] 🟩 Render link chips based on displayMode attribute (auto/chip/link/unfurl)
  - [x] 🟩 Update PLAN.md

- [x] 🟩 **3.2: Inter-note link chips**
  - [x] 🟩 Write tests (2 tests)
  - [x] 🟩 Detect [[uuid]] patterns in plain text
  - [x] 🟩 Render as styled orange chips (note title resolution deferred to Phase 4)
  - [x] 🟩 Update PLAN.md

- [x] 🟩 **3.3: Date chips**
  - [x] 🟩 Write tests (2 tests)
  - [x] 🟩 Detect YYYY-MM-DD patterns and render as purple chips
  - [x] 🟩 Update PLAN.md

- [x] 🟩 **3.4: oEmbed unfurls**
  - [x] 🟩 Write tests (4 tests)
  - [x] 🟩 Render as static cards with thumbnail, title, provider, URL
  - [x] 🟩 Handle loading/error states gracefully
  - [x] 🟩 Update PLAN.md

### Phase 4: Comments System

- [x] 🟩 **4.1: Extract and number comments**
  - [x] 🟩 Write tests for comment extraction (5 tests)
  - [x] 🟩 Find all comment marks in document order
  - [x] 🟩 Assign sequential superscript numbers
  - [x] 🟩 Handle overlapping comments (multiple superscripts on same text)
  - [x] 🟩 Update PLAN.md

- [x] 🟩 **4.2: Render comment highlights with superscripts**
  - [x] 🟩 Write tests (included in 4.1)
  - [x] 🟩 Wrap commented text in yellow highlight span
  - [x] 🟩 Add superscript number after highlighted text
  - [x] 🟩 Update PLAN.md

- [x] 🟩 **4.3: Generate comments endnotes section**
  - [x] 🟩 Write tests (5 tests)
  - [x] 🟩 Fetch thread details with replies via IPC
  - [x] 🟩 Render separator line, then each comment with:
    - Number, quoted original text, author, timestamp, content
  - [x] 🟩 Render replies indented under each thread
  - [x] 🟩 CSS styles for endnotes section
  - [x] 🟩 Update PLAN.md
  - **Note:** @mentions in comments render as plain text (styling deferred)

- [x] 🟩 **4.4: Resolved comments toggle**
  - [x] 🟩 Write tests (3 tests)
  - [x] 🟩 Checkbox already in print preview from Phase 1
  - [x] 🟩 Filter comments based on resolved status
  - [x] 🟩 Re-generate HTML when toggle changes
  - [x] 🟩 Update PLAN.md

### Phase 5: Print Preview Polish

- [x] 🟩 **5.1: Print preview UI refinements**
  - [x] 🟩 Styled preview container with paper-like appearance
  - [x] 🟩 Header bar with Print/Close buttons and resolved toggle
  - [x] 🟩 Loading state while generating/loading images
  - [x] 🟩 Update PLAN.md

- [x] 🟩 **5.2: Print stylesheet refinements**
  - [x] 🟩 Fine-tune typography (11pt base, proportional headings)
  - [x] 🟩 Page break handling (avoid breaks inside code blocks, images)
  - [x] 🟩 Hide print preview UI elements when printing
  - [x] 🟩 Update PLAN.md

### Phase 6: Edge Cases and Documentation

- [x] 🟩 **6.1: Handle edge cases**
  - [x] 🟩 Empty note (returns empty string)
  - [x] 🟩 Note with no comments (no endnotes section)
  - [x] 🟩 All comments resolved + exclude resolved = no endnotes section
  - [x] 🟩 Very long notes (handled by page break CSS)
  - [x] 🟩 Update PLAN.md

- [x] 🟩 **6.2: Update website documentation**
  - [x] 🟩 Add print feature to desktop feature list (features/index.md)
  - [x] 🟩 Document keyboard shortcut (guide/keyboard-shortcuts.md)
  - [x] 🟩 Describe what gets printed (features/import-export.md#print)
  - [x] 🟩 Update PLAN.md

- [ ] 🟨 **6.3: Final testing and code review**
  - [ ] 🟨 Test full flow on macOS (manual verification needed)
  - [x] 🟩 Verify all content types render correctly (65 tests pass)
  - [x] 🟩 Code review (no TODOs, proper error handling)
  - [ ] 🟥 Run CI
  - [ ] 🟥 Update PLAN.md with final status

---

## Deferred Items

(Items moved here only with user approval)

- None

---

## Technical Notes

### Print Preview Window

New Electron window opened with URL parameter `?printPreview=true&noteId={id}`. Similar pattern to existing `syncStatus`, `noteInfo` windows.

### HTML Generation Flow

1. Fetch note content (Y.Doc) via IPC
2. Convert to ProseMirror JSON
3. Walk nodes and generate HTML with custom renderers for each type
4. Post-process to add comment superscripts
5. Append endnotes section
6. Return complete HTML string

### Comment Numbering

Comments numbered by first appearance position in document. Each unique threadId gets one number. Overlapping comments on same text get multiple superscripts.

### Image Loading

Track pending images with a counter. Enable Print button only when all images loaded. Show loading indicator until ready.

### Data Flow

```
App.tsx (menu:print)
  → createWindow({ printPreview: true, noteId })
    → PrintPreview component
      → IPC: getNoteContent(noteId)
      → IPC: getCommentThreads(noteId)
      → generatePrintHtml(content, comments, options)
      → Display in iframe/div
      → Print button → window.print()
```
