# Feature Implementation Plan: Cosmetic Hotkey Fixes

**Overall Progress:** `100%`

**Original Prompt:** [PROMPT.md](./PROMPT.md)

**Questions & Answers:** [QUESTIONS-1.md](./QUESTIONS-1.md)

## Summary

Four distinct fixes:

1. Swap Find hotkeys and rename menu item
2. Fix panel toggle shortcuts to use focused window
3. Implement Cmd+X "cut line when no selection"

## Tasks

- [x] 🟩 **Step 1: Fix Find hotkeys in menu.ts**
  - [x] 🟩 Change "Find..." to "Find Note" with accelerator `CmdOrCtrl+Alt+F`
  - [x] 🟩 Change "Find in Note" accelerator to `CmdOrCtrl+F`
  - [x] 🟩 Update PLAN.md

- [x] 🟩 **Step 2: Fix panel toggle shortcuts to use focused window**
  - [x] 🟩 Update "Toggle Folder Panel" (Shift+Cmd+1) to use `BrowserWindow.getFocusedWindow()`
  - [x] 🟩 Update "Toggle Tags Panel" (Shift+Cmd+2) to use `BrowserWindow.getFocusedWindow()`
  - [x] 🟩 Update "Toggle Notes List" (Shift+Cmd+0) to use `BrowserWindow.getFocusedWindow()`
  - [x] 🟩 Update PLAN.md

- [x] 🟩 **Step 3: Implement Cmd+X cut line when no selection**
  - [x] 🟩 Write test for cut line behavior in TipTap extension
  - [x] 🟩 Create CutLine extension with `Mod-x` keyboard shortcut
  - [x] 🟩 Add extension to getEditorExtensions.ts
  - [x] 🟩 Update PLAN.md

- [x] 🟩 **Step 4: Final verification**
  - [x] 🟩 Run tests to ensure all pass (641 tests passed)
  - [x] 🟩 Update PLAN.md with final status

## Deferred Items

None

## Technical Notes

### Cmd+X Implementation

TipTap allows custom keyboard shortcuts via extensions. When `Mod-x` is pressed:

1. Check if selection is empty (from === to)
2. If empty: select the current line, copy to clipboard, delete
3. If not empty: let default cut behavior handle it (return false)

Use `navigator.clipboard.writeText()` for plain text clipboard (standard for line-cut in editors).

### Edge Cases for Cut Line

- Cursor at document start: cut first line
- Cursor at document end: cut last line
- Empty line: cut the empty line (just newline)
- Single line document: cut and leave empty paragraph

### Plan Critique Notes

- Steps 1-2 are low risk (menu.ts changes)
- Step 3 medium risk - tests cover edge cases
- Ordering is correct - no dependencies between steps

## Implementation Notes

### Files Changed

1. `packages/desktop/src/main/menu.ts` - Updated Find hotkeys and panel toggle handlers
2. `packages/desktop/src/renderer/src/components/EditorPanel/extensions/CutLine.ts` - New extension
3. `packages/desktop/src/renderer/src/components/EditorPanel/extensions/__tests__/CutLine.test.ts` - New tests (9 tests)
4. `packages/desktop/src/renderer/src/components/EditorPanel/getEditorExtensions.ts` - Added CutLine import

### Test Results

- CutLine tests: 9/9 passed
- EditorPanel tests: 641 passed (1 skipped)
- All formatting checks pass

### Pre-existing Issues (Not Fixed)

- TypeScript errors in profile/sync related code (PollingGroup, ProfileMode types missing from @notecove/shared)
- ESLint errors related to the same missing types
- These are unrelated to this feature and appear to be from incomplete work on another branch
