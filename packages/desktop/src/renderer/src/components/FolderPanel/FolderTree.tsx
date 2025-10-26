/**
 * FolderTree Component
 *
 * Displays the hierarchical folder structure using MUI RichTreeView.
 * Phase 2.4.1: Read-only display with selection and expand/collapse.
 */

import { type FC, forwardRef, useEffect, useState, useRef, type MouseEvent, type DragEvent } from 'react';
import {
  Box,
  Typography,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
} from '@mui/material';
import { RichTreeView } from '@mui/x-tree-view/RichTreeView';
import { TreeViewBaseItem } from '@mui/x-tree-view/models';
import { TreeItem, TreeItemProps } from '@mui/x-tree-view/TreeItem';

interface FolderData {
  id: string;
  name: string;
  parentId: string | null;
  sdId: string;
  order: number;
  deleted: boolean;
}

export interface FolderTreeProps {
  sdId: string;
  selectedFolderId?: string | null;
  expandedFolderIds?: string[];
  onFolderSelect?: (folderId: string | null) => void;
  onExpandedChange?: (expandedIds: string[]) => void;
  refreshTrigger?: number; // Change this number to force reload
  onRefresh?: () => void; // Callback to trigger refresh
}

/**
 * Transform flat folder list into tree structure for MUI TreeView
 */
function buildTreeItems(folders: FolderData[]): TreeViewBaseItem[] {
  // Create special UI-only items
  const allNotesItem: TreeViewBaseItem = {
    id: 'all-notes',
    label: 'All Notes',
  };

  const recentlyDeletedItem: TreeViewBaseItem = {
    id: 'recently-deleted',
    label: 'Recently Deleted',
  };

  // Build tree from user folders
  const folderMap = new Map<string, TreeViewBaseItem>();
  const rootFolders: TreeViewBaseItem[] = [];

  // First pass: create all folder items
  for (const folder of folders) {
    folderMap.set(folder.id, {
      id: folder.id,
      label: folder.name,
      children: [],
    });
  }

  // Second pass: build hierarchy
  for (const folder of folders) {
    const item = folderMap.get(folder.id);
    if (!item) continue;

    if (folder.parentId === null) {
      // Root level folder
      rootFolders.push(item);
    } else {
      // Child folder - add to parent's children
      const parent = folderMap.get(folder.parentId);
      if (parent) {
        if (!parent.children) {
          parent.children = [];
        }
        parent.children.push(item);
      }
    }
  }

  // Sort folders by order (within each level)
  const sortByOrder = (items: TreeViewBaseItem[]): void => {
    items.sort((a, b) => {
      const folderA = folders.find((f) => f.id === a.id);
      const folderB = folders.find((f) => f.id === b.id);
      return (folderA?.order ?? 0) - (folderB?.order ?? 0);
    });

    // Recursively sort children
    for (const item of items) {
      if (item.children && item.children.length > 0) {
        sortByOrder(item.children);
      }
    }
  };

  sortByOrder(rootFolders);

  // Combine: All Notes, user folders, Recently Deleted
  return [allNotesItem, ...rootFolders, recentlyDeletedItem];
}

/**
 * Custom TreeItem component with context menu and drag & drop support
 */
interface CustomTreeItemProps extends TreeItemProps {
  onItemContextMenu?: (event: MouseEvent<HTMLElement>, itemId: string) => void;
  onItemDragStart?: (event: DragEvent<HTMLLIElement>, itemId: string) => void;
  onItemDragOver?: (event: DragEvent<HTMLLIElement>, itemId: string) => void;
  onItemDragLeave?: (event: DragEvent<HTMLLIElement>, itemId: string) => void;
  onItemDrop?: (event: DragEvent<HTMLLIElement>, itemId: string) => void;
  onItemDragEnd?: (event: DragEvent<HTMLLIElement>, itemId: string) => void;
  draggedOverFolderId?: string | null;
}

const CustomTreeItem = forwardRef<HTMLLIElement, CustomTreeItemProps>((props, ref) => {
  const {
    onItemContextMenu,
    onItemDragStart,
    onItemDragOver,
    onItemDragLeave,
    onItemDrop,
    onItemDragEnd,
    draggedOverFolderId,
    itemId,
    ...other
  } = props;

  // Compute derived values
  const isDraggedOver = draggedOverFolderId === itemId;
  const isDraggable = itemId !== 'all-notes' && itemId !== 'recently-deleted';

  const handleContextMenu = (event: MouseEvent<HTMLLIElement>) => {
    if (onItemContextMenu && itemId) {
      event.stopPropagation(); // Prevent event bubbling to parent items
      onItemContextMenu(event, itemId);
    }
  };

  const handleDragStart = (event: DragEvent<HTMLLIElement>) => {
    if (onItemDragStart && itemId) {
      event.stopPropagation(); // Prevent event bubbling to parent items
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', itemId);
      onItemDragStart(event, itemId);
    }
  };

  const handleDragOver = (event: DragEvent<HTMLLIElement>) => {
    if (onItemDragOver && itemId) {
      event.preventDefault(); // Allow drop
      event.stopPropagation(); // Prevent event bubbling to parent items
      event.dataTransfer.dropEffect = 'move';
      onItemDragOver(event, itemId);
    }
  };

  const handleDragLeave = (event: DragEvent<HTMLLIElement>) => {
    if (onItemDragLeave && itemId) {
      event.stopPropagation(); // Prevent event bubbling to parent items
      onItemDragLeave(event, itemId);
    }
  };

  const handleDrop = (event: DragEvent<HTMLLIElement>) => {
    if (onItemDrop && itemId) {
      event.preventDefault();
      event.stopPropagation(); // Prevent event bubbling to parent items
      onItemDrop(event, itemId);
    }
  };

  const handleDragEnd = (event: DragEvent<HTMLLIElement>) => {
    if (onItemDragEnd && itemId) {
      onItemDragEnd(event, itemId);
    }
  };

  return (
    <TreeItem
      ref={ref}
      itemId={itemId}
      onContextMenu={handleContextMenu}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onDragEnd={handleDragEnd}
      slotProps={{
        root: {
          draggable: isDraggable,
        },
      }}
      sx={{
        ...(isDraggedOver && {
          backgroundColor: 'action.hover',
          borderLeft: 3,
          borderColor: 'primary.main',
        }),
      }}
      {...other}
    />
  );
});

CustomTreeItem.displayName = 'CustomTreeItem';

export const FolderTree: FC<FolderTreeProps> = ({
  sdId,
  selectedFolderId,
  expandedFolderIds = [],
  onFolderSelect,
  onExpandedChange,
  refreshTrigger = 0,
  onRefresh,
}) => {
  const [folders, setFolders] = useState<FolderData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    anchorEl: HTMLElement;
    folderId: string;
  } | null>(null);

  // Rename dialog state
  const [renameDialog, setRenameDialog] = useState<{
    open: boolean;
    folderId: string;
    currentName: string;
    newName: string;
    error: string | null;
  }>({
    open: false,
    folderId: '',
    currentName: '',
    newName: '',
    error: null,
  });

  // Delete confirmation dialog state
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    folderId: string;
    folderName: string;
  }>({
    open: false,
    folderId: '',
    folderName: '',
  });

  // Drag & drop state
  const [draggedFolderId, setDraggedFolderId] = useState<string | null>(null);
  const [draggedOverFolderId, setDraggedOverFolderId] = useState<string | null>(null);
  const dropHandledRef = useRef(false); // Synchronous flag for drop handling

  useEffect(() => {
    const loadFolders = async (): Promise<void> => {
      try {
        setLoading(true);
        setError(null);
        const folderList = await window.electronAPI.folder.list(sdId);
        setFolders(folderList);
      } catch (err) {
        console.error('Failed to load folders:', err);
        setError(err instanceof Error ? err.message : 'Failed to load folders');
      } finally {
        setLoading(false);
      }
    };

    void loadFolders();
  }, [sdId, refreshTrigger]);

  if (loading) {
    return (
      <Box sx={{ padding: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Loading folders...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ padding: 2 }}>
        <Typography variant="body2" color="error">
          Error: {error}
        </Typography>
      </Box>
    );
  }

  // Context menu handlers
  const handleContextMenu = (event: MouseEvent<HTMLElement>, folderId: string): void => {
    event.preventDefault();
    // Don't show context menu for special items
    if (folderId === 'all-notes' || folderId === 'recently-deleted') {
      return;
    }
    setContextMenu({
      anchorEl: event.currentTarget,
      folderId,
    });
  };

  const handleCloseContextMenu = (): void => {
    setContextMenu(null);
  };

  const handleRenameClick = (): void => {
    if (!contextMenu) return;
    const folder = folders.find((f) => f.id === contextMenu.folderId);
    if (!folder) return;

    setRenameDialog({
      open: true,
      folderId: folder.id,
      currentName: folder.name,
      newName: folder.name,
      error: null,
    });
    handleCloseContextMenu();
  };

  const handleRenameConfirm = async (): Promise<void> => {
    try {
      await window.electronAPI.folder.rename(sdId, renameDialog.folderId, renameDialog.newName);
      setRenameDialog({ ...renameDialog, open: false });
      onRefresh?.();
    } catch (err) {
      setRenameDialog({
        ...renameDialog,
        error: err instanceof Error ? err.message : 'Failed to rename folder',
      });
    }
  };

  const handleRenameCancel = (): void => {
    setRenameDialog({
      open: false,
      folderId: '',
      currentName: '',
      newName: '',
      error: null,
    });
  };

  const handleDeleteClick = (): void => {
    if (!contextMenu) return;
    const folder = folders.find((f) => f.id === contextMenu.folderId);
    if (!folder) return;

    setDeleteDialog({
      open: true,
      folderId: folder.id,
      folderName: folder.name,
    });
    handleCloseContextMenu();
  };

  const handleDeleteConfirm = async (): Promise<void> => {
    try {
      await window.electronAPI.folder.delete(sdId, deleteDialog.folderId);
      setDeleteDialog({ open: false, folderId: '', folderName: '' });
      onRefresh?.();
    } catch (err) {
      console.error('Failed to delete folder:', err);
      setDeleteDialog({ open: false, folderId: '', folderName: '' });
    }
  };

  const handleDeleteCancel = (): void => {
    setDeleteDialog({ open: false, folderId: '', folderName: '' });
  };

  const handleMoveToTopLevel = async (): Promise<void> => {
    if (!contextMenu) return;
    try {
      await window.electronAPI.folder.move(sdId, contextMenu.folderId, null);
      handleCloseContextMenu();
      onRefresh?.();
    } catch (err) {
      console.error('Failed to move folder:', err);
      handleCloseContextMenu();
    }
  };

  // Drag & drop handlers
  const isDescendant = (ancestorId: string, descendantId: string): boolean => {
    let current = folders.find((f) => f.id === descendantId);
    while (current) {
      if (current.id === ancestorId) {
        return true;
      }
      if (current.parentId === null) {
        break;
      }
      current = folders.find((f) => f.id === current?.parentId);
    }
    return false;
  };

  const isValidDropTarget = (targetId: string, sourceId: string): boolean => {
    // Cannot drop on special items
    if (targetId === 'all-notes' || targetId === 'recently-deleted') {
      return targetId === 'all-notes'; // Can drop on "All Notes" to move to root
    }
    // Cannot drop on itself
    if (targetId === sourceId) {
      return false;
    }
    // Cannot drop on descendant (would create circular reference)
    if (isDescendant(sourceId, targetId)) {
      return false;
    }
    return true;
  };

  const handleDragStart = (_event: DragEvent<HTMLLIElement>, itemId: string): void => {
    // Don't allow dragging special items
    if (itemId === 'all-notes' || itemId === 'recently-deleted') {
      return;
    }
    setDraggedFolderId(itemId);
    dropHandledRef.current = false; // Reset drop handled flag for new drag
  };

  const handleDragOver = (_event: DragEvent<HTMLLIElement>, itemId: string): void => {
    if (!draggedFolderId) return;
    if (isValidDropTarget(itemId, draggedFolderId)) {
      setDraggedOverFolderId(itemId);
    }
  };

  const handleDragLeave = (_event: DragEvent<HTMLLIElement>, _itemId: string): void => {
    setDraggedOverFolderId(null);
  };

  const handleDrop = async (_event: DragEvent<HTMLLIElement>, itemId: string): Promise<void> => {
    if (!draggedFolderId) return;

    // CRITICAL FIX: Only handle drop ONCE per drag operation
    // The event bubbles up from child items, but we only want the first (deepest) handler to run
    // Use a ref instead of state for synchronous checking
    if (dropHandledRef.current) {
      return;
    }
    dropHandledRef.current = true; // Mark this drop as handled

    // Validate drop
    if (!isValidDropTarget(itemId, draggedFolderId)) {
      setDraggedFolderId(null);
      setDraggedOverFolderId(null);
      return;
    }

    try {
      // Determine new parent ID
      let newParentId: string | null = null;
      if (itemId === 'all-notes') {
        // Move to root
        newParentId = null;
      } else if (itemId !== 'recently-deleted') {
        // Move to target folder
        newParentId = itemId;
      }

      // Call folder:move handler
      await window.electronAPI.folder.move(sdId, draggedFolderId, newParentId);

      // Refresh the tree
      onRefresh?.();
    } catch (err) {
      console.error('Failed to move folder:', err);
    } finally {
      setDraggedFolderId(null);
      setDraggedOverFolderId(null);
    }
  };

  const handleDragEnd = (_event: DragEvent<HTMLLIElement>, _itemId: string): void => {
    // Always reset drag state when drag ends (successful drop, ESC key, or cancelled)
    setDraggedFolderId(null);
    setDraggedOverFolderId(null);
    dropHandledRef.current = false; // Reset for next drag operation
  };

  const treeItems = buildTreeItems(folders);

  // Handler for tree item context menu
  const handleItemContextMenu = (event: MouseEvent<HTMLElement>, itemId: string): void => {
    if (itemId !== 'all-notes' && itemId !== 'recently-deleted') {
      handleContextMenu(event, itemId);
    }
  };

  return (
    <Box sx={{ height: '100%', overflow: 'auto' }}>
      <RichTreeView
        items={treeItems}
        selectedItems={selectedFolderId ?? null}
        expandedItems={expandedFolderIds}
        onSelectedItemsChange={(_event, itemId) => {
          onFolderSelect?.(itemId);
        }}
        onExpandedItemsChange={(_event, itemIds) => {
          onExpandedChange?.(itemIds);
        }}
        slots={{
          item: CustomTreeItem,
        }}
        slotProps={{
          item: {
            onItemContextMenu: handleItemContextMenu,
            onItemDragStart: handleDragStart,
            onItemDragOver: handleDragOver,
            onItemDragLeave: handleDragLeave,
            onItemDrop: (event, itemId) => {
              void handleDrop(event, itemId);
            },
            onItemDragEnd: handleDragEnd,
            draggedOverFolderId: draggedOverFolderId,
          } as CustomTreeItemProps,
        }}
      />

      {/* Context Menu */}
      <Menu
        open={contextMenu !== null}
        onClose={handleCloseContextMenu}
        anchorEl={contextMenu?.anchorEl}
      >
        <MenuItem onClick={handleRenameClick}>Rename</MenuItem>
        <MenuItem
          onClick={() => {
            void handleMoveToTopLevel();
          }}
        >
          Move to Top Level
        </MenuItem>
        <MenuItem onClick={handleDeleteClick}>Delete</MenuItem>
      </Menu>

      {/* Rename Dialog */}
      <Dialog open={renameDialog.open} onClose={handleRenameCancel} maxWidth="xs" fullWidth>
        <DialogTitle>Rename Folder</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Folder Name"
            type="text"
            fullWidth
            value={renameDialog.newName}
            onChange={(e) => {
              setRenameDialog({ ...renameDialog, newName: e.target.value });
            }}
            error={!!renameDialog.error}
            helperText={renameDialog.error}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                void handleRenameConfirm();
              }
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleRenameCancel}>Cancel</Button>
          <Button
            onClick={() => {
              void handleRenameConfirm();
            }}
            variant="contained"
            disabled={!renameDialog.newName.trim()}
          >
            Rename
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog.open} onClose={handleDeleteCancel} maxWidth="xs" fullWidth>
        <DialogTitle>Delete Folder</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete &ldquo;{deleteDialog.folderName}&rdquo;? This action
            cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel}>Cancel</Button>
          <Button
            onClick={() => {
              void handleDeleteConfirm();
            }}
            variant="contained"
            color="error"
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
