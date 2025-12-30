# Print Note Feature - Implementation Plan

**Overall Progress:** `17%` (Phase 1 complete)

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

- [ ] 🟥 **2.1: Lists and blockquotes**
  - [ ] 🟥 Write tests
  - [ ] 🟥 Implement bullet lists, numbered lists, blockquotes
  - [ ] 🟥 Update PLAN.md

- [ ] 🟥 **2.2: Task items**
  - [ ] 🟥 Write tests
  - [ ] 🟥 Render tri-state checkboxes as symbols (☐ ☑ ☒)
  - [ ] 🟥 Update PLAN.md

- [ ] 🟥 **2.3: Code blocks with syntax highlighting**
  - [ ] 🟥 Write tests
  - [ ] 🟥 Render code blocks with language-specific highlighting
  - [ ] 🟥 Include print-friendly syntax highlighting CSS
  - [ ] 🟥 Update PLAN.md

- [ ] 🟥 **2.4: Images**
  - [ ] 🟥 Write tests
  - [ ] 🟥 Render images at display size, max-width: 100% for page fit
  - [ ] 🟥 Handle image captions
  - [ ] 🟥 Wait for images to load before enabling Print button
  - [ ] 🟥 Update PLAN.md

- [ ] 🟥 **2.5: Tables**
  - [ ] 🟥 Write tests
  - [ ] 🟥 Render tables with borders and proper styling
  - [ ] 🟥 Update PLAN.md

- [ ] 🟥 **2.6: Hashtags**
  - [ ] 🟥 Write tests
  - [ ] 🟥 Render hashtags with colored styling
  - [ ] 🟥 Update PLAN.md

### Phase 3: Chips and Unfurls

- [ ] 🟥 **3.1: Link chips**
  - [ ] 🟥 Write tests
  - [ ] 🟥 Render link chips with favicon, title, styled appearance
  - [ ] 🟥 Update PLAN.md

- [ ] 🟥 **3.2: Inter-note link chips**
  - [ ] 🟥 Write tests
  - [ ] 🟥 Render as styled chips matching screen appearance
  - [ ] 🟥 Resolve note titles via IPC
  - [ ] 🟥 Update PLAN.md

- [ ] 🟥 **3.3: Date chips**
  - [ ] 🟥 Write tests
  - [ ] 🟥 Render date chips with styled appearance
  - [ ] 🟥 Update PLAN.md

- [ ] 🟥 **3.4: oEmbed unfurls**
  - [ ] 🟥 Write tests
  - [ ] 🟥 Render as static cards with thumbnail, title, provider
  - [ ] 🟥 Update PLAN.md

### Phase 4: Comments System

- [ ] 🟥 **4.1: Extract and number comments**
  - [ ] 🟥 Write tests for comment extraction
  - [ ] 🟥 Find all comment marks in document order
  - [ ] 🟥 Assign sequential superscript numbers
  - [ ] 🟥 Handle overlapping comments (multiple superscripts on same text)
  - [ ] 🟥 Update PLAN.md

- [ ] 🟥 **4.2: Render comment highlights with superscripts**
  - [ ] 🟥 Write tests
  - [ ] 🟥 Wrap commented text in yellow highlight span
  - [ ] 🟥 Add superscript number after highlighted text
  - [ ] 🟥 Update PLAN.md

- [ ] 🟥 **4.3: Generate comments endnotes section**
  - [ ] 🟥 Write tests
  - [ ] 🟥 Fetch thread details with replies via IPC
  - [ ] 🟥 Render separator line, then each comment with:
    - Number, quoted original text, author, timestamp, content
  - [ ] 🟥 Render replies indented under each thread
  - [ ] 🟥 Style @mentions as chips
  - [ ] 🟥 Update PLAN.md

- [ ] 🟥 **4.4: Resolved comments toggle**
  - [ ] 🟥 Write tests
  - [ ] 🟥 Add "Include resolved comments" checkbox to print preview
  - [ ] 🟥 Re-generate HTML when toggle changes
  - [ ] 🟥 Update PLAN.md

### Phase 5: Print Preview Polish

- [ ] 🟥 **5.1: Print preview UI refinements**
  - [ ] 🟥 Styled preview container with paper-like appearance
  - [ ] 🟥 Header bar with Print/Close buttons and resolved toggle
  - [ ] 🟥 Loading state while generating/loading images
  - [ ] 🟥 Update PLAN.md

- [ ] 🟥 **5.2: Print stylesheet refinements**
  - [ ] 🟥 Fine-tune typography (11pt base, proportional headings)
  - [ ] 🟥 Page break handling (avoid breaks inside code blocks, images)
  - [ ] 🟥 Hide print preview UI elements when printing
  - [ ] 🟥 Update PLAN.md

### Phase 6: Edge Cases and Documentation

- [ ] 🟥 **6.1: Handle edge cases**
  - [ ] 🟥 Empty note
  - [ ] 🟥 Note with no comments
  - [ ] 🟥 All comments resolved + exclude resolved = no endnotes section
  - [ ] 🟥 Very long notes
  - [ ] 🟥 Update PLAN.md

- [ ] 🟥 **6.2: Update website documentation**
  - [ ] 🟥 Add print feature to desktop feature list
  - [ ] 🟥 Document keyboard shortcut (Cmd/Ctrl-P)
  - [ ] 🟥 Describe what gets printed (content, comments as endnotes)
  - [ ] 🟥 Update PLAN.md

- [ ] 🟥 **6.3: Final testing and code review**
  - [ ] 🟥 Test full flow on macOS
  - [ ] 🟥 Verify all content types render correctly
  - [ ] 🟥 Code review
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
