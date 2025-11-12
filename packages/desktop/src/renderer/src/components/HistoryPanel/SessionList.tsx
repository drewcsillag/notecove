/**
 * SessionList Component
 *
 * Displays a list of editing sessions in the history panel.
 * Shows session timestamp, duration, and update count.
 */

import React from 'react';
import { Box, List, ListItem, ListItemButton, ListItemText, Typography, Chip } from '@mui/material';
import { format } from 'date-fns';

interface ActivitySession {
  id: string;
  startTime: number;
  endTime: number;
  updateCount: number;
  instanceIds: string[];
  updates: {
    instanceId: string;
    timestamp: number;
    sequence: number;
    data: Uint8Array;
  }[];
}

interface SessionListProps {
  sessions: ActivitySession[];
  selectedSession: ActivitySession | null;
  onSessionSelect: (session: ActivitySession) => void;
}

const formatDuration = (startMs: number, endMs: number): string => {
  const durationMs = endMs - startMs;
  const seconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  } else if (minutes > 0) {
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  } else {
    return `${seconds}s`;
  }
};

const formatSessionTime = (timestamp: number): { primary: string; secondary: string } => {
  const date = new Date(timestamp);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  let primary: string;
  if (isToday) {
    primary = 'Today';
  } else if (isYesterday) {
    primary = 'Yesterday';
  } else {
    primary = format(date, 'MMM d, yyyy');
  }

  const secondary = format(date, 'h:mm a');

  return { primary, secondary };
};

export const SessionList: React.FC<SessionListProps> = ({
  sessions,
  selectedSession,
  onSessionSelect,
}) => {
  if (sessions.length === 0) {
    return (
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          No sessions found
        </Typography>
      </Box>
    );
  }

  // Sort sessions by start time (most recent first)
  const sortedSessions = [...sessions].sort((a, b) => b.startTime - a.startTime);

  return (
    <List sx={{ p: 0 }}>
      {sortedSessions.map((session) => {
        const isSelected = selectedSession?.id === session.id;
        const { primary, secondary } = formatSessionTime(session.startTime);
        const duration = formatDuration(session.startTime, session.endTime);
        const deviceCount = session.instanceIds.length;

        return (
          <ListItem key={session.id} disablePadding>
            <ListItemButton
              selected={isSelected}
              onClick={() => {
                onSessionSelect(session);
              }}
              sx={{
                py: 1.5,
                px: 2,
                borderBottom: 1,
                borderColor: 'divider',
                '&.Mui-selected': {
                  bgcolor: 'action.selected',
                  '&:hover': {
                    bgcolor: 'action.selected',
                  },
                },
              }}
            >
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2" fontWeight={isSelected ? 600 : 400}>
                      {primary}
                    </Typography>
                    {deviceCount > 1 && (
                      <Chip
                        label={`${deviceCount} devices`}
                        size="small"
                        sx={{ height: 18, fontSize: '0.65rem' }}
                      />
                    )}
                  </Box>
                }
                secondary={
                  <Box sx={{ mt: 0.5 }}>
                    <Typography variant="caption" color="text.secondary" display="block">
                      {secondary}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {duration} · {session.updateCount}{' '}
                      {session.updateCount === 1 ? 'update' : 'updates'}
                    </Typography>
                  </Box>
                }
              />
            </ListItemButton>
          </ListItem>
        );
      })}
    </List>
  );
};
