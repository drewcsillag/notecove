# Questions: Folder Drag to Subfolder

## Current State

Based on my codebase exploration, **folder drag-to-subfolder already appears to be implemented**:

- Schema has `parent_id` for hierarchy
- `folder.move(sdId, folderId, newParentId)` IPC handler exists
- `FolderTree.tsx` handleDrop calls move when dropping on a different parent
- E2E tests in `folder-bugs.spec.ts` verify dragging folders to different parents works

The library (`@minoru/react-dnd-treeview`) distinguishes:

- Drop **on** a folder → move INTO it (become child)
- Drop **between** folders → reorder among siblings

## Questions

1. **What specific issue are you experiencing?** Is there a bug, or is this a UX concern about how the feature works?

I try to drag a folder to be a subfolder of another, and I can reorder it so it's below the target folder, but can't seem to find the target to make it become a subfolder

2. **Can you describe an example scenario?** What do you try to do, what happens, and what did you expect?

I clock on a folder and drag it over the target folder, but when I drop, it just drops it to order after the target rather than as subfolder
