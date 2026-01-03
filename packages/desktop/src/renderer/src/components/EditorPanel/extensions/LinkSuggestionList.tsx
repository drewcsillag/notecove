/**
 * Link Suggestion List Component
 *
 * Renders a dropdown list of suggestions when the user types `[[` in the editor.
 * Supports two modes:
 * - Note mode: Shows notes matching the query
 * - Heading mode: Shows headings from a specific note (when user types [[note-id#)
 *
 * Uses TipTap's suggestion API for autocomplete functionality.
 */

import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { Paper, List, ListItem, ListItemButton, ListItemText, Box, Typography } from '@mui/material';
import type { SuggestionProps } from '@tiptap/suggestion';
import type {
  SuggestionItem,
  NoteSuggestionItem,
  HeadingSuggestionItem,
  EntireNoteSuggestionItem,
} from './InterNoteLink';

export interface LinkSuggestionListProps extends SuggestionProps<SuggestionItem> {
  // Props from TipTap's suggestion API
  items: SuggestionItem[];
  command: (props: SuggestionItem) => void;
}

export interface LinkSuggestionListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

/**
 * Helper to check if item is a note
 */
function isNoteItem(item: SuggestionItem): item is NoteSuggestionItem {
  return item.type === 'note';
}

/**
 * Helper to check if item is a heading
 */
function isHeadingItem(item: SuggestionItem): item is HeadingSuggestionItem {
  return item.type === 'heading';
}

/**
 * Helper to check if item is an "entire note" option
 */
function isEntireNoteItem(item: SuggestionItem): item is EntireNoteSuggestionItem {
  return item.type === 'entireNote';
}

/**
 * Render a note suggestion item
 */
function NoteItemContent({
  item,
  hasDuplicate,
}: {
  item: NoteSuggestionItem;
  hasDuplicate: boolean;
}): React.ReactElement {
  return (
    <Box component="span" sx={{ display: 'flex', flexDirection: 'column' }}>
      <Box component="span" sx={{ fontWeight: 500 }}>
        {item.title || 'Untitled'}
      </Box>
      {(item.folderPath || hasDuplicate) && (
        <Box component="span" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
          {[
            item.folderPath,
            hasDuplicate &&
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
  );
}

/**
 * Render a heading suggestion item
 */
function HeadingItemContent({ item }: { item: HeadingSuggestionItem }): React.ReactElement {
  // Show heading level indicator (H1, H2, etc.) and the heading text
  return (
    <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Typography
        component="span"
        sx={{
          fontSize: '0.65rem',
          fontWeight: 600,
          color: 'text.secondary',
          backgroundColor: 'action.hover',
          px: 0.5,
          py: 0.25,
          borderRadius: 0.5,
          minWidth: '1.5rem',
          textAlign: 'center',
        }}
      >
        H{item.level}
      </Typography>
      <Box component="span" sx={{ fontWeight: 500 }}>
        {item.text}
      </Box>
    </Box>
  );
}

/**
 * Render an "entire note" suggestion item
 */
function EntireNoteItemContent({
  item,
}: {
  item: EntireNoteSuggestionItem;
}): React.ReactElement {
  return (
    <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Typography
        component="span"
        sx={{
          fontSize: '0.65rem',
          fontWeight: 600,
          color: 'primary.main',
          backgroundColor: 'primary.lighter',
          px: 0.5,
          py: 0.25,
          borderRadius: 0.5,
        }}
      >
        NOTE
      </Typography>
      <Box component="span" sx={{ fontWeight: 500 }}>
        Link to {item.noteTitle || 'entire note'}
      </Box>
    </Box>
  );
}

export const LinkSuggestionList = forwardRef<LinkSuggestionListRef, LinkSuggestionListProps>(
  (props, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    // Reset selected index when items change
    useEffect(() => {
      setSelectedIndex(0);
    }, [props.items]);

    // Determine if we're showing headings (all items are headings)
    const isHeadingMode = props.items.length > 0 && props.items.every(isHeadingItem);

    // Detect duplicate titles for note items to show additional differentiators
    const titleCounts = new Map<string, number>();
    props.items.forEach((item) => {
      if (isNoteItem(item)) {
        const title = item.title ? item.title.toLowerCase() : 'untitled';
        titleCounts.set(title, (titleCounts.get(title) ?? 0) + 1);
      }
    });

    const hasDuplicateTitle = (item: NoteSuggestionItem): boolean => {
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
          {isHeadingMode ? 'No headings found' : 'No notes found'}
        </Paper>
      );
    }

    // For heading mode, show the note title as a header
    const headingModeNoteTitle = isHeadingMode
      ? (props.items[0] as HeadingSuggestionItem).noteTitle
      : null;

    return (
      <Paper
        elevation={3}
        sx={{
          maxHeight: '300px',
          overflow: 'auto',
          minWidth: '300px',
        }}
      >
        {headingModeNoteTitle && (
          <Box
            sx={{
              px: 2,
              py: 1,
              borderBottom: 1,
              borderColor: 'divider',
              backgroundColor: 'action.hover',
            }}
          >
            <Typography variant="caption" color="text.secondary">
              Headings in &quot;{headingModeNoteTitle}&quot;
            </Typography>
          </Box>
        )}
        <List dense disablePadding>
          {props.items.map((item, index) => (
            <ListItem key={`${item.type}-${item.id}`} disablePadding>
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
                    isHeadingItem(item) ? (
                      <HeadingItemContent item={item} />
                    ) : isEntireNoteItem(item) ? (
                      <EntireNoteItemContent item={item} />
                    ) : isNoteItem(item) ? (
                      <NoteItemContent item={item} hasDuplicate={hasDuplicateTitle(item)} />
                    ) : null
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
