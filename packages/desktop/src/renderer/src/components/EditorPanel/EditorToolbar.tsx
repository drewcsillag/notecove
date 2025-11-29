/**
 * Editor Toolbar Component
 *
 * Formatting toolbar for TipTap editor with Material-UI buttons.
 */

import React from 'react';
import { Box, IconButton, Divider, Tooltip } from '@mui/material';
import {
  FormatBold,
  FormatItalic,
  FormatUnderlined,
  FormatStrikethrough,
  Code,
  FormatQuote,
  FormatListBulleted,
  FormatListNumbered,
  HorizontalRule,
  Undo,
  Redo,
  CheckBoxOutlineBlank,
} from '@mui/icons-material';
import type { Editor } from '@tiptap/react';

export interface EditorToolbarProps {
  editor: Editor | null;
}

export const EditorToolbar: React.FC<EditorToolbarProps> = ({ editor }) => {
  if (!editor) {
    return null;
  }

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
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          color={editor.isActive('bulletList') ? 'primary' : 'default'}
        >
          <FormatListBulleted fontSize="small" />
        </IconButton>
      </Tooltip>

      <Tooltip title="Numbered List (⌘⇧7)">
        <IconButton
          size="small"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          color={editor.isActive('orderedList') ? 'primary' : 'default'}
        >
          <FormatListNumbered fontSize="small" />
        </IconButton>
      </Tooltip>

      <Tooltip title="Convert to Task Item">
        <IconButton
          size="small"
          onClick={() => editor.chain().focus().convertToTaskItem().run()}
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

      <Tooltip title="Horizontal Rule">
        <IconButton size="small" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
          <HorizontalRule fontSize="small" />
        </IconButton>
      </Tooltip>

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
