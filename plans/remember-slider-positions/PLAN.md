# Feature Implementation Plan: Remember Slider Positions

**Overall Progress:** `100%`

## Summary

This feature remembers all slider/panel positions and toggle states across application restarts:

1. Main panel sizes (folder/tags | notes list | editor)
2. Left sidebar sizes (folder | tags)
3. Folder panel visibility toggle
4. Tags panel visibility toggle
5. Note scroll positions (per-note)

## Tasks

### 1. Fix Slider Position Persistence (Bug Fix)

- [x] 🟩 **Identified root cause**: `defaultSize` in react-resizable-panels only applies at mount time
- [x] 🟩 **Added loading gate**: `panelSizesLoaded` state prevents layout render until sizes are loaded
- [x] 🟩 **Merged panel loading into single effect**: Loads both panel sizes in parallel before rendering
- [x] 🟩 **Updated tests**: Fixed tests to wait for panel sizes to load

### 2. Implement Toggle Folder Panel

- [x] 🟩 **Added `showFolderPanel` state** in App.tsx
- [x] 🟩 **Updated toggle handler** for `onToggleFolderPanel` menu event
- [x] 🟩 **Extended LeftSidebar component** with `showFolderPanel` prop
- [x] 🟩 **Updated LeftSidebar tests** with new test cases for all visibility combinations

### 3. Persist Panel Toggle States

- [x] 🟩 **Added AppStateKey values**: `ShowFolderPanel`, `ShowTagPanel`
- [x] 🟩 **Load toggle states on mount** (alongside panel sizes)
- [x] 🟩 **Save toggle states on change** (with loading guard to prevent initial save)

### 4. Add Note Scroll Position Persistence

- [x] 🟩 **Added AppStateKey**: `NoteScrollPositions` for storing scroll positions per-note
- [x] 🟩 **Created useNoteScrollPosition hook**: Manages per-note scroll positions with debounced saves
- [x] 🟩 **Integrated into TipTapEditor**: Reports scroll changes and restores on note load
- [x] 🟩 **Falls back gracefully**: Uses window state first, then per-note storage

## Files Changed

### Shared Package

- `packages/shared/src/database/schema.ts` - Added new AppStateKey values

### Desktop Package

- `packages/desktop/src/renderer/src/App.tsx` - Panel size loading gate, toggle states
- `packages/desktop/src/renderer/src/components/LeftSidebar/LeftSidebar.tsx` - showFolderPanel prop
- `packages/desktop/src/renderer/src/components/LeftSidebar/__tests__/LeftSidebar.test.tsx` - Updated tests
- `packages/desktop/src/renderer/src/components/EditorPanel/TipTapEditor.tsx` - Note scroll position integration
- `packages/desktop/src/renderer/src/hooks/useNoteScrollPosition.ts` - New hook for per-note scroll positions
- `packages/desktop/src/renderer/src/__tests__/App.test.tsx` - Updated tests

## Related Files (for reference)

- `plans/remember-slider-positions/QUESTIONS-1.md` - Initial questions and answers

## Bug Fixes Included

- Resolved merge conflict in `packages/desktop/src/renderer/src/components/TagPanel/TagPanel.tsx`
