/**
 * FolderTree Component
 *
 * Displays the hierarchical folder structure using @minoru/react-dnd-treeview.
 * Phase 2.4.4: Drag-and-drop reordering using battle-tested react-dnd library.
 */

import { type FC, useEffect, useState, useRef, type MouseEvent } from 'react';
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
  ListItemButton,
  ListItemText,
} from '@mui/material';
import { Tree, type NodeModel, type DropOptions } from '@minoru/react-dnd-treeview';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FolderIcon from '@mui/icons-material/Folder';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore';
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess';
import { IconButton, Tooltip } from '@mui/material';

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
  refreshTrigger?: number;
  onRefresh?: () => void;
}

/**
 * Transform flat folder list into react-dnd-treeview NodeModel format
 */
function buildTreeNodes(folders: FolderData[]): NodeModel[] {
  const nodes: NodeModel[] = [];

  // Add special UI-only items
  nodes.push({
    id: 'all-notes',
    parent: 0,
    text: 'All Notes',
    droppable: true, // Droppable to allow moving folders to root level (like Apple Notes)
    data: { isSpecial: true, noExpand: true }, // But don't show expand/collapse button
  });

  // Add user folders - root folders (parentId === null) go at top level, not under "All Notes"
  for (const folder of folders) {
    nodes.push({
      id: folder.id,
      parent: folder.parentId ?? 0, // Root folders go at top level (parent: 0)
      text: folder.name,
      droppable: true,
      data: {
        order: folder.order,
        sdId: folder.sdId,
        isSpecial: false,
      },
    });
  }

  // Add "Recently Deleted" at the end
  nodes.push({
    id: 'recently-deleted',
    parent: 0,
    text: 'Recently Deleted',
    droppable: false,
    data: { isSpecial: true },
  });

  return nodes;
}

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
  const [treeData, setTreeData] = useState<NodeModel[]>([]);
  const [allFolderIds, setAllFolderIds] = useState<string[]>([]); // For initial expansion
  const [remountCounter, setRemountCounter] = useState(0); // Force remount for expand/collapse all
  const [isCollapsedAll, setIsCollapsedAll] = useState(false); // Track if user clicked collapse all
  const isProgrammaticChange = useRef(false); // Track if change is from expand/collapse all buttons

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

  useEffect(() => {
    const loadFolders = async (): Promise<void> => {
      try {
        setLoading(true);
        setError(null);
        const folderList = await window.electronAPI.folder.list(sdId);
        setFolders(folderList);
        setTreeData(buildTreeNodes(folderList));

        // Set all folder IDs for initial expansion (start fully expanded)
        const folderIds = folderList.map((f) => f.id);
        setAllFolderIds(folderIds);
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

  // Drag-and-drop handler
  const handleDrop = async (newTree: NodeModel[], options: DropOptions): Promise<void> => {
    const { dragSourceId, dropTargetId } = options;

    // Don't allow dragging special items
    if (dragSourceId === 'all-notes' || dragSourceId === 'recently-deleted') {
      return;
    }

    // Don't allow dropping on "Recently Deleted"
    if (dropTargetId === 'recently-deleted') {
      return;
    }

    // Determine the new parent ID
    // Dropping on "All Notes" or root (0) means move to root level (parentId = null)
    let newParentId: string | null = null;
    if (dropTargetId !== 'all-notes' && dropTargetId !== 0) {
      newParentId = String(dropTargetId);
    }

    try {
      console.log(`[FolderTree] Moving folder ${dragSourceId} to parent ${newParentId}`);
      await window.electronAPI.folder.move(sdId, String(dragSourceId), newParentId);

      // Update tree data locally for immediate feedback
      setTreeData(newTree);

      // Trigger refresh to get updated data from backend
      onRefresh?.();
    } catch (err) {
      console.error('Failed to move folder:', err);
      // Revert to original tree data on error
      setTreeData(buildTreeNodes(folders));
    }
  };

  // Control which nodes can be dragged
  const canDrag = (node: NodeModel | undefined): boolean => {
    if (!node) return false;
    return !(node.data as { isSpecial?: boolean }).isSpecial;
  };

  // Control where nodes can be dropped
  const canDrop = (_tree: NodeModel[], options: DropOptions): boolean => {
    const { dragSourceId, dropTargetId } = options;

    // Can't drag special items
    if (dragSourceId === 'all-notes' || dragSourceId === 'recently-deleted') {
      return false;
    }

    // Can't drop on "Recently Deleted"
    if (dropTargetId === 'recently-deleted') {
      return false;
    }

    // Allow dropping on "All Notes" (root level) and regular folders
    return true;
  };

  // Handle tree item selection
  const handleSelect = (node: NodeModel): void => {
    onFolderSelect?.(String(node.id));
  };

  // Handle expand/collapse
  const handleToggle = (nodeId: string | number, isOpen: boolean): void => {
    const id = String(nodeId);
    let newExpanded: string[];

    if (isOpen) {
      newExpanded = [...expandedFolderIds, id];
    } else {
      newExpanded = expandedFolderIds.filter((fid) => fid !== id);
    }

    onExpandedChange?.(newExpanded);
  };

  // Expand all folders
  const handleExpandAll = (): void => {
    isProgrammaticChange.current = true;
    setRemountCounter((prev) => prev + 1); // Force remount
    setIsCollapsedAll(false);
    onExpandedChange?.(allFolderIds);
  };

  // Collapse all folders
  const handleCollapseAll = (): void => {
    isProgrammaticChange.current = true;
    setRemountCounter((prev) => prev + 1); // Force remount
    setIsCollapsedAll(true);
    onExpandedChange?.([]);
  };

  // Determine if all folders are expanded (but not if user explicitly collapsed all)
  const allExpanded =
    !isCollapsedAll &&
    (expandedFolderIds.length === 0 || expandedFolderIds.length === allFolderIds.length);

  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Expand/Collapse All Button */}
      <Box sx={{ p: 1, borderBottom: 1, borderColor: 'divider' }}>
        <Tooltip title={allExpanded ? 'Collapse All' : 'Expand All'}>
          <IconButton
            size="small"
            onClick={allExpanded ? handleCollapseAll : handleExpandAll}
            sx={{ ml: 1 }}
          >
            {allExpanded ? (
              <UnfoldLessIcon fontSize="small" />
            ) : (
              <UnfoldMoreIcon fontSize="small" />
            )}
          </IconButton>
        </Tooltip>
      </Box>

      {/* Tree Container */}
      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          '& ul': {
            listStyleType: 'none',
            paddingLeft: 0,
            margin: 0,
          },
          '& li': {
            listStyleType: 'none',
          },
        }}
      >
        <DndProvider backend={HTML5Backend}>
          <Tree
            key={`tree-${remountCounter}`} // Force remount when expand/collapse all is clicked
            tree={treeData}
            rootId={0}
            onDrop={(tree, options) => void handleDrop(tree, options)}
            canDrag={canDrag}
            canDrop={canDrop}
            initialOpen={
              isCollapsedAll ? [] : expandedFolderIds.length > 0 ? expandedFolderIds : allFolderIds
            }
            onChangeOpen={(newOpenIds) => {
              // Skip callback if this is a programmatic change (expand/collapse all)
              if (isProgrammaticChange.current) {
                isProgrammaticChange.current = false; // Reset flag
                return;
              }
              // Sync library's internal state with our parent component (but don't trigger remount)
              onExpandedChange?.(newOpenIds.map(String));
            }}
            dragPreviewRender={(monitorProps) => {
              // Custom drag preview to show ONLY the dragged folder, not the entire tree
              return (
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '4px 8px',
                    backgroundColor: 'primary.light',
                    borderRadius: 1,
                    opacity: 0.8,
                  }}
                >
                  <FolderIcon fontSize="small" sx={{ mr: 1 }} />
                  <Typography variant="body2">{monitorProps.item.text}</Typography>
                </Box>
              );
            }}
            render={(node, { depth, onToggle, isDropTarget }) => {
              const isSelected = String(node.id) === selectedFolderId;
              const isExpanded = expandedFolderIds.includes(String(node.id));
              const noExpand = (node.data as { noExpand?: boolean }).noExpand ?? false;

              // Check if this node has children
              const hasChildren = treeData.some((n) => n.parent === node.id);

              return (
                <ListItemButton
                  sx={{
                    pl: depth * 2,
                    backgroundColor: isDropTarget
                      ? 'primary.light'
                      : isSelected
                        ? 'action.selected'
                        : 'transparent',
                    borderLeft: isDropTarget ? 3 : 0,
                    borderColor: isDropTarget ? 'primary.main' : 'transparent',
                    '&:hover': {
                      backgroundColor: 'action.hover',
                    },
                  }}
                  onClick={() => {
                    handleSelect(node);
                  }}
                  onContextMenu={(e) => {
                    handleContextMenu(e, String(node.id));
                  }}
                >
                  {node.droppable && !noExpand && hasChildren && (
                    <Box
                      component="span"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggle();
                        handleToggle(node.id, !isExpanded);
                      }}
                      sx={{ mr: 0.5, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                    >
                      {isExpanded ? <ExpandMoreIcon /> : <ChevronRightIcon />}
                    </Box>
                  )}
                  {(!node.droppable || noExpand || !hasChildren) && (
                    <Box sx={{ width: 24, mr: 0.5 }} />
                  )}
                  <Box sx={{ mr: 1, display: 'flex', alignItems: 'center' }}>
                    {node.droppable ? (
                      isExpanded ? (
                        <FolderOpenIcon fontSize="small" />
                      ) : (
                        <FolderIcon fontSize="small" />
                      )
                    ) : null}
                  </Box>
                  <ListItemText primary={node.text} />
                </ListItemButton>
              );
            }}
          />
        </DndProvider>
      </Box>

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
