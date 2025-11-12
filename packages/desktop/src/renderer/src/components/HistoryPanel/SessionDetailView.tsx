/**
 * SessionDetailView Component
 *
 * Displays detailed information about a selected editing session,
 * including a timeline of updates and preview of the content at different points.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Slider,
  CircularProgress,
  Alert,
  Divider,
  Paper,
} from '@mui/material';
import RestoreIcon from '@mui/icons-material/Restore';
import { format } from 'date-fns';
import * as Y from 'yjs';

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

interface SessionDetailViewProps {
  session: ActivitySession;
  noteId: string;
  onRestore: (timestamp: number, updateIndex?: number) => Promise<void>;
}

// Extract plain text from Yjs document
function extractTextFromDoc(doc: Y.Doc): string {
  const content = doc.getXmlFragment('content');
  let text = '';

  const extractFromElement = (elem: Y.XmlElement | Y.XmlFragment): string => {
    let result = '';
    elem.forEach((child: unknown) => {
      if (child instanceof Y.XmlText) {
        result += String(child);
      } else if (child instanceof Y.XmlElement) {
        result += extractFromElement(child);
        // Add newline after block elements
        if (child.nodeName === 'paragraph' || child.nodeName === 'heading') {
          result += '\n';
        }
      }
    });
    return result;
  };

  text = extractFromElement(content);
  return text.trim();
}

export const SessionDetailView: React.FC<SessionDetailViewProps> = ({
  session,
  noteId,
  onRestore,
}) => {
  const [selectedUpdateIndex, setSelectedUpdateIndex] = useState<number>(
    session.updates.length - 1
  );
  const [currentPreview, setCurrentPreview] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);

  // Load preview for current slider position
  useEffect(() => {
    const loadPreview = async (): Promise<void> => {
      setLoading(true);
      setError(null);
      try {
        // Reconstruct document up to selected update
        const update = session.updates[selectedUpdateIndex];
        if (!update) return;

        // Use timestamp only - don't pass updateIndex as it would be relative to session,
        // but backend expects it relative to all updates in note history
        const reconstructedState = await window.electronAPI.history.reconstructAt(noteId, {
          timestamp: update.timestamp,
        });

        // Apply to a temporary doc to extract text
        const tempDoc = new Y.Doc();
        Y.applyUpdate(tempDoc, reconstructedState);
        const text = extractTextFromDoc(tempDoc);
        setCurrentPreview(text);
      } catch (err) {
        console.error('Failed to load preview:', err);
        setError(err instanceof Error ? err.message : 'Failed to load preview');
      } finally {
        setLoading(false);
      }
    };

    void loadPreview();
  }, [session.id, noteId, selectedUpdateIndex, session.updates]);

  const handleSliderChange = useCallback((_event: Event, value: number | number[]) => {
    setSelectedUpdateIndex(value as number);
  }, []);

  const handleRestore = useCallback(async () => {
    const update = session.updates[selectedUpdateIndex];
    if (!update) return;

    setRestoring(true);
    setError(null);

    try {
      await onRestore(update.timestamp, selectedUpdateIndex);
    } catch (err) {
      console.error('Failed to restore version:', err);
      setError(err instanceof Error ? err.message : 'Failed to restore version');
    } finally {
      setRestoring(false);
    }
  }, [session, selectedUpdateIndex, onRestore]);

  const selectedUpdate = session.updates[selectedUpdateIndex];

  // Create slider marks for key points
  const marks = [
    { value: 0, label: 'Start' },
    { value: session.updates.length - 1, label: 'End' },
  ];

  // Only show one mark if there's only one update
  const sliderMarks = session.updates.length === 1 ? [{ value: 0, label: 'Only Update' }] : marks;

  return (
    <Box sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Session Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          {format(session.startTime, 'MMMM d, yyyy')}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {session.updates.length === 1
            ? format(session.startTime, 'h:mm a')
            : `${format(session.startTime, 'h:mm a')} - ${format(session.endTime, 'h:mm a')}`}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {session.updateCount} {session.updateCount === 1 ? 'update' : 'updates'}
          {session.instanceIds.length > 1 && ` · ${session.instanceIds.length} devices`}
        </Typography>
      </Box>

      <Divider sx={{ mb: 3 }} />

      {/* Error Display */}
      {error && (
        <Alert
          severity="error"
          onClose={() => {
            setError(null);
          }}
          sx={{ mb: 2 }}
        >
          {error}
        </Alert>
      )}

      {/* Timeline Scrubber */}
      {session.updates.length > 0 && (
        <>
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" gutterBottom>
              Timeline
            </Typography>
            <Box sx={{ px: 2, mt: 2 }}>
              <Slider
                value={selectedUpdateIndex}
                onChange={handleSliderChange}
                min={0}
                max={session.updates.length - 1}
                step={1}
                marks={sliderMarks}
                valueLabelDisplay="auto"
                valueLabelFormat={(value) => {
                  const update = session.updates[value];
                  return update ? format(update.timestamp, 'h:mm:ss a') : '';
                }}
                disabled={session.updates.length === 1}
              />
            </Box>
            {selectedUpdate && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                Update {selectedUpdateIndex + 1} of {session.updates.length} ·{' '}
                {format(selectedUpdate.timestamp, 'h:mm:ss a')}
              </Typography>
            )}
          </Box>

          <Divider sx={{ mb: 3 }} />

          {/* Preview Section */}
          <Box sx={{ mb: 3, flex: 1, overflow: 'auto' }}>
            <Typography variant="subtitle2" gutterBottom>
              Preview
            </Typography>

            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <Paper variant="outlined" sx={{ p: 2 }}>
                {currentPreview ? (
                  <Typography
                    variant="body2"
                    sx={{
                      whiteSpace: 'pre-wrap',
                      fontFamily: 'monospace',
                      maxHeight: 400,
                      overflow: 'auto',
                    }}
                  >
                    {currentPreview}
                  </Typography>
                ) : (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ fontStyle: 'italic', textAlign: 'center', py: 4 }}
                  >
                    No content yet
                    <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                      This version contains metadata only (cursor positions, selections)
                    </Typography>
                  </Typography>
                )}
              </Paper>
            )}
          </Box>

          {/* Restore Button */}
          <Box sx={{ mt: 'auto', pt: 2 }}>
            <Button
              variant="contained"
              startIcon={restoring ? <CircularProgress size={20} /> : <RestoreIcon />}
              onClick={() => {
                void handleRestore();
              }}
              disabled={restoring || loading}
              fullWidth
            >
              {restoring ? 'Restoring...' : 'Restore to This Version'}
            </Button>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              This will replace the current note content with the selected version
            </Typography>
          </Box>
        </>
      )}

      {/* Empty State */}
      {session.updates.length === 0 && (
        <Box sx={{ p: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            No updates in this session
          </Typography>
        </Box>
      )}
    </Box>
  );
};
