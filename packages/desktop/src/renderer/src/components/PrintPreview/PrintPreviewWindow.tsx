/**
 * PrintPreviewWindow Component
 *
 * A dedicated window for displaying print preview of a note.
 * Shows the note content formatted for printing with comments as endnotes.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  Typography,
  CircularProgress,
} from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';
import CloseIcon from '@mui/icons-material/Close';
import type { JSONContent } from '@tiptap/core';
import { generatePrintHtml } from '../../services/print';

export interface PrintPreviewWindowProps {
  /** Note ID to preview for printing */
  noteId: string;
}

/** Print stylesheet for 11pt base text with light mode colors */
const printStyles = `
  .print-content {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    font-size: 11pt;
    line-height: 1.5;
    color: #000;
  }
  .print-content h1 {
    font-size: 22pt;
    font-weight: 600;
    margin: 1em 0 0.5em;
  }
  .print-content h2 {
    font-size: 18pt;
    font-weight: 600;
    margin: 1em 0 0.5em;
  }
  .print-content h3 {
    font-size: 14pt;
    font-weight: 600;
    margin: 1em 0 0.5em;
  }
  .print-content h4, .print-content h5, .print-content h6 {
    font-size: 12pt;
    font-weight: 600;
    margin: 1em 0 0.5em;
  }
  .print-content p {
    margin: 0.5em 0;
  }

  /* Inline code */
  .print-content code {
    font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', monospace;
    background: #f5f5f5;
    padding: 0.1em 0.3em;
    border-radius: 3px;
    font-size: 10pt;
  }

  /* Code blocks */
  .print-content pre {
    background: #f5f5f5;
    padding: 1em;
    border-radius: 4px;
    overflow-x: auto;
    font-size: 10pt;
    border: 1px solid #e0e0e0;
  }
  .print-content pre code {
    background: none;
    padding: 0;
  }

  /* Task lists */
  .print-content ul.task-list {
    list-style: none;
    padding-left: 0;
    margin: 0.5em 0;
  }
  .print-content li.task-item {
    display: flex;
    align-items: flex-start;
    margin: 0.25em 0;
  }
  .print-content li.task-item .task-checkbox {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    min-width: 16px;
    border: 2px solid #666;
    border-radius: 3px;
    margin-right: 8px;
    margin-top: 2px;
    font-size: 11px;
    font-weight: 700;
    line-height: 1;
  }
  .print-content li.task-item .task-content {
    flex: 1;
  }
  .print-content li.task-item .task-content p {
    margin: 0;
    display: inline;
  }
  /* Unchecked - empty box */
  .print-content li.task-item.task-item--unchecked .task-checkbox {
    background-color: transparent;
  }
  /* Checked - green with checkmark */
  .print-content li.task-item.task-item--checked .task-checkbox {
    background-color: #4caf50;
    border-color: #4caf50;
    color: #ffffff;
  }
  .print-content li.task-item.task-item--checked .task-content {
    text-decoration: line-through;
    opacity: 0.6;
    color: #666;
  }
  /* Cancelled/Nope - red with X */
  .print-content li.task-item.task-item--nope .task-checkbox {
    background-color: #f44336;
    border-color: #f44336;
    color: #ffffff;
  }
  .print-content li.task-item.task-item--nope .task-content {
    text-decoration: line-through;
    opacity: 0.6;
    color: #666;
  }

  /* Tables */
  .print-content table.print-table {
    border-collapse: collapse;
    width: 100%;
    margin: 1em 0;
  }
  .print-content table.print-table th,
  .print-content table.print-table td {
    border: 1px solid #333;
    padding: 0.5em;
    text-align: left;
  }
  .print-content table.print-table th {
    background-color: #f0f0f0;
    font-weight: 600;
  }
  .print-content table.print-table th p,
  .print-content table.print-table td p {
    margin: 0;
  }

  /* Hashtags */
  .print-content .hashtag {
    color: #1976d2;
    font-weight: 500;
  }

  /* Images */
  .print-content img {
    max-width: 100%;
    height: auto;
    display: block;
    margin: 1em 0;
  }

  /* Blockquotes */
  .print-content blockquote {
    margin: 1em 0;
    padding-left: 1em;
    border-left: 3px solid #ccc;
    color: #555;
  }

  /* Lists */
  .print-content ul, .print-content ol {
    margin: 0.5em 0;
    padding-left: 1.5em;
  }
  .print-content li {
    margin: 0.25em 0;
  }

  /* Link chips */
  .print-content .link-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background-color: #e3f2fd;
    border: 1px solid #90caf9;
    border-radius: 4px;
    padding: 2px 6px;
    font-size: 0.9em;
    color: #1565c0;
    text-decoration: none;
  }
  .print-content .link-chip-icon {
    font-size: 0.8em;
  }
  .print-content .link-chip-text {
    font-weight: 500;
  }
  .print-content .link-chip-domain {
    color: #666;
    font-size: 0.85em;
  }
  .print-content .print-link {
    color: #1565c0;
    text-decoration: underline;
  }

  /* Inter-note link chips */
  .print-content .inter-note-link {
    display: inline;
    background-color: #fff3e0;
    border: 1px solid #ffcc80;
    border-radius: 4px;
    padding: 2px 6px;
    font-size: 0.9em;
    color: #e65100;
    font-weight: 500;
  }

  /* Date chips */
  .print-content .date-chip {
    display: inline;
    background-color: #f3e5f5;
    border: 1px solid #ce93d8;
    border-radius: 4px;
    padding: 2px 6px;
    font-size: 0.9em;
    color: #7b1fa2;
    font-weight: 500;
  }

  /* oEmbed unfurl cards */
  .print-content .unfurl-card {
    display: flex;
    border: 1px solid #ddd;
    border-radius: 8px;
    overflow: hidden;
    margin: 1em 0;
    background-color: #fafafa;
    max-width: 600px;
  }
  .print-content .unfurl-thumbnail {
    flex-shrink: 0;
    width: 120px;
    min-height: 80px;
    background-color: #eee;
  }
  .print-content .unfurl-thumbnail img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    margin: 0;
  }
  .print-content .unfurl-content {
    flex: 1;
    padding: 12px;
    min-width: 0;
  }
  .print-content .unfurl-title {
    font-weight: 600;
    font-size: 1em;
    color: #333;
    margin-bottom: 4px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .print-content .unfurl-description {
    font-size: 0.85em;
    color: #666;
    margin-bottom: 8px;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .print-content .unfurl-meta {
    font-size: 0.75em;
    color: #888;
  }
  .print-content .unfurl-provider {
    font-weight: 500;
    margin-right: 8px;
  }
  .print-content .unfurl-url {
    color: #999;
    word-break: break-all;
  }

  /* Print-specific page break rules */
  @media print {
    .print-content h1, .print-content h2, .print-content h3,
    .print-content h4, .print-content h5, .print-content h6 {
      page-break-after: avoid;
      break-after: avoid;
    }
    .print-content pre, .print-content blockquote,
    .print-content table, .print-content img {
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .print-content p {
      orphans: 3;
      widows: 3;
    }
  }
`;

/**
 * PrintPreviewWindow displays a print-ready view of a note.
 *
 * Features:
 * - Resolved comments toggle
 * - Print button (triggers window.print())
 * - Close button
 */
export function PrintPreviewWindow({ noteId }: PrintPreviewWindowProps): React.ReactElement {
  const [includeResolvedComments, setIncludeResolvedComments] = useState(false);
  const [loading, setLoading] = useState(true);
  const [printHtml, setPrintHtml] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Load note content and generate print HTML
  useEffect(() => {
    const loadContent = async (): Promise<void> => {
      try {
        setLoading(true);
        setError(null);

        // Fetch note content using the export API
        const notes = await window.electronAPI.export.getNotesForExport([noteId]);
        if (notes.length === 0) {
          throw new Error('Note not found');
        }

        const note = notes[0];
        if (!note) {
          throw new Error('Note not found');
        }

        const content = note.content as JSONContent;

        // TODO: Fetch comments for endnotes (Phase 4)
        const comments: never[] = [];

        // Generate print HTML
        let html = generatePrintHtml(content, comments, {
          includeResolvedComments,
        });

        // Resolve local images (those with data-image-id and data-sd-id attributes)
        // Find all images that need resolution and collect their IDs
        const imageRegex = /data-image-id="([^"]+)"\s+data-sd-id="([^"]+)"\s+src=""/g;
        const imagesToResolve: { imageId: string; sdId: string }[] = [];
        let imageMatch;
        while ((imageMatch = imageRegex.exec(html)) !== null) {
          const imageId = imageMatch[1];
          const sdId = imageMatch[2];
          if (imageId && sdId) {
            imagesToResolve.push({ imageId, sdId });
          }
        }

        // Resolve each image and replace in HTML
        for (const { imageId, sdId } of imagesToResolve) {
          try {
            const dataUrl = await window.electronAPI.image.getDataUrl(sdId, imageId);
            if (dataUrl) {
              // Replace the empty src with the data URL
              html = html.replace(
                `data-image-id="${imageId}" data-sd-id="${sdId}" src=""`,
                `data-image-id="${imageId}" data-sd-id="${sdId}" src="${dataUrl}"`
              );
            } else {
              console.warn('[PrintPreview] Image not found:', imageId);
            }
          } catch (imgErr) {
            console.warn('[PrintPreview] Failed to load image:', imageId, imgErr);
          }
        }

        setPrintHtml(html);
        setLoading(false);
      } catch (err) {
        console.error('[PrintPreview] Failed to load content:', err);
        setError(err instanceof Error ? err.message : 'Failed to load content');
        setLoading(false);
      }
    };

    void loadContent();
  }, [noteId, includeResolvedComments]);

  // Handle print button click
  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  // Handle close button click
  const handleClose = useCallback(() => {
    window.close();
  }, []);

  return (
    <Box
      sx={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'grey.100',
      }}
    >
      {/* Inject print styles */}
      <style>{printStyles}</style>

      {/* Header bar - hidden when printing */}
      <Box
        className="print-preview-header"
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          py: 1,
          bgcolor: 'background.paper',
          borderBottom: 1,
          borderColor: 'divider',
          '@media print': {
            display: 'none',
          },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="h6">Print Preview</Typography>
          <FormControlLabel
            control={
              <Checkbox
                checked={includeResolvedComments}
                onChange={(e) => {
                  setIncludeResolvedComments(e.target.checked);
                }}
                size="small"
              />
            }
            label="Include resolved comments"
          />
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="contained"
            startIcon={<PrintIcon />}
            onClick={handlePrint}
            disabled={loading || !!error}
          >
            Print
          </Button>
          <Button variant="outlined" startIcon={<CloseIcon />} onClick={handleClose}>
            Close
          </Button>
        </Box>
      </Box>

      {/* Preview content area */}
      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          display: 'flex',
          justifyContent: 'center',
          py: 3,
          '@media print': {
            overflow: 'visible',
            py: 0,
          },
        }}
      >
        {loading ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
            <Typography color="error">{error}</Typography>
          </Box>
        ) : (
          <Box
            className="print-content"
            sx={{
              width: '8.5in',
              bgcolor: 'background.paper',
              boxShadow: 3,
              p: 4,
              mb: 3, // Add margin at bottom so shadow extends past content
              // Content auto-sizes, page breaks handled by browser during printing
              '@media print': {
                width: '100%',
                boxShadow: 'none',
                p: 0,
                mb: 0,
              },
            }}
            dangerouslySetInnerHTML={{ __html: printHtml }}
          />
        )}
      </Box>
    </Box>
  );
}
