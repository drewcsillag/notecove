# Fix Mac Option+Up/Down Line Move

**Overall Progress:** `100%`

## Problem Analysis

The `MoveBlock.ts` extension uses `'Alt-Up'` and `'Alt-Down'` keyboard shortcuts. These work on Windows/Linux but not on Mac.

**Root Cause Hypothesis:**
On Mac, Option+Up/Down is intercepted by the browser/system for paragraph navigation (move cursor to beginning/end of paragraph) before it reaches TipTap's keyboard handler. This is a contenteditable-specific issue that VS Code avoids because Monaco uses custom rendering.

**Evidence:**

- The comment shortcut (`Cmd+Alt+M`) works on Mac because it uses a direct DOM event listener with `event.code` instead of relying on TipTap's shortcut system (see `TipTapEditor.tsx:1593-1604`)
- TipTap uses ProseMirror keymap which relies on `event.key` processing

**Solution:**
Use the same pattern as the comment shortcut - add a direct DOM `keydown` listener that:

1. Checks for Option+ArrowUp/Down on Mac (Alt+ArrowUp/Down on other platforms)
2. Uses `event.code` for reliable key detection
3. Calls the existing `moveBlockUp`/`moveBlockDown` commands
4. Prevents default to stop paragraph navigation

## Tasks

- [x] 🟩 **Step 1: Verify hypothesis with debug logging**
  - [x] 🟩 Add temporary console.log in TipTapEditor to log all keydown events
  - [x] 🟩 Test on Mac to see what happens with Option+Up/Down
  - [x] 🟩 Confirm whether events reach DOM but not TipTap, or don't reach at all
  - [x] 🟩 Remove debug logging after verification

- [x] 🟩 **Step 2: Add failing test for keyboard shortcut handling**
  - [x] 🟩 Create test that simulates Alt+ArrowUp/Down keydown event with correct event properties
  - [x] 🟩 Verify it triggers the moveBlockUp/moveBlockDown commands

- [x] 🟩 **Step 3: Add DOM keydown listener for line movement**
  - [x] 🟩 Add useEffect in TipTapEditor.tsx (similar to comment shortcut pattern at lines 1589-1616)
  - [x] 🟩 Listen for Alt+ArrowUp/Down using `event.code` ('ArrowUp'/'ArrowDown') and `event.altKey`
  - [x] 🟩 Call editor.commands.moveBlockUp/moveBlockDown
  - [x] 🟩 preventDefault and stopPropagation to stop native paragraph navigation

- [x] 🟩 **Step 4: Keep TipTap shortcuts as fallback**
  - [x] 🟩 Keep existing `'Alt-Up'` and `'Alt-Down'` in MoveBlock.ts
  - [x] 🟩 Both handlers can coexist - DOM listener catches Mac, TipTap catches if DOM misses

- [x] 🟩 **Step 5: Verify and test**
  - [x] 🟩 Run existing MoveBlock tests (should still pass)
  - [x] 🟩 Run full CI

## Files to Modify

1. `packages/desktop/src/renderer/src/components/EditorPanel/TipTapEditor.tsx` - Add DOM keydown listener
2. `packages/desktop/src/renderer/src/components/EditorPanel/extensions/__tests__/MoveBlock.test.ts` - Add keyboard event simulation tests (optional, may be hard to test DOM events in Jest)

## Critique Notes (Phase 3)

### Verified

- Ordering: Test → Implement → Verify ✓
- Pattern follows established code (comment shortcut) ✓

### Added

- Step 1 to verify hypothesis before implementing
- Explicit mention of stopPropagation to prevent event conflicts

### Risks

- Low: Follows established pattern
- Handler ordering: DOM listener will fire before TipTap's, which is what we want

### Questions Resolved

- No new questions - approach is clear
