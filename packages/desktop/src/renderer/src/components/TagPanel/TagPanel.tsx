/**
 * Tag Panel Component
 *
 * Displays all tags with note counts and allows filtering notes by clicking tags.
 * Phase 4.1: Tags System
 */

import React, { useEffect, useState, useCallback } from 'react';
import { Box, Typography, List, ListItem, ListItemButton, Chip, IconButton } from '@mui/material';
import { LocalOffer as TagIcon, Clear as ClearIcon } from '@mui/icons-material';

export interface TagPanelProps {
  selectedTags: string[];
  onTagSelect: (tagId: string) => void;
  onClearFilters: () => void;
}

export const TagPanel: React.FC<TagPanelProps> = ({
  selectedTags,
  onTagSelect,
  onClearFilters,
}) => {
  const [tags, setTags] = useState<Array<{ id: string; name: string; count: number }>>([]);
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
    const unsubscribe = window.electronAPI.note.onUpdated(() => {
      void loadTags();
    });

    return () => {
      unsubscribe();
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
          {selectedTags.length > 0 && (
            <Chip label={selectedTags.length} size="small" sx={{ height: 20, minWidth: 20 }} />
          )}
        </Box>
        {selectedTags.length > 0 && (
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

      {/* Tags List */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        <List dense disablePadding>
          {tags.map((tag) => {
            const isSelected = selectedTags.includes(tag.id);
            return (
              <ListItem key={tag.id} disablePadding>
                <ListItemButton
                  selected={isSelected}
                  onClick={() => onTagSelect(tag.id)}
                  sx={{
                    py: 0.75,
                    px: 2,
                    '&.Mui-selected': {
                      backgroundColor: 'primary.light',
                      '&:hover': {
                        backgroundColor: 'primary.light',
                      },
                    },
                  }}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      gap: 1,
                    }}
                  >
                    <Typography
                      variant="body2"
                      sx={{
                        color: isSelected ? 'primary.main' : 'text.primary',
                        fontWeight: isSelected ? 600 : 400,
                        flex: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      #{tag.name}
                    </Typography>
                    <Chip
                      label={tag.count}
                      size="small"
                      sx={{
                        height: 20,
                        fontSize: '0.75rem',
                        backgroundColor: isSelected ? 'primary.main' : 'action.hover',
                        color: isSelected ? 'primary.contrastText' : 'text.secondary',
                      }}
                    />
                  </Box>
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>
      </Box>
    </Box>
  );
};
