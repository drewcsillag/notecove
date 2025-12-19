/**
 * MentionPopover Component
 *
 * A popover that appears when clicking on a mention chip.
 * Displays user info and provides action to filter notes by that person.
 */

import React from 'react';
import { Box, Typography, Button, Avatar, Paper, Stack } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';

export interface MentionPopoverProps {
  /** The profile ID of the mentioned user */
  profileId: string;
  /** The @handle of the mentioned user */
  handle: string;
  /** The display name of the mentioned user */
  displayName: string;
  /** Callback when "Search for mentions" is clicked */
  onSearchMentions?: (handle: string, displayName: string) => void;
  /** Callback when the popover should close */
  onClose: () => void;
}

/**
 * Get initials from a display name for the avatar
 */
function getInitials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter((p) => p.length > 0);
  if (parts.length >= 2) {
    const first = parts[0]?.[0] ?? '';
    const last = parts[parts.length - 1]?.[0] ?? '';
    return `${first}${last}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || '?';
}

/**
 * Generate a consistent color based on a string (for avatar background)
 */
function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 65%, 45%)`;
}

/**
 * MentionPopover displays user info and actions when a mention is clicked
 */
export const MentionPopover: React.FC<MentionPopoverProps> = ({
  profileId,
  handle,
  displayName,
  onSearchMentions,
  onClose,
}) => {
  const handleSearchClick = () => {
    console.log('[MentionPopover] Search for mentions of:', handle, displayName);
    onSearchMentions?.(handle, displayName);
    onClose();
  };

  const initials = getInitials(displayName);
  const avatarColor = stringToColor(profileId);

  return (
    <Paper
      elevation={4}
      sx={{
        p: 2,
        minWidth: 200,
        maxWidth: 280,
        borderRadius: 2,
      }}
    >
      <Stack spacing={2}>
        {/* User info section */}
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Avatar
            sx={{
              width: 40,
              height: 40,
              bgcolor: avatarColor,
              fontSize: '1rem',
              fontWeight: 600,
            }}
          >
            {initials}
          </Avatar>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography
              variant="subtitle2"
              sx={{
                fontWeight: 600,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {displayName}
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {handle}
            </Typography>
          </Box>
        </Stack>

        {/* Action button */}
        {onSearchMentions && (
          <Button
            variant="outlined"
            size="small"
            startIcon={<SearchIcon />}
            onClick={handleSearchClick}
            fullWidth
            sx={{ textTransform: 'none' }}
          >
            Find notes mentioning this person
          </Button>
        )}
      </Stack>
    </Paper>
  );
};

export default MentionPopover;
