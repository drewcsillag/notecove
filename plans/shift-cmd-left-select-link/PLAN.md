# Feature Implementation Plan: Shift+Cmd+Left Select Link

**Overall Progress:** `100%`

## Problem Summary

When cursor is immediately after an inter-note link (e.g., `foo [[Link]]| bar`), leftward selection commands don't work correctly:

- **Shift+Cmd+Left**: Should select to beginning of line, but only selects `foo ` (skipping the link)
- **Shift+Left**: Should extend selection left by one character, but doesn't correctly handle the hidden link text

**Root Cause**: The `[[uuid]]` text is hidden via `display: none` CSS. The browser's native selection doesn't "see" this content, causing selection to skip over it.

## Tasks

### Phase A: Selection Fix

- [x] 🟩 **Step 1: Quick scroll investigation (30 min max)**
  - [x] 🟩 Identify which commands cause unexpected scroll
  - [x] 🟩 Determine if related to selection bug or separate issue
  - [x] 🟩 Document findings - see [SCROLL-INVESTIGATION.md](./SCROLL-INVESTIGATION.md)

- [x] 🟩 **Step 2: Add failing tests**
  - [x] 🟩 Add failing tests for Shift+Cmd+Left near links
  - [x] 🟩 Add failing tests for Shift+Left near links

- [x] 🟩 **Step 3: Implement Shift+Left fix**
  - [x] 🟩 Add keyboard shortcut handler for `Shift-Left` in InterNoteLink extension
  - [x] 🟩 When cursor is immediately after a link (`[[uuid]]|`), extend selection to include entire link
  - [x] 🟩 Make tests pass

- [x] 🟩 **Step 4: Implement Shift+Cmd+Left fix**
  - [x] 🟩 Add keyboard shortcut handler for `Mod-Shift-ArrowLeft` (maps to Cmd on Mac)
  - [x] 🟩 Selects from cursor to beginning of paragraph, naturally including all links
  - [x] 🟩 Make tests pass

- [x] 🟩 **Step 5: Manual testing & edge cases**
  - [x] 🟩 Test with multiple links in sequence (via unit tests)
  - [x] 🟩 Test link at start/end of line (via unit tests)
  - [x] 🟩 Test with existing selection that spans a link (via unit tests)
  - [x] 🟩 Run formatting, typecheck, unit tests - all pass

### Phase B: Scroll Position Fix (if needed)

- [ ] 🟥 **Step 6: Fix scroll position issue**
  - [ ] 🟥 Implement fix based on Step 1 findings
  - [ ] 🟥 Add tests if applicable
  - [ ] 🟥 Run CI

## Technical Approach

### Key insight

The existing `findLinkEndingAt()` function already solves part of this - it finds a `[[uuid]]` link ending at a given position. We need to use this in selection handlers.

### For Shift+Left

When extending selection left:

1. Check if there's a link ending at the selection's anchor position
2. If yes, extend selection to include the entire link
3. If no, let default behavior handle it

### For Shift+Cmd+Left

When extending selection to beginning of line:

1. Let browser handle the initial selection
2. Check if the resulting selection boundary falls inside or adjacent to a link
3. If adjacent to a link, extend selection to include entire link
4. Repeat until no more links are skipped

### Key code location

`packages/desktop/src/renderer/src/components/EditorPanel/extensions/InterNoteLink.ts`

- Existing keyboard handlers at line 267-331 (Backspace and Delete)
- We'll add new handlers in `addKeyboardShortcuts()`

## Questions Resolved

- [QUESTIONS-1.md](./QUESTIONS-1.md) - Initial requirements clarification
- [QUESTIONS-PLAN-1.md](./QUESTIONS-PLAN-1.md) - Plan critique answers:
  - Quick scroll investigation first (30 min max)
  - Shift+Right works correctly (no fix needed)
  - Scroll fix as Phase B in this plan
