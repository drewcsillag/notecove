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
  .print-content code {
    font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', monospace;
    background: #f5f5f5;
    padding: 0.1em 0.3em;
    border-radius: 3px;
    font-size: 10pt;
  }
  .print-content pre {
    background: #f5f5f5;
    padding: 1em;
    border-radius: 4px;
    overflow-x: auto;
    font-size: 10pt;
  }
  .print-content pre code {
    background: none;
    padding: 0;
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
        const html = generatePrintHtml(content, comments, {
          includeResolvedComments,
        });

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
              minHeight: '11in',
              bgcolor: 'background.paper',
              boxShadow: 3,
              p: 4,
              '@media print': {
                width: '100%',
                minHeight: 'auto',
                boxShadow: 'none',
                p: 0,
              },
            }}
            dangerouslySetInnerHTML={{ __html: printHtml }}
          />
        )}
      </Box>
    </Box>
  );
}
