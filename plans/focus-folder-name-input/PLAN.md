# Feature Implementation Plan: Focus Folder Name Input

**Overall Progress:** `100%`

## Summary

Fix the Create Folder dialog so the folder name text field is focused when the dialog opens. The existing `autoFocus` attribute doesn't work reliably with MUI Dialog - need to use `inputRef` and manually focus after dialog opens.

## Tasks

- [x] 🟩 **Step 1: Write test**
  - [x] 🟩 Add test to `FolderPanel.test.tsx` that opens the create folder dialog and verifies the text field has focus

- [x] 🟩 **Step 2: Implement the fix**
  - [x] 🟩 Add `useRef` for the text field input
  - [x] 🟩 Add `useEffect` to focus the input when `createDialogOpen` becomes true (with setTimeout(0) to allow dialog transition)
  - [x] 🟩 Replace `autoFocus` with `inputRef` on the TextField

- [x] 🟩 **Step 3: Verify fix**
  - [x] 🟩 Run the test to confirm it passes
  - [x] 🟩 Run typecheck, lint, and unit tests - all pass

## Files to Modify

- `packages/desktop/src/renderer/src/components/FolderPanel/__tests__/FolderPanel.test.tsx` - add focus test
- `packages/desktop/src/renderer/src/components/FolderPanel/FolderPanel.tsx` - implement fix

## Related Files

- [QUESTIONS-1.md](./QUESTIONS-1.md) - Investigation notes

## Plan Review (Phase 3)

- **Ordering**: ✅ TDD order is correct
- **Feedback loop**: ✅ Quick - test runs in seconds
- **Debug tools**: ✅ Jest + RTL sufficient
- **Missing items**: ✅ None
- **Risk**: ✅ Low - UI-only change, pattern exists in codebase
