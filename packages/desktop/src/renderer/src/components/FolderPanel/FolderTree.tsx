/**
 * FolderTree Component
 *
 * Displays the hierarchical folder structure using MUI RichTreeView.
 * Phase 2.4.1: Read-only display with selection and expand/collapse.
 */

import React, { useEffect, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { RichTreeView } from '@mui/x-tree-view/RichTreeView';
import { TreeViewBaseItem } from '@mui/x-tree-view/models';

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

export const FolderTree: React.FC<FolderTreeProps> = ({
  sdId,
  selectedFolderId,
  expandedFolderIds = [],
  onFolderSelect,
  onExpandedChange,
  refreshTrigger = 0,
}) => {
  const [folders, setFolders] = useState<FolderData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const treeItems = buildTreeItems(folders);

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
      />
    </Box>
  );
};
