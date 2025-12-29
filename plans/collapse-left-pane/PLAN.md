# Feature: Collapse Left Pane & Toggle Notes List

**Overall Progress:** `85%`

## Summary

When both folder panel and tags panel are hidden, automatically collapse the entire left pane to zero width. Add "Toggle Notes List" option to collapse the middle pane. Move SyncStatusIndicator to a new bottom statusbar.

**Note:** ExpandStrip feature was removed due to layout bugs with react-resizable-panels. Panels can only be restored via keyboard shortcuts (Cmd+Shift+1/2/0) or View menu.

## Requirements Summary

| Requirement             | Detail                                                 |
| ----------------------- | ------------------------------------------------------ |
| Left pane auto-collapse | When `showFolderPanel=false` AND `showTagPanel=false`  |
| Left pane auto-restore  | When either panel toggled visible while pane collapsed |
| ~~Expand strip~~        | ~~Removed - caused layout bugs with resize handles~~   |
| Middle pane toggle      | `Cmd+Shift+0` to toggle notes list                     |
| Menu checkmarks         | Show ✓ when panels are visible (DEFERRED)              |
| Bottom statusbar        | New component, contains SyncStatusIndicator            |
| State persistence       | All collapse states persist across restarts            |

## Links

- [QUESTIONS-1.md](./QUESTIONS-1.md) - Initial questions and answers
- [QUESTIONS-2.md](./QUESTIONS-2.md) - Follow-up questions and answers
- [QUESTIONS-PLAN-1.md](./QUESTIONS-PLAN-1.md) - Plan critique questions

---

## Tasks

### Step 1: Bottom Statusbar Component

> Move SyncStatusIndicator out of LeftSidebar into a new window-wide statusbar

- [x] 🟩 **1.1** Write tests for BottomStatusbar component
  - Renders at bottom of window
  - Contains SyncStatusIndicator
  - Has proper styling (border-top, background)
  - Future-ready layout (flexbox with sections)

- [x] 🟩 **1.2** Create BottomStatusbar component
  - Location: `src/renderer/src/components/Layout/BottomStatusbar.tsx`
  - Full window width, fixed at bottom
  - Left section for sync indicator
  - Right section reserved for future items

- [x] 🟩 **1.3** Integrate BottomStatusbar into App layout
  - Add below ThreePanelLayout
  - Remove SyncStatusIndicator from LeftSidebar

- [ ] 🟨 **1.4** Manual verification
  - Sync indicator visible at bottom
  - Works in light/dark mode

---

### Step 2: Expand Strip Component

> Reusable thin strip shown when a pane is collapsed

- [x] 🟩 **2.1** Write tests for ExpandStrip component
  - Renders with correct width (~8-12px)
  - Has visible background difference
  - Shows chevron icon on hover
  - Calls onClick when clicked
  - Supports drag behavior (onDragStart, onDrag)
  - Is keyboard focusable (Tab navigation)
  - Has proper aria-label

- [x] 🟩 **2.2** Create ExpandStrip component
  - Location: `src/renderer/src/components/Layout/ExpandStrip.tsx`
  - Props: `position: 'left' | 'right'`, `onClick`, `onDrag`, `visible`, `ariaLabel`
  - Styling: subtle background, hover state, cursor
  - Accessibility: `tabIndex={0}`, `role="button"`, `aria-label`
  - Keyboard: Enter/Space triggers onClick

- [ ] 🟨 **2.3** Manual verification
  - Strip appears correctly
  - Hover shows chevron
  - Click and drag work

---

### Step 3: Left Pane Collapse Logic

> Auto-collapse when both panels hidden, auto-restore when either shown

- [x] 🟩 **3.1** Write tests for left pane collapse behavior
  - When `showFolderPanel=false` AND `showTagPanel=false` → left pane width = 0
  - When either toggled true while collapsed → restore to previous width
  - Expand strip visible when collapsed
  - Click on strip restores pane

- [x] 🟩 **3.2** Add `leftPaneCollapsed` derived state and panel memory
  - In App.tsx or ThreePanelLayout
  - Derived from `showFolderPanel` and `showTagPanel`
  - Track `lastVisibleLeftPanels: {folder: boolean, tags: boolean}` - remembers what was visible before collapse
  - Update memory when panels are hidden (before collapse triggers)

- [x] 🟩 **3.3** Update ThreePanelLayout to handle collapse
  - Accept `leftPaneCollapsed` prop
  - When collapsed: set left panel size to 0, show ExpandStrip
  - Use react-resizable-panels imperative API (`collapse()`/`expand()`)

- [x] 🟩 **3.4** Wire up expand strip click/drag
  - Click: restore `lastVisibleLeftPanels` state (whatever was visible before)
  - Drag: allow custom sizing
  - aria-label: "Expand left panel"

- [ ] 🟨 **3.5** Manual verification
  - Toggle both panels off → left pane collapses
  - Click strip → pane restores with previously visible panels
  - Drag strip → custom sizing works
  - Test: hide tags only, then hide folders → restore shows both

---

### Step 4: Middle Pane Toggle & Menu Checkmarks

> Add "Toggle Notes List" to View menu with Cmd+Shift+0, add checkmarks to all panel toggles

- [x] 🟩 **4.1** Add `showNotesListPanel` state and AppStateKey
  - Add `ShowNotesListPanel` to AppStateKey enum in schema.ts
  - In App.tsx: add state, default: true
  - Persist to appState

- [x] 🟩 **4.2** Add menu item and IPC handler
  - In `menu.ts`: Add "Toggle Notes List" with `Cmd+Shift+0`
  - In preload: Add `onToggleNotesListPanel` listener
  - In App.tsx: Handle toggle event

- [ ] 🟨 **4.3** Add checkmarks to View menu panel toggles (DEFERRED)
  - Update menu.ts to receive panel visibility state
  - Add `checked: true/false` to Toggle Folder Panel, Toggle Tags Panel, Toggle Notes List
  - Update menu when panel state changes (IPC from renderer to main)
  - Note: Requires bidirectional IPC - deferred to future enhancement

- [x] 🟩 **4.4** Update ThreePanelLayout for middle pane collapse
  - Accept `middlePaneCollapsed` prop
  - When collapsed: set middle panel size to 0, show ExpandStrip
  - Use react-resizable-panels imperative API

- [x] 🟩 **4.5** Wire up middle pane expand strip
  - Click: restore previous size, set `showNotesListPanel=true`
  - Drag: allow custom sizing
  - aria-label: "Expand notes list"

- [ ] 🟨 **4.6** Manual verification
  - Cmd+Shift+0 toggles notes list
  - Strip appears when collapsed
  - Click/drag restore works

---

### Step 5: First-Collapse Tooltip

> Show tooltip with hotkeys on first collapse, once ever

- [x] 🟩 **5.1** Add tooltip state and persistence
  - `hasSeenLeftPaneTooltip` in appState
  - `hasSeenMiddlePaneTooltip` in appState

- [x] 🟩 **5.2** Implement tooltip on ExpandStrip
  - Show MUI Tooltip on first collapse
  - Platform-aware: Use "Cmd" on macOS, "Ctrl" on Windows/Linux
  - Content (macOS): "Press Cmd+Shift+1 to show Folders, Cmd+Shift+2 to show Tags, or click this strip"
  - Content (Windows): "Press Ctrl+Shift+1 to show Folders, Ctrl+Shift+2 to show Tags, or click this strip"
  - For middle: "Press Cmd/Ctrl+Shift+0 to show Notes List, or click this strip"
  - Auto-dismiss after ~5 seconds or on interaction
  - Mark as seen after shown

- [ ] 🟨 **5.3** Manual verification
  - First collapse shows tooltip
  - Subsequent collapses don't show tooltip
  - Tooltip dismisses properly

---

### Step 6: State Persistence

> Ensure all collapse states persist across restarts

- [x] 🟩 **6.1** Add AppStateKeys for new state
  - `ShowNotesListPanel` (moved to Step 4.1, already added)
  - `HasSeenLeftPaneTooltip` (will be used in Step 5)
  - `HasSeenMiddlePaneTooltip` (will be used in Step 5)
  - `LastVisibleLeftPanels` (JSON: `{folder: boolean, tags: boolean}`)

- [x] 🟩 **6.2** Wire up persistence in App.tsx
  - Load states on mount (showNotesListPanel, lastVisibleLeftPanels)
  - Save states on change
  - Panel sizes already persisted via existing `PanelSizes` key

- [ ] 🟨 **6.3** Manual verification
  - Collapse panes, restart app
  - Panes remain collapsed
  - Click expand strip, restart app
  - Correct panels are visible
  - Tooltip doesn't reappear after first time

---

### Step 7: Final Testing & Cleanup

- [x] 🟩 **7.1** Run full test suite (24 Layout tests pass)
- [x] 🟩 **7.2** Fix resize bug: Dynamic middleMaxSize when left pane collapsed
  - When left pane is collapsed, reduce middle panel's maxSize by leftSize
  - Prevents notes list from expanding into space freed by collapsed left panel
- [ ] 🟨 **7.3** Code review
- [ ] 🟨 **7.4** Manual verification of all features
- [ ] 🟨 **7.5** Update documentation if needed

---

## Technical Notes

### Component Structure

```
App.tsx
├── ThreePanelLayout
│   ├── LeftSidebar (collapsible)
│   ├── ResizeHandle (hidden when left collapsed)
│   ├── NotesListPanel (collapsible)
│   ├── ResizeHandle (hidden when middle collapsed)
│   └── EditorPanel
└── BottomStatusbar
    └── SyncStatusIndicator
```

Note: ExpandStrip component exists but is not currently used in ThreePanelLayout due to layout bugs.

### State Flow

```
showFolderPanel ─┬─► leftPaneCollapsed ─► ThreePanelLayout
showTagPanel ────┘         │
                           ▼
              lastVisibleLeftPanels ◄─► persistence
              {folder: bool, tags: bool}

showNotesListPanel ─► middlePaneCollapsed ─► ThreePanelLayout
```

### Panel Restore Logic

```
On hotkey press (Cmd+Shift+1 or Cmd+Shift+2):
1. Toggle the corresponding panel (folder or tags)
2. If panel becomes visible, left pane auto-expands
3. If both panels become hidden, left pane auto-collapses
```

### Dynamic Middle Panel Max Size

```
When left pane is collapsed:
- middleMaxSize = 50 - leftSize (typically 25%)
- This prevents notes list from expanding into the freed space
- Ensures resize handle stops at the same absolute position
```

### Hotkeys

| Key         | Action                  |
| ----------- | ----------------------- |
| Cmd+Shift+1 | Toggle Folder Panel     |
| Cmd+Shift+2 | Toggle Tags Panel       |
| Cmd+Shift+0 | Toggle Notes List Panel |
