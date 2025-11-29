/**
 * Tag Panel Component
 *
 * Displays all tags with note counts and allows filtering notes by clicking tags.
 * Phase 4.1: Tags System
 */

import React, { useEffect, useState, useCallback } from 'react';
import { Box, Typography, Chip, IconButton } from '@mui/material';
import { LocalOffer as TagIcon, Clear as ClearIcon } from '@mui/icons-material';

export interface TagPanelProps {
  tagFilters: Record<string, 'include' | 'exclude'>;
  onTagSelect: (tagId: string) => void;
  onClearFilters: () => void;
}

export const TagPanel: React.FC<TagPanelProps> = ({ tagFilters, onTagSelect, onClearFilters }) => {
  const [tags, setTags] = useState<{ id: string; name: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load tags from database
  const loadTags = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const allTags = await window.electronAPI.tag.getAll();
      setTags(allTags);
    } catch (err) {
      console.error('Failed to load tags:', err);
      setError('Failed to load tags');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    void loadTags();
  }, [loadTags]);

  // Listen for tag updates
  useEffect(() => {
    // When tags are updated (via note edits), refresh the list
    // This will be triggered by the note:updated event which updates tags
    const unsubscribeNote = window.electronAPI.note.onUpdated(() => {
      void loadTags();
    });

    // When Storage Directories are created/deleted, refresh tags
    // Deleting an SD removes all its notes and orphaned tags
    // Creating/restoring an SD may add new tags
    const unsubscribeSD = window.electronAPI.sd.onUpdated(() => {
      void loadTags();
    });

    return () => {
      unsubscribeNote();
      unsubscribeSD();
    };
  }, [loadTags]);

  if (loading) {
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
          justifyContent: 'space-between',
          px: 2,
          py: 1.5,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TagIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
          <Typography variant="subtitle2" fontWeight={600}>
            Tags
          </Typography>
          {Object.keys(tagFilters).length > 0 && (
            <Chip
              label={Object.keys(tagFilters).length}
              size="small"
              sx={{ height: 20, minWidth: 20 }}
            />
          )}
        </Box>
        {Object.keys(tagFilters).length > 0 && (
          <IconButton
            size="small"
            onClick={onClearFilters}
            title="Clear all filters"
            sx={{ ml: 1 }}
          >
            <ClearIcon sx={{ fontSize: 18 }} />
          </IconButton>
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
        {tags.map((tag) => {
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
