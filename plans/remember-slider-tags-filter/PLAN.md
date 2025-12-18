# Feature Implementation Plan: Remember Slider & Tags Filter

**Overall Progress:** `100%`

**Critique:** [CRITIQUE.md](./CRITIQUE.md)

## Summary

Two features:

1. Persist the vertical slider position between Folders and Tags panels (using appState, like the main 3-panel layout)
2. Add inline search box next to "Tags" label to filter visible tags

---

## Tasks

### Feature 1: Slider Position Persistence

- [x] 🟩 **Step 1.1: Add AppStateKey for left sidebar panel sizes**
  - Add `LeftSidebarPanelSizes` to `AppStateKey` enum in schema.ts
  - Format: `[folderPercent, tagPercent]` as JSON string

- [x] 🟩 **Step 1.2: Write tests for slider persistence**
  - Test that LeftSidebar loads saved sizes on mount
  - Test that LeftSidebar saves sizes when panels are resized
  - Test graceful handling of missing/invalid saved state

- [x] 🟩 **Step 1.3: Update LeftSidebar to persist panel sizes**
  - Add props for `initialSizes` and `onLayoutChange`
  - Use `onLayout` callback from PanelGroup to detect size changes
  - Save sizes via `window.electronAPI.appState.set()`

- [x] 🟩 **Step 1.4: Update App.tsx to load/save left sidebar sizes**
  - Load saved sizes on mount (like existing panel sizes)
  - Pass sizes and change handler to LeftSidebar

### Feature 2: Tag Search Box

- [x] 🟩 **Step 2.1: Write tests for tag filtering**
  - Test that search input filters visible tags
  - Test case-insensitive matching
  - Test empty search shows all tags
  - Test search clears on mount (no persistence)

- [x] 🟩 **Step 2.2: Add search state to TagPanel**
  - Add `searchQuery` state (local, not persisted)
  - Filter `tags` array before rendering based on search

- [x] 🟩 **Step 2.3: Add search TextField to header**
  - Position inline next to "Tags" label
  - Use compact styling (`size="small"`, flexible width with flex-shrink)
  - Add search icon as InputAdornment
  - Add clear button when text present

- [x] 🟩 **Step 2.4: Style and polish**
  - Ensure search box fits well in header
  - Handle edge cases (no matching tags message)
  - Verified styling in tests

---

## Non-Goals (per user feedback)

- ~~Always-visible clear button~~ - existing conditional behavior is sufficient
- ~~Search query persistence~~ - search clears on restart

---

## Dependencies

- `@notecove/shared` schema.ts (for AppStateKey)
- LeftSidebar.tsx, TagPanel.tsx components
- App.tsx for state coordination

## Testing Strategy

- Unit tests for TagPanel filtering logic
- Integration tests for LeftSidebar persistence
- Manual verification of UI appearance
