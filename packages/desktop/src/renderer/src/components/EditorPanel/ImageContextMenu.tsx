/**
 * ImageContextMenu - Right-click context menu for images
 *
 * Provides image-specific actions:
 * - Copy Image - Copy to clipboard
 * - Save Image As... - Save to file system
 * - Open Original - Open full file in default app
 * - Edit Properties... - Open properties dialog
 * - Delete Image - Remove from note
 * - Set as Block / Set as Inline - Toggle display mode
 * - Alignment submenu - Left, Center, Right
 *
 * @see plans/add-images/PLAN-PHASE-3.md
 * @see plans/add-images/PLAN-PHASE-4.md
 */

import { useState, useEffect, useCallback } from 'react';
import { Menu, MenuItem, Divider, ListItemIcon, ListItemText } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import SaveAltIcon from '@mui/icons-material/SaveAlt';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import SettingsIcon from '@mui/icons-material/Settings';
import DeleteIcon from '@mui/icons-material/Delete';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import ViewStreamIcon from '@mui/icons-material/ViewStream';
import FormatAlignLeftIcon from '@mui/icons-material/FormatAlignLeft';
import FormatAlignCenterIcon from '@mui/icons-material/FormatAlignCenter';
import FormatAlignRightIcon from '@mui/icons-material/FormatAlignRight';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { ImagePropertiesDialog } from './ImagePropertiesDialog';
import type { ImageNodeAttrs } from './extensions/Image';

/** Event data for opening context menu */
export interface ContextMenuOpenEvent {
  imageId: string;
  sdId: string;
  x: number;
  y: number;
  /** All current image attributes */
  attrs: ImageNodeAttrs;
  /** Callback to update image attributes */
  onUpdateAttrs: (attrs: Partial<ImageNodeAttrs>) => void;
  /** Callback to delete the image */
  onDelete: () => void;
}

/** Custom event name for opening context menu */
export const CONTEXT_MENU_OPEN_EVENT = 'notecove:image-context-menu:open';

/**
 * Dispatch event to open context menu
 */
export function openImageContextMenu(data: ContextMenuOpenEvent): void {
  const event = new CustomEvent(CONTEXT_MENU_OPEN_EVENT, { detail: data });
  window.dispatchEvent(event);
}

/**
 * ImageContextMenu component
 */
export function ImageContextMenu(): React.JSX.Element | null {
  const [anchorPosition, setAnchorPosition] = useState<{ top: number; left: number } | null>(null);
  const [currentData, setCurrentData] = useState<ContextMenuOpenEvent | null>(null);
  const [alignmentMenuAnchor, setAlignmentMenuAnchor] = useState<HTMLElement | null>(null);
  const [propertiesDialogOpen, setPropertiesDialogOpen] = useState(false);
  const [propertiesDialogData, setPropertiesDialogData] = useState<ContextMenuOpenEvent | null>(
    null
  );

  // Handle open event
  useEffect(() => {
    const handleOpen = (e: Event): void => {
      const data = (e as CustomEvent<ContextMenuOpenEvent>).detail;
      setCurrentData(data);
      setAnchorPosition({ top: data.y, left: data.x });
    };

    window.addEventListener(CONTEXT_MENU_OPEN_EVENT, handleOpen);
    return () => {
      window.removeEventListener(CONTEXT_MENU_OPEN_EVENT, handleOpen);
    };
  }, []);

  // Close menu
  const handleClose = useCallback(() => {
    setAnchorPosition(null);
    setCurrentData(null);
    setAlignmentMenuAnchor(null);
  }, []);

  // Copy image to clipboard
  const handleCopyImage = useCallback(async () => {
    if (!currentData) return;
    try {
      await window.electronAPI.image.copyToClipboard(currentData.sdId, currentData.imageId);
      handleClose();
    } catch (error) {
      console.error('[ImageContextMenu] Failed to copy image:', error);
    }
  }, [currentData, handleClose]);

  // Save image as...
  const handleSaveAs = useCallback(async () => {
    if (!currentData) return;
    try {
      await window.electronAPI.image.saveAs(currentData.sdId, currentData.imageId);
      handleClose();
    } catch (error) {
      console.error('[ImageContextMenu] Failed to save image:', error);
    }
  }, [currentData, handleClose]);

  // Open original in external app
  const handleOpenOriginal = useCallback(async () => {
    if (!currentData) return;
    try {
      await window.electronAPI.image.openExternal(currentData.sdId, currentData.imageId);
      handleClose();
    } catch (error) {
      console.error('[ImageContextMenu] Failed to open image:', error);
    }
  }, [currentData, handleClose]);

  // Edit properties - open dialog
  const handleEditProperties = useCallback(() => {
    if (!currentData) return;
    // Store the data for the dialog before closing menu
    setPropertiesDialogData(currentData);
    setPropertiesDialogOpen(true);
    handleClose();
  }, [currentData, handleClose]);

  // Handle properties dialog save
  const handlePropertiesSave = useCallback(
    (attrs: Partial<ImageNodeAttrs>) => {
      if (!propertiesDialogData) return;
      propertiesDialogData.onUpdateAttrs(attrs);
      setPropertiesDialogOpen(false);
      setPropertiesDialogData(null);
    },
    [propertiesDialogData]
  );

  // Handle properties dialog close
  const handlePropertiesClose = useCallback(() => {
    setPropertiesDialogOpen(false);
    setPropertiesDialogData(null);
  }, []);

  // Delete image
  const handleDelete = useCallback(() => {
    if (!currentData) return;
    currentData.onDelete();
    handleClose();
  }, [currentData, handleClose]);

  // Toggle display mode
  const handleSetDisplay = useCallback(
    (display: 'block' | 'inline') => {
      if (!currentData) return;
      currentData.onUpdateAttrs({ display });
      handleClose();
    },
    [currentData, handleClose]
  );

  // Set alignment
  const handleSetAlignment = useCallback(
    (alignment: 'left' | 'center' | 'right') => {
      if (!currentData) return;
      currentData.onUpdateAttrs({ alignment });
      setAlignmentMenuAnchor(null);
      handleClose();
    },
    [currentData, handleClose]
  );

  // Open alignment submenu
  const handleAlignmentClick = (event: React.MouseEvent<HTMLLIElement>): void => {
    setAlignmentMenuAnchor(event.currentTarget);
  };

  // Close alignment submenu
  const handleAlignmentMenuClose = (): void => {
    setAlignmentMenuAnchor(null);
  };

  const isAlignmentMenuOpen = Boolean(alignmentMenuAnchor);
  const isMenuOpen = Boolean(anchorPosition);

  return (
    <>
      <Menu
        open={isMenuOpen}
        onClose={handleClose}
        anchorReference="anchorPosition"
        anchorPosition={anchorPosition ?? { top: 0, left: 0 }}
        MenuListProps={{
          'aria-label': 'Image context menu',
        }}
      >
        <MenuItem onClick={() => void handleCopyImage()}>
          <ListItemIcon>
            <ContentCopyIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Copy Image</ListItemText>
        </MenuItem>

        <MenuItem onClick={() => void handleSaveAs()}>
          <ListItemIcon>
            <SaveAltIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Save Image As...</ListItemText>
        </MenuItem>

        <MenuItem onClick={() => void handleOpenOriginal()}>
          <ListItemIcon>
            <OpenInNewIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Open Original</ListItemText>
        </MenuItem>

        <MenuItem onClick={handleEditProperties}>
          <ListItemIcon>
            <SettingsIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Edit Properties...</ListItemText>
        </MenuItem>

        <Divider />

        <MenuItem onClick={handleDelete}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText primaryTypographyProps={{ color: 'error' }}>Delete Image</ListItemText>
        </MenuItem>

        <Divider />

        {currentData?.attrs.display === 'inline' ? (
          <MenuItem
            onClick={() => {
              handleSetDisplay('block');
            }}
          >
            <ListItemIcon>
              <ViewModuleIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Set as Block</ListItemText>
          </MenuItem>
        ) : (
          <MenuItem
            onClick={() => {
              handleSetDisplay('inline');
            }}
          >
            <ListItemIcon>
              <ViewStreamIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Set as Inline</ListItemText>
          </MenuItem>
        )}

        <MenuItem onClick={handleAlignmentClick} disabled={currentData?.attrs.display === 'inline'}>
          <ListItemIcon>
            <FormatAlignCenterIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Alignment</ListItemText>
          <ChevronRightIcon fontSize="small" sx={{ ml: 2 }} />
        </MenuItem>
      </Menu>

      {/* Alignment submenu */}
      <Menu
        anchorEl={alignmentMenuAnchor}
        open={isAlignmentMenuOpen}
        onClose={handleAlignmentMenuClose}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
        MenuListProps={{
          'aria-label': 'Alignment options',
        }}
      >
        <MenuItem
          onClick={() => {
            handleSetAlignment('left');
          }}
          selected={currentData?.attrs.alignment === 'left'}
        >
          <ListItemIcon>
            <FormatAlignLeftIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Left</ListItemText>
        </MenuItem>

        <MenuItem
          onClick={() => {
            handleSetAlignment('center');
          }}
          selected={currentData?.attrs.alignment === 'center'}
        >
          <ListItemIcon>
            <FormatAlignCenterIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Center</ListItemText>
        </MenuItem>

        <MenuItem
          onClick={() => {
            handleSetAlignment('right');
          }}
          selected={currentData?.attrs.alignment === 'right'}
        >
          <ListItemIcon>
            <FormatAlignRightIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Right</ListItemText>
        </MenuItem>
      </Menu>

      {/* Properties Dialog */}
      {propertiesDialogData && (
        <ImagePropertiesDialog
          open={propertiesDialogOpen}
          onClose={handlePropertiesClose}
          onSave={handlePropertiesSave}
          attrs={propertiesDialogData.attrs}
        />
      )}
    </>
  );
}

export default ImageContextMenu;
