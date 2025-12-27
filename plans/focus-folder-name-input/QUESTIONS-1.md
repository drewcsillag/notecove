# Questions - Focus Folder Name Input

## Context

The Create Folder dialog in `FolderPanel.tsx` (lines 268-300) already has `autoFocus` on the TextField (line 272), but the focus isn't working. This is a known MUI issue where `autoFocus` on a TextField inside a Dialog doesn't work reliably because Dialog manages its own focus.

## Investigation Findings

- The dialog uses standard MUI `Dialog`, `DialogContent`, and `TextField` components
- `autoFocus` is already set on the TextField but isn't working
- Other components in the codebase (e.g., `LinkInputPopover`, `StorageDirectorySettings`) also use `autoFocus` - some may have the same issue
- The common solution is to use `inputRef` with a `useEffect` to manually focus after the dialog's transition completes

## No Questions

The fix is straightforward - use `inputRef` and focus manually when the dialog opens. This is the pattern used in `LinkInputPopover.tsx` (lines 39-49).

No clarifications needed from user.
