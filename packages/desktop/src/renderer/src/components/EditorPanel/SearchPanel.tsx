/**
 * SearchPanel Component
 *
 * Provides in-note search functionality with case-sensitive option.
 * Integrates with TipTap's SearchAndReplace extension.
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  Box,
  TextField,
  IconButton,
  Checkbox,
  FormControlLabel,
  Typography,
  Paper,
  Tooltip,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import type { Editor } from '@tiptap/react';

export interface SearchPanelProps {
  editor: Editor | null;
  onClose: () => void;
  /** Lifted search term state for retention across panel open/close */
  searchTerm: string;
  /** Callback to update the lifted search term state */
  onSearchTermChange: (term: string) => void;
}

interface SearchAndReplaceStorage {
  results: unknown[];
  resultIndex: number;
}

export const SearchPanel: React.FC<SearchPanelProps> = ({
  editor,
  onClose,
  searchTerm,
  onSearchTermChange,
}) => {
  const [replaceTerm, setReplaceTerm] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [currentMatch, setCurrentMatch] = useState(0);
  const [totalMatches, setTotalMatches] = useState(0);
  const [showReplace, setShowReplace] = useState(false);

  // Update search results when search term or options change
  useEffect(() => {
    if (!editor || !searchTerm) {
      setCurrentMatch(0);
      setTotalMatches(0);
      return;
    }

    // Set search options and perform search
    editor.commands.setSearchTerm(searchTerm);
    editor.commands.setCaseSensitive(caseSensitive);

    // Get search results
    const storage = editor.storage['searchAndReplace'] as SearchAndReplaceStorage | undefined;
    const results = storage?.results ?? [];
    setTotalMatches(results.length);

    // Get current result index
    const resultIndex = storage?.resultIndex ?? 0;
    setCurrentMatch(resultIndex >= 0 && results.length > 0 ? resultIndex + 1 : 0);

    // Scroll to first match when search term changes
    if (results.length > 0) {
      setTimeout(() => {
        const currentMatch = document.querySelector('.search-result-current');
        if (currentMatch) {
          currentMatch.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          });
        }
      }, 100);
    }
  }, [editor, searchTerm, caseSensitive]);

  // Helper function to scroll to current match
  const scrollToCurrentMatch = useCallback(() => {
    if (!editor) return;

    // Wait a tick for the DOM to update with the new .search-result-current class
    setTimeout(() => {
      const currentMatch = document.querySelector('.search-result-current');
      if (currentMatch) {
        currentMatch.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }
    }, 50);
  }, [editor]);

  const handleNext = useCallback(() => {
    if (!editor || !searchTerm) return;
    editor.commands.nextSearchResult();

    // Update current match index
    const storage = editor.storage['searchAndReplace'] as SearchAndReplaceStorage | undefined;
    const resultIndex = storage?.resultIndex ?? 0;
    const results = storage?.results ?? [];
    setCurrentMatch(resultIndex >= 0 && results.length > 0 ? resultIndex + 1 : 0);

    // Scroll to the new current match
    scrollToCurrentMatch();
  }, [editor, searchTerm, scrollToCurrentMatch]);

  const handlePrevious = useCallback(() => {
    if (!editor || !searchTerm) return;
    editor.commands.previousSearchResult();

    // Update current match index
    const storage = editor.storage['searchAndReplace'] as SearchAndReplaceStorage | undefined;
    const resultIndex = storage?.resultIndex ?? 0;
    const results = storage?.results ?? [];
    setCurrentMatch(resultIndex >= 0 && results.length > 0 ? resultIndex + 1 : 0);

    // Scroll to the new current match
    scrollToCurrentMatch();
  }, [editor, searchTerm, scrollToCurrentMatch]);

  const handleSearchChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onSearchTermChange(event.target.value);
    },
    [onSearchTermChange]
  );

  const handleReplaceChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setReplaceTerm(event.target.value);
  }, []);

  const handleCaseSensitiveChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setCaseSensitive(event.target.checked);
  }, []);

  const handleReplace = useCallback(() => {
    if (!editor || !searchTerm) return;
    editor.commands.setReplaceTerm(replaceTerm);
    editor.commands.replace();

    // Move to next match after replacing
    setTimeout(() => {
      handleNext();
    }, 50);
  }, [editor, searchTerm, replaceTerm, handleNext]);

  const handleReplaceAll = useCallback(() => {
    if (!editor || !searchTerm) return;
    editor.commands.setReplaceTerm(replaceTerm);
    editor.commands.replaceAll();

    // Clear search after replace all
    onSearchTermChange('');
    setReplaceTerm('');
  }, [editor, searchTerm, replaceTerm, onSearchTermChange]);

  // Clear editor highlights when closing - keeps the search term in lifted state for reopening
  const handleClose = useCallback(() => {
    if (editor) {
      editor.commands.setSearchTerm('');
    }
    onClose();
  }, [editor, onClose]);

  // Cleanup: clear editor highlights when component unmounts
  useEffect(() => {
    return () => {
      if (editor) {
        editor.commands.setSearchTerm('');
      }
    };
  }, [editor]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Enter') {
        if (event.shiftKey) {
          handlePrevious();
        } else {
          handleNext();
        }
      } else if (event.key === 'Escape') {
        handleClose();
      }
    },
    [handleNext, handlePrevious, handleClose]
  );

  return (
    <Paper
      elevation={3}
      sx={{
        position: 'absolute',
        top: 8,
        right: 8,
        zIndex: 1000,
        p: 2,
        minWidth: showReplace ? 500 : 400,
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
      }}
    >
      {/* Search Input Row */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <TextField
          size="small"
          placeholder="Find in note..."
          value={searchTerm}
          onChange={handleSearchChange}
          onKeyDown={handleKeyDown}
          autoFocus
          fullWidth
          sx={{ flex: 1 }}
          InputProps={{
            endAdornment: searchTerm && (
              <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>
                {totalMatches > 0 ? `${currentMatch}/${totalMatches}` : 'No matches'}
              </Typography>
            ),
          }}
        />

        {/* Navigation Buttons */}
        <Tooltip title="Previous match (Shift+Enter)">
          <span>
            <IconButton
              size="small"
              onClick={handlePrevious}
              disabled={!searchTerm || totalMatches === 0}
            >
              <NavigateBeforeIcon />
            </IconButton>
          </span>
        </Tooltip>

        <Tooltip title="Next match (Enter)">
          <span>
            <IconButton
              size="small"
              onClick={handleNext}
              disabled={!searchTerm || totalMatches === 0}
            >
              <NavigateNextIcon />
            </IconButton>
          </span>
        </Tooltip>

        <Tooltip title="Close search (Esc)">
          <IconButton size="small" onClick={handleClose}>
            <CloseIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Replace Input Row (collapsible) */}
      {showReplace && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TextField
            size="small"
            placeholder="Replace with..."
            value={replaceTerm}
            onChange={handleReplaceChange}
            fullWidth
            sx={{ flex: 1 }}
          />

          <Tooltip title="Replace current match">
            <span>
              <IconButton
                size="small"
                onClick={handleReplace}
                disabled={!searchTerm || totalMatches === 0}
              >
                <Typography variant="caption" sx={{ px: 0.5 }}>
                  Replace
                </Typography>
              </IconButton>
            </span>
          </Tooltip>

          <Tooltip title="Replace all matches">
            <span>
              <IconButton
                size="small"
                onClick={handleReplaceAll}
                disabled={!searchTerm || totalMatches === 0}
              >
                <Typography variant="caption" sx={{ px: 0.5 }}>
                  All
                </Typography>
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      )}

      {/* Options Row */}
      <Box sx={{ display: 'flex', gap: 2, pl: 1, alignItems: 'center' }}>
        <FormControlLabel
          control={
            <Checkbox size="small" checked={caseSensitive} onChange={handleCaseSensitiveChange} />
          }
          label={<Typography variant="caption">Case sensitive</Typography>}
        />
        <Tooltip title="Show replace options">
          <FormControlLabel
            control={
              <Checkbox
                size="small"
                checked={showReplace}
                onChange={(e) => {
                  setShowReplace(e.target.checked);
                }}
              />
            }
            label={<Typography variant="caption">Replace</Typography>}
          />
        </Tooltip>
      </Box>
    </Paper>
  );
};
