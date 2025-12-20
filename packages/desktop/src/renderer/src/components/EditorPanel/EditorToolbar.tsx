/**
 * Editor Toolbar Component
 *
 * Formatting toolbar for TipTap editor with Material-UI buttons.
 */

import React from 'react';
import { Box, IconButton, Divider, Tooltip, Badge } from '@mui/material';
import {
  FormatBold,
  FormatItalic,
  FormatUnderlined,
  FormatStrikethrough,
  Code,
  DataObject,
  FormatQuote,
  FormatListBulleted,
  FormatListNumbered,
  HorizontalRule,
  Undo,
  Redo,
  CheckBoxOutlineBlank,
  Link,
  AddPhotoAlternate,
  TableChart,
  // Table manipulation icons
  AddCircleOutline,
  RemoveCircleOutline,
  BorderTop,
  DeleteSweep,
  // Cell alignment icons
  FormatAlignLeft,
  FormatAlignCenter,
  FormatAlignRight,
  // Comment icons
  AddComment,
  Comment,
} from '@mui/icons-material';
import type { Editor } from '@tiptap/react';
import { canAddRow, canAddColumn, canDeleteRow, canDeleteColumn } from './extensions/Table';

// Extended chain commands interface for our custom table commands
interface ExtendedChainCommands {
  setColumnAlignment: (alignment: 'left' | 'center' | 'right') => ExtendedChainCommands;
  run: () => boolean;
}

export interface EditorToolbarProps {
  editor: Editor | null;
  /**
   * Callback when the link button is clicked
   * Called with the button element for popover positioning
   */
  onLinkButtonClick?: (buttonElement: HTMLElement) => void;
  /**
   * Callback when the image button is clicked
   * Called with the button element for popover positioning
   */
  onImageButtonClick?: (buttonElement: HTMLElement) => void;
  /**
   * Callback when the table button is clicked
   * Called with the button element for popover positioning
   */
  onTableButtonClick?: (buttonElement: HTMLElement) => void;
  /**
   * Callback when the comment button is clicked
   * Called with the current selection info
   */
  onCommentButtonClick?: () => void;
  /**
   * Callback when the "view all comments" button is clicked
   * Opens the comment panel without selecting a specific thread
   */
  onViewCommentsClick?: () => void;
  /**
   * Whether any text is currently selected (for enabling comment button)
   */
  hasTextSelection?: boolean;
  /**
   * Number of open (unresolved) comments for the current note
   */
  commentCount?: number;
}

export const EditorToolbar: React.FC<EditorToolbarProps> = ({
  editor,
  onLinkButtonClick,
  onImageButtonClick,
  onTableButtonClick,
  onCommentButtonClick,
  onViewCommentsClick,
  hasTextSelection = false,
  commentCount = 0,
}) => {
  if (!editor) {
    return null;
  }

  /**
   * Handle link button click
   */
  const handleLinkClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (onLinkButtonClick) {
      onLinkButtonClick(event.currentTarget);
    }
  };

  /**
   * Handle image button click
   */
  const handleImageClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (onImageButtonClick) {
      onImageButtonClick(event.currentTarget);
    }
  };

  /**
   * Handle table button click
   */
  const handleTableClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (onTableButtonClick) {
      onTableButtonClick(event.currentTarget);
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 0.5,
        padding: 1,
        borderBottom: 1,
        borderColor: 'divider',
        backgroundColor: 'background.paper',
      }}
    >
      {/* Text Formatting */}
      <Tooltip title="Bold (⌘B)">
        <IconButton
          size="small"
          onClick={() => editor.chain().focus().toggleBold().run()}
          color={editor.isActive('bold') ? 'primary' : 'default'}
        >
          <FormatBold fontSize="small" />
        </IconButton>
      </Tooltip>

      <Tooltip title="Italic (⌘I)">
        <IconButton
          size="small"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          color={editor.isActive('italic') ? 'primary' : 'default'}
        >
          <FormatItalic fontSize="small" />
        </IconButton>
      </Tooltip>

      <Tooltip title="Underline (⌘U)">
        <IconButton
          size="small"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          color={editor.isActive('underline') ? 'primary' : 'default'}
        >
          <FormatUnderlined fontSize="small" />
        </IconButton>
      </Tooltip>

      <Tooltip title="Strikethrough (⌘⇧X)">
        <IconButton
          size="small"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          color={editor.isActive('strike') ? 'primary' : 'default'}
        >
          <FormatStrikethrough fontSize="small" />
        </IconButton>
      </Tooltip>

      <Tooltip title="Code (⌘E)">
        <IconButton
          size="small"
          onClick={() => editor.chain().focus().toggleCode().run()}
          color={editor.isActive('code') ? 'primary' : 'default'}
        >
          <Code fontSize="small" />
        </IconButton>
      </Tooltip>

      <Tooltip title="Insert link (⌘K)">
        <IconButton
          size="small"
          onClick={handleLinkClick}
          color={editor.isActive('link') ? 'primary' : 'default'}
          aria-label="Insert link"
        >
          <Link fontSize="small" />
        </IconButton>
      </Tooltip>

      <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

      {/* Headings */}
      {[1, 2, 3].map((level) => (
        <Tooltip key={level} title={`Heading ${level} (⌘⌥${level})`}>
          <IconButton
            size="small"
            onClick={() =>
              editor
                .chain()
                .focus()
                .toggleHeading({ level: level as 1 | 2 | 3 })
                .run()
            }
            color={editor.isActive('heading', { level }) ? 'primary' : 'default'}
            sx={{ fontWeight: 'bold', fontSize: '0.9em' }}
          >
            H{level}
          </IconButton>
        </Tooltip>
      ))}

      <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

      {/* Lists */}
      <Tooltip title="Bullet List (⌘⇧8)">
        <IconButton
          size="small"
          onClick={() => {
            // If on a taskItem in a bulletList, convert to regular listItem
            // Otherwise, toggle bullet list (handles: ordered->bullet, paragraph->bullet, or toggle off)
            if (editor.isActive('taskItem') && editor.isActive('bulletList')) {
              editor.chain().focus().convertToListItem().run();
            } else {
              editor.chain().focus().toggleBulletList().run();
            }
          }}
          color={editor.isActive('bulletList') ? 'primary' : 'default'}
        >
          <FormatListBulleted fontSize="small" />
        </IconButton>
      </Tooltip>

      <Tooltip title="Numbered List (⌘⇧7)">
        <IconButton
          size="small"
          onClick={() => {
            // If on a taskItem in an orderedList, convert to regular listItem
            // Otherwise, toggle ordered list (handles: bullet->ordered, paragraph->ordered, or toggle off)
            if (editor.isActive('taskItem') && editor.isActive('orderedList')) {
              editor.chain().focus().convertToListItem().run();
            } else {
              editor.chain().focus().toggleOrderedList().run();
            }
          }}
          color={editor.isActive('orderedList') ? 'primary' : 'default'}
        >
          <FormatListNumbered fontSize="small" />
        </IconButton>
      </Tooltip>

      <Tooltip title="Toggle Task Item">
        <IconButton
          size="small"
          onClick={() => editor.chain().focus().toggleTaskItem().run()}
          color={editor.isActive('taskItem') ? 'primary' : 'default'}
        >
          <CheckBoxOutlineBlank fontSize="small" />
        </IconButton>
      </Tooltip>

      <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

      {/* Block Elements */}
      <Tooltip title="Blockquote (⌘⇧B)">
        <IconButton
          size="small"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          color={editor.isActive('blockquote') ? 'primary' : 'default'}
        >
          <FormatQuote fontSize="small" />
        </IconButton>
      </Tooltip>

      <Tooltip title="Code block (⌘⇧C)">
        <IconButton
          size="small"
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          color={editor.isActive('codeBlock') ? 'primary' : 'default'}
          aria-label="Code block"
        >
          <DataObject fontSize="small" />
        </IconButton>
      </Tooltip>

      <Tooltip title="Horizontal Rule">
        <IconButton size="small" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
          <HorizontalRule fontSize="small" />
        </IconButton>
      </Tooltip>

      <Tooltip title="Insert image (⌘⇧I)">
        <IconButton
          size="small"
          onClick={handleImageClick}
          aria-label="Insert image"
          data-testid="image-button"
        >
          <AddPhotoAlternate fontSize="small" />
        </IconButton>
      </Tooltip>

      <Tooltip title="Insert table">
        <IconButton
          size="small"
          onClick={handleTableClick}
          color={editor.isActive('table') ? 'primary' : 'default'}
          aria-label="Insert table"
          data-testid="table-button"
        >
          <TableChart fontSize="small" />
        </IconButton>
      </Tooltip>

      <Tooltip title={hasTextSelection ? 'Add comment (⌘⌥M)' : 'Select text to add comment'}>
        <span>
          <IconButton
            size="small"
            onClick={onCommentButtonClick}
            disabled={!hasTextSelection}
            aria-label="Add comment"
            data-testid="comment-button"
          >
            <AddComment fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>

      <Tooltip title="View comments">
        <IconButton
          size="small"
          onClick={onViewCommentsClick}
          aria-label="View comments"
          data-testid="view-comments-button"
        >
          <Badge
            badgeContent={commentCount}
            color="primary"
            max={99}
            sx={{
              '& .MuiBadge-badge': {
                fontSize: '0.6rem',
                minWidth: '14px',
                height: '14px',
                padding: '0 3px',
              },
            }}
          >
            <Comment fontSize="small" />
          </Badge>
        </IconButton>
      </Tooltip>

      {/* Table Manipulation - only shown when cursor is in a table */}
      {editor.isActive('table') && (
        <>
          <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

          <Tooltip title="Add row below (⌘↵)">
            <IconButton
              size="small"
              onClick={() => canAddRow(editor) && editor.chain().focus().addRowAfter().run()}
              disabled={!canAddRow(editor)}
              aria-label="Add row below"
              data-testid="table-add-row-after"
            >
              <AddCircleOutline fontSize="small" sx={{ transform: 'rotate(0deg)' }} />
              <Box
                component="span"
                sx={{ fontSize: '0.6rem', fontWeight: 'bold', ml: -0.5, mt: 0.5 }}
              >
                R
              </Box>
            </IconButton>
          </Tooltip>

          <Tooltip title="Add column right (⌘⇧↵)">
            <IconButton
              size="small"
              onClick={() => canAddColumn(editor) && editor.chain().focus().addColumnAfter().run()}
              disabled={!canAddColumn(editor)}
              aria-label="Add column right"
              data-testid="table-add-col-after"
            >
              <AddCircleOutline fontSize="small" />
              <Box
                component="span"
                sx={{ fontSize: '0.6rem', fontWeight: 'bold', ml: -0.5, mt: 0.5 }}
              >
                C
              </Box>
            </IconButton>
          </Tooltip>

          <Tooltip title="Delete row (⌘⌫)">
            <IconButton
              size="small"
              onClick={() => canDeleteRow(editor) && editor.chain().focus().deleteRow().run()}
              disabled={!canDeleteRow(editor)}
              aria-label="Delete row"
              data-testid="table-delete-row"
            >
              <RemoveCircleOutline fontSize="small" color="error" />
              <Box
                component="span"
                sx={{ fontSize: '0.6rem', fontWeight: 'bold', ml: -0.5, mt: 0.5 }}
              >
                R
              </Box>
            </IconButton>
          </Tooltip>

          <Tooltip title="Delete column (⌘⇧⌫)">
            <IconButton
              size="small"
              onClick={() => canDeleteColumn(editor) && editor.chain().focus().deleteColumn().run()}
              disabled={!canDeleteColumn(editor)}
              aria-label="Delete column"
              data-testid="table-delete-col"
            >
              <RemoveCircleOutline fontSize="small" color="error" />
              <Box
                component="span"
                sx={{ fontSize: '0.6rem', fontWeight: 'bold', ml: -0.5, mt: 0.5 }}
              >
                C
              </Box>
            </IconButton>
          </Tooltip>

          <Tooltip title="Toggle header row">
            <IconButton
              size="small"
              onClick={() => editor.chain().focus().toggleHeaderRow().run()}
              aria-label="Toggle header row"
              data-testid="table-toggle-header"
            >
              <BorderTop fontSize="small" />
            </IconButton>
          </Tooltip>

          <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

          <Tooltip title="Align column left">
            <IconButton
              size="small"
              onClick={() =>
                (editor.chain().focus() as unknown as ExtendedChainCommands)
                  .setColumnAlignment('left')
                  .run()
              }
              aria-label="Align column left"
              data-testid="table-column-align-left"
            >
              <FormatAlignLeft fontSize="small" />
            </IconButton>
          </Tooltip>

          <Tooltip title="Align column center">
            <IconButton
              size="small"
              onClick={() =>
                (editor.chain().focus() as unknown as ExtendedChainCommands)
                  .setColumnAlignment('center')
                  .run()
              }
              aria-label="Align column center"
              data-testid="table-column-align-center"
            >
              <FormatAlignCenter fontSize="small" />
            </IconButton>
          </Tooltip>

          <Tooltip title="Align column right">
            <IconButton
              size="small"
              onClick={() =>
                (editor.chain().focus() as unknown as ExtendedChainCommands)
                  .setColumnAlignment('right')
                  .run()
              }
              aria-label="Align column right"
              data-testid="table-column-align-right"
            >
              <FormatAlignRight fontSize="small" />
            </IconButton>
          </Tooltip>

          <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

          <Tooltip title="Delete table">
            <IconButton
              size="small"
              onClick={() => editor.chain().focus().deleteTable().run()}
              aria-label="Delete table"
              data-testid="table-delete"
              color="error"
            >
              <DeleteSweep fontSize="small" />
            </IconButton>
          </Tooltip>
        </>
      )}

      <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

      {/* Undo/Redo */}
      <Tooltip title="Undo (⌘Z)">
        <IconButton
          size="small"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          aria-label="Undo"
          data-testid="undo-button"
        >
          <Undo fontSize="small" />
        </IconButton>
      </Tooltip>

      <Tooltip title="Redo (⌘⇧Z)">
        <IconButton
          size="small"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          aria-label="Redo"
          data-testid="redo-button"
        >
          <Redo fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  );
};
