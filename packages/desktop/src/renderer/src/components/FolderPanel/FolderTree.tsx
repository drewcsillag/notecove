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
import { DroppableFolderNode } from './DroppableFolderNode';
import { CrossSDConfirmDialog } from '../NotesListPanel/CrossSDConfirmDialog';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FolderIcon from '@mui/icons-material/Folder';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore';
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess';
import StorageIcon from '@mui/icons-material/Storage';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { IconButton, Tooltip, Chip } from '@mui/material';

// Phase 2.5.1: Single SD only
const DEFAULT_SD_ID = 'default';

interface FolderData {
  id: string;
  name: string;
  parentId: string | null;
  sdId: string;
  order: number;
  deleted: boolean;
}

interface StorageDirectory {
  id: string;
  name: string;
  path: string;
  created: number;
  isActive: boolean;
}

export interface FolderTreeProps {
  sdId?: string; // Optional - if not provided, shows all SDs
  selectedFolderId?: string | null;
  expandedFolderIds?: string[];
  onFolderSelect?: (folderId: string | null) => void;
  onExpandedChange?: (expandedIds: string[]) => void;
  refreshTrigger?: number;
  onRefresh?: () => void;
  activeSdId?: string; // For multi-SD mode, which SD is currently active
  onActiveSdChange?: (sdId: string) => void; // Callback when active SD changes
}

/**
 * Transform flat folder list into react-dnd-treeview NodeModel format (Single SD mode)
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

/**
 * Build tree nodes for multi-SD mode
 * Structure:
 * - SD 1 (collapsible)
 *   - All Notes
 *   - User folders
 *   - Recently Deleted
 * - SD 2 (collapsible)
 *   - All Notes
 *   - User folders
 *   - Recently Deleted
 */
function buildMultiSDTreeNodes(
  sds: StorageDirectory[],
  foldersBySd: Map<string, FolderData[]>,
  activeSdId?: string
): NodeModel[] {
  const nodes: NodeModel[] = [];

  for (const sd of sds) {
    // Add SD as top-level node
    nodes.push({
      id: `sd:${sd.id}`,
      parent: 0,
      text: sd.name,
      droppable: false, // Cannot drop folders onto SD header
      data: {
        isSD: true,
        sdId: sd.id,
        isActive: sd.id === activeSdId,
        path: sd.path,
      },
    });

    // Add "All Notes" under this SD
    nodes.push({
      id: `all-notes:${sd.id}`,
      parent: `sd:${sd.id}`,
      text: 'All Notes',
      droppable: true,
      data: {
        isSpecial: true,
        noExpand: true,
        sdId: sd.id,
      },
    });

    // Add user folders under this SD
    const folders = foldersBySd.get(sd.id) ?? [];
    for (const folder of folders) {
      nodes.push({
        id: folder.id,
        parent: folder.parentId ?? `sd:${sd.id}`, // Root folders go under SD
        text: folder.name,
        droppable: true,
        data: {
          order: folder.order,
          sdId: sd.id,
          isSpecial: false,
        },
      });
    }

    // Add "Recently Deleted" under this SD
    nodes.push({
      id: `recently-deleted:${sd.id}`,
      parent: `sd:${sd.id}`,
      text: 'Recently Deleted',
      droppable: false,
      data: {
        isSpecial: true,
        sdId: sd.id,
      },
    });
  }

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
  activeSdId,
  onActiveSdChange,
}) => {
  const [folders, setFolders] = useState<FolderData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [treeData, setTreeData] = useState<NodeModel[]>([]);
  const [allFolderIds, setAllFolderIds] = useState<string[]>([]); // For initial expansion
  const [remountCounter, setRemountCounter] = useState(0); // Force remount for expand/collapse all
  const [isCollapsedAll, setIsCollapsedAll] = useState(false); // Track if user clicked collapse all
  const isProgrammaticChange = useRef(false); // Track if change is from expand/collapse all buttons
  const previousExpandedLength = useRef(0); // Track previous length to detect initial expansion
  const scrollContainerRef = useRef<HTMLDivElement>(null); // Ref to scroll container
  const savedScrollPosition = useRef<number>(0); // Save scroll position before remount

  // Multi-SD mode state
  const [sds, setSds] = useState<StorageDirectory[]>([]);
  const [foldersBySd, setFoldersBySd] = useState<Map<string, FolderData[]>>(new Map());
  const isMultiSDMode = sdId === undefined;

  // Note count badges state
  const [noteCounts, setNoteCounts] = useState<Map<string, number>>(new Map());
  const [noteCountRefreshTrigger, setNoteCountRefreshTrigger] = useState(0);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    anchorEl: HTMLElement;
    folderId: string;
  } | null>(null);

  // Force remount when expandedFolderIds changes from empty to populated (initial load)
  useEffect(() => {
    if (previousExpandedLength.current === 0 && expandedFolderIds.length > 0) {
      setRemountCounter((prev) => prev + 1);
    }
    previousExpandedLength.current = expandedFolderIds.length;
  }, [expandedFolderIds]);

  // Save scroll position before remount
  useEffect(() => {
    if (scrollContainerRef.current) {
      savedScrollPosition.current = scrollContainerRef.current.scrollTop;
    }
  }, [remountCounter]);

  // Restore scroll position after remount
  useEffect(() => {
    if (scrollContainerRef.current && savedScrollPosition.current > 0) {
      scrollContainerRef.current.scrollTop = savedScrollPosition.current;
    }
  }, [remountCounter, treeData]);

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

  // Cross-SD confirmation dialog state
  const [crossSDDialog, setCrossSDDialog] = useState<{
    open: boolean;
    noteIds: string[];
    sourceSdId: string;
    targetSdId: string;
    targetFolderId: string | null;
  }>({
    open: false,
    noteIds: [],
    sourceSdId: '',
    targetSdId: '',
    targetFolderId: null,
  });

  useEffect(() => {
    const loadData = async (): Promise<void> => {
      try {
        setLoading(true);
        setError(null);

        if (isMultiSDMode) {
          // Multi-SD mode: load all SDs and folders for each SD
          const sdList = await window.electronAPI.sd.list();
          setSds(sdList);

          // Load folders for each SD
          const folderMap = new Map<string, FolderData[]>();
          await Promise.all(
            sdList.map(async (sd) => {
              const folderList = await window.electronAPI.folder.list(sd.id);
              folderMap.set(sd.id, folderList);
            })
          );
          setFoldersBySd(folderMap);

          // Flatten all folders into single array for context menu operations
          const allFolders = Array.from(folderMap.values()).flat();
          setFolders(allFolders);

          // Build tree with SD sections
          const nodes = buildMultiSDTreeNodes(sdList, folderMap, activeSdId);
          setTreeData(nodes);

          // Set all folder IDs + SD IDs for expand all functionality
          const allFolderIds = allFolders.map((f) => f.id);
          const allIds = [...sdList.map((s) => `sd:${s.id}`), ...allFolderIds];
          setAllFolderIds(allIds);

          // For default expansion: expand all folders for better discoverability
          // Users can collapse folders they don't need, and the state persists
          if (expandedFolderIds.length === 0) {
            // Only set default expansion if no saved state - expand everything
            // Call this synchronously so the Tree gets the right initialOpen on first render
            onExpandedChange?.(allIds);
          }

          // Also increment remount counter to ensure Tree re-renders with expanded state
          if (expandedFolderIds.length === 0 && allIds.length > 0) {
            setRemountCounter((prev) => prev + 1);
          }
        } else {
          // Single SD mode: original behavior
          const folderList = await window.electronAPI.folder.list(sdId);
          setFolders(folderList);
          setTreeData(buildTreeNodes(folderList));

          // Set all folder IDs for initial expansion (start fully expanded)
          const folderIds = folderList.map((f) => f.id);
          setAllFolderIds(folderIds);

          // Expand all folders on first load (no saved state)
          if (expandedFolderIds.length === 0) {
            onExpandedChange?.(folderIds);
          }
        }
      } catch (err) {
        console.error('Failed to load data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load folders');
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, [sdId, refreshTrigger, isMultiSDMode, activeSdId, expandedFolderIds.length, onExpandedChange]);

  // Auto-refresh note counts when notes change
  useEffect(() => {
    // Guard against tests where electronAPI might not be available
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!window.electronAPI?.note) {
      return;
    }

    const refreshCounts = (): void => {
      // Small delay to let database update, then trigger reload
      setTimeout(() => {
        setNoteCountRefreshTrigger((prev) => prev + 1);
      }, 500); // Delay to ensure DB write completes
    };

    // Subscribe to note events
    const unsubCreated = window.electronAPI.note.onCreated(refreshCounts);
    const unsubDeleted = window.electronAPI.note.onDeleted(refreshCounts);
    const unsubRestored = window.electronAPI.note.onRestored(refreshCounts);
    const unsubPermanentDeleted = window.electronAPI.note.onPermanentDeleted(refreshCounts);
    const unsubMoved = window.electronAPI.note.onMoved(refreshCounts);

    return () => {
      unsubCreated();
      unsubDeleted();
      unsubRestored();
      unsubPermanentDeleted();
      unsubMoved();
    };
  }, []);

  // Load note counts for badges
  useEffect(() => {
    const loadNoteCounts = async (): Promise<void> => {
      // Guard against tests where electronAPI might not be available
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!window.electronAPI?.note) {
        return;
      }

      if (!sds.length && !sdId) {
        return; // No SDs loaded yet
      }

      const counts = new Map<string, number>();

      if (isMultiSDMode) {
        // Multi-SD mode: load counts for each SD
        for (const sd of sds) {
          try {
            // "All Notes" for this SD
            const allNotesCount = await window.electronAPI.note.getAllNotesCount(sd.id);
            counts.set(`all-notes:${sd.id}`, allNotesCount);

            // Recently Deleted for this SD
            const deletedCount = await window.electronAPI.note.getDeletedNoteCount(sd.id);
            counts.set(`recently-deleted:${sd.id}`, deletedCount);

            // Each folder in this SD
            const folders = foldersBySd.get(sd.id) ?? [];
            await Promise.all(
              folders.map(async (folder) => {
                const count = await window.electronAPI.note.getCountForFolder(sd.id, folder.id);
                counts.set(folder.id, count);
              })
            );
          } catch (err) {
            console.error(`Failed to load note counts for SD ${sd.id}:`, err);
          }
        }
      } else if (sdId) {
        // Single SD mode
        try {
          // "All Notes"
          const allNotesCount = await window.electronAPI.note.getAllNotesCount(sdId);
          counts.set('all-notes', allNotesCount);

          // Recently Deleted
          const deletedCount = await window.electronAPI.note.getDeletedNoteCount(sdId);
          counts.set('recently-deleted', deletedCount);

          // Each folder
          await Promise.all(
            folders.map(async (folder) => {
              const count = await window.electronAPI.note.getCountForFolder(sdId, folder.id);
              counts.set(folder.id, count);
            })
          );
        } catch (err) {
          console.error('Failed to load note counts:', err);
        }
      }

      setNoteCounts(counts);
    };

    void loadNoteCounts();
  }, [folders, foldersBySd, sds, sdId, isMultiSDMode, refreshTrigger, noteCountRefreshTrigger]);

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
      // Find the folder to get its SD ID
      const folder = folders.find((f) => f.id === renameDialog.folderId);
      if (!folder) {
        throw new Error('Folder not found');
      }

      await window.electronAPI.folder.rename(
        folder.sdId,
        renameDialog.folderId,
        renameDialog.newName
      );
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
      // Find the folder to get its SD ID
      const folder = folders.find((f) => f.id === deleteDialog.folderId);
      if (!folder) {
        throw new Error('Folder not found');
      }

      await window.electronAPI.folder.delete(folder.sdId, deleteDialog.folderId);
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
      // Find the folder to get its SD ID
      const folder = folders.find((f) => f.id === contextMenu.folderId);
      if (!folder) {
        throw new Error('Folder not found');
      }

      await window.electronAPI.folder.move(folder.sdId, contextMenu.folderId, null);
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

    // Don't allow dragging special items (handle both single and multi-SD formats)
    if (
      String(dragSourceId).includes('all-notes') ||
      String(dragSourceId).includes('recently-deleted') ||
      String(dragSourceId).startsWith('sd:')
    ) {
      return;
    }

    // Don't allow dropping on "Recently Deleted" or SD headers
    if (
      String(dropTargetId).includes('recently-deleted') ||
      String(dropTargetId).startsWith('sd:')
    ) {
      return;
    }

    // In multi-SD mode, prevent cross-SD drag operations
    if (isMultiSDMode) {
      const dragNode = newTree.find((n) => n.id === dragSourceId);
      const dropNode = newTree.find((n) => n.id === dropTargetId);

      if (dragNode && dropNode) {
        const dragSdId = (dragNode.data as { sdId?: string }).sdId;
        const dropSdId = (dropNode.data as { sdId?: string }).sdId;

        if (dragSdId && dropSdId && dragSdId !== dropSdId) {
          console.warn('[FolderTree] Cannot drag folders across different SDs');
          return;
        }
      }
    }

    // Determine the new parent ID
    // In multi-SD mode, dropping on "All Notes" for a specific SD means move to root of that SD
    let newParentId: string | null = null;
    const dropTargetStr = String(dropTargetId);

    if (isMultiSDMode) {
      // Handle multi-SD special cases
      if (dropTargetStr.startsWith('all-notes:')) {
        // Dropping on "All Notes" for a specific SD - root level within that SD
        newParentId = null;
      } else if (dropTargetStr.startsWith('sd:')) {
        // Dropping on SD header - shouldn't happen, but treat as root
        newParentId = null;
      } else if (dropTargetId !== 0) {
        // Dropping on a regular folder
        newParentId = dropTargetStr;
      }
    } else {
      // Single SD mode: original logic
      if (dropTargetId !== 'all-notes' && dropTargetId !== 0) {
        newParentId = dropTargetStr;
      }
    }

    // Determine which SD this operation is for
    const targetSdId = isMultiSDMode
      ? ((newTree.find((n) => n.id === dragSourceId)?.data as { sdId?: string }).sdId ?? sdId)
      : sdId;

    if (!targetSdId) {
      console.error('[FolderTree] Cannot determine SD for folder move');
      return;
    }

    try {
      console.log(
        `[FolderTree] Moving folder ${dragSourceId} to parent ${newParentId} in SD ${targetSdId}`
      );
      await window.electronAPI.folder.move(targetSdId, String(dragSourceId), newParentId);

      // Update tree data locally for immediate feedback
      setTreeData(newTree);

      // Trigger refresh to get updated data from backend
      onRefresh?.();
    } catch (err) {
      console.error('Failed to move folder:', err);
      // Revert to original tree data on error
      if (isMultiSDMode) {
        const nodes = buildMultiSDTreeNodes(sds, foldersBySd, activeSdId);
        setTreeData(nodes);
      } else {
        setTreeData(buildTreeNodes(folders));
      }
    }
  };

  // Control which nodes can be dragged
  const canDrag = (node: NodeModel | undefined): boolean => {
    if (!node) return false;
    const nodeData = node.data as { isSpecial?: boolean; isSD?: boolean };
    return !nodeData.isSpecial && !nodeData.isSD;
  };

  // Control where nodes can be dropped
  const canDrop = (tree: NodeModel[], options: DropOptions): boolean => {
    const { dragSourceId, dropTargetId } = options;

    // Can't drag special items or SD headers (handle both formats)
    if (
      String(dragSourceId).includes('all-notes') ||
      String(dragSourceId).includes('recently-deleted') ||
      String(dragSourceId).startsWith('sd:')
    ) {
      return false;
    }

    // Can't drop on "Recently Deleted" or SD headers
    if (
      String(dropTargetId).includes('recently-deleted') ||
      String(dropTargetId).startsWith('sd:')
    ) {
      return false;
    }

    // In multi-SD mode, prevent cross-SD drops
    if (isMultiSDMode) {
      const dragNode = tree.find((n) => n.id === dragSourceId);
      const dropNode = tree.find((n) => n.id === dropTargetId);

      if (dragNode && dropNode) {
        const dragSdId = (dragNode.data as { sdId?: string }).sdId;
        // For drop target, handle special cases like "all-notes:sd-id"
        let dropSdId = (dropNode.data as { sdId?: string }).sdId;

        // Extract SD ID from special node IDs
        if (!dropSdId && String(dropTargetId).includes(':')) {
          const parts = String(dropTargetId).split(':');
          dropSdId = parts[1];
        }

        if (dragSdId && dropSdId && dragSdId !== dropSdId) {
          return false; // Cannot drop across SDs
        }
      }
    }

    // Allow dropping on "All Notes" (root level) and regular folders
    return true;
  };

  // Handle tree item selection
  const handleSelect = (node: NodeModel): void => {
    const nodeId = String(node.id);
    const nodeData = node.data as { isSD?: boolean; sdId?: string; isSpecial?: boolean };

    console.log('[FolderTree] handleSelect called:', {
      nodeId,
      isSD: nodeData.isSD,
      sdId: nodeData.sdId,
      isMultiSDMode,
      hasOnActiveSdChange: !!onActiveSdChange,
    });

    // If clicking an SD header, toggle its expansion (don't activate it or change notes pane)
    if (nodeData.isSD) {
      console.log('[FolderTree] SD header clicked - toggling expansion');
      const isExpanded = expandedFolderIds.includes(nodeId);
      handleToggle(nodeId, !isExpanded);
      return;
    }

    // In multi-SD mode, track which SD this folder belongs to and update active SD
    if (isMultiSDMode && onActiveSdChange) {
      // Extract SD ID from the folder or special node
      let newActiveSdId: string | undefined;

      if (nodeId.includes(':')) {
        // Special nodes like "all-notes:sd-id" or "recently-deleted:sd-id"
        const parts = nodeId.split(':');
        newActiveSdId = parts[1];
      } else if (nodeData.sdId) {
        // Regular folder with sdId in data
        newActiveSdId = nodeData.sdId;
      }

      if (newActiveSdId && newActiveSdId !== activeSdId) {
        onActiveSdChange(newActiveSdId);
      }
    }

    onFolderSelect?.(nodeId);
  };

  // Handle expand/collapse
  const handleToggle = (nodeId: string | number, isOpen: boolean): void => {
    const id = String(nodeId);
    let newExpanded: string[];

    if (isOpen) {
      newExpanded = [...expandedFolderIds, id];
      // If user is expanding a node, exit "collapsed all" mode
      setIsCollapsedAll(false);
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

  // Handle note drop on folder
  const handleNoteDrop = async (
    noteIds: string[],
    targetFolderId: string,
    sourceSdId?: string
  ): Promise<void> => {
    // Use default SD ID if sourceSdId is undefined (single-SD scenarios)
    const effectiveSourceSdId = sourceSdId ?? DEFAULT_SD_ID;
    console.log('[FolderTree] Note drop:', {
      noteIds,
      targetFolderId,
      sourceSdId: effectiveSourceSdId,
    });

    try {
      // Check if the first note is deleted to detect drag from Recently Deleted
      if (noteIds.length === 0) {
        return; // No notes to move
      }
      const firstNoteId = noteIds[0];
      if (!firstNoteId) {
        return; // Safety check, should never happen due to length check
      }
      const firstNoteMetadata = await window.electronAPI.note.getMetadata(firstNoteId);
      const isDraggingDeletedNotes = firstNoteMetadata.deleted;

      // Determine the target SD ID and actual folder ID
      let targetSdId: string;
      let actualFolderId: string | null = null;

      // Handle special nodes and extract target SD ID
      if (targetFolderId.startsWith('all-notes')) {
        // "All Notes" - extract SD ID from suffix (e.g., "all-notes:default")
        const parts = targetFolderId.split(':');
        targetSdId = parts.length > 1 && parts[1] ? parts[1] : effectiveSourceSdId;
        actualFolderId = null;
      } else if (targetFolderId.startsWith('recently-deleted')) {
        // Dropping on "Recently Deleted" should delete the notes (if not already deleted)
        if (!isDraggingDeletedNotes) {
          await Promise.all(noteIds.map((noteId) => window.electronAPI.note.delete(noteId)));
          console.log('[FolderTree] Deleted notes:', noteIds);
        }
        return;
      } else if (targetFolderId.startsWith('sd:')) {
        // Dropping on an SD node - extract SD ID (e.g., "sd:default")
        const parts = targetFolderId.split(':');
        targetSdId = parts.length > 1 && parts[1] ? parts[1] : effectiveSourceSdId;
        actualFolderId = null;
      } else {
        // Regular folder - look up which SD it belongs to
        let folderSdId = effectiveSourceSdId; // Default to source SD

        // Search through all folders to find this folder's SD
        for (const [sdId, sdFolders] of foldersBySd.entries()) {
          if (sdFolders.some((f) => f.id === targetFolderId)) {
            folderSdId = sdId;
            break;
          }
        }

        targetSdId = folderSdId;
        actualFolderId = targetFolderId;
      }

      // If dragging deleted notes to a non-Recently-Deleted folder, restore them first
      if (isDraggingDeletedNotes && !targetFolderId.startsWith('recently-deleted')) {
        console.log('[FolderTree] Restoring deleted notes:', noteIds);
        await Promise.all(noteIds.map((noteId) => window.electronAPI.note.restore(noteId)));
        // After restoring, we'll continue to move them to the target folder below
      }

      // Check if this is a cross-SD operation
      // Only treat as cross-SD if both IDs are defined and different
      const isCrossSD = effectiveSourceSdId !== targetSdId;

      if (isCrossSD) {
        console.log('[FolderTree] Cross-SD operation detected:', {
          sourceSdId: effectiveSourceSdId,
          targetSdId,
        });

        // Show confirmation dialog for cross-SD move
        setCrossSDDialog({
          open: true,
          noteIds,
          sourceSdId: effectiveSourceSdId,
          targetSdId,
          targetFolderId: actualFolderId,
        });
        return;
      }

      // Same-SD move - proceed normally
      await Promise.all(
        noteIds.map((noteId) => window.electronAPI.note.move(noteId, actualFolderId))
      );

      console.log('[FolderTree] Moved notes:', { noteIds, actualFolderId });
    } catch (err) {
      console.error('[FolderTree] Failed to move notes:', err);
    }
  };

  // Handle cross-SD confirmation
  const handleCrossSDConfirm = async (): Promise<void> => {
    const { noteIds, sourceSdId, targetSdId, targetFolderId } = crossSDDialog;

    // Close dialog
    setCrossSDDialog({ ...crossSDDialog, open: false });

    try {
      // Move each note to target SD
      // TODO: Handle conflicts - for now, we pass null (no conflict resolution)
      // Full conflict handling will be implemented when backend supports it
      await Promise.all(
        noteIds.map((noteId) =>
          window.electronAPI.note.moveToSD(noteId, sourceSdId, targetSdId, targetFolderId, null)
        )
      );

      console.log('[FolderTree] Cross-SD move completed:', {
        noteIds,
        sourceSdId,
        targetSdId,
        targetFolderId,
      });
    } catch (err) {
      console.error('[FolderTree] Failed to move notes across SDs:', err);
    }
  };

  const handleCrossSDCancel = (): void => {
    setCrossSDDialog({ ...crossSDDialog, open: false });
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
        ref={scrollContainerRef}
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
        <Tree
          key={`tree-${remountCounter}`} // Force remount when expand/collapse all is clicked
          tree={treeData}
          rootId={0}
          onDrop={(tree, options) => void handleDrop(tree, options)}
          canDrag={canDrag}
          canDrop={canDrop}
          initialOpen={(() => {
            const result = isCollapsedAll
              ? []
              : expandedFolderIds.length > 0
                ? expandedFolderIds
                : allFolderIds.length > 0
                  ? allFolderIds
                  : [];
            console.log('[FolderTree] Tree initialOpen:', {
              isCollapsedAll,
              expandedFolderIds: expandedFolderIds.length,
              allFolderIds: allFolderIds.length,
              result: result.length,
            });
            return result;
          })()}
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
            const nodeData = node.data as {
              isSD?: boolean;
              isActive?: boolean;
              path?: string;
              isSpecial?: boolean;
            };
            const isSDNode = nodeData.isSD ?? false;
            const isActiveSD = nodeData.isActive ?? false;
            const isSpecialNode = nodeData.isSpecial ?? false;

            // Check if this node has children
            const hasChildren = treeData.some((n) => n.parent === node.id);

            // Determine if this node belongs to the active SD (for test selectors)
            const nodeDataWithSdId = node.data as {
              sdId?: string;
              isSD?: boolean;
              isActive?: boolean;
              path?: string;
            };
            const belongsToActiveSD =
              isMultiSDMode &&
              activeSdId &&
              ((isSDNode && nodeDataWithSdId.sdId === activeSdId) ||
                (!isSDNode && nodeDataWithSdId.sdId === activeSdId) ||
                (String(node.id).includes(':') && String(node.id).split(':')[1] === activeSdId));

            return (
              <DroppableFolderNode
                folderId={String(node.id)}
                onDrop={(noteIds, targetFolderId, sourceSdId) => {
                  void handleNoteDrop(noteIds, targetFolderId, sourceSdId);
                }}
                isSpecial={isSpecialNode || isSDNode}
              >
                <ListItemButton
                  data-testid={`folder-tree-node-${node.id}`}
                  data-active-sd={belongsToActiveSD ? 'true' : undefined}
                  aria-label={String(node.text)}
                  sx={{
                    pl: depth * 2,
                    backgroundColor: isDropTarget
                      ? 'primary.light'
                      : isSelected
                        ? 'action.selected'
                        : isSDNode && isActiveSD
                          ? 'action.hover'
                          : 'transparent',
                    borderLeft: isDropTarget ? 3 : isActiveSD && isSDNode ? 3 : 0,
                    borderColor: isDropTarget
                      ? 'primary.main'
                      : isActiveSD && isSDNode
                        ? 'primary.main'
                        : 'transparent',
                    '&:hover': {
                      backgroundColor: 'action.hover',
                    },
                    fontWeight: isSDNode ? 600 : 400,
                  }}
                  onClick={() => {
                    handleSelect(node);
                  }}
                  onContextMenu={(e) => {
                    if (!isSDNode) {
                      handleContextMenu(e, String(node.id));
                    }
                  }}
                >
                  {/* Expand/collapse chevron */}
                  {(node.droppable ?? isSDNode) && !noExpand && hasChildren && (
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
                  {((!node.droppable && !isSDNode) || noExpand || !hasChildren) && (
                    <Box sx={{ width: 24, mr: 0.5 }} />
                  )}

                  {/* Icon */}
                  <Box sx={{ mr: 1, display: 'flex', alignItems: 'center' }}>
                    {isSDNode ? (
                      <StorageIcon fontSize="small" color={isActiveSD ? 'primary' : 'action'} />
                    ) : node.droppable ? (
                      isExpanded ? (
                        <FolderOpenIcon fontSize="small" />
                      ) : (
                        <FolderIcon fontSize="small" />
                      )
                    ) : null}
                  </Box>

                  {/* Text and active indicator */}
                  <ListItemText primary={node.text} />

                  {/* Note count badge */}
                  {(() => {
                    const count = noteCounts.get(String(node.id));
                    return (
                      count !== undefined &&
                      count > 0 && (
                        <Chip
                          label={count}
                          size="small"
                          sx={{
                            ml: 1,
                            height: 20,
                            backgroundColor: 'action.hover',
                            color: 'text.secondary',
                            fontSize: '0.75rem',
                          }}
                        />
                      )
                    );
                  })()}

                  {isSDNode && isActiveSD && (
                    <Chip
                      label="Active"
                      size="small"
                      color="primary"
                      icon={<CheckCircleIcon />}
                      sx={{ ml: 1, height: 20 }}
                    />
                  )}
                </ListItemButton>
              </DroppableFolderNode>
            );
          }}
        />
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

      {/* Cross-SD Move Confirmation Dialog */}
      {crossSDDialog.open && (
        <CrossSDConfirmDialog
          open={crossSDDialog.open}
          noteCount={crossSDDialog.noteIds.length}
          sourceSdName={
            sds.find((sd) => sd.id === crossSDDialog.sourceSdId)?.name ?? crossSDDialog.sourceSdId
          }
          targetSdName={
            sds.find((sd) => sd.id === crossSDDialog.targetSdId)?.name ?? crossSDDialog.targetSdId
          }
          targetFolderName={
            crossSDDialog.targetFolderId
              ? (folders.find((f) => f.id === crossSDDialog.targetFolderId)?.name ?? null)
              : null
          }
          onConfirm={() => {
            void handleCrossSDConfirm();
          }}
          onCancel={handleCrossSDCancel}
        />
      )}
    </Box>
  );
};
