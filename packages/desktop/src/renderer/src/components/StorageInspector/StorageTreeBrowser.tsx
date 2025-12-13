/**
 * Storage Tree Browser Component
 *
 * Displays the storage directory structure in a tree view.
 * Uses a simple recursive tree implementation.
 */

import React, { useState, useCallback } from 'react';
import { Box, Typography, CircularProgress, List, ListItemButton, Collapse } from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import DescriptionIcon from '@mui/icons-material/Description';
import ImageIcon from '@mui/icons-material/Image';
import DataObjectIcon from '@mui/icons-material/DataObject';
import ArticleIcon from '@mui/icons-material/Article';
import BadgeIcon from '@mui/icons-material/Badge';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import StorageIcon from '@mui/icons-material/Storage';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

/**
 * File type from the service
 */
export type InspectorFileType =
  | 'crdtlog'
  | 'snapshot'
  | 'activity'
  | 'profile'
  | 'image'
  | 'identity'
  | 'directory'
  | 'unknown';

/**
 * Tree node from the service
 */
export interface SDTreeNode {
  name: string;
  path: string;
  type: InspectorFileType;
  size?: number;
  modified?: Date;
  children?: SDTreeNode[];
}

export interface StorageTreeBrowserProps {
  /** Tree data from the service */
  data: SDTreeNode[];
  /** Currently selected path */
  selectedPath?: string | null;
  /** Called when a file is selected */
  onFileSelect?: (node: SDTreeNode) => void;
  /** Loading state */
  loading?: boolean;
  /** Error message */
  error?: string | null;
}

/**
 * Get icon for file type
 */
function getFileIcon(type: InspectorFileType, isOpen?: boolean): React.ReactNode {
  switch (type) {
    case 'directory':
      return isOpen ? (
        <FolderOpenIcon fontSize="small" sx={{ color: 'action.active' }} />
      ) : (
        <FolderIcon fontSize="small" sx={{ color: 'action.active' }} />
      );
    case 'crdtlog':
      return <DataObjectIcon fontSize="small" sx={{ color: 'info.main' }} />;
    case 'snapshot':
      return <StorageIcon fontSize="small" sx={{ color: 'success.main' }} />;
    case 'activity':
      return <ArticleIcon fontSize="small" sx={{ color: 'warning.main' }} />;
    case 'profile':
      return <BadgeIcon fontSize="small" sx={{ color: 'secondary.main' }} />;
    case 'image':
      return <ImageIcon fontSize="small" sx={{ color: 'error.main' }} />;
    case 'identity':
      return <DescriptionIcon fontSize="small" sx={{ color: 'primary.main' }} />;
    default:
      return <HelpOutlineIcon fontSize="small" sx={{ color: 'text.disabled' }} />;
  }
}

/**
 * Format file size for display
 */
function formatFileSize(bytes?: number): string {
  if (bytes === undefined) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface TreeNodeProps {
  node: SDTreeNode;
  depth: number;
  selectedPath: string | null | undefined;
  expandedPaths: Set<string>;
  onToggle: (path: string) => void;
  onSelect: (node: SDTreeNode) => void;
}

const TreeNode: React.FC<TreeNodeProps> = ({
  node,
  depth,
  selectedPath,
  expandedPaths,
  onToggle,
  onSelect,
}) => {
  const isDirectory = node.type === 'directory';
  const isExpanded = expandedPaths.has(node.path);
  const isSelected = selectedPath === node.path;
  const hasChildren = node.children && node.children.length > 0;

  const handleClick = () => {
    if (isDirectory && hasChildren) {
      onToggle(node.path);
    }
    onSelect(node);
  };

  return (
    <>
      <ListItemButton
        onClick={handleClick}
        selected={isSelected}
        sx={{
          pl: depth * 2 + 1,
          py: 0.5,
          minHeight: 32,
        }}
      >
        {/* Expand/collapse icon for directories */}
        <Box sx={{ width: 20, display: 'flex', alignItems: 'center', mr: 0.5 }}>
          {isDirectory &&
            hasChildren &&
            (isExpanded ? (
              <ExpandMoreIcon fontSize="small" />
            ) : (
              <ChevronRightIcon fontSize="small" />
            ))}
        </Box>

        {/* File type icon */}
        <Box sx={{ mr: 1, display: 'flex', alignItems: 'center' }}>
          {getFileIcon(node.type, isExpanded)}
        </Box>

        {/* Name */}
        <Typography
          variant="body2"
          sx={{
            flexGrow: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {node.name}
        </Typography>

        {/* Size for files */}
        {!isDirectory && node.size !== undefined && (
          <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
            {formatFileSize(node.size)}
          </Typography>
        )}
      </ListItemButton>

      {/* Children */}
      {isDirectory && hasChildren && (
        <Collapse in={isExpanded} timeout="auto" unmountOnExit>
          <List component="div" disablePadding>
            {node.children?.map((child) => (
              <TreeNode
                key={child.path}
                node={child}
                depth={depth + 1}
                selectedPath={selectedPath}
                expandedPaths={expandedPaths}
                onToggle={onToggle}
                onSelect={onSelect}
              />
            ))}
          </List>
        </Collapse>
      )}
    </>
  );
};

export const StorageTreeBrowser: React.FC<StorageTreeBrowserProps> = ({
  data,
  selectedPath,
  onFileSelect,
  loading,
  error,
}) => {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());

  const handleToggle = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const handleSelect = useCallback(
    (node: SDTreeNode) => {
      if (onFileSelect) {
        onFileSelect(node);
      }
    },
    [onFileSelect]
  );

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100%',
          p: 2,
        }}
      >
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography color="error" variant="body2">
          {error}
        </Typography>
      </Box>
    );
  }

  if (data.length === 0) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography color="text.secondary" variant="body2">
          No files found in this storage directory
        </Typography>
      </Box>
    );
  }

  return (
    <List
      component="nav"
      dense
      sx={{
        width: '100%',
        py: 0,
      }}
    >
      {data.map((node) => (
        <TreeNode
          key={node.path}
          node={node}
          depth={0}
          selectedPath={selectedPath}
          expandedPaths={expandedPaths}
          onToggle={handleToggle}
          onSelect={handleSelect}
        />
      ))}
    </List>
  );
};

export default StorageTreeBrowser;
