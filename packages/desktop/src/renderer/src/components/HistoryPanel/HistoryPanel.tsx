/**
 * History Panel Component
 *
 * Displays the revision history for the currently selected note,
 * allowing users to view past versions and restore them.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { Box, Typography, IconButton, CircularProgress, Alert } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { SessionList } from './SessionList';
import { SessionDetailView } from './SessionDetailView';

interface HistoryPanelProps {
  selectedNoteId: string | null;
  onClose: () => void;
}

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

interface HistoryStats {
  totalUpdates: number;
  totalSessions: number;
  firstEdit: number | null;
  lastEdit: number | null;
  instanceCount: number;
  instances: string[];
}

export const HistoryPanel: React.FC<HistoryPanelProps> = ({ selectedNoteId, onClose }) => {
  const [sessions, setSessions] = useState<ActivitySession[]>([]);
  const [stats, setStats] = useState<HistoryStats | null>(null);
  const [selectedSession, setSelectedSession] = useState<ActivitySession | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load timeline when note changes
  useEffect(() => {
    if (!selectedNoteId) {
      setSessions([]);
      setStats(null);
      setSelectedSession(null);
      setError(null);
      return;
    }

    const loadTimeline = async (): Promise<void> => {
      setLoading(true);
      setError(null);
      try {
        const [timelineData, statsData] = await Promise.all([
          window.electronAPI.history.getTimeline(selectedNoteId),
          window.electronAPI.history.getStats(selectedNoteId),
        ]);

        setSessions(timelineData);
        setStats(statsData);

        // Auto-select most recent session if available
        if (timelineData.length > 0) {
          const lastSession = timelineData[timelineData.length - 1];
          if (lastSession) {
            setSelectedSession(lastSession);
          }
        }
      } catch (err) {
        console.error('Failed to load note history:', err);
        setError(err instanceof Error ? err.message : 'Failed to load history');
      } finally {
        setLoading(false);
      }
    };

    void loadTimeline();
  }, [selectedNoteId]);

  const handleSessionSelect = useCallback((session: ActivitySession) => {
    setSelectedSession(session);
  }, []);

  const handleRestore = useCallback(
    async (timestamp: number, updateIndex?: number) => {
      if (!selectedNoteId) return;

      try {
        const restoredState = await window.electronAPI.history.reconstructAt(
          selectedNoteId,
          updateIndex !== undefined ? { timestamp, updateIndex } : { timestamp }
        );

        // Apply the restored state to the note
        await window.electronAPI.note.applyUpdate(selectedNoteId, restoredState);

        // Close the history panel after successful restore
        onClose();
      } catch (err) {
        console.error('Failed to restore note version:', err);
        setError(err instanceof Error ? err.message : 'Failed to restore version');
      }
    },
    [selectedNoteId, onClose]
  );

  if (!selectedNoteId) {
    return (
      <Box
        sx={{
          p: 2,
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Typography variant="body2" color="text.secondary">
          Select a note to view its history
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box
        sx={{
          p: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Typography variant="h6">History</Typography>
        <IconButton onClick={onClose} size="small" aria-label="close">
          <CloseIcon />
        </IconButton>
      </Box>

      {/* Stats Summary */}
      {stats && (
        <Box sx={{ p: 2, bgcolor: 'background.paper' }}>
          <Typography variant="caption" color="text.secondary">
            {stats.totalSessions} sessions · {stats.totalUpdates} updates · {stats.instanceCount}{' '}
            {stats.instanceCount === 1 ? 'device' : 'devices'}
          </Typography>
        </Box>
      )}

      {/* Error Display */}
      {error && (
        <Box sx={{ p: 2 }}>
          <Alert
            severity="error"
            onClose={() => {
              setError(null);
            }}
          >
            {error}
          </Alert>
        </Box>
      )}

      {/* Loading State */}
      {loading && (
        <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}>
          <CircularProgress />
        </Box>
      )}

      {/* Content */}
      {!loading && sessions.length > 0 && (
        <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Session List */}
          <Box
            sx={{
              width: 250,
              borderRight: 1,
              borderColor: 'divider',
              overflow: 'auto',
            }}
          >
            <SessionList
              sessions={sessions}
              selectedSession={selectedSession}
              onSessionSelect={handleSessionSelect}
            />
          </Box>

          {/* Detail View */}
          <Box sx={{ flex: 1, overflow: 'auto' }}>
            {selectedSession && (
              <SessionDetailView
                session={selectedSession}
                noteId={selectedNoteId}
                onRestore={handleRestore}
              />
            )}
          </Box>
        </Box>
      )}

      {/* Empty State */}
      {!loading && sessions.length === 0 && !error && (
        <Box
          sx={{ p: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}
        >
          <Typography variant="body2" color="text.secondary">
            No history available for this note
          </Typography>
        </Box>
      )}
    </Box>
  );
};
