# Note Info Window - Implementation Plan

**Overall Progress:** `100%` ✅

## Summary

Convert the Note Info dialog into a dedicated window that:

- Opens as its own window (one per note, multiple allowed)
- Is a child window (closes when parent closes)
- Shows all information inline (no accordion)
- Fixes data issues (CRDT count from vector clock sum, remove pack count)
- Persists window position/size
- Can be opened from context menu

## Questions Reference

- [QUESTIONS-1.md](./QUESTIONS-1.md) - Initial clarifications
- [QUESTIONS-PLAN-1.md](./QUESTIONS-PLAN-1.md) - Plan review questions

## Risks Identified

1. **Child window behavior** - Verify Electron `parent` option closes children on parent close
2. **Window state key collision** - Need unique key format for noteInfo windows vs minimal windows
3. **No focused window** - Need fallback when `openNoteInfo` called without focused window

---

## Tasks

### Step 1: Fix Data Layer (TDD)

- [x] 🟩 **1.1** Write failing tests for `handleGetNoteInfo` changes:
  - Test: `crdtUpdateCount` equals sum of vector clock sequences
  - Test: `packCount` field is removed from response
  - Test: `fullFolderPath` includes SD name prefix
- [x] 🟩 **1.2** Implement `handleGetNoteInfo` changes to pass tests:
  - Remove `packCount` from return type
  - Change `crdtUpdateCount` to sum of vector clock sequences
  - Add `fullFolderPath` field (SD name + folder hierarchy)
- [x] 🟩 **1.3** Update TypeScript types in `electron.d.ts`, `preload/index.ts`, and `NoteInfoDialog.tsx`

### Step 2: Window Creation IPC (TDD)

- [x] 🟩 **2.1** Write failing tests for `window:openNoteInfo` IPC handler:
  - Test: Creates new window with correct parameters
  - Test: Window has parent set (child window behavior)
  - Test: Multiple calls create multiple windows
  - Test: Returns error if no focused window (requires focused window)
  - Test: Returns error if note doesn't exist
- [x] 🟩 **2.2** Add `noteInfo` window type to `createWindow()` options in `main/index.ts`
- [x] 🟩 **2.3** Implement IPC handler `window:openNoteInfo(noteId)`:
  - Creates new BrowserWindow with `noteInfo: true, targetNoteId`
  - Sets parent window (child window behavior)
  - Default size ~900x600
  - Window title: "Note Info - {note title}"
  - Requires focused window (return error otherwise)
  - Validate note exists (return error otherwise)
- [x] 🟩 **2.4** Register `noteInfo` window type with WindowStateManager for position persistence
- [x] 🟩 **2.5** Add preload API: `window.electronAPI.window.openNoteInfo(noteId)`

### Step 3: Note Info Window Component (TDD)

- [x] 🟩 **3.1** Write failing tests for NoteInfoWindow component:
  - Test: Renders all info sections inline (no accordion)
  - Test: Shows full folder path with SD name prefix
  - Test: Does not render Pack Count row
  - Test: Shows CRDT Update Count (from data)
- [x] 🟩 **3.2** Create `NoteInfoWindow.tsx` - standalone page component (not dialog)
- [x] 🟩 **3.3** Add URL parameter parsing for `noteInfo=true` and `targetNoteId`
- [x] 🟩 **3.4** Add conditional render in `App.tsx` for `noteInfo` window type

### Step 4: Update Menu and Shortcuts

- [x] 🟩 **4.1** Modify `Tools > Note Info` menu item to call `window:openNoteInfo` IPC
- [x] 🟩 **4.2** Ensure Cmd+Shift+I triggers the new window (not old dialog)

### Step 5: Add Context Menu Option

- [x] 🟩 **5.1** Add "Note Info" option to note context menu in sidebar
- [x] 🟩 **5.2** Wire context menu to `window:openNoteInfo(noteId)`

### Step 6: Cleanup

- [x] 🟩 **6.1** Remove old `NoteInfoDialog` component
- [x] 🟩 **6.2** Remove dialog-related state from `App.tsx`
- [x] 🟩 **6.3** Remove old `menu:noteInfo` IPC event handling (kept event, changed handler to use window API)
- [x] 🟩 **6.4** Update any remaining references

### Step 7: E2E Tests

- [x] 🟩 **7.1** Write E2E test: Open Note Info window from menu
- [x] 🟩 **7.2** Write E2E test: Note Info displays correct data
- [x] 🟩 **7.3** Write E2E test: Window closes when parent closes (tested via child window behavior)

### Step 8: Final Verification

- [x] 🟩 **8.1** Run full CI suite
- [x] 🟩 **8.2** Manual test: Open Note Info from context menu
- [x] 🟩 **8.3** Manual test: Multiple Note Info windows (different notes)
- [x] 🟩 **8.4** Manual test: Window position persists across restarts
- [x] 🟩 **8.5** Manual test: Toast error when no note selected

---

## Technical Notes

### Window Creation Pattern

Follow the existing `syncStatus` window pattern but allow multiple instances:

```typescript
createWindow({
  noteInfo: true,
  targetNoteId: noteId,
  bounds: savedBounds, // from WindowStateManager
});
```

### Child Window Behavior

Use Electron's `parent` option:

```typescript
const newWindow = new BrowserWindow({
  parent: focusedWindow,
  // ... other options
});
```

### CRDT Update Count Fix

```typescript
// Current (wrong): counts log files
const crdtUpdateCount = logs.length;

// Fixed: sum of vector clock sequences
const crdtUpdateCount = Object.values(vectorClock).reduce((sum, entry) => sum + entry.sequence, 0);
```

### Full Folder Path

```typescript
// Current: "Folder A / Subfolder B"
// New: "My SD Name / Folder A / Subfolder B"
const fullFolderPath = sdName + (folderPath ? ' / ' + folderPath : '');
```

### Error Handling

Show toast notification when:

- No note is selected
- Note doesn't exist / was deleted
- No focused window available

Use existing toast/snackbar system in the app.
