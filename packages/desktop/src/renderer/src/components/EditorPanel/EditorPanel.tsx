/**
 * Editor Panel Component
 *
 * Displays the TipTap note editor with formatting toolbar.
 * Includes a resizable comment panel on the right.
 */

import React, { useCallback, useEffect, useState, useRef } from 'react';
import { Box, Drawer, useTheme } from '@mui/material';
import {
  Panel,
  PanelGroup,
  PanelResizeHandle,
  ImperativePanelHandle,
} from 'react-resizable-panels';
import { TipTapEditor } from './TipTapEditor';
import { HistoryPanel } from '../HistoryPanel/HistoryPanel';
import { CommentPanel } from '../CommentPanel';

const COMMENT_PANEL_STORAGE_KEY = 'notecove-comment-panel-size';
const DEFAULT_COMMENT_PANEL_SIZE = 40; // 40% of editor width

interface EditorPanelProps {
  selectedNoteId: string | null;
  isNewlyCreated?: boolean;
  onNoteLoaded?: () => void;
  showHistoryPanel?: boolean;
  onHistoryPanelClose?: () => void;
  showSearchPanel?: boolean;
  onSearchPanelClose?: () => void;
  onNavigateToNote?: (noteId: string, headingId?: string) => void;
  /** Heading ID to scroll to after note loads */
  pendingHeadingId?: string;
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
  pendingHeadingId,
  showCommentPanel = false,
  onCommentPanelClose,
  onCommentAdded,
}) => {
  const theme = useTheme();
  const [isNoteDeleted, setIsNoteDeleted] = useState(false);
  // Lifted search term state - retained across panel open/close, cleared on note switch
  const [searchTerm, setSearchTerm] = useState('');
  // Selected comment thread ID (for highlighting in editor and panel)
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  // Comment panel ref for programmatic expand/collapse
  const commentPanelRef = useRef<ImperativePanelHandle>(null);
  // Track saved panel size
  const [savedPanelSize, setSavedPanelSize] = useState<number>(() => {
    const saved = localStorage.getItem(COMMENT_PANEL_STORAGE_KEY);
    return saved ? parseFloat(saved) : DEFAULT_COMMENT_PANEL_SIZE;
  });
  // Track if panel was opened via "view all" (prevents auto-close when no thread selected)
  const [openedViaViewAll, setOpenedViaViewAll] = useState(false);

  // Clear search term and selected thread when note changes
  useEffect(() => {
    setSearchTerm('');
    setSelectedThreadId(null);
    setOpenedViaViewAll(false);
  }, [selectedNoteId]);

  // Auto-close panel when no thread is selected (after a small delay to allow for switching)
  // But don't auto-close if opened via "view all" button
  useEffect(() => {
    if (!selectedThreadId && showCommentPanel && !openedViaViewAll) {
      const timer = setTimeout(() => {
        onCommentPanelClose?.();
      }, 300);
      return () => {
        clearTimeout(timer);
      };
    }
    return undefined;
  }, [selectedThreadId, showCommentPanel, onCommentPanelClose, openedViaViewAll]);

  // Expand/collapse comment panel based on showCommentPanel prop
  useEffect(() => {
    const panel = commentPanelRef.current;
    if (!panel) return;

    if (showCommentPanel) {
      panel.expand();
      panel.resize(savedPanelSize);
    } else {
      panel.collapse();
    }
  }, [showCommentPanel, savedPanelSize]);

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

  // Memoized wrapper to prevent TipTapEditor from remounting when EditorPanel re-renders
  // TipTapEditor's cleanup effect includes onTitleChange in its dependencies,
  // so an unstable reference would cause the editor to be destroyed and recreated
  const stableTitleChangeHandler = useCallback(
    (noteId: string, title: string, contentText: string) => {
      void handleTitleChange(noteId, title, contentText);
    },
    [handleTitleChange]
  );

  // Save panel size when it changes
  const handlePanelResize = (sizes: number[]) => {
    const commentSize = sizes[1];
    if (commentSize && commentSize > 0) {
      setSavedPanelSize(commentSize);
      localStorage.setItem(COMMENT_PANEL_STORAGE_KEY, commentSize.toString());
    }
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <PanelGroup direction="horizontal" onLayout={handlePanelResize}>
        {/* Editor Panel */}
        <Panel id="editor-panel" order={1} minSize={40}>
          <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Use key to force recreation of editor when switching notes */}
            <TipTapEditor
              key={selectedNoteId}
              noteId={selectedNoteId}
              readOnly={isNoteDeleted}
              isNewlyCreated={isNewlyCreated}
              {...(onNavigateToNote && { onNavigateToNote })}
              {...(onNoteLoaded && { onNoteLoaded })}
              {...(pendingHeadingId && { pendingHeadingId })}
              onTitleChange={stableTitleChangeHandler}
              showSearchPanel={showSearchPanel}
              {...(onSearchPanelClose && { onSearchPanelClose })}
              searchTerm={searchTerm}
              onSearchTermChange={setSearchTerm}
              selectedThreadId={selectedThreadId}
              onCommentClick={(threadId) => {
                setSelectedThreadId(threadId);
                setOpenedViaViewAll(false); // Clicked a specific thread
                onCommentAdded?.(); // Open the panel when clicking on a comment
              }}
              onAddComment={({ threadId }) => {
                // Select the new thread and notify parent (to open panel if needed)
                setSelectedThreadId(threadId);
                setOpenedViaViewAll(false); // Added a specific thread
                onCommentAdded?.();
              }}
              onViewComments={() => {
                // Open panel without selecting a thread
                setOpenedViaViewAll(true);
                onCommentAdded?.();
              }}
            />
          </Box>
        </Panel>

        {/* Resize Handle - only visible when panel is open */}
        <PanelResizeHandle>
          <Box
            sx={{
              width: '4px',
              height: '100%',
              backgroundColor: showCommentPanel ? theme.palette.divider : 'transparent',
              cursor: showCommentPanel ? 'col-resize' : 'default',
              '&:hover': {
                backgroundColor: showCommentPanel ? theme.palette.primary.main : 'transparent',
              },
              '&:active': {
                backgroundColor: showCommentPanel ? theme.palette.primary.dark : 'transparent',
              },
            }}
          />
        </PanelResizeHandle>

        {/* Comment Panel */}
        <Panel
          id="comment-panel"
          order={2}
          ref={commentPanelRef}
          defaultSize={0}
          minSize={0}
          maxSize={50}
          collapsible={true}
          collapsedSize={0}
        >
          <Box
            sx={{
              height: '100%',
              overflow: 'hidden',
              borderLeft: showCommentPanel ? `1px solid ${theme.palette.divider}` : 'none',
              backgroundColor: theme.palette.background.paper,
            }}
          >
            <CommentPanel
              noteId={selectedNoteId}
              onClose={() => {
                setSelectedThreadId(null);
                setOpenedViaViewAll(false);
                onCommentPanelClose?.();
              }}
              selectedThreadId={selectedThreadId}
              onThreadSelect={(threadId) => {
                setSelectedThreadId(threadId);
                setOpenedViaViewAll(false); // Selected a specific thread
              }}
            />
          </Box>
        </Panel>
      </PanelGroup>

      {/* History Panel Drawer - kept as drawer since it's modal */}
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
    </Box>
  );
};
