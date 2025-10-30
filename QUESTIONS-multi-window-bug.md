# Multi-Window Folder Selection Bug

## Issue
Bug reported: "When having two windows open in the same instance, switching folders in one window will change the notes list in both windows."

## Root Cause Analysis
The folder selection state is stored in `appState` (persisted storage via SQLite) which is shared across all windows of the same Electron app instance.

When Window 1 selects a folder:
1. FolderPanel in Window 1 calls `window.electronAPI.appState.set('selectedFolderId', folderId)`
2. NotesListPanel in Window 1 reads from `appState.get('selectedFolderId')` on mount
3. Window 2's NotesListPanel ALSO reads from the same `appState.get('selectedFolderId')`
4. Both windows end up showing notes from the same folder

## Solution Approach
The folder selection state needs to be:
1. Maintained independently per window (in React state, not appState)
2. Only persisted to appState on window close (for next app launch)
3. Only loaded from appState on initial window creation

## Implementation Strategy
1. Lift `selectedFolderId` state from FolderPanel and NotesListPanel to App.tsx
2. Pass selectedFolderId as prop to both panels (controlled component pattern)
3. Remove immediate appState.set() calls in FolderPanel.handleFolderSelect()
4. Add beforeunload event handler in FolderPanel to save to appState only when window closes
5. Update NotesListPanel to accept selectedFolderId as prop instead of loading from appState

## Files to Modify
- `packages/desktop/src/renderer/src/App.tsx` - Add selectedFolderId state, pass to both panels
- `packages/desktop/src/renderer/src/components/FolderPanel/FolderPanel.tsx` - Convert to controlled component
- `packages/desktop/src/renderer/src/components/NotesListPanel/NotesListPanel.tsx` - Accept selectedFolderId prop
- Add E2E test: `packages/desktop/e2e/multi-window-folder-selection.spec.ts`

## Notes
- This is a non-trivial refactoring requiring changes across multiple components
- All existing unit tests will need to be updated to pass the new required props
- The multi-window bug is not blocking Phase 2.5.5 core deliverable (restore functionality)
- Defer this fix to a future phase or dedicated bug-fix session
