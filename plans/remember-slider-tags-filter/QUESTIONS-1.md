# Questions - Remember Slider & Tags Features

## Feature Summary

Three related features for the tags panel:

1. **Persist slider position** - Remember the vertical slider position between Folders and Tags panels
2. **Clear tags button** - Add a button to clear all selected tag filters
3. **Tag search box** - Add a search/filter box to filter visible tags

---

## Questions

### 1. Clear Tags Button

**Observation**: There's already a clear button that appears when filters are active (line 121-130 in TagPanel.tsx). It shows an X icon next to the filter count badge.

**Question**: Is the existing clear button sufficient, or do you want an **always-visible** clear button (even when no filters are active)? The current behavior is:

- Badge shows count of active filters
- Clear (X) button only appears when count > 0

Ah, never mind then regarding adding the button then

### 2. Tag Search Box Location

The header currently has:

- Tag icon + "Tags" label (left)
- Filter count badge + Clear button (right)

**Question**: Where should the search box go?

- **Option A**: Below the header, as a separate row (similar to the search box in NotesListPanel)
- **Option B**: Inline in the header, replacing/next to the "Tags" label
- **Option C**: Collapsible - click a search icon to expand the search box

B next to the Tags label

### 3. Tag Search Behavior

**Question**: When typing in the search box, should it:

- **Option A**: Filter the visible tags only (hide non-matching tags from view)
- **Option B**: Auto-select matching tags as "include" filters
- **Option C**: Combination - filter visible AND provide a keyboard shortcut to select all visible

A

### 4. Slider Persistence Scope

The vertical slider between Folders and Tags uses `react-resizable-panels` with `PanelGroup`. This library supports built-in persistence via `autoSaveId` prop which saves to localStorage.

**Question**: Should we:

- **Option A**: Use the library's built-in `autoSaveId` localStorage persistence (simpler, immediate)
- **Option B**: Use our existing `appState` database persistence (consistent with other settings like panel sizes and theme)

Note: The main 3-panel layout (left/middle/right) uses `appState` persistence, not `autoSaveId`.

Use what we use for the other sliders that we persist positions for (the one between folders and note list, and between notelist and note editor)
That sounds like option B, but correct me if I'm wrong

### 5. Search Box Persistence

**Question**: Should the tag search query be persisted across app restarts?

- **Yes**: Like the main notes search query (persisted via appState)
- **No**: Clear on restart (most search boxes don't persist)

## No

## Implementation Notes

### Already Available

- `AppStateKey.TagFilters` is defined but not yet used for persistence
- Clear filters functionality already exists (just conditionally shown)
- Tag panel header structure supports adding elements

### Requires Implementation

- Slider position persistence (either autoSaveId or appState)
- Search TextField in header
- Tag list filtering logic based on search
