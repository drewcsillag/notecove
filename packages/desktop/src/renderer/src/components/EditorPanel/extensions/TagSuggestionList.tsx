/**
 * Tag Suggestion List Component
 *
 * Renders a dropdown list of tag suggestions when the user types `#` in the editor.
 * Uses TipTap's suggestion API for autocomplete functionality.
 */

import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { Paper, List, ListItem, ListItemButton, ListItemText, Box } from '@mui/material';
import type { SuggestionProps } from '@tiptap/suggestion';

export interface TagSuggestionListProps
  extends SuggestionProps<{ id: string; name: string; count: number }> {
  // Props from TipTap's suggestion API
  items: { id: string; name: string; count: number }[];
  command: (props: { id: string; name: string; count: number }) => void;
}

export interface TagSuggestionListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

export const TagSuggestionList = forwardRef<TagSuggestionListRef, TagSuggestionListProps>(
  (props, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    // Reset selected index when items change
    useEffect(() => {
      setSelectedIndex(0);
    }, [props.items]);

    // Keyboard navigation
    const selectItem = (index: number): void => {
      const item = props.items[index];
      if (item) {
        props.command(item);
      }
    };

    const upHandler = (): void => {
      setSelectedIndex((selectedIndex + props.items.length - 1) % props.items.length);
    };

    const downHandler = (): void => {
      setSelectedIndex((selectedIndex + 1) % props.items.length);
    };

    const enterHandler = (): void => {
      selectItem(selectedIndex);
    };

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }): boolean => {
        if (event.key === 'ArrowUp') {
          upHandler();
          return true;
        }

        if (event.key === 'ArrowDown') {
          downHandler();
          return true;
        }

        if (event.key === 'Enter') {
          enterHandler();
          return true;
        }

        return false;
      },
    }));

    // Don't render if no items
    if (props.items.length === 0) {
      return null;
    }

    return (
      <Paper
        elevation={3}
        sx={{
          maxHeight: '300px',
          overflow: 'auto',
          minWidth: '200px',
        }}
      >
        <List dense disablePadding>
          {props.items.map((item, index) => (
            <ListItem key={item.id} disablePadding>
              <ListItemButton
                selected={index === selectedIndex}
                onClick={() => {
                  selectItem(index);
                }}
                sx={{
                  py: 0.5,
                  px: 2,
                }}
              >
                <ListItemText
                  primary={
                    <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box component="span" sx={{ color: 'primary.main', fontWeight: 500 }}>
                        #{item.name}
                      </Box>
                      <Box component="span" sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>
                        ({item.count})
                      </Box>
                    </Box>
                  }
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Paper>
    );
  }
);

TagSuggestionList.displayName = 'TagSuggestionList';
