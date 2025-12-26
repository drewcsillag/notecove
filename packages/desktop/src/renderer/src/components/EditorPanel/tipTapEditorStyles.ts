/**
 * TipTap Editor Styles
 *
 * ProseMirror CSS-in-JS styles for the TipTap editor component.
 * Extracted from TipTapEditor.tsx for maintainability.
 */

import type { Theme, SxProps } from '@mui/material';
import { getCodeBlockStyles } from './codeBlockTheme';

/**
 * Returns the complete sx styles for the TipTapEditor outer Box container.
 * Includes all ProseMirror styling for the editor content.
 *
 * @param theme - MUI theme object
 * @returns SxProps style object for the editor container
 */
export function getTipTapEditorStyles(theme: Theme): SxProps<Theme> {
  return {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    '& .ProseMirror': {
      minHeight: '100%',
      outline: 'none',
      // Preserve tab characters and multiple spaces while still allowing text wrap
      whiteSpace: 'pre-wrap',
      '& h1': {
        fontSize: '2em',
        fontWeight: 600,
        marginTop: 2,
        marginBottom: 1,
      },
      '& h2': {
        fontSize: '1.5em',
        fontWeight: 600,
        marginTop: 1.5,
        marginBottom: 0.75,
      },
      '& h3': {
        fontSize: '1.25em',
        fontWeight: 600,
        marginTop: 1.25,
        marginBottom: 0.5,
      },
      '& p': {
        marginBottom: 0,
        marginTop: 0,
      },
      '& ul, & ol': {
        paddingLeft: 2,
        marginBottom: 1,
      },
      // Inline code (not in code blocks)
      '& code': {
        backgroundColor: 'action.hover',
        padding: '2px 4px',
        borderRadius: 0.5,
        fontSize: '0.9em',
      },
      // Code block styles with syntax highlighting (One Dark/One Light theme)
      ...getCodeBlockStyles(theme.palette.mode === 'dark'),
      '& blockquote': {
        borderLeft: '4px solid',
        borderColor: 'primary.main',
        paddingLeft: 2,
        marginLeft: 0,
        fontStyle: 'italic',
        color: 'text.secondary',
      },
      // Hashtag styling
      '& .hashtag': {
        color: theme.palette.primary.main,
        fontWeight: 500,
        cursor: 'pointer',
        textDecoration: 'none',
        '&:hover': {
          textDecoration: 'underline',
        },
      },
      // Date chip styling (YYYY-MM-DD dates)
      // Uses normal text color but with chip background
      '& .date-chip': {
        backgroundColor:
          theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
        color: theme.palette.text.primary,
        padding: '2px 6px',
        borderRadius: '4px',
        cursor: 'pointer',
        fontWeight: 500,
        transition: 'background-color 0.15s ease',
        '&:hover': {
          backgroundColor:
            theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.1)',
        },
      },
      // Mention chip styling (user @mentions)
      '& .mention-chip': {
        backgroundColor:
          theme.palette.mode === 'dark' ? 'rgba(144, 202, 249, 0.16)' : 'rgba(25, 118, 210, 0.08)',
        color: theme.palette.text.primary,
        padding: '2px 6px',
        borderRadius: '4px',
        cursor: 'pointer',
        fontWeight: 500,
        whiteSpace: 'nowrap',
        transition: 'background-color 0.15s ease',
        '&:hover': {
          backgroundColor:
            theme.palette.mode === 'dark'
              ? 'rgba(144, 202, 249, 0.24)'
              : 'rgba(25, 118, 210, 0.16)',
        },
        // Hide the handle prefix, show only display name
        '& .mention-handle-hidden': {
          display: 'none',
        },
      },
      // Comment highlight styling
      '& .comment-highlight': {
        backgroundColor:
          theme.palette.mode === 'dark' ? 'rgba(255, 213, 79, 0.25)' : 'rgba(255, 213, 79, 0.4)',
        borderBottom: `2px solid ${theme.palette.warning.main}`,
        cursor: 'pointer',
        transition: 'background-color 0.2s ease',
        '&:hover': {
          backgroundColor:
            theme.palette.mode === 'dark' ? 'rgba(255, 213, 79, 0.35)' : 'rgba(255, 213, 79, 0.5)',
        },
        // Active/selected comment
        '&.comment-active': {
          backgroundColor:
            theme.palette.mode === 'dark' ? 'rgba(255, 213, 79, 0.45)' : 'rgba(255, 213, 79, 0.6)',
        },
        // Overlapping comments - nested highlights get progressively darker
        '& .comment-highlight': {
          backgroundColor:
            theme.palette.mode === 'dark' ? 'rgba(255, 193, 7, 0.35)' : 'rgba(255, 193, 7, 0.5)',
          // Third level overlap (rare but possible)
          '& .comment-highlight': {
            backgroundColor:
              theme.palette.mode === 'dark' ? 'rgba(255, 160, 0, 0.45)' : 'rgba(255, 160, 0, 0.6)',
          },
        },
      },
      // Inter-note link styling (complementary to tags - use secondary color)
      '& .inter-note-link': {
        color: theme.palette.secondary.main,
        fontWeight: 500,
        cursor: 'pointer',
        textDecoration: 'none',
        borderBottom: `1px dotted ${theme.palette.secondary.main}`,
        '&:hover': {
          textDecoration: 'underline',
          borderBottomStyle: 'solid',
        },
      },
      // Broken inter-note link styling (note doesn't exist or is deleted)
      '& .inter-note-link-broken': {
        color: theme.palette.error.main,
        fontWeight: 500,
        cursor: 'not-allowed',
        textDecoration: 'line-through',
        borderBottom: `1px dotted ${theme.palette.error.main}`,
      },
      // Hide the original [[note-id]] text when displaying title
      '& .inter-note-link-hidden': {
        display: 'none',
      },
      // Web link styling (external http/https links)
      // Blue and underlined to distinguish from internal links (which are dotted)
      '& a.web-link': {
        color: theme.palette.info.main,
        textDecoration: 'underline',
        cursor: 'pointer',
        '&:hover': {
          color: theme.palette.info.dark,
          textDecoration: 'underline',
        },
        '&:visited': {
          color: theme.palette.info.main,
        },
      },
      // NotecoveImage styling - all images are block-level and centered
      '& figure.notecove-image': {
        margin: '16px 0',
        padding: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: '100%',
        // Selected state
        '&.ProseMirror-selectednode': {
          outline: `2px solid ${theme.palette.primary.main}`,
          outlineOffset: '4px',
          borderRadius: '4px',
        },
      },
      '& .notecove-image-container': {
        position: 'relative',
        display: 'inline-flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100px',
        minWidth: '100px',
        backgroundColor: theme.palette.action.hover,
        borderRadius: '4px',
        overflow: 'hidden',
      },
      '& .notecove-image-element': {
        maxWidth: '100%',
        height: 'auto',
        display: 'block',
        borderRadius: '4px',
      },
      '& .notecove-image-loading': {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        padding: '24px',
        color: theme.palette.text.secondary,
        fontSize: '0.875rem',
      },
      '& .notecove-image-spinner': {
        width: '24px',
        height: '24px',
        animation: 'notecove-spin 1s linear infinite',
      },
      '& .notecove-spinner-circle': {
        stroke: theme.palette.primary.main,
        strokeLinecap: 'round',
        strokeDasharray: '50 50',
      },
      '@keyframes notecove-spin': {
        from: { transform: 'rotate(0deg)' },
        to: { transform: 'rotate(360deg)' },
      },
      '& .notecove-image-error': {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        padding: '24px',
        color: theme.palette.error.main,
        fontSize: '0.875rem',
      },
      '& .notecove-image-broken': {
        width: '32px',
        height: '32px',
        color: theme.palette.error.main,
      },
      '& .notecove-image-error-id': {
        fontSize: '0.75rem',
        fontFamily: 'monospace',
        color: theme.palette.text.disabled,
        marginTop: '4px',
      },
      '& .notecove-image-caption': {
        marginTop: '8px',
        fontSize: '0.875rem',
        color: theme.palette.text.secondary,
        fontStyle: 'italic',
        textAlign: 'center',
        maxWidth: '100%',
      },
      // Dev-mode tooltip (only visible in development)
      '& .notecove-image-dev-tooltip': {
        position: 'absolute',
        bottom: '100%',
        left: '50%',
        transform: 'translateX(-50%)',
        marginBottom: '8px',
        padding: '8px 12px',
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        color: '#fff',
        fontSize: '11px',
        fontFamily: 'monospace',
        borderRadius: '4px',
        whiteSpace: 'nowrap',
        zIndex: 1000,
        pointerEvents: 'none',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
      },
      '& .notecove-dev-tooltip-row': {
        padding: '2px 0',
        '& strong': {
          color: '#8be9fd',
          marginRight: '8px',
        },
      },
      // Resize handles container - only visible when image is selected
      '& .notecove-image-resize-handles': {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'none',
        opacity: 0,
        transition: 'opacity 0.15s ease',
      },
      // Show resize handles when image is selected
      '& figure.notecove-image.ProseMirror-selectednode .notecove-image-resize-handles': {
        opacity: 1,
      },
      // Individual resize handle
      '& .notecove-image-resize-handle': {
        position: 'absolute',
        width: '12px',
        height: '12px',
        backgroundColor: theme.palette.primary.main,
        border: `2px solid ${theme.palette.background.paper}`,
        borderRadius: '2px',
        pointerEvents: 'auto',
        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        transition: 'transform 0.1s ease',
        '&:hover': {
          transform: 'scale(1.2)',
        },
      },
      // Corner positions
      '& .notecove-image-resize-handle--nw': {
        top: '-6px',
        left: '-6px',
        cursor: 'nw-resize',
      },
      '& .notecove-image-resize-handle--ne': {
        top: '-6px',
        right: '-6px',
        cursor: 'ne-resize',
      },
      '& .notecove-image-resize-handle--sw': {
        bottom: '-6px',
        left: '-6px',
        cursor: 'sw-resize',
      },
      '& .notecove-image-resize-handle--se': {
        bottom: '-6px',
        right: '-6px',
        cursor: 'se-resize',
      },
      // Resize dimension tooltip
      '& .notecove-image-resize-tooltip': {
        position: 'absolute',
        bottom: '100%',
        left: '50%',
        transform: 'translateX(-50%)',
        marginBottom: '8px',
        padding: '4px 8px',
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        color: '#fff',
        fontSize: '12px',
        fontFamily: 'monospace',
        borderRadius: '4px',
        whiteSpace: 'nowrap',
        zIndex: 1001,
        pointerEvents: 'none',
      },
      // Resizing state - show cursor and prevent selection
      '& figure.notecove-image--resizing': {
        userSelect: 'none',
        cursor: 'nw-resize',
        '& *': {
          cursor: 'inherit',
        },
      },
      // Linked image indicator - subtle border and link icon
      '& figure.notecove-image--linked': {
        '& .notecove-image-container': {
          position: 'relative',
          '&::after': {
            content: '"\\1F517"', // Link emoji
            position: 'absolute',
            top: '8px',
            right: '8px',
            fontSize: '16px',
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            borderRadius: '4px',
            padding: '2px 6px',
            opacity: 0.8,
            pointerEvents: 'none',
          },
        },
        '& .notecove-image-element': {
          outline: `2px solid ${theme.palette.info.main}`,
          outlineOffset: '-2px',
        },
      },
      // Table styling
      '& table': {
        borderCollapse: 'collapse',
        width: '100%',
        margin: '16px 0',
        tableLayout: 'fixed',
        overflow: 'hidden',
        borderRadius: '4px',
        border: `1px solid ${theme.palette.divider}`,
      },
      '& table td, & table th': {
        border: `1px solid ${theme.palette.divider}`,
        padding: '8px 12px',
        textAlign: 'left',
        verticalAlign: 'top',
        position: 'relative',
        minWidth: '50px',
        boxSizing: 'border-box',
        '& > p': {
          margin: 0,
        },
      },
      '& table th': {
        backgroundColor:
          theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
        fontWeight: 600,
      },
      '& table tr:hover': {
        backgroundColor:
          theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.02)',
      },
      // Selected cell styling
      '& table .selectedCell': {
        backgroundColor:
          theme.palette.mode === 'dark' ? 'rgba(25, 118, 210, 0.2)' : 'rgba(25, 118, 210, 0.1)',
      },
      '& table .selectedCell::after': {
        content: '""',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        border: `2px solid ${theme.palette.primary.main}`,
        pointerEvents: 'none',
      },
      // Column resize handle styling
      '& .column-resize-handle': {
        position: 'absolute',
        right: '-2px',
        top: 0,
        bottom: 0,
        width: '4px',
        backgroundColor: theme.palette.primary.main,
        cursor: 'col-resize',
        zIndex: 20,
      },
      // Table selected state
      '& table.ProseMirror-selectednode': {
        outline: `2px solid ${theme.palette.primary.main}`,
        outlineOffset: '2px',
      },
      // Resize cursor when dragging
      '&.resize-cursor': {
        cursor: 'col-resize',
      },
      // Search result highlighting
      '& .search-result': {
        backgroundColor:
          theme.palette.mode === 'dark' ? 'rgba(255, 235, 59, 0.3)' : 'rgba(255, 235, 59, 0.5)',
        borderRadius: '2px',
      },
      '& .search-result-current': {
        backgroundColor:
          theme.palette.mode === 'dark' ? 'rgba(255, 152, 0, 0.5)' : 'rgba(255, 152, 0, 0.7)',
        outline: `2px solid ${theme.palette.primary.main}`,
        outlineOffset: '1px',
      },
      // Task item styling (list-based checkboxes)
      // The checkbox is positioned to the left of content
      // Content aligns with body text (task item pulls back to cancel list indentation)
      '& li[data-type="taskItem"]': {
        display: 'flex',
        alignItems: 'flex-start',
        listStyle: 'none',
        position: 'relative',
        // Pull back to cancel list padding, so content aligns with body text
        // Lists have paddingLeft: 2 (16px), so we offset by -16px
        marginLeft: -2, // MUI spacing: -16px
        // Add padding on left for the checkbox
        paddingLeft: '28px', // 18px checkbox + 10px gap

        // Checkbox wrapper - positioned absolutely in the padding area
        '& .task-checkbox-wrapper': {
          position: 'absolute',
          left: 0,
          top: '2px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          userSelect: 'none',
        },

        // Checkbox element
        '& .task-checkbox': {
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '18px',
          height: '18px',
          border: `2px solid ${theme.palette.text.secondary}`,
          borderRadius: '3px',
          fontSize: '12px',
          fontWeight: 700,
          lineHeight: 1,
          transition: 'all 0.15s ease',
        },

        // Task content area
        '& .task-content': {
          flex: 1,
          minWidth: 0,
        },

        // Unchecked state - empty checkbox
        '&[data-checked="unchecked"]': {
          '& .task-checkbox': {
            backgroundColor: 'transparent',
          },
          '& .task-content': {
            textDecoration: 'none',
            opacity: 1,
          },
        },

        // Checked state - green checkbox with checkmark, strikethrough text
        '&[data-checked="checked"]': {
          '& .task-checkbox': {
            backgroundColor: theme.palette.success.main,
            borderColor: theme.palette.success.main,
            color: '#ffffff',
          },
          '& .task-content': {
            textDecoration: 'line-through',
            opacity: 0.6,
            color: theme.palette.text.secondary,
          },
        },

        // Nope state - red checkbox with X, strikethrough text
        '&[data-checked="nope"]': {
          '& .task-checkbox': {
            backgroundColor: theme.palette.error.main,
            borderColor: theme.palette.error.main,
            color: '#ffffff',
          },
          '& .task-content': {
            textDecoration: 'line-through',
            opacity: 0.6,
            color: theme.palette.text.secondary,
          },
        },
      },
    },
  };
}
