/**
 * AtSuggestionList Component
 *
 * Renders a dropdown list of suggestions when the user types `@` in the editor.
 * Shows date keywords at the top, followed by user mentions.
 *
 * Uses TipTap's suggestion API for autocomplete functionality.
 */

import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import {
  Paper,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  ListSubheader,
  Typography,
  Box,
} from '@mui/material';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import type { SuggestionProps } from '@tiptap/suggestion';
import type { AtSuggestionItem } from './extensions/AtMention';

export interface AtSuggestionListProps extends SuggestionProps<AtSuggestionItem> {
  items: AtSuggestionItem[];
  command: (props: AtSuggestionItem) => void;
}

export interface AtSuggestionListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

export const AtSuggestionList = forwardRef<AtSuggestionListRef, AtSuggestionListProps>(
  (props, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    // Separate items by type
    const dateItems = props.items.filter((item) => item.type === 'date');
    const userItems = props.items.filter((item) => item.type === 'user');
    const hintItems = props.items.filter((item) => item.type === 'hint');

    // Flatten for navigation (dates first, then users - hints are not selectable)
    const selectableItems = [...dateItems, ...userItems];

    // Reset selected index when items change
    useEffect(() => {
      setSelectedIndex(0);
    }, [props.items]);

    // Keyboard navigation
    const selectItem = (index: number): void => {
      const item = selectableItems[index];
      if (item) {
        props.command(item);
      }
    };

    const upHandler = (): void => {
      setSelectedIndex((prev) => (prev + selectableItems.length - 1) % selectableItems.length);
    };

    const downHandler = (): void => {
      setSelectedIndex((prev) => (prev + 1) % selectableItems.length);
    };

    const enterHandler = (): void => {
      selectItem(selectedIndex);
    };

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }): boolean => {
        // If there are no selectable items, don't handle any keys (let default behavior work)
        if (selectableItems.length === 0) {
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

    // Don't render if no items at all (including hints)
    if (props.items.length === 0) {
      return null;
    }

    // Track the current index across both sections for selection highlighting
    let currentIndex = 0;

    return (
      <Paper
        elevation={3}
        sx={{
          maxHeight: '300px',
          overflow: 'auto',
          minWidth: '250px',
        }}
      >
        <List dense disablePadding>
          {/* Date Keywords Section */}
          {dateItems.length > 0 && (
            <>
              <ListSubheader
                sx={{
                  lineHeight: '32px',
                  bgcolor: 'background.paper',
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <Typography variant="caption" color="text.secondary">
                  Dates
                </Typography>
              </ListSubheader>
              {dateItems.map((item) => {
                const index = currentIndex++;
                return (
                  <ListItem key={item.id} disablePadding>
                    <ListItemButton
                      selected={index === selectedIndex}
                      onClick={() => selectItem(index)}
                      sx={{ py: 0.5, px: 2 }}
                    >
                      <ListItemIcon sx={{ minWidth: 36 }}>
                        <CalendarTodayIcon fontSize="small" color="action" />
                      </ListItemIcon>
                      <ListItemText
                        primary={item.label}
                        secondary={item.description}
                        primaryTypographyProps={{ variant: 'body2' }}
                        secondaryTypographyProps={{ variant: 'caption' }}
                      />
                    </ListItemButton>
                  </ListItem>
                );
              })}
            </>
          )}

          {/* User Mentions Section */}
          {userItems.length > 0 && (
            <>
              <ListSubheader
                sx={{
                  lineHeight: '32px',
                  bgcolor: 'background.paper',
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <Typography variant="caption" color="text.secondary">
                  People
                </Typography>
              </ListSubheader>
              {userItems.map((item) => {
                const index = currentIndex++;
                if (item.type !== 'user') return null;
                return (
                  <ListItem key={item.id} disablePadding>
                    <ListItemButton
                      selected={index === selectedIndex}
                      onClick={() => selectItem(index)}
                      sx={{ py: 0.5, px: 2 }}
                    >
                      <ListItemIcon sx={{ minWidth: 36 }}>
                        <Box
                          sx={{
                            width: 24,
                            height: 24,
                            borderRadius: '50%',
                            bgcolor: 'primary.main',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Typography variant="caption" sx={{ color: 'primary.contrastText' }}>
                            {item.displayName.charAt(0).toUpperCase()}
                          </Typography>
                        </Box>
                      </ListItemIcon>
                      <ListItemText
                        primary={item.displayName}
                        secondary={item.handle}
                        primaryTypographyProps={{ variant: 'body2' }}
                        secondaryTypographyProps={{ variant: 'caption' }}
                      />
                    </ListItemButton>
                  </ListItem>
                );
              })}
            </>
          )}

          {/* Hint Section (not selectable) */}
          {hintItems.map((item) => {
            if (item.type !== 'hint') return null;
            return (
              <ListItem key={item.id} sx={{ py: 1, px: 2 }}>
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <InfoOutlinedIcon fontSize="small" color="info" />
                </ListItemIcon>
                <ListItemText
                  primary={item.message}
                  primaryTypographyProps={{
                    variant: 'caption',
                    color: 'text.secondary',
                    fontStyle: 'italic',
                  }}
                />
              </ListItem>
            );
          })}
        </List>
      </Paper>
    );
  }
);

AtSuggestionList.displayName = 'AtSuggestionList';
