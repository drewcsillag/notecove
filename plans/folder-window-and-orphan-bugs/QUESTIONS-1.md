# Questions - Folder Window and Orphan Bugs

## Understanding Confirmed

Based on my analysis, I've confirmed the following:

### Issue 1: Folder Selection Affecting All Windows

**Root Cause**: When a folder is selected in `FolderPanel.tsx` (line 126), it calls `window.electronAPI.folder.emitSelected(folderId)` which broadcasts to ALL windows via `broadcastToAll('folder:selected', folderId)` in `folder-handlers.ts`.

The `NotesListPanel` listens for this event (line 776) and reacts by clearing search state. However, the actual folder selection state and note list fetching appear to be per-window (each window maintains its own `selectedFolderId` state).

**Question 1**: I traced the code and the `folder:selected` event seems to only clear the search in other windows, but shouldn't change the folder selection itself in other windows. Can you clarify what specific behavior you're seeing?

Possibilities:

- a) When you select a folder in Window A, the notes list in Window B changes to show notes from that folder
- b) When you select a folder in Window A, the search box clears in Window B but the folder/notes stay the same
- c) Something else (please describe)

a and b

### Issue 2: Orphaned Subfolders

**Root Cause Confirmed**: When deleting a parent folder:

1. Only the parent folder is marked `deleted: true`
2. Child folders retain `deleted: false` with their `parentId` pointing to the deleted parent
3. `getActiveFolders()` returns all folders where `!deleted`, so orphaned children appear
4. These orphans show up in "Move to..." dialog (and likely other places that list folders)

**Question 2**: For the orphan problem, which fix approach do you prefer?

- **Option A (Cascade Delete)**: When deleting a parent folder, also recursively mark all descendants as deleted. This is simpler but means if you "undelete" the parent (which isn't currently implemented), the children wouldn't automatically come back.

- **Option B (Filter by Ancestry)**: Modify `getActiveFolders()` to also exclude folders whose parent (or any ancestor) is deleted. This preserves the children in the database but hides them from UI. They could theoretically be "adopted" by moving them to a new parent before or after deletion.

- **Option C (Both)**: Do cascading delete AND filter by ancestry for robustness.

I'd want delete to, in the case that there are subfolders ask: do you want to delete this folder and all its children, or delete this folder and have the children move to its parent. Or would users understand this?

**Question 3**: When a parent folder is deleted, what should happen to notes inside it and its child folders?

Current behavior: Notes remain in the database with their `folderId` intact (pointing to a deleted folder), so they become invisible in folder-filtered views but may still appear in "All Notes".

Options:

- **A**: Move notes to root (null folderId) when their folder is deleted
- **B**: Delete the notes when their folder is deleted (seems destructive)
- **C**: Leave as-is (notes stay associated with deleted folder) - they show in "All Notes" but not in folder views
- **D**: Move notes to the parent folder of the deleted folder (if exists, else root)

D

## No Other Blocking Questions

The implementation approach is clear once you answer the above. I'm ready to proceed with the plan after your responses.
