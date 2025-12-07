# Phase 9: Toolbar UI

**Status:** 🟥 To Do
**Progress:** `0%`

**Depends on:** Phase 1 (Foundation), Phase 2 (File picker)

## Overview

Add image insertion button to editor toolbar.

---

## Current Toolbar Layout

```
[B] [I] [U] [S] [Code] | [H1] [H2] [H3] | [•] [1.] [☐] | ["] [—] | [Link] | [↩] [↪]
Bold Italic Under Strike Code  Headings    Lists       Quote HR  Link    Undo Redo
```

## Proposed Layout

Per user request: between horizontal rule and undo/redo:

```
[B] [I] [U] [S] [Code] | [H1] [H2] [H3] | [•] [1.] [☐] | ["] [—] | [Link] [🖼] | [↩] [↪]
                                                                     ^^^
                                                               Image button
```

---

## Tasks

### 9.1 Add Image Button to Toolbar

**Status:** 🟥 To Do

Add button that triggers file picker.

#### Button Behavior

- **Click**: Opens file picker dialog (Phase 2.3)
- **Tooltip**: "Insert image (⌘⇧I)"
- **Icon**: Image/picture icon from Material Icons

#### Icon Options (Material Icons)

- `Image` - Generic image icon
- `AddPhotoAlternate` - Image with + (suggests adding)
- `InsertPhoto` - Image with insert indicator

Recommend: `AddPhotoAlternate` (clearest intent)

#### Implementation

- Add to `EditorToolbar.tsx`
- Wire up to `image:pickAndSave` IPC
- Insert resulting image nodes

#### Steps

- [ ] 🟥 Write E2E test: clicking image button opens file picker
- [ ] 🟥 Add image button to `EditorToolbar.tsx`
- [ ] 🟥 Style button consistent with existing toolbar
- [ ] 🟥 Add tooltip with keyboard shortcut
- [ ] 🟥 Wire up click handler

---

## Keyboard Shortcut

**Shortcut:** `Cmd+Shift+I` (Mac) / `Ctrl+Shift+I` (Windows/Linux)

Note: `Cmd+I` is taken by Italic.

#### Implementation

- Add to TipTap keyboard shortcuts in Image extension
- Triggers same action as button click

#### Steps

- [ ] 🟥 Add keyboard shortcut to Image extension
- [ ] 🟥 Test shortcut works on Mac and Windows
- [ ] 🟥 Update tooltip to show shortcut

---

## Button States

| State    | Appearance  | When            |
| -------- | ----------- | --------------- |
| Normal   | Default     | Ready to insert |
| Hover    | Highlighted | Mouse over      |
| Active   | Pressed     | During click    |
| Disabled | Grayed      | Read-only mode  |

#### Steps

- [ ] 🟥 Style all button states
- [ ] 🟥 Disable when editor is read-only

---

## Accessibility

- Button has `aria-label="Insert image"`
- Keyboard navigable (Tab through toolbar)
- Visible focus state

#### Steps

- [ ] 🟥 Add aria-label
- [ ] 🟥 Ensure keyboard navigation works
- [ ] 🟥 Add focus styles

---

## Divider Placement

Current toolbar uses `|` dividers to group related items. The image button goes in a new "media" group:

```
[Link] | [🖼] | [↩] [↪]
       ^     ^
    dividers
```

Or combine with Link in "insert" group:

```
[Link] [🖼] | [↩] [↪]
```

User specified "between horizontal rule and undo/redo", so:

```
[—] | [Link] [🖼] | [↩] [↪]
```

#### Steps

- [ ] 🟥 Position button correctly in toolbar
- [ ] 🟥 Add appropriate dividers

---

## Testing Checklist

- [ ] Image button visible in toolbar
- [ ] Button positioned between HR and undo/redo
- [ ] Click opens file picker
- [ ] Keyboard shortcut works
- [ ] Button disabled in read-only mode
- [ ] Tooltip shows shortcut
- [ ] Button accessible via keyboard
- [ ] CI passes
