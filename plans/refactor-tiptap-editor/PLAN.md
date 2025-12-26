# TipTapEditor Refactoring Plan

**Overall Progress:** `89%` (Phases 1-8 complete)

**Goal:** Reduce TipTapEditor.tsx from 3178 lines to ~600 lines by extracting logical groupings into separate files, each under 500 lines (max 800).

**Decisions Made:** (see [QUESTIONS-1.md](./QUESTIONS-1.md))
- Styling → Pure function export (matches `codeBlockTheme.ts` pattern)
- Logic → Multiple custom hooks (8 smaller files preferred)
- Extensions → Extract to separate file
- Context menu/links → Custom hooks
- Toolbar handlers → Keep inline

---

## Pre-Flight Checks

- [x] 🟩 **Step 0: Verify existing tests pass**
  - [x] 🟩 Run `npx jest --testPathPattern="EditorPanel/__tests__"` to establish baseline
  - [x] 🟩 Document any pre-existing failures: None

---

## Phase 1: Extract Styles (~550 lines) ✅

- [x] 🟩 **Step 1: Create `tipTapEditorStyles.ts`**
  - [x] 🟩 Create file with `getTipTapEditorStyles(theme: Theme)` function
  - [x] 🟩 Move all ProseMirror styles from TipTapEditor's sx prop
  - [x] 🟩 Export type for the returned style object (SxProps<Theme>)
  - [x] 🟩 Update TipTapEditor.tsx to import and use the function
  - [x] 🟩 Run tests to verify no regressions

**Result:** TipTapEditor.tsx: 3178 → 2625 lines (553 lines extracted to tipTapEditorStyles.ts: 572 lines)

---

## Phase 2: Extract Editor Extensions (~150 lines) ✅

- [x] 🟩 **Step 2: Create `getEditorExtensions.ts`**
  - [x] 🟩 Create file with `getEditorExtensions(yDoc, callbacks)` function
  - [x] 🟩 Move extension configuration (StarterKit, custom extensions, Collaboration)
  - [x] 🟩 Define callback interface `EditorExtensionCallbacks` for extension events
  - [x] 🟩 Update TipTapEditor.tsx to use the function with useMemo
  - [x] 🟩 Run tests to verify no regressions

**Result:** TipTapEditor.tsx: 2625 → 2551 lines (getEditorExtensions.ts: 135 lines)

---

## Phase 3: Extract Note Sync Logic (~200 lines) ✅

- [x] 🟩 **Step 3: Create `useNoteSync.ts`**
  - [x] 🟩 Create hook with signature: `useNoteSync(noteId, editor, yDoc, refs, state, options)`
  - [x] 🟩 Move note loading/unloading logic
  - [x] 🟩 Move Yjs update handlers
  - [x] 🟩 Move focus-after-load effect
  - [x] 🟩 Return: `{ showSyncIndicator }` (isLoading owned by component for useEditor)
  - [x] 🟩 Update TipTapEditor.tsx to use the hook
  - [x] 🟩 Run tests to verify no regressions

**Result:** TipTapEditor.tsx: 2551 → 2371 lines (useNoteSync.ts: 335 lines)

**Note:** Hook signature differs from plan due to dependency cycle:
- useEditor needs `isLoading` for `editable` prop
- useNoteSync needs `editor` to operate
- Solution: Component owns `isLoading` state, passes via `UseNoteSyncState` interface

---

## Phase 4: Extract State Restoration Logic (~125 lines) ✅

- [x] 🟩 **Step 4: Create `useEditorStateRestoration.ts`**
  - [x] 🟩 Create hook with signature: `useEditorStateRestoration(noteId, editor, isLoading, editorContainerRef)`
  - [x] 🟩 Move window state reporting
  - [x] 🟩 Move saved state loading
  - [x] 🟩 Move scroll/cursor restoration
  - [x] 🟩 Move scroll/cursor tracking
  - [x] 🟩 Move final state reporting on unmount
  - [x] 🟩 Update TipTapEditor.tsx to use the hook
  - [x] 🟩 Run tests to verify no regressions

**Result:** TipTapEditor.tsx: 2371 → 2230 lines (useEditorStateRestoration.ts: 179 lines)

**Note:** Hook internally calls `useWindowState()` and `useNoteScrollPosition()` instead of receiving callbacks as props, keeping the interface simple.

---

## Phase 5: Extract Image Handling (~240 lines) ✅

- [x] 🟩 **Step 5: Create `useEditorImages.ts`**
  - [x] 🟩 Create hook with signature: `useEditorImages(editor, editorContainerRef)`
  - [x] 🟩 Move MIME type helpers (EXTENSION_TO_MIME, getMimeTypeFromFilename, getImageMimeType)
  - [x] 🟩 Move DOM drop handler for image files
  - [x] 🟩 Move keyboard shortcut for image picker (Cmd+Shift+M)
  - [x] 🟩 Update TipTapEditor.tsx to use the hook
  - [x] 🟩 Run tests to verify no regressions

**Result:** TipTapEditor.tsx: 2230 → 1955 lines (useEditorImages.ts: 307 lines)

---

## Phase 6: Extract Comment Handling (~220 lines) ✅

- [x] 🟩 **Step 6: Create `useEditorComments.ts`**
  - [x] 🟩 Create hook with signature: `useEditorComments(noteId, editor, userProfile, callbacks)`
  - [x] 🟩 Move comment click handler
  - [x] 🟩 Move add comment on selection
  - [x] 🟩 Move comment keyboard shortcut (Cmd+Alt+M)
  - [x] 🟩 Move comment count tracking
  - [x] 🟩 Return: `{ openCommentCount, overlapPopover, closeOverlapPopover, handleCommentButtonClick }`
  - [x] 🟩 Update TipTapEditor.tsx to use the hook
  - [x] 🟩 Run tests to verify no regressions

**Result:** TipTapEditor.tsx: 1955 → 1770 lines (useEditorComments.ts: 280 lines)

**Note:** Hook also manages the overlap popover state (shown when multiple comments overlap at the same position). The hook handles comment thread creation via IPC, comment mark application, and cleanup when threads are deleted.

---

## Phase 7: Extract Context Menu (~260 lines) ✅

- [x] 🟩 **Step 7: Create `useEditorContextMenu.ts`**
  - [x] 🟩 Create hook with signature: `useEditorContextMenu(editor)`
  - [x] 🟩 Move context menu state
  - [x] 🟩 Move clipboard utilities (serializeSelectionToClipboard, writeToClipboard, readBlobAsText)
  - [x] 🟩 Move cut/copy/paste handlers
  - [x] 🟩 Return: `{ contextMenu, handleContextMenu, handleClose, handleCut, handleCopy, handlePaste, handlePasteAsPlainText }`
  - [x] 🟩 Update TipTapEditor.tsx to use the hook
  - [x] 🟩 Run `context-menu-clipboard.test.ts` specifically to verify (19 tests pass)

**Result:** TipTapEditor.tsx: 1770 → 1592 lines (useEditorContextMenu.ts: 254 lines)

---

## Phase 8: Extract Link Popovers (~305 lines) ✅

- [x] 🟩 **Step 8: Create `useEditorLinkPopovers.tsx`**
  - [x] 🟩 Create hook with signature: `useEditorLinkPopovers(editor)`
  - [x] 🟩 Move link popover state (LinkPopover, LinkInputPopover, TextAndUrlInputPopover)
  - [x] 🟩 Move three tippy.js popover effects
  - [x] 🟩 Move handleLinkButtonClick
  - [x] 🟩 Move handleCmdK and handleCmdKRef effect
  - [x] 🟩 Return: `{ setLinkPopoverData, handleCmdKRef, handleLinkButtonClick }`
  - [x] 🟩 Update TipTapEditor.tsx to use the hook
  - [x] 🟩 Run tests to verify no regressions (423 tests pass)

**Result:** TipTapEditor.tsx: 1592 → 1191 lines (useEditorLinkPopovers.tsx: 485 lines)

**Note:** Hook uses `.tsx` extension for JSX support. Manages three types of popovers using tippy.js for positioning. WebLink callbacks in component use the hook's `setLinkPopoverData` and `handleCmdKRef`.

---

## Phase 9: Final Cleanup

- [ ] 🟥 **Step 9: Review and optimize imports**
  - [ ] 🟥 Remove unused imports from TipTapEditor.tsx
  - [ ] 🟥 Ensure no circular dependencies
  - [ ] 🟥 Verify all extracted files have proper TypeScript types

- [ ] 🟥 **Step 10: Final verification**
  - [ ] 🟥 Run full test suite: `pnpm --filter @notecove/desktop test`
  - [ ] 🟥 Run E2E tests related to editor: `pnpm --filter @notecove/desktop test:e2e -- --grep "editor"`
  - [ ] 🟥 Verify line counts for all files are within targets
  - [ ] 🟥 Manual testing of key features (paste, drop, comments, links)

---

## Final File Structure

| File | Target Lines | Content |
|------|--------------|---------|
| `TipTapEditor.tsx` | ~600 | Main component, useEditor, toolbar handlers, JSX |
| `tipTapEditorStyles.ts` | ~550 | Style objects/functions |
| `getEditorExtensions.ts` | ~150 | Editor extension configuration |
| `useNoteSync.ts` | ~200 | Note loading, IPC, Yjs sync |
| `useEditorStateRestoration.ts` | ~125 | Scroll/cursor persistence |
| `useEditorImages.ts` | ~240 | Image drop/paste/keyboard |
| `useEditorComments.ts` | ~220 | Comment handling |
| `useEditorContextMenu.ts` | ~260 | Context menu handlers |
| `useEditorLinkPopovers.ts` | ~305 | Link popover management |

---

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Circular dependencies between hooks | Medium | Extract in order; ESLint will catch |
| Tippy.js popover refs broken | High | Run link/context menu tests after Phase 7-8 |
| Yjs sync timing issues | High | Phase 3 tests critical; manual verify sync indicator |
| Performance regression (extra re-renders) | Low | Same dependencies, should be equivalent |
| Cmd+K handling split between Phase 7-8 | Medium | Phase 8 owns Cmd+K; Phase 7 context menu doesn't need it |

---

## Shared Refs (for hook parameters)

These refs from TipTapEditor will be passed to multiple hooks:

| Ref | Used By |
|-----|---------|
| `editor` | All hooks |
| `containerRef` | useEditorStateRestoration, useEditorImages |
| `yDocRef` | useNoteSync |

---

## Notes

- Each phase should be committed separately for easy rollback if needed
- Tests should pass after each phase before proceeding
- **Smoke test manually after each phase** - visual bugs may not be caught by unit tests
- The `editorProps` callbacks (handlePaste, transformPasted, clipboardTextSerializer) stay inline due to tight coupling with component refs
- Existing tests in `__tests__/` directory must continue to pass
- Hook call order in final component: useNoteSync → useEditorStateRestoration → useEditorImages → useEditorComments → useEditorContextMenu → useEditorLinkPopovers
