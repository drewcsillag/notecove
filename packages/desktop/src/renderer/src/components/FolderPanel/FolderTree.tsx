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
  Snackbar,
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

// App state key for SD order (per-device, not synced)
const SD_ORDER_KEY = 'sdOrder';

/**
 * Sort SDs by saved order. SDs not in savedOrder are appended at the end.
 */
function sortSDsByOrder(sds: StorageDirectory[], savedOrder: string[]): StorageDirectory[] {
  const orderMap = new Map(savedOrder.map((id, index) => [id, index]));
  return [...sds].sort((a, b) => {
    const aOrder = orderMap.get(a.id) ?? Number.MAX_SAFE_INTEGER;
    const bOrder = orderMap.get(b.id) ?? Number.MAX_SAFE_INTEGER;
    if (aOrder !== bOrder) {
      return aOrder - bOrder;
    }
    // For SDs not in saved order, sort by creation time
    return a.created - b.created;
  });
}

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
 * Custom sort comparator for tree nodes.
 * Ensures: "All Notes" first, "Recently Deleted" last, user folders by order field.
 * Works for both single-SD mode (e.g., "all-notes") and multi-SD mode (e.g., "all-notes:sd-123").
 * Exported for testing.
 */
export function sortNodes(a: NodeModel, b: NodeModel): number {
  const aId = String(a.id);
  const bId = String(b.id);

  // Check if nodes are special items
  const aIsAllNotes = aId === 'all-notes' || aId.startsWith('all-notes:');
  const bIsAllNotes = bId === 'all-notes' || bId.startsWith('all-notes:');
  const aIsRecentlyDeleted = aId === 'recently-deleted' || aId.startsWith('recently-deleted:');
  const bIsRecentlyDeleted = bId === 'recently-deleted' || bId.startsWith('recently-deleted:');
  const aIsSD = aId.startsWith('sd:');
  const bIsSD = bId.startsWith('sd:');
  const aIsSDSpacerTop = aId === 'sd-spacer-top';
  const bIsSDSpacerTop = bId === 'sd-spacer-top';
  const aIsSDSpacerBottom = aId === 'sd-spacer-bottom';
  const bIsSDSpacerBottom = bId === 'sd-spacer-bottom';

  // SD spacer top: always first at root level
  if (aIsSDSpacerTop && !bIsSDSpacerTop) return -1;
  if (!aIsSDSpacerTop && bIsSDSpacerTop) return 1;

  // SD spacer bottom: always last at root level
  if (aIsSDSpacerBottom && !bIsSDSpacerBottom) return 1;
  if (!aIsSDSpacerBottom && bIsSDSpacerBottom) return -1;

  // SD headers: keep their original order (don't sort among themselves)
  if (aIsSD && bIsSD) {
    return 0;
  }

  // "All Notes" always first (among siblings)
  if (aIsAllNotes && !bIsAllNotes) return -1;
  if (!aIsAllNotes && bIsAllNotes) return 1;

  // "Recently Deleted" always last (among siblings)
  if (aIsRecentlyDeleted && !bIsRecentlyDeleted) return 1;
  if (!aIsRecentlyDeleted && bIsRecentlyDeleted) return -1;

  // User folders: sort by order field (from backend), with name as fallback
  const aOrder = (a.data as { order?: number } | undefined)?.order ?? 0;
  const bOrder = (b.data as { order?: number } | undefined)?.order ?? 0;
  if (aOrder !== bOrder) {
    return aOrder - bOrder;
  }

  // Fallback to alphabetical (case-insensitive) for same order values
  return a.text.toLowerCase().localeCompare(b.text.toLowerCase());
}

/**
 * Sort tree nodes by parent group, applying sortNodes within each parent.
 * This is used when sort={false} on the Tree component to maintain our custom ordering.
 */
function sortTreeNodesByParent(nodes: NodeModel[]): NodeModel[] {
  // Group nodes by parent
  const byParent = new Map<string | number, NodeModel[]>();
  for (const node of nodes) {
    const parentKey = node.parent;
    if (!byParent.has(parentKey)) {
      byParent.set(parentKey, []);
    }
    const parentArray = byParent.get(parentKey);
    if (parentArray) {
      parentArray.push(node);
    }
  }

  // Sort each parent's children
  for (const children of byParent.values()) {
    children.sort(sortNodes);
  }

  // Flatten back, maintaining parent order (root first, then children in sorted order)
  const result: NodeModel[] = [];
  const visited = new Set<string | number>();

  function addNodeAndChildren(nodeId: string | number): void {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);

    const children = byParent.get(nodeId) ?? [];
    for (const child of children) {
      result.push(child);
      addNodeAndChildren(child.id);
    }
  }

  // Start from root (parent: 0)
  addNodeAndChildren(0);

  return result;
}

/**
 * Transform flat folder list into react-dnd-treeview NodeModel format (Single SD mode)
 * Returns nodes pre-sorted for use with sort={false} on Tree component.
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

  // Pre-sort nodes for use with sort={false}
  return sortTreeNodesByParent(nodes);
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

  // Add invisible spacer at the top for SD reordering drop target
  // This allows dropping before the first SD
  if (sds.length > 0) {
    nodes.push({
      id: 'sd-spacer-top',
      parent: 0,
      text: '',
      droppable: true,
      data: {
        isSDSpacer: true,
        position: 'top',
      },
    });
  }

  for (const sd of sds) {
    // Add SD as top-level node
    // NOTE: droppable must be true for the library to allow reordering of child nodes
    // (the library checks parent.droppable when calculating edge drop targets)
    // We control actual drop behavior in canDrop callback
    nodes.push({
      id: `sd:${sd.id}`,
      parent: 0,
      text: sd.name,
      droppable: true,
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

  // Add invisible spacer at the bottom for SD reordering drop target
  // This allows dropping after the last SD
  if (sds.length > 0) {
    nodes.push({
      id: 'sd-spacer-bottom',
      parent: 0,
      text: '',
      droppable: true,
      data: {
        isSDSpacer: true,
        position: 'bottom',
      },
    });
  }

  // Pre-sort nodes for use with sort={false}
  return sortTreeNodesByParent(nodes);
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

  // SD context menu state (separate from folder context menu)
  const [sdContextMenu, setSdContextMenu] = useState<{
    anchorEl: HTMLElement;
    sdId: string;
    sdName: string;
  } | null>(null);

  // SD rename dialog state
  const [sdRenameDialog, setSdRenameDialog] = useState<{
    open: boolean;
    sdId: string;
    currentName: string;
    newName: string;
  }>({
    open: false,
    sdId: '',
    currentName: '',
    newName: '',
  });

  // SD rename error snackbar state
  const [sdRenameSnackbar, setSdRenameSnackbar] = useState<{
    open: boolean;
    message: string;
  }>({
    open: false,
    message: '',
  });

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
    sdId: string;
    hasChildren: boolean;
    childCount: number;
    descendantCount: number;
  }>({
    open: false,
    folderId: '',
    folderName: '',
    sdId: '',
    hasChildren: false,
    childCount: 0,
    descendantCount: 0,
  });

  // Trash context menu state (separate from folder context menu)
  const [trashContextMenu, setTrashContextMenu] = useState<{
    anchorEl: HTMLElement;
    sdId: string;
  } | null>(null);

  // Trash note count for Empty Trash menu item
  const [trashNoteCount, setTrashNoteCount] = useState<number>(0);

  // Empty Trash confirmation dialog state
  const [emptyTrashDialog, setEmptyTrashDialog] = useState<{
    open: boolean;
    sdId: string;
    noteCount: number;
  }>({
    open: false,
    sdId: '',
    noteCount: 0,
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
          const [sdList, savedOrderJson] = await Promise.all([
            window.electronAPI.sd.list(),
            window.electronAPI.appState.get(SD_ORDER_KEY),
          ]);

          // Sort SDs by saved order (per-device setting)
          const savedOrder: string[] = savedOrderJson
            ? (JSON.parse(savedOrderJson) as string[])
            : [];
          const sortedSdList = sortSDsByOrder(sdList, savedOrder);
          setSds(sortedSdList);

          // Load folders for each SD
          const folderMap = new Map<string, FolderData[]>();
          await Promise.all(
            sortedSdList.map(async (sd) => {
              const folderList = await window.electronAPI.folder.list(sd.id);
              folderMap.set(sd.id, folderList);
            })
          );
          setFoldersBySd(folderMap);

          // Flatten all folders into single array for context menu operations
          const allFolders = Array.from(folderMap.values()).flat();
          setFolders(allFolders);

          // Build tree with SD sections
          const nodes = buildMultiSDTreeNodes(sortedSdList, folderMap, activeSdId);
          setTreeData(nodes);

          // Set all folder IDs + SD IDs for expand all functionality
          const allFolderIds = allFolders.map((f) => f.id);
          const allIds = [...sortedSdList.map((s) => `sd:${s.id}`), ...allFolderIds];
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
    // Also refresh when notes are synced from other instances (may include folder changes)
    const unsubExternalUpdate = window.electronAPI.note.onExternalUpdate(refreshCounts);

    return () => {
      unsubCreated();
      unsubDeleted();
      unsubRestored();
      unsubPermanentDeleted();
      unsubMoved();
      unsubExternalUpdate();
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
    // No context menu for all-notes
    if (folderId === 'all-notes' || folderId.startsWith('all-notes:')) {
      return;
    }
    // Handle Recently Deleted folders specially
    if (folderId === 'recently-deleted' || folderId.startsWith('recently-deleted:')) {
      // Extract sdId from folderId (format: "recently-deleted:sdId" or just "recently-deleted")
      const sdId = folderId.includes(':')
        ? (folderId.split(':')[1] ?? '')
        : (activeSdId ?? sds[0]?.id ?? '');
      if (sdId) {
        void handleTrashContextMenu(event, sdId);
      }
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

  // Trash context menu handlers
  const handleTrashContextMenu = async (
    event: MouseEvent<HTMLElement>,
    sdId: string
  ): Promise<void> => {
    // Capture anchor element immediately before any async operations
    const anchorEl = event.currentTarget;

    // Show menu immediately with loading state (count 0)
    setTrashNoteCount(0);
    setTrashContextMenu({
      anchorEl,
      sdId,
    });

    // Fetch the current trash count and update
    try {
      const count = await window.electronAPI.note.getDeletedNoteCount(sdId);
      setTrashNoteCount(count);
    } catch (err) {
      console.error('Failed to get deleted note count:', err);
      setTrashNoteCount(0);
    }
  };

  const handleCloseTrashContextMenu = (): void => {
    setTrashContextMenu(null);
  };

  const handleEmptyTrashClick = (): void => {
    if (!trashContextMenu) return;
    setEmptyTrashDialog({
      open: true,
      sdId: trashContextMenu.sdId,
      noteCount: trashNoteCount,
    });
    handleCloseTrashContextMenu();
  };

  const handleEmptyTrashConfirm = async (): Promise<void> => {
    try {
      await window.electronAPI.note.emptyTrash(emptyTrashDialog.sdId);
      setEmptyTrashDialog({ open: false, sdId: '', noteCount: 0 });
      // The notes list will update via note:permanentDeleted events
    } catch (err) {
      console.error('Failed to empty trash:', err);
      setEmptyTrashDialog({ open: false, sdId: '', noteCount: 0 });
    }
  };

  const handleEmptyTrashCancel = (): void => {
    setEmptyTrashDialog({ open: false, sdId: '', noteCount: 0 });
  };

  // SD context menu handlers
  const handleSdContextMenu = (
    event: MouseEvent<HTMLElement>,
    sdId: string,
    sdName: string
  ): void => {
    event.preventDefault();
    setSdContextMenu({
      anchorEl: event.currentTarget,
      sdId,
      sdName,
    });
  };

  const handleCloseSdContextMenu = (): void => {
    setSdContextMenu(null);
  };

  const handleSdRenameClick = (): void => {
    if (!sdContextMenu) return;
    setSdRenameDialog({
      open: true,
      sdId: sdContextMenu.sdId,
      currentName: sdContextMenu.sdName,
      newName: sdContextMenu.sdName,
    });
    handleCloseSdContextMenu();
  };

  const handleSdRenameConfirm = async (): Promise<void> => {
    const trimmedName = sdRenameDialog.newName.trim();

    // Skip if name hasn't changed
    if (trimmedName === sdRenameDialog.currentName) {
      handleSdRenameCancel();
      return;
    }

    try {
      await window.electronAPI.sd.rename(sdRenameDialog.sdId, trimmedName);
      handleSdRenameCancel();
      // Trigger refresh to reload SD list with new name
      onRefresh?.();
    } catch (err) {
      console.error('Failed to rename SD:', err);
      const message = err instanceof Error ? err.message : 'Failed to rename Storage Directory';
      setSdRenameSnackbar({ open: true, message });
      handleSdRenameCancel();
    }
  };

  const handleSdRenameCancel = (): void => {
    setSdRenameDialog({
      open: false,
      sdId: '',
      currentName: '',
      newName: '',
    });
  };

  const handleSdRenameSnackbarClose = (): void => {
    setSdRenameSnackbar({ open: false, message: '' });
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

  const handleDeleteClick = async (): Promise<void> => {
    if (!contextMenu) return;
    const folder = folders.find((f) => f.id === contextMenu.folderId);
    if (!folder) return;

    // Check if folder has children
    try {
      const childInfo = await window.electronAPI.folder.getChildInfo(folder.sdId, folder.id);
      setDeleteDialog({
        open: true,
        folderId: folder.id,
        folderName: folder.name,
        sdId: folder.sdId,
        hasChildren: childInfo.hasChildren,
        childCount: childInfo.childCount,
        descendantCount: childInfo.descendantCount,
      });
    } catch (err) {
      console.error('Failed to get folder child info:', err);
      // Fallback to simple delete dialog without child info
      setDeleteDialog({
        open: true,
        folderId: folder.id,
        folderName: folder.name,
        sdId: folder.sdId,
        hasChildren: false,
        childCount: 0,
        descendantCount: 0,
      });
    }
    handleCloseContextMenu();
  };

  const handleDeleteConfirm = async (
    mode: 'simple' | 'cascade' | 'reparent' = 'simple'
  ): Promise<void> => {
    try {
      await window.electronAPI.folder.delete(deleteDialog.sdId, deleteDialog.folderId, mode);
      setDeleteDialog({
        open: false,
        folderId: '',
        folderName: '',
        sdId: '',
        hasChildren: false,
        childCount: 0,
        descendantCount: 0,
      });
      onRefresh?.();
    } catch (err) {
      console.error('Failed to delete folder:', err);
      setDeleteDialog({
        open: false,
        folderId: '',
        folderName: '',
        sdId: '',
        hasChildren: false,
        childCount: 0,
        descendantCount: 0,
      });
    }
  };

  const handleDeleteCancel = (): void => {
    setDeleteDialog({
      open: false,
      folderId: '',
      folderName: '',
      sdId: '',
      hasChildren: false,
      childCount: 0,
      descendantCount: 0,
    });
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
    const { dragSourceId, dropTargetId, relativeIndex } = options;
    const dragSourceStr = String(dragSourceId);
    const dropTargetStr = String(dropTargetId);

    // Handle SD reordering (drop on spacer or between SDs)
    if (dragSourceStr.startsWith('sd:')) {
      const isDropOnSpacer =
        dropTargetStr === 'sd-spacer-top' || dropTargetStr === 'sd-spacer-bottom';
      const isDropOnSD = dropTargetStr.startsWith('sd:');
      // Also handle drop on root (0) with relativeIndex - this happens for edge drops
      const isDropOnRoot = dropTargetId === 0 && relativeIndex !== undefined;

      if (isDropOnSpacer || isDropOnSD || isDropOnRoot) {
        const sdIdToMove = dragSourceStr.replace('sd:', '');
        const currentSdIds = sds.map((sd) => sd.id);
        const currentIndex = currentSdIds.indexOf(sdIdToMove);

        if (currentIndex === -1) {
          console.error('[FolderTree] Cannot find SD to reorder');
          return;
        }

        // Create new order by moving the SD
        const newOrder = [...currentSdIds];
        newOrder.splice(currentIndex, 1);

        // Determine insertion index based on drop target
        let insertIndex: number;
        if (dropTargetStr === 'sd-spacer-top') {
          // Dropping on top spacer = move to first position
          insertIndex = 0;
        } else if (dropTargetStr === 'sd-spacer-bottom') {
          // Dropping on bottom spacer = move to last position
          insertIndex = newOrder.length;
        } else if (relativeIndex !== undefined) {
          // Dropping between SDs with relativeIndex
          // Adjust for the spacer-top node at index 0
          insertIndex = Math.max(0, relativeIndex - 1);
        } else {
          // Shouldn't happen, but fallback to end
          insertIndex = newOrder.length;
        }

        newOrder.splice(insertIndex, 0, sdIdToMove);

        console.log(`[FolderTree] Reordering SD ${sdIdToMove} to index ${insertIndex}`, newOrder);

        try {
          // Save new order to app state
          await window.electronAPI.appState.set(SD_ORDER_KEY, JSON.stringify(newOrder));

          // Update local state immediately
          const reorderedSds = sortSDsByOrder(sds, newOrder);
          setSds(reorderedSds);

          // Rebuild tree with new SD order
          const nodes = buildMultiSDTreeNodes(reorderedSds, foldersBySd, activeSdId);
          setTreeData(nodes);
        } catch (err) {
          console.error('Failed to reorder SDs:', err);
        }
        return;
      }
    }

    // Don't allow dragging special items (handle both single and multi-SD formats)
    if (dragSourceStr.includes('all-notes') || dragSourceStr.includes('recently-deleted')) {
      return;
    }

    // Don't allow dropping folders on "Recently Deleted"
    if (dropTargetStr.includes('recently-deleted')) {
      return;
    }

    // For SD header drops: allow if this is a reorder operation (relativeIndex provided)
    // This happens when reordering root-level folders - the library reports the SD header as dropTarget
    if (dropTargetStr.startsWith('sd:')) {
      if (relativeIndex === undefined) {
        // Not a reorder - block the drop (can't nest folders under SD header)
        return;
      }
      // This is a reorder operation - continue to handle it below
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

    // Get the dragged node to check its current parent
    const dragNode = treeData.find((n) => n.id === dragSourceId);
    if (!dragNode) {
      console.error('[FolderTree] Cannot find dragged node');
      return;
    }

    const currentParentId = dragNode.parent;

    // Ignore drop if target is the same as source (can't drop onto self)
    if (dragSourceId === dropTargetId) {
      return;
    }

    // Determine which SD this operation is for
    const targetSdId = isMultiSDMode ? ((dragNode.data as { sdId?: string }).sdId ?? sdId) : sdId;

    if (!targetSdId) {
      console.error('[FolderTree] Cannot determine SD for folder operation');
      return;
    }

    // Check if this is a reorder operation (same parent, relativeIndex provided)
    // relativeIndex is the position among siblings where the item should be placed
    const currentParentStr = String(currentParentId);
    const isReorderOperation =
      relativeIndex !== undefined &&
      (currentParentStr === dropTargetStr ||
        // Handle drop on "All Notes" (root) when folder is already at root
        (dropTargetStr === 'all-notes' && currentParentStr === '0') ||
        (dropTargetStr.startsWith('all-notes:') && currentParentStr === `sd:${targetSdId}`) ||
        // Handle drop on SD header when folder is already under that SD
        (dropTargetStr === `sd:${targetSdId}` && currentParentStr === `sd:${targetSdId}`));

    try {
      if (isReorderOperation) {
        // Reorder within same parent
        await window.electronAPI.folder.reorder(targetSdId, String(dragSourceId), relativeIndex);
      } else {
        // Move to different parent
        let newParentId: string | null = null;

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

        console.log(
          `[FolderTree] Moving folder ${dragSourceId} to parent ${newParentId} in SD ${targetSdId}`
        );
        await window.electronAPI.folder.move(targetSdId, String(dragSourceId), newParentId);
      }

      // Update tree data locally for immediate feedback
      setTreeData(newTree);

      // Trigger refresh to get updated data from backend
      onRefresh?.();
    } catch (err) {
      console.error('Failed to move/reorder folder:', err);
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
    // Allow SD headers to be dragged (for reordering), but not special items
    if (nodeData.isSD) return true;
    return !nodeData.isSpecial;
  };

  // Control where nodes can be dropped
  const canDrop = (tree: NodeModel[], options: DropOptions): boolean => {
    const { dragSourceId, dropTargetId, relativeIndex } = options;
    const dragSourceStr = String(dragSourceId);
    const dropTargetStr = String(dropTargetId);

    // SD header reordering: SD can only be dropped at root level (reorder among SDs)
    if (dragSourceStr.startsWith('sd:')) {
      // SD can be dropped on spacers (top/bottom) for reordering
      if (dropTargetStr === 'sd-spacer-top' || dropTargetStr === 'sd-spacer-bottom') {
        return true;
      }
      // SD can be dropped at root level (for reordering among SDs)
      // NOTE: relativeIndex is always undefined in canDrop (library limitation),
      // so we just allow drops on root and let handleDrop handle the logic
      if (dropTargetId === 0) {
        return true;
      }
      // SD can be dropped on another SD (edge drop for reordering)
      // The library uses the sibling SD as dropTarget for edge detection
      if (dropTargetStr.startsWith('sd:') && dragSourceStr !== dropTargetStr) {
        return true;
      }
      return false; // Block all other SD drops
    }

    // Can't drag special items (All Notes, Recently Deleted), spacers
    if (
      dragSourceStr.includes('all-notes') ||
      dragSourceStr.includes('recently-deleted') ||
      dragSourceStr.startsWith('sd-spacer')
    ) {
      return false;
    }

    // Can't drop folders on "Recently Deleted" or spacers
    // NOTE: We allow dropping folders on SD headers because the library uses the SD header
    // as the dropTargetId when reordering root-level folders (it's the parent node).
    // The handleDrop function will interpret this correctly as a reorder or move-to-root.
    if (dropTargetStr.includes('recently-deleted') || dropTargetStr.startsWith('sd-spacer')) {
      return false;
    }

    // In multi-SD mode, prevent cross-SD drops for folders
    if (isMultiSDMode) {
      const dragNode = tree.find((n) => n.id === dragSourceId);
      const dropNode = tree.find((n) => n.id === dropTargetId);

      if (dragNode && dropNode) {
        const dragSdId = (dragNode.data as { sdId?: string }).sdId;
        // For drop target, handle special cases like "all-notes:sd-id"
        let dropSdId = (dropNode.data as { sdId?: string }).sdId;

        // Extract SD ID from special node IDs
        if (!dropSdId && dropTargetStr.includes(':')) {
          const parts = dropTargetStr.split(':');
          dropSdId = parts[1];
        }

        if (dragSdId && dropSdId && dragSdId !== dropSdId) {
          return false; // Cannot drop across SDs
        }
      }
    }

    // Block reordering that would place a folder before "All Notes" or after "Recently Deleted"
    // This happens when relativeIndex is provided (reorder operation) and the drop target is at root level
    if (relativeIndex !== undefined) {
      const isRootLevelDrop =
        dropTargetId === 0 ||
        dropTargetStr === 'all-notes' ||
        dropTargetStr.startsWith('all-notes:') ||
        dropTargetStr.startsWith('sd:');

      if (isRootLevelDrop) {
        // Dropping at index 0 would place folder before "All Notes" - block this
        if (relativeIndex === 0) {
          return false;
        }

        // Get sibling count at this level to check if dropping after "Recently Deleted"
        // Find all siblings at this parent level
        let parentId: string | number;
        if (dropTargetId === 0 || dropTargetStr === 'all-notes') {
          parentId = 0;
        } else if (dropTargetStr.startsWith('all-notes:')) {
          const sdId = dropTargetStr.split(':')[1];
          parentId = `sd:${sdId}`;
        } else if (dropTargetStr.startsWith('sd:')) {
          parentId = dropTargetStr;
        } else {
          parentId = dropTargetId;
        }

        const siblings = tree.filter((n) => n.parent === parentId);
        // If relativeIndex would place after the last real item (which is Recently Deleted), block it
        // Recently Deleted is always last, so its index is siblings.length - 1
        // Dropping at siblings.length would be after Recently Deleted
        if (relativeIndex >= siblings.length) {
          return false;
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

      // Use provided sourceSdId or get from note metadata
      const effectiveSourceSdId = sourceSdId ?? firstNoteMetadata.sdId;
      console.log('[FolderTree] Note drop:', {
        noteIds,
        targetFolderId,
        sourceSdId: effectiveSourceSdId,
      });

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
          sort={false} // Disable library sorting - we pre-sort in buildTreeNodes/buildMultiSDTreeNodes
          insertDroppableFirst={false} // Don't auto-reorder droppable nodes
          dropTargetOffset={8} // Pixels from edge to trigger reorder vs nest (must be < height/2 to allow nesting)
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
          placeholderRender={(_node, { depth }) => {
            // Visual indicator for where the dragged item will be inserted
            return (
              <Box
                sx={{
                  height: '2px',
                  backgroundColor: 'primary.main',
                  marginLeft: `${depth * 24 + 8}px`,
                  marginRight: '8px',
                  borderRadius: '1px',
                }}
              />
            );
          }}
          render={(node, { depth, onToggle, isDropTarget, handleRef }) => {
            // Render spacer nodes as thin drop zones
            const nodeId = String(node.id);
            if (nodeId === 'sd-spacer-top' || nodeId === 'sd-spacer-bottom') {
              // Return a thin drop zone that shows highlight when dragging over
              return (
                <Box
                  data-testid={`folder-tree-node-${nodeId}`}
                  sx={{
                    height: isDropTarget ? 8 : 4,
                    backgroundColor: isDropTarget ? 'primary.main' : 'transparent',
                    transition: 'all 0.2s ease',
                    mx: 1,
                    borderRadius: 1,
                  }}
                />
              );
            }

            const isSelected = nodeId === selectedFolderId;
            const isExpanded = expandedFolderIds.includes(nodeId);
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
                (nodeId.includes(':') && nodeId.split(':')[1] === activeSdId));

            // SD nodes need a drag handle wrapper for reordering
            const nodeContent = (
              <ListItemButton
                dense
                data-testid={`folder-tree-node-${nodeId}`}
                data-active-sd={belongsToActiveSD ? 'true' : undefined}
                aria-label={node.text}
                sx={{
                  pl: depth * 2,
                  py: 0,
                  minHeight: 0,
                  height: 26, // Force compact height
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
                  if (isSDNode) {
                    // SD nodes get their own context menu with Rename option
                    const sdId = (node.data as { sdId?: string }).sdId;
                    if (sdId) {
                      handleSdContextMenu(e, sdId, node.text);
                    }
                  } else {
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
            );

            // All nodes need handleRef for @minoru/react-dnd-treeview drag-and-drop to work
            return (
              <div ref={handleRef as React.RefObject<HTMLDivElement>}>
                <DroppableFolderNode
                  folderId={nodeId}
                  onDrop={(noteIds, targetFolderId, sourceSdId) => {
                    void handleNoteDrop(noteIds, targetFolderId, sourceSdId);
                  }}
                  isSpecial={isSpecialNode || isSDNode}
                >
                  {nodeContent}
                </DroppableFolderNode>
              </div>
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
        <MenuItem
          onClick={() => {
            void handleDeleteClick();
          }}
        >
          Delete
        </MenuItem>
      </Menu>

      {/* Trash Context Menu */}
      <Menu
        open={trashContextMenu !== null}
        onClose={handleCloseTrashContextMenu}
        anchorEl={trashContextMenu?.anchorEl}
      >
        <MenuItem onClick={handleEmptyTrashClick} disabled={trashNoteCount === 0}>
          Empty Trash{trashNoteCount === 0 ? '' : ` (${trashNoteCount})`}
        </MenuItem>
      </Menu>

      {/* Empty Trash Confirmation Dialog */}
      <Dialog open={emptyTrashDialog.open} onClose={handleEmptyTrashCancel} maxWidth="xs" fullWidth>
        <DialogTitle>Empty Trash?</DialogTitle>
        <DialogContent>
          <Typography>
            Permanently delete {emptyTrashDialog.noteCount} note
            {emptyTrashDialog.noteCount === 1 ? '' : 's'}? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleEmptyTrashCancel}>Cancel</Button>
          <Button
            onClick={() => {
              void handleEmptyTrashConfirm();
            }}
            variant="contained"
            color="error"
          >
            Empty Trash
          </Button>
        </DialogActions>
      </Dialog>

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
      <Dialog open={deleteDialog.open} onClose={handleDeleteCancel} maxWidth="sm" fullWidth>
        <DialogTitle>Delete Folder</DialogTitle>
        <DialogContent>
          {deleteDialog.hasChildren ? (
            <Box>
              <Typography sx={{ mb: 2 }}>
                &ldquo;{deleteDialog.folderName}&rdquo; contains {deleteDialog.descendantCount}{' '}
                subfolder{deleteDialog.descendantCount === 1 ? '' : 's'}. How would you like to
                proceed?
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Notes in deleted folders will be moved to the parent folder.
              </Typography>
            </Box>
          ) : (
            <Typography>
              Are you sure you want to delete &ldquo;{deleteDialog.folderName}&rdquo;? Notes in this
              folder will be moved to the parent folder.
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ flexDirection: deleteDialog.hasChildren ? 'column' : 'row', gap: 1 }}>
          {deleteDialog.hasChildren ? (
            <>
              <Box
                sx={{ display: 'flex', justifyContent: 'flex-end', width: '100%', gap: 1, mb: 1 }}
              >
                <Button onClick={handleDeleteCancel}>Cancel</Button>
              </Box>
              <Button
                onClick={() => {
                  void handleDeleteConfirm('reparent');
                }}
                variant="outlined"
                fullWidth
                sx={{ textTransform: 'none' }}
              >
                Delete folder only, move subfolders to parent
              </Button>
              <Button
                onClick={() => {
                  void handleDeleteConfirm('cascade');
                }}
                variant="contained"
                color="error"
                fullWidth
                sx={{ textTransform: 'none' }}
              >
                Delete folder and all {deleteDialog.descendantCount} subfolder
                {deleteDialog.descendantCount === 1 ? '' : 's'}
              </Button>
            </>
          ) : (
            <>
              <Button onClick={handleDeleteCancel}>Cancel</Button>
              <Button
                onClick={() => {
                  void handleDeleteConfirm('reparent');
                }}
                variant="contained"
                color="error"
              >
                Delete
              </Button>
            </>
          )}
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

      {/* SD Context Menu */}
      <Menu
        open={sdContextMenu !== null}
        onClose={handleCloseSdContextMenu}
        anchorEl={sdContextMenu?.anchorEl}
      >
        <MenuItem onClick={handleSdRenameClick}>Rename</MenuItem>
      </Menu>

      {/* SD Rename Dialog */}
      <Dialog open={sdRenameDialog.open} onClose={handleSdRenameCancel} maxWidth="xs" fullWidth>
        <DialogTitle>Rename Storage Directory</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Name"
            type="text"
            fullWidth
            value={sdRenameDialog.newName}
            onChange={(e) => {
              setSdRenameDialog({ ...sdRenameDialog, newName: e.target.value });
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && sdRenameDialog.newName.trim()) {
                void handleSdRenameConfirm();
              } else if (e.key === 'Escape') {
                handleSdRenameCancel();
              }
            }}
            onFocus={(e) => {
              // Select all text when focused
              e.target.select();
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleSdRenameCancel}>Cancel</Button>
          <Button
            onClick={() => {
              void handleSdRenameConfirm();
            }}
            variant="contained"
            disabled={!sdRenameDialog.newName.trim()}
          >
            OK
          </Button>
        </DialogActions>
      </Dialog>

      {/* SD Rename Error Snackbar */}
      <Snackbar
        open={sdRenameSnackbar.open}
        autoHideDuration={5000}
        onClose={handleSdRenameSnackbarClose}
        message={sdRenameSnackbar.message}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  );
};
