/**
 * Editor Comments Hook
 *
 * Handles comment interactions: click handling, adding comments, keyboard shortcuts,
 * and comment count tracking.
 */

import { useEffect, useState, useCallback } from 'react';
import type { Editor } from '@tiptap/react';

/**
 * User profile for comment authorship
 */
interface UserProfile {
  profileId: string;
  username: string;
  handle: string;
}

/**
 * State for the overlap comment popover (shown when multiple comments overlap)
 */
export interface OverlapPopoverState {
  anchorEl: HTMLElement;
  threadIds: string[];
}

/**
 * Callbacks for comment interactions
 */
export interface CommentCallbacks {
  /** Called when a comment mark is clicked */
  onCommentClick?: (threadId: string) => void;
  /** Called when a new comment is added */
  onAddComment?: (selection: { from: number; to: number; text: string; threadId: string }) => void;
}

/**
 * Return value from the useEditorComments hook
 */
export interface UseEditorCommentsReturn {
  /** Number of open (unresolved) comment threads */
  openCommentCount: number;
  /** State for the overlap popover (when multiple comments overlap) */
  overlapPopover: OverlapPopoverState | null;
  /** Close the overlap popover */
  closeOverlapPopover: () => void;
  /** Handler for the comment toolbar button */
  handleCommentButtonClick: () => void;
}

/**
 * Hook to handle comment interactions in the editor.
 *
 * Manages:
 * - Click handling for comment highlights (with overlap detection)
 * - Adding comments on selection
 * - Keyboard shortcut (Cmd+Alt+M / Ctrl+Alt+M)
 * - Comment count tracking for toolbar badge
 *
 * @param noteId - ID of the current note
 * @param editor - TipTap editor instance
 * @param userProfile - User profile for comment authorship
 * @param callbacks - Callbacks for comment interactions
 * @returns Comment state and handlers
 */
export function useEditorComments(
  noteId: string | null,
  editor: Editor | null,
  userProfile: UserProfile | null,
  callbacks: CommentCallbacks
): UseEditorCommentsReturn {
  const { onCommentClick, onAddComment } = callbacks;

  // State for comment count (toolbar badge)
  const [openCommentCount, setOpenCommentCount] = useState(0);

  // State for overlap popover (when multiple comments overlap)
  const [overlapPopover, setOverlapPopover] = useState<OverlapPopoverState | null>(null);

  // Close the overlap popover
  const closeOverlapPopover = useCallback(() => {
    setOverlapPopover(null);
  }, []);

  // Create a comment on the current selection
  // This function is used by both the keyboard shortcut and toolbar button
  const handleAddCommentOnSelection = useCallback(async () => {
    if (!editor || !noteId || !userProfile) return;

    // Get current selection
    const { from, to, empty } = editor.state.selection;

    if (empty) {
      console.log('[useEditorComments] Cannot add comment: no selection');
      return;
    }

    // Get selected text
    const text = editor.state.doc.textBetween(from, to, ' ');
    console.log('[useEditorComments] Adding comment for selection:', { from, to, text });

    try {
      // Encode positions as simple Uint8Array for now
      // Future enhancement: Use Yjs RelativePosition for anchors that survive text edits
      const anchorStart = new Uint8Array(new Uint32Array([from]).buffer);
      const anchorEnd = new Uint8Array(new Uint32Array([to]).buffer);

      // Create the comment thread via IPC
      const result = await window.electronAPI.comment.addThread(noteId, {
        noteId,
        anchorStart,
        anchorEnd,
        authorId: userProfile.profileId,
        authorName: userProfile.username || 'Anonymous',
        authorHandle: userProfile.handle || '@anonymous',
        content: '', // Empty content - user will fill in via panel
        originalText: text,
        created: Date.now(),
        modified: Date.now(),
        resolved: false,
      });

      if (!result.success || !result.threadId) {
        console.error('[useEditorComments] Failed to create comment thread:', result.error);
        return;
      }

      console.log('[useEditorComments] Comment thread created:', result.threadId);

      // Apply the comment mark to the selection
      editor.chain().focus().setTextSelection({ from, to }).setCommentMark(result.threadId).run();

      console.log('[useEditorComments] Comment mark applied');

      // Notify parent about the new comment (to open panel, select thread, etc.)
      onAddComment?.({ from, to, text, threadId: result.threadId });
    } catch (err) {
      console.error('[useEditorComments] Failed to create comment thread:', err);
    }
  }, [editor, noteId, onAddComment, userProfile]);

  // Handler for the comment toolbar button
  const handleCommentButtonClick = useCallback(() => {
    void handleAddCommentOnSelection();
  }, [handleAddCommentOnSelection]);

  // Click handler for comment highlights
  // When a comment mark is clicked, check for overlapping comments and show popover if multiple
  useEffect(() => {
    if (!editor || !onCommentClick) return;

    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const commentHighlight = target.closest('.comment-highlight');
      if (commentHighlight) {
        // Collect all thread IDs from this element and its ancestors
        const threadIds: string[] = [];
        let current: Element | null = commentHighlight;

        while (current) {
          if (current.classList.contains('comment-highlight')) {
            const threadId = current.getAttribute('data-thread-id');
            if (threadId && !threadIds.includes(threadId)) {
              threadIds.push(threadId);
            }
          }
          current = current.parentElement?.closest('.comment-highlight') ?? null;
        }

        if (threadIds.length === 0) {
          return;
        }

        if (threadIds.length === 1 && threadIds[0]) {
          // Single comment - select it directly
          console.log('[useEditorComments] Comment highlight clicked, threadId:', threadIds[0]);
          onCommentClick(threadIds[0]);
        } else if (threadIds.length > 1) {
          // Multiple overlapping comments - show popover
          console.log('[useEditorComments] Overlapping comments clicked:', threadIds);
          setOverlapPopover({
            anchorEl: commentHighlight as HTMLElement,
            threadIds,
          });
        }
      }
    };

    const editorDom = editor.view.dom;
    editorDom.addEventListener('click', handleClick);

    return () => {
      editorDom.removeEventListener('click', handleClick);
    };
  }, [editor, onCommentClick]);

  // Keyboard shortcut for adding comments (Cmd+Alt+M / Ctrl+Alt+M like Google Docs)
  useEffect(() => {
    if (!editor || !noteId) return;

    const handleKeyDown = async (event: KeyboardEvent) => {
      // Check for Cmd+Alt+M (Mac) or Ctrl+Alt+M (Windows/Linux)
      // eslint-disable-next-line @typescript-eslint/prefer-includes, @typescript-eslint/no-deprecated
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modifier = isMac ? event.metaKey : event.ctrlKey;

      // Use event.code instead of event.key because Alt/Option modifies the character on Mac
      if (modifier && event.altKey && event.code === 'KeyM') {
        event.preventDefault();
        event.stopPropagation();
        await handleAddCommentOnSelection();
      }
    };

    const editorDom = editor.view.dom;
    const wrappedHandler = (event: Event) => {
      void handleKeyDown(event as KeyboardEvent);
    };
    editorDom.addEventListener('keydown', wrappedHandler);

    return () => {
      editorDom.removeEventListener('keydown', wrappedHandler);
    };
  }, [editor, noteId, handleAddCommentOnSelection]);

  // Load and track open comment count for toolbar badge
  useEffect(() => {
    if (!noteId) {
      setOpenCommentCount(0);
      return;
    }

    // Load initial count
    const loadCommentCount = async () => {
      try {
        const threads = await window.electronAPI.comment.getThreads(noteId);
        const openCount = threads.filter((t) => !t.resolved).length;
        setOpenCommentCount(openCount);
      } catch (error) {
        console.error('Failed to load comment count:', error);
      }
    };
    void loadCommentCount();

    // Subscribe to thread changes
    const unsubAdded = window.electronAPI.comment.onThreadAdded((addedNoteId) => {
      if (addedNoteId === noteId) {
        void loadCommentCount();
      }
    });
    const unsubUpdated = window.electronAPI.comment.onThreadUpdated((updatedNoteId) => {
      if (updatedNoteId === noteId) {
        void loadCommentCount();
      }
    });
    const unsubDeleted = window.electronAPI.comment.onThreadDeleted((deletedNoteId, threadId) => {
      if (deletedNoteId === noteId) {
        void loadCommentCount();
        // Remove the comment mark from the editor
        if (editor) {
          editor.commands.removeCommentMarkById(threadId);
        }
      }
    });

    return () => {
      unsubAdded();
      unsubUpdated();
      unsubDeleted();
    };
  }, [noteId, editor]);

  return {
    openCommentCount,
    overlapPopover,
    closeOverlapPopover,
    handleCommentButtonClick,
  };
}
