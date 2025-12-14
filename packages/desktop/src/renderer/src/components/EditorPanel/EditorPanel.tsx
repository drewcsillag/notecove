/**
 * Editor Panel Component
 *
 * Displays the TipTap note editor with formatting toolbar.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Box, Drawer } from '@mui/material';
import { TipTapEditor } from './TipTapEditor';
import { HistoryPanel } from '../HistoryPanel/HistoryPanel';
import { CommentPanel } from '../CommentPanel';

interface EditorPanelProps {
  selectedNoteId: string | null;
  isNewlyCreated?: boolean;
  onNoteLoaded?: () => void;
  showHistoryPanel?: boolean;
  onHistoryPanelClose?: () => void;
  showSearchPanel?: boolean;
  onSearchPanelClose?: () => void;
  onNavigateToNote?: (noteId: string) => void;
  showCommentPanel?: boolean;
  onCommentPanelClose?: () => void;
  /** Called when user adds a comment - parent can use to open panel */
  onCommentAdded?: () => void;
}

export const EditorPanel: React.FC<EditorPanelProps> = ({
  selectedNoteId,
  isNewlyCreated = false,
  onNoteLoaded,
  showHistoryPanel = false,
  onHistoryPanelClose,
  showSearchPanel = false,
  onSearchPanelClose,
  onNavigateToNote,
  showCommentPanel = false,
  onCommentPanelClose,
  onCommentAdded,
}) => {
  const [isNoteDeleted, setIsNoteDeleted] = useState(false);
  // Lifted search term state - retained across panel open/close, cleared on note switch
  const [searchTerm, setSearchTerm] = useState('');
  // Selected comment thread ID (for highlighting in editor and panel)
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);

  // Clear search term and selected thread when note changes
  useEffect(() => {
    setSearchTerm('');
    setSelectedThreadId(null);
  }, [selectedNoteId]);

  // Check if the selected note is deleted
  useEffect(() => {
    if (!selectedNoteId) {
      setIsNoteDeleted(false);
      return;
    }

    const checkNoteStatus = async (): Promise<void> => {
      try {
        const metadata = await window.electronAPI.note.getMetadata(selectedNoteId);
        setIsNoteDeleted(metadata.deleted);
      } catch (err) {
        console.error('Failed to get note metadata:', err);
        setIsNoteDeleted(false);
      }
    };

    void checkNoteStatus();
  }, [selectedNoteId]);

  const handleTitleChange = useCallback(
    async (noteId: string, title: string, contentText: string) => {
      try {
        await window.electronAPI.note.updateTitle(noteId, title, contentText);
      } catch (err) {
        console.error('Failed to update note title:', err);
      }
    },
    []
  );

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {/* Use key to force recreation of editor when switching notes */}
      <TipTapEditor
        key={selectedNoteId}
        noteId={selectedNoteId}
        readOnly={isNoteDeleted}
        isNewlyCreated={isNewlyCreated}
        {...(onNavigateToNote && { onNavigateToNote })}
        {...(onNoteLoaded && { onNoteLoaded })}
        onTitleChange={(noteId: string, title: string, contentText: string) => {
          void handleTitleChange(noteId, title, contentText);
        }}
        showSearchPanel={showSearchPanel}
        {...(onSearchPanelClose && { onSearchPanelClose })}
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        selectedThreadId={selectedThreadId}
        onCommentClick={(threadId) => {
          setSelectedThreadId(threadId);
        }}
        onAddComment={() => {
          // When a comment is added, notify parent (to open panel if needed)
          onCommentAdded?.();
        }}
      />

      {/* History Panel Drawer */}
      <Drawer
        anchor="right"
        open={showHistoryPanel}
        onClose={onHistoryPanelClose}
        variant="temporary"
        sx={{
          '& .MuiDrawer-paper': {
            width: 600,
            maxWidth: '90vw',
          },
        }}
      >
        {showHistoryPanel && selectedNoteId && (
          <HistoryPanel
            selectedNoteId={selectedNoteId}
            onClose={
              onHistoryPanelClose ??
              (() => {
                // Empty fallback
              })
            }
          />
        )}
      </Drawer>

      {/* Comment Panel Drawer */}
      <Drawer
        anchor="right"
        open={showCommentPanel}
        onClose={onCommentPanelClose}
        variant="temporary"
        sx={{
          '& .MuiDrawer-paper': {
            width: 350,
            maxWidth: '80vw',
          },
        }}
      >
        {showCommentPanel && (
          <CommentPanel
            noteId={selectedNoteId}
            onClose={
              onCommentPanelClose ??
              (() => {
                // Empty fallback
              })
            }
            selectedThreadId={selectedThreadId}
            onThreadSelect={(threadId) => {
              setSelectedThreadId(threadId);
            }}
          />
        )}
      </Drawer>
    </Box>
  );
};
