/**
 * Tag Panel Component
 *
 * Displays all tags with note counts and allows filtering notes by clicking tags.
 * Phase 4.1: Tags System
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Box, Typography, Chip, IconButton, TextField, InputAdornment } from '@mui/material';
import {
  LocalOffer as TagIcon,
  Clear as ClearIcon,
  Search as SearchIcon,
} from '@mui/icons-material';

export interface TagPanelProps {
  tagFilters: Record<string, 'include' | 'exclude'>;
  onTagSelect: (tagId: string) => void;
  onClearFilters: () => void;
}

export const TagPanel: React.FC<TagPanelProps> = ({ tagFilters, onTagSelect, onClearFilters }) => {
  const [tags, setTags] = useState<{ id: string; name: string; count: number }[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Load tags from database (initial load shows loading state)
  const loadTags = useCallback(async (isInitial?: boolean) => {
    isInitial = isInitial ?? false;
    try {
      if (isInitial) {
        setInitialLoading(true);
      }
      setError(null);
      const allTags = await window.electronAPI.tag.getAll();
      setTags(allTags);
    } catch (err) {
      console.error('Failed to load tags:', err);
      setError('Failed to load tags');
    } finally {
      if (isInitial) {
        setInitialLoading(false);
      }
    }
  }, []);

  // Initial load
  useEffect(() => {
    void loadTags(true); // Pass true for initial load to show loading state
  }, [loadTags]);

  // Listen for tag updates with debouncing to prevent flicker
  useEffect(() => {
    let debounceTimeout: NodeJS.Timeout | null = null;

    const debouncedLoadTags = () => {
      // Debounce rapid updates (e.g., typing triggers many note:updated events)
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
      }
      debounceTimeout = setTimeout(() => {
        void loadTags();
        debounceTimeout = null;
      }, 500); // Wait 500ms after last update before refreshing
    };

    // When tags are updated (via note edits), refresh the list
    // This will be triggered by the note:updated event which updates tags
    const unsubscribeNote = window.electronAPI.note.onUpdated(() => {
      debouncedLoadTags();
    });

    // When Storage Directories are created/deleted, refresh tags immediately
    // (these are less frequent and user expects immediate feedback)
    const unsubscribeSD = window.electronAPI.sd.onUpdated(() => {
      void loadTags();
    });

    return () => {
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
      }
      unsubscribeNote();
      unsubscribeSD();
    };
  }, [loadTags]);

  // Filter tags based on search query
  const filteredTags = useMemo(() => {
    if (!searchQuery.trim()) {
      return tags;
    }
    const query = searchQuery.toLowerCase();
    return tags.filter((tag) => tag.name.toLowerCase().includes(query));
  }, [tags, searchQuery]);

  if (initialLoading) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Loading tags...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="body2" color="error">
          {error}
        </Typography>
      </Box>
    );
  }

  if (tags.length === 0) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="body2" color="text.secondary">
          No tags yet. Add tags to your notes by typing #tagname
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 2,
          py: 1,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <TagIcon sx={{ fontSize: 20, color: 'text.secondary', flexShrink: 0 }} />
        <Typography variant="subtitle2" fontWeight={600} sx={{ flexShrink: 0 }}>
          Tags
        </Typography>
        <TextField
          size="small"
          placeholder="Filter tags..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
              </InputAdornment>
            ),
            endAdornment: searchQuery ? (
              <InputAdornment position="end">
                <IconButton
                  size="small"
                  onClick={() => {
                    setSearchQuery('');
                  }}
                  title="Clear search"
                  sx={{ p: 0.25 }}
                >
                  <ClearIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </InputAdornment>
            ) : null,
          }}
          sx={{
            flex: 1,
            minWidth: 0,
            '& .MuiInputBase-root': {
              height: 28,
              fontSize: '0.8125rem',
            },
            '& .MuiInputBase-input': {
              py: 0.5,
            },
          }}
        />
        {Object.keys(tagFilters).length > 0 && (
          <>
            <Chip
              label={Object.keys(tagFilters).length}
              size="small"
              sx={{ height: 20, minWidth: 20, flexShrink: 0 }}
            />
            <IconButton
              size="small"
              onClick={onClearFilters}
              title="Clear all filters"
              sx={{ flexShrink: 0 }}
            >
              <ClearIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </>
        )}
      </Box>

      {/* Tags as Pills */}
      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          p: 2,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 1,
          alignContent: 'flex-start',
        }}
      >
        {filteredTags.length === 0 && searchQuery && (
          <Typography variant="body2" color="text.secondary">
            No tags match your filter
          </Typography>
        )}
        {filteredTags.map((tag) => {
          const filterState = tagFilters[tag.id]; // undefined | 'include' | 'exclude'
          const isInclude = filterState === 'include';
          const isExclude = filterState === 'exclude';

          return (
            <Chip
              key={tag.id}
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  #{tag.name}
                  <Box
                    component="span"
                    sx={{
                      backgroundColor: 'action.hover',
                      color: 'text.secondary',
                      fontSize: '0.75rem',
                      borderRadius: '10px',
                      px: 0.75,
                      minWidth: 20,
                      textAlign: 'center',
                    }}
                  >
                    {tag.count}
                  </Box>
                </Box>
              }
              onClick={() => {
                onTagSelect(tag.id);
              }}
              color={isInclude ? 'primary' : isExclude ? 'error' : 'default'}
              variant={isInclude || isExclude ? 'filled' : 'outlined'}
              sx={{
                cursor: 'pointer',
                fontWeight: isInclude || isExclude ? 600 : 400,
                '&:hover': {
                  backgroundColor: isInclude
                    ? 'primary.dark'
                    : isExclude
                      ? 'error.dark'
                      : 'action.hover',
                },
              }}
            />
          );
        })}
      </Box>
    </Box>
  );
};
