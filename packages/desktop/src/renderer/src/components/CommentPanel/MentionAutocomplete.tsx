/**
 * MentionAutocomplete component
 *
 * Provides autocomplete dropdown for @-mentions in comment input.
 * Fetches users from profile presence and filters based on query.
 */

import React, { useEffect, useState } from 'react';
import {
  Popper,
  Paper,
  List,
  ListItemButton,
  ListItemAvatar,
  ListItemText,
  Avatar,
} from '@mui/material';

/**
 * User data from mention:getUsers IPC
 */
export interface MentionUser {
  profileId: string;
  handle: string; // @drew
  name: string; // Drew Colthorp
}

interface MentionAutocompleteProps {
  /** Current query after @ */
  query: string;
  /** Called when user selects a mention */
  onSelect: (user: MentionUser) => void;
  /** Called when autocomplete should close (escape, blur) */
  onClose: () => void;
  /** Anchor element for positioning the popper */
  anchorEl: HTMLElement | null;
}

/**
 * MentionAutocomplete - Autocomplete dropdown for @-mentions
 */
export const MentionAutocomplete: React.FC<MentionAutocompleteProps> = ({
  query,
  onSelect,
  onClose,
  anchorEl,
}) => {
  const [users, setUsers] = useState<MentionUser[]>([]);
  const [filtered, setFiltered] = useState<MentionUser[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Load users on mount
  useEffect(() => {
    window.electronAPI.mention
      .getUsers()
      .then((loadedUsers) => {
        setUsers(loadedUsers);
      })
      .catch((error) => {
        console.error('[MentionAutocomplete] Failed to load users:', error);
      });
  }, []);

  // Filter on query change
  useEffect(() => {
    const q = query.toLowerCase();
    const matches = users
      .filter((u) => u.handle.toLowerCase().includes(q) || u.name.toLowerCase().includes(q))
      .slice(0, 5); // Limit to 5 results
    setFiltered(matches);
    setSelectedIndex(0);
  }, [query, users]);

  // Keyboard navigation
  useEffect(() => {
    if (!anchorEl || filtered.length === 0) return;

    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        e.stopPropagation();
        if (filtered[selectedIndex]) {
          onSelect(filtered[selectedIndex]);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };

    // Use capture phase to handle before textarea
    document.addEventListener('keydown', handler, true);
    return () => {
      document.removeEventListener('keydown', handler, true);
    };
  }, [filtered, selectedIndex, onSelect, onClose, anchorEl]);

  // Don't render if no anchor or no matches
  if (!anchorEl || filtered.length === 0) return null;

  return (
    <Popper
      open
      anchorEl={anchorEl}
      placement="bottom-start"
      style={{ zIndex: 1400 }}
      modifiers={[
        {
          name: 'offset',
          options: {
            offset: [0, 4],
          },
        },
      ]}
    >
      <Paper elevation={8} sx={{ minWidth: 200 }}>
        <List dense sx={{ py: 0.5 }}>
          {filtered.map((user, i) => (
            <ListItemButton
              key={user.profileId}
              selected={i === selectedIndex}
              onClick={() => {
                onSelect(user);
              }}
              sx={{
                py: 0.5,
                '&.Mui-selected': {
                  bgcolor: 'action.selected',
                },
              }}
            >
              <ListItemAvatar sx={{ minWidth: 36 }}>
                <Avatar
                  sx={{
                    width: 24,
                    height: 24,
                    fontSize: '0.75rem',
                    bgcolor: 'primary.main',
                  }}
                >
                  {user.name.charAt(0).toUpperCase()}
                </Avatar>
              </ListItemAvatar>
              <ListItemText
                primary={user.name}
                secondary={user.handle}
                primaryTypographyProps={{ variant: 'body2' }}
                secondaryTypographyProps={{ variant: 'caption' }}
              />
            </ListItemButton>
          ))}
        </List>
      </Paper>
    </Popper>
  );
};

export default MentionAutocomplete;
