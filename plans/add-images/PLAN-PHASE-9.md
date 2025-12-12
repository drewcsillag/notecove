# Phase 9: Toolbar UI

**Status:** 🟩 Done
**Progress:** `100%`

**Depends on:** Phase 1 (Foundation), Phase 2 (File picker)

## Overview

Add image insertion button to editor toolbar.

---

## Current Toolbar Layout

```
[B] [I] [U] [S] [Code] | [H1] [H2] [H3] | [•] [1.] [☐] | ["] [—] | [Link] | [↩] [↪]
Bold Italic Under Strike Code  Headings    Lists       Quote HR  Link    Undo Redo
```

## Final Layout

Per user request: between horizontal rule and undo/redo:

```
[B] [I] [U] [S] [Code] | [Link] | [H1] [H2] [H3] | [•] [1.] [☐] | ["] [—] [🖼] | [↩] [↪]
                                                                      ^^^
                                                                Image button
```

---

## Tasks

### 9.1 Add Image Button to Toolbar

**Status:** 🟩 Done

Add button that triggers file picker.

#### Button Behavior

- **Click**: Opens file picker dialog (Phase 2.3)
- **Tooltip**: "Insert image (⌘⇧I)"
- **Icon**: `AddPhotoAlternate` from Material Icons

#### Implementation

- Added to `EditorToolbar.tsx`
- Wired up to `image:pickAndSave` IPC via `handleImageButtonClick` in TipTapEditor
- Inserts resulting image nodes at cursor position

#### Steps

- [x] 🟩 Write unit tests for toolbar button (5 tests in EditorToolbar.test.tsx)
- [ ] 🟨 Write E2E test: clicking image button opens file picker (skipped - file dialogs can't be tested in E2E)
- [x] 🟩 Add image button to `EditorToolbar.tsx`
- [x] 🟩 Style button consistent with existing toolbar
- [x] 🟩 Add tooltip with keyboard shortcut
- [x] 🟩 Wire up click handler

---

## Keyboard Shortcut

**Shortcut:** `Cmd+Shift+I` (Mac) / `Ctrl+Shift+I` (Windows/Linux)

Note: `Cmd+I` is taken by Italic.

#### Implementation

- Added via keydown listener in TipTapEditor useEffect (Phase 2)
- Triggers same action as button click

#### Steps

- [x] 🟩 Add keyboard shortcut to TipTapEditor (done in Phase 2)
- [x] 🟩 Test shortcut works on Mac (manually verified)
- [x] 🟩 Update tooltip to show shortcut

---

## Button States

| State    | Appearance  | When            |
| -------- | ----------- | --------------- |
| Normal   | Default     | Ready to insert |
| Hover    | Highlighted | Mouse over      |
| Active   | Pressed     | During click    |
| Disabled | Grayed      | Read-only mode  |

#### Steps

- [x] 🟩 Style all button states (handled by MUI IconButton)
- [ ] 🟨 Disable when editor is read-only (deferred - no read-only mode yet)

---

## Accessibility

- Button has `aria-label="Insert image"`
- Keyboard navigable (Tab through toolbar)
- Visible focus state

#### Steps

- [x] 🟩 Add aria-label
- [x] 🟩 Ensure keyboard navigation works (MUI handles this)
- [x] 🟩 Add focus styles (MUI handles this)

---

## Divider Placement

Button is placed after horizontal rule and before the divider that precedes undo/redo:

```
[—] [🖼] | [↩] [↪]
```

#### Steps

- [x] 🟩 Position button correctly in toolbar
- [x] 🟩 Add appropriate dividers

---

## Testing Checklist

- [x] Image button visible in toolbar
- [x] Button positioned after HR and before undo/redo divider
- [x] Click opens file picker
- [x] Keyboard shortcut works (Cmd+Shift+I)
- [ ] Button disabled in read-only mode (deferred)
- [x] Tooltip shows shortcut
- [x] Button accessible via keyboard
- [ ] CI passes (pending verification)

---

## Files Changed

- `packages/desktop/src/renderer/src/components/EditorPanel/EditorToolbar.tsx`
  - Added `AddPhotoAlternate` icon import
  - Added `onImageButtonClick` prop
  - Added image button JSX with tooltip and aria-label
- `packages/desktop/src/renderer/src/components/EditorPanel/TipTapEditor.tsx`
  - Added `handleImageButtonClick` handler
  - Wired up `onImageButtonClick` to EditorToolbar
- `packages/desktop/src/renderer/src/components/EditorPanel/__tests__/EditorToolbar.test.tsx` (new)
  - 5 unit tests for image button
