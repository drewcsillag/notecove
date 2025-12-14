/**
 * Comment Panel Component
 *
 * Displays comment threads for the current note in a right sidebar.
 * Supports adding comments, replies, and resolving threads.
 *
 * Phase 1 - Minimal Vertical Slice
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  Box,
  Typography,
  IconButton,
  TextField,
  Button,
  Paper,
  Collapse,
  Divider,
  Chip,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';
import {
  Comment as CommentIcon,
  Close as CloseIcon,
  Check as CheckIcon,
  Reply as ReplyIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import type { CommentThread, CommentReply } from '@notecove/shared/comments';

export interface CommentPanelProps {
  noteId: string | null;
  onClose: () => void;
  onAddComment?: (selection: { from: number; to: number; text: string }) => void;
  selectedThreadId?: string | null;
  onThreadSelect?: (threadId: string | null) => void;
}

interface ThreadWithReplies extends CommentThread {
  replies: CommentReply[];
}

export const CommentPanel: React.FC<CommentPanelProps> = ({
  noteId,
  onClose,
  selectedThreadId,
  onThreadSelect,
}) => {
  const [threads, setThreads] = useState<ThreadWithReplies[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showResolved, setShowResolved] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());
  // Edit mode state
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  // Delete confirmation state
  const [deleteConfirmThreadId, setDeleteConfirmThreadId] = useState<string | null>(null);

  // Load threads from the note
  const loadThreads = useCallback(async () => {
    if (!noteId) {
      setThreads([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const fetchedThreads = await window.electronAPI.comment.getThreads(noteId);

      // For now, we'll load replies separately (in a real implementation,
      // the IPC could return threads with replies pre-loaded)
      const threadsWithReplies: ThreadWithReplies[] = fetchedThreads.map((thread) => ({
        ...thread,
        replies: [], // TODO: Load replies from CRDT
      }));

      setThreads(threadsWithReplies);
    } catch (err) {
      console.error('Failed to load comment threads:', err);
      setError('Failed to load comments');
    } finally {
      setLoading(false);
    }
  }, [noteId]);

  // Initial load
  useEffect(() => {
    void loadThreads();
  }, [loadThreads]);

  // Listen for comment updates
  useEffect(() => {
    const unsubscribeThreadAdded = window.electronAPI.comment.onThreadAdded(
      (eventNoteId, _threadId) => {
        if (eventNoteId === noteId) {
          void loadThreads();
        }
      }
    );

    const unsubscribeThreadUpdated = window.electronAPI.comment.onThreadUpdated(
      (eventNoteId, _threadId) => {
        if (eventNoteId === noteId) {
          void loadThreads();
        }
      }
    );

    const unsubscribeThreadDeleted = window.electronAPI.comment.onThreadDeleted(
      (eventNoteId, _threadId) => {
        if (eventNoteId === noteId) {
          void loadThreads();
        }
      }
    );

    return () => {
      unsubscribeThreadAdded();
      unsubscribeThreadUpdated();
      unsubscribeThreadDeleted();
    };
  }, [noteId, loadThreads]);

  const handleResolve = async (threadId: string, resolved: boolean) => {
    try {
      const updates: { resolved: boolean; resolvedBy?: string; resolvedAt?: number } = {
        resolved,
      };
      if (resolved) {
        updates.resolvedBy = 'current-user'; // TODO: Get actual user ID
        updates.resolvedAt = Date.now();
      }
      if (noteId) {
        await window.electronAPI.comment.updateThread(noteId, threadId, updates);
      }
      void loadThreads();
    } catch (err) {
      console.error('Failed to resolve thread:', err);
    }
  };

  const handleDeleteClick = (threadId: string) => {
    setDeleteConfirmThreadId(threadId);
  };

  const handleDeleteCancel = () => {
    setDeleteConfirmThreadId(null);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmThreadId || !noteId) return;

    try {
      await window.electronAPI.comment.deleteThread(noteId, deleteConfirmThreadId);
      setDeleteConfirmThreadId(null);
      void loadThreads();
    } catch (err) {
      console.error('Failed to delete thread:', err);
    }
  };

  const handleReply = async (threadId: string) => {
    if (!replyText.trim() || !noteId) return;

    try {
      await window.electronAPI.comment.addReply(noteId, threadId, {
        threadId,
        authorId: 'current-user', // TODO: Get actual user ID
        authorName: 'You', // TODO: Get actual user name
        authorHandle: '@you', // TODO: Get actual handle
        content: replyText.trim(),
        created: Date.now(),
        modified: Date.now(),
      });
      setReplyText('');
      setReplyingTo(null);
      void loadThreads();
    } catch (err) {
      console.error('Failed to add reply:', err);
    }
  };

  const handleStartEdit = (threadId: string, currentContent: string) => {
    setEditingThreadId(threadId);
    setEditText(currentContent);
    // Cancel any reply in progress
    setReplyingTo(null);
    setReplyText('');
  };

  const handleCancelEdit = () => {
    setEditingThreadId(null);
    setEditText('');
  };

  const handleSaveEdit = async (threadId: string) => {
    if (!editText.trim() || !noteId) return;

    try {
      await window.electronAPI.comment.updateThread(noteId, threadId, {
        content: editText.trim(),
      });
      setEditingThreadId(null);
      setEditText('');
      void loadThreads();
    } catch (err) {
      console.error('Failed to update thread:', err);
    }
  };

  const toggleExpanded = (threadId: string) => {
    setExpandedThreads((prev) => {
      const next = new Set(prev);
      if (next.has(threadId)) {
        next.delete(threadId);
      } else {
        next.add(threadId);
      }
      return next;
    });
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  // Filter threads based on resolved state
  const visibleThreads = threads.filter((t) => showResolved || !t.resolved);
  const resolvedCount = threads.filter((t) => t.resolved).length;

  if (!noteId) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Select a note to view comments
        </Typography>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="body2" color="error">
          {error}
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          py: 1.5,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CommentIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
          <Typography variant="subtitle2" fontWeight={600}>
            Comments
          </Typography>
          {threads.length > 0 && (
            <Chip label={threads.length} size="small" sx={{ height: 20, minWidth: 20 }} />
          )}
        </Box>
        <IconButton size="small" onClick={onClose} title="Close comments">
          <CloseIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Box>

      {/* Resolved toggle */}
      {resolvedCount > 0 && (
        <Box sx={{ px: 2, py: 1, borderBottom: 1, borderColor: 'divider' }}>
          <Button
            size="small"
            onClick={() => {
              setShowResolved(!showResolved);
            }}
            startIcon={showResolved ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            sx={{ textTransform: 'none' }}
          >
            {showResolved ? 'Hide' : 'Show'} {resolvedCount} resolved
          </Button>
        </Box>
      )}

      {/* Thread list */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 1 }}>
        {visibleThreads.length === 0 ? (
          <Box sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              No comments yet. Select text and click the comment button or press ⌘⌥M.
            </Typography>
          </Box>
        ) : (
          visibleThreads.map((thread) => (
            <Paper
              key={thread.id}
              elevation={0}
              sx={{
                mb: 1,
                border: 1,
                borderColor: selectedThreadId === thread.id ? 'primary.main' : 'divider',
                borderRadius: 1,
                overflow: 'hidden',
                opacity: thread.resolved ? 0.7 : 1,
                cursor: 'pointer',
                '&:hover': {
                  borderColor: 'primary.light',
                },
              }}
              onClick={() => onThreadSelect?.(thread.id)}
            >
              {/* Thread header */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  p: 1.5,
                  pb: 0,
                }}
              >
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" fontWeight={600}>
                    {thread.authorName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formatDate(thread.created)}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleResolve(thread.id, !thread.resolved);
                    }}
                    title={thread.resolved ? 'Reopen' : 'Resolve'}
                    color={thread.resolved ? 'success' : 'default'}
                  >
                    <CheckIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Box>
              </Box>

              {/* Original text quote */}
              {thread.originalText && (
                <Box
                  sx={{
                    mx: 1.5,
                    mt: 1,
                    p: 1,
                    backgroundColor: 'action.hover',
                    borderRadius: 0.5,
                    borderLeft: 3,
                    borderColor: 'warning.main',
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      fontStyle: 'italic',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    &ldquo;{thread.originalText}&rdquo;
                  </Typography>
                </Box>
              )}

              {/* Comment content */}
              <Box sx={{ px: 1.5, py: 1 }}>
                {editingThreadId === thread.id ? (
                  <Box>
                    <TextField
                      size="small"
                      fullWidth
                      multiline
                      rows={2}
                      value={editText}
                      onChange={(e) => {
                        setEditText(e.target.value);
                      }}
                      autoFocus
                      sx={{ mb: 1 }}
                    />
                    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                      <Button size="small" onClick={handleCancelEdit}>
                        Cancel
                      </Button>
                      <Button
                        size="small"
                        variant="contained"
                        onClick={() => {
                          void handleSaveEdit(thread.id);
                        }}
                        disabled={!editText.trim()}
                      >
                        Save
                      </Button>
                    </Box>
                  </Box>
                ) : (
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                    <Typography variant="body2" sx={{ flex: 1 }}>
                      {thread.content || <em style={{ opacity: 0.6 }}>No comment text</em>}
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartEdit(thread.id, thread.content);
                      }}
                      title="Edit comment"
                      sx={{ ml: 'auto', opacity: 0.6, '&:hover': { opacity: 1 } }}
                    >
                      <EditIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  </Box>
                )}
              </Box>

              {/* Replies section */}
              {thread.replies.length > 0 && (
                <>
                  <Divider />
                  <Box
                    sx={{ px: 1.5, py: 0.5, cursor: 'pointer' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleExpanded(thread.id);
                    }}
                  >
                    <Typography
                      variant="caption"
                      color="primary"
                      sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                    >
                      {expandedThreads.has(thread.id) ? (
                        <ExpandLessIcon sx={{ fontSize: 14 }} />
                      ) : (
                        <ExpandMoreIcon sx={{ fontSize: 14 }} />
                      )}
                      {thread.replies.length} {thread.replies.length === 1 ? 'reply' : 'replies'}
                    </Typography>
                  </Box>
                  <Collapse in={expandedThreads.has(thread.id)}>
                    <Box sx={{ pl: 2, pr: 1.5, pb: 1 }}>
                      {thread.replies.map((reply) => (
                        <Box
                          key={reply.id}
                          sx={{
                            py: 1,
                            borderTop: 1,
                            borderColor: 'divider',
                          }}
                        >
                          <Typography variant="body2" fontWeight={600}>
                            {reply.authorName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {formatDate(reply.created)}
                          </Typography>
                          <Typography variant="body2" sx={{ mt: 0.5 }}>
                            {reply.content}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  </Collapse>
                </>
              )}

              {/* Reply input */}
              <Box
                sx={{ px: 1.5, pb: 1 }}
                onClick={(e) => {
                  e.stopPropagation();
                }}
              >
                {replyingTo === thread.id ? (
                  <Box sx={{ mt: 1 }}>
                    <TextField
                      size="small"
                      fullWidth
                      multiline
                      rows={2}
                      placeholder="Write a reply..."
                      value={replyText}
                      onChange={(e) => {
                        setReplyText(e.target.value);
                      }}
                      autoFocus
                      sx={{ mb: 1 }}
                    />
                    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                      <Button
                        size="small"
                        onClick={() => {
                          setReplyingTo(null);
                          setReplyText('');
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="small"
                        variant="contained"
                        onClick={() => void handleReply(thread.id)}
                        disabled={!replyText.trim()}
                      >
                        Reply
                      </Button>
                    </Box>
                  </Box>
                ) : (
                  <Button
                    size="small"
                    startIcon={<ReplyIcon sx={{ fontSize: 14 }} />}
                    onClick={() => {
                      setReplyingTo(thread.id);
                    }}
                    sx={{ textTransform: 'none' }}
                  >
                    Reply
                  </Button>
                )}
              </Box>

              {/* Delete button (only for own comments) */}
              <Box
                sx={{
                  px: 1.5,
                  pb: 1,
                  display: 'flex',
                  justifyContent: 'flex-end',
                }}
                onClick={(e) => {
                  e.stopPropagation();
                }}
              >
                <Button
                  size="small"
                  color="error"
                  onClick={() => {
                    handleDeleteClick(thread.id);
                  }}
                  sx={{ textTransform: 'none', fontSize: '0.75rem' }}
                >
                  Delete
                </Button>
              </Box>
            </Paper>
          ))
        )}
      </Box>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmThreadId !== null}
        onClose={handleDeleteCancel}
        aria-labelledby="delete-confirm-title"
        aria-describedby="delete-confirm-description"
      >
        <DialogTitle id="delete-confirm-title">Delete Comment</DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-confirm-description">
            Are you sure you want to delete this comment? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel}>Cancel</Button>
          <Button
            onClick={() => {
              void handleDeleteConfirm();
            }}
            color="error"
            autoFocus
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
