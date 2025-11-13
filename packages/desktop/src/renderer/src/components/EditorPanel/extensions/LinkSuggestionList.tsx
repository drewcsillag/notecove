/**
 * Link Suggestion List Component
 *
 * Renders a dropdown list of note suggestions when the user types `[[` in the editor.
 * Uses TipTap's suggestion API for autocomplete functionality.
 */

import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { Paper, List, ListItem, ListItemButton, ListItemText, Box } from '@mui/material';
import type { SuggestionProps } from '@tiptap/suggestion';

export interface LinkSuggestionListProps
  extends SuggestionProps<{
    id: string;
    title: string;
    sdId: string;
    folderId: string | null;
    folderPath: string;
    created: number;
    modified: number;
  }> {
  // Props from TipTap's suggestion API
  items: {
    id: string;
    title: string;
    sdId: string;
    folderId: string | null;
    folderPath: string;
    created: number;
    modified: number;
  }[];
  command: (props: {
    id: string;
    title: string;
    sdId: string;
    folderId: string | null;
    folderPath: string;
    created: number;
    modified: number;
  }) => void;
}

export interface LinkSuggestionListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

export const LinkSuggestionList = forwardRef<LinkSuggestionListRef, LinkSuggestionListProps>(
  (props, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    // Reset selected index when items change
    useEffect(() => {
      setSelectedIndex(0);
    }, [props.items]);

    // Detect duplicate titles to show additional differentiators
    const titleCounts = new Map<string, number>();
    props.items.forEach((item) => {
      const title = item.title ? item.title.toLowerCase() : 'untitled';
      titleCounts.set(title, (titleCounts.get(title) ?? 0) + 1);
    });

    const hasDuplicateTitle = (item: (typeof props.items)[0]): boolean => {
      const title = item.title ? item.title.toLowerCase() : 'untitled';
      return (titleCounts.get(title) ?? 0) > 1;
    };

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
        // If there are no items, don't handle any keys (let default behavior work)
        if (props.items.length === 0) {
          return false;
        }

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

    // Show message if no items
    if (props.items.length === 0) {
      return (
        <Paper
          elevation={3}
          sx={{
            padding: 2,
            minWidth: '200px',
          }}
        >
          No notes found
        </Paper>
      );
    }

    return (
      <Paper
        elevation={3}
        sx={{
          maxHeight: '300px',
          overflow: 'auto',
          minWidth: '300px',
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
                    <Box component="span" sx={{ display: 'flex', flexDirection: 'column' }}>
                      <Box component="span" sx={{ fontWeight: 500 }}>
                        {item.title || 'Untitled'}
                      </Box>
                      {(item.folderPath || hasDuplicateTitle(item)) && (
                        <Box component="span" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
                          {[
                            item.folderPath,
                            hasDuplicateTitle(item) &&
                              new Date(item.modified).toLocaleDateString(undefined, {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                              }),
                          ]
                            .filter(Boolean)
                            .join(' • ')}
                        </Box>
                      )}
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

LinkSuggestionList.displayName = 'LinkSuggestionList';
