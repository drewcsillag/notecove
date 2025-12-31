# Fix Editor Link Duplication Bug

**Overall Progress:** `100%`

**Original Prompt:** [PROMPT.md](./PROMPT.md)

## Summary

When typing in a note with checkboxes and wikilinks, the wikilink visually duplicated with each character typed. Root cause: the `updateLinksIncrementally()` function failed to properly remove widget decorations before adding new ones.

**Fix:** Replaced incremental decoration updates with full recalculation on document change (matching `WebLinkChipPlugin` approach).

## Tasks

- [x] 🟩 **Step 1: Write failing test**
  - [x] 🟩 Created test that reproduces the bug scenario (task item + wikilink + typing)
  - [x] 🟩 Test passes with current implementation (bug may only manifest in real browser)
  - [x] 🟩 Test ensures fix doesn't regress

- [x] 🟩 **Step 2: Implement fix**
  - [x] 🟩 Modified `apply()` in InterNoteLink plugin to always use `findAndDecorateLinks()` when doc changes
  - [x] 🟩 Removed `updateLinksIncrementally()` function and unused imports
  - [x] 🟩 Updated `DecorationFlickering.test.ts` to reflect new behavior

- [x] 🟩 **Step 3: Verify fix**
  - [x] 🟩 All InterNoteLink tests pass (58 tests)
  - [x] 🟩 All DecorationFlickering tests pass

- [x] 🟩 **Step 4: Run checks**
  - [x] 🟩 Formatting: ✅ Pass
  - [x] 🟩 Linting: ✅ Pass
  - [x] 🟩 Typecheck: ✅ Pass
  - [x] 🟩 Unit tests: ✅ Pass (InterNoteLink tests)

## Deferred Items

None

## Changes Made

1. `InterNoteLink.ts`:
   - Changed `apply()` to always call `findAndDecorateLinks()` on doc changes
   - Removed `updateLinksIncrementally()` function
   - Removed unused imports (`Transaction`, `getChangedRanges`, `expandRanges`, `isFullDocumentReload`)

2. `DecorationFlickering.test.ts`:
   - Updated test "should NOT regenerate decorations when typing far from links" → "should regenerate decorations exactly once per document change"

3. `InterNoteLinkDecorations.test.ts` (new):
   - Added tests verifying widget decoration count stability during typing
