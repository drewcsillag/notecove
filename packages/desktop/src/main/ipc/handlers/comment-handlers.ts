/**
 * Comment Handlers
 *
 * IPC handlers for comment operations: threads, replies, reactions.
 */

import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import type { HandlerContext } from './types';
import type { CommentThread, CommentReply, CommentReaction } from '@notecove/shared/comments';

/**
 * Register all comment-related IPC handlers
 */
export function registerCommentHandlers(ctx: HandlerContext): void {
  ipcMain.handle('comment:getThreads', handleGetCommentThreads(ctx));
  ipcMain.handle('comment:addThread', handleAddCommentThread(ctx));
  ipcMain.handle('comment:updateThread', handleUpdateCommentThread(ctx));
  ipcMain.handle('comment:deleteThread', handleDeleteCommentThread(ctx));
  ipcMain.handle('comment:addReply', handleAddCommentReply(ctx));
  ipcMain.handle('comment:updateReply', handleUpdateCommentReply(ctx));
  ipcMain.handle('comment:deleteReply', handleDeleteCommentReply(ctx));
  ipcMain.handle('comment:getReplies', handleGetCommentReplies(ctx));
  ipcMain.handle('comment:getReactions', handleGetCommentReactions(ctx));
  ipcMain.handle('comment:addReaction', handleAddCommentReaction(ctx));
  ipcMain.handle('comment:removeReaction', handleRemoveCommentReaction(ctx));
}

/**
 * Unregister all comment-related IPC handlers
 */
export function unregisterCommentHandlers(): void {
  ipcMain.removeHandler('comment:getThreads');
  ipcMain.removeHandler('comment:addThread');
  ipcMain.removeHandler('comment:updateThread');
  ipcMain.removeHandler('comment:deleteThread');
  ipcMain.removeHandler('comment:addReply');
  ipcMain.removeHandler('comment:updateReply');
  ipcMain.removeHandler('comment:deleteReply');
  ipcMain.removeHandler('comment:getReplies');
  ipcMain.removeHandler('comment:getReactions');
  ipcMain.removeHandler('comment:addReaction');
  ipcMain.removeHandler('comment:removeReaction');
}

// =============================================================================
// Handler Factories
// =============================================================================

function handleGetCommentThreads(ctx: HandlerContext) {
  return async (_event: IpcMainInvokeEvent, noteId: string): Promise<CommentThread[]> => {
    const { crdtManager, database } = ctx;

    const noteDoc = crdtManager.getNoteDoc(noteId);
    if (!noteDoc) {
      // Note not loaded yet, try to load it
      const note = await database.getNote(noteId);
      if (!note) {
        return [];
      }
      await crdtManager.loadNote(noteId, note.sdId);
      const loadedNoteDoc = crdtManager.getNoteDoc(noteId);
      if (!loadedNoteDoc) {
        return [];
      }
      return loadedNoteDoc.getCommentThreads();
    }
    return noteDoc.getCommentThreads();
  };
}

function handleAddCommentThread(ctx: HandlerContext) {
  return async (
    _event: IpcMainInvokeEvent,
    noteId: string,
    thread: Omit<CommentThread, 'id'>
  ): Promise<{ success: boolean; threadId?: string; error?: string }> => {
    const { crdtManager, database, broadcastToAll } = ctx;

    try {
      const noteDoc = crdtManager.getNoteDoc(noteId);
      if (!noteDoc) {
        return { success: false, error: 'Note not loaded' };
      }

      const threadId = noteDoc.addCommentThread(thread);

      // Update database cache
      const threadData = noteDoc.getCommentThread(threadId);
      if (threadData) {
        await database.upsertCommentThread({
          id: threadData.id,
          noteId: threadData.noteId,
          anchorStart: threadData.anchorStart,
          anchorEnd: threadData.anchorEnd,
          originalText: threadData.originalText,
          authorId: threadData.authorId,
          authorName: threadData.authorName,
          authorHandle: threadData.authorHandle,
          content: threadData.content,
          created: threadData.created,
          modified: threadData.modified,
          resolved: threadData.resolved,
          resolvedBy: threadData.resolvedBy ?? null,
          resolvedAt: threadData.resolvedAt ?? null,
        });
      }

      // Broadcast the update
      broadcastToAll('comment:threadAdded', noteId, threadId);

      return { success: true, threadId };
    } catch (error) {
      console.error('[IPC] Failed to add comment thread:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  };
}

function handleUpdateCommentThread(ctx: HandlerContext) {
  return async (
    _event: IpcMainInvokeEvent,
    noteId: string,
    threadId: string,
    updates: Partial<Pick<CommentThread, 'content' | 'resolved' | 'resolvedBy' | 'resolvedAt'>>
  ): Promise<{ success: boolean; error?: string }> => {
    const { crdtManager, database, broadcastToAll } = ctx;

    try {
      const noteDoc = crdtManager.getNoteDoc(noteId);
      if (!noteDoc) {
        return { success: false, error: 'Note not loaded' };
      }

      noteDoc.updateCommentThread(threadId, updates);

      // Update database cache
      const threadData = noteDoc.getCommentThread(threadId);
      if (threadData) {
        await database.upsertCommentThread({
          id: threadData.id,
          noteId: threadData.noteId,
          anchorStart: threadData.anchorStart,
          anchorEnd: threadData.anchorEnd,
          originalText: threadData.originalText,
          authorId: threadData.authorId,
          authorName: threadData.authorName,
          authorHandle: threadData.authorHandle,
          content: threadData.content,
          created: threadData.created,
          modified: threadData.modified,
          resolved: threadData.resolved,
          resolvedBy: threadData.resolvedBy ?? null,
          resolvedAt: threadData.resolvedAt ?? null,
        });
      }

      // Broadcast the update
      broadcastToAll('comment:threadUpdated', noteId, threadId);

      return { success: true };
    } catch (error) {
      console.error('[IPC] Failed to update comment thread:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  };
}

function handleDeleteCommentThread(ctx: HandlerContext) {
  return async (
    _event: IpcMainInvokeEvent,
    noteId: string,
    threadId: string
  ): Promise<{ success: boolean; error?: string }> => {
    const { crdtManager, database, broadcastToAll } = ctx;

    try {
      const noteDoc = crdtManager.getNoteDoc(noteId);
      if (!noteDoc) {
        return { success: false, error: 'Note not loaded' };
      }

      noteDoc.deleteCommentThread(threadId);

      // Update database cache
      await database.deleteCommentThread(threadId);
      await database.deleteRepliesForThread(threadId);
      await database.deleteReactionsForTarget('thread', threadId);

      // Broadcast the update
      broadcastToAll('comment:threadDeleted', noteId, threadId);

      return { success: true };
    } catch (error) {
      console.error('[IPC] Failed to delete comment thread:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  };
}

function handleAddCommentReply(ctx: HandlerContext) {
  return async (
    _event: IpcMainInvokeEvent,
    noteId: string,
    threadId: string,
    reply: Omit<CommentReply, 'id'>
  ): Promise<{ success: boolean; replyId?: string; error?: string }> => {
    const { crdtManager, database, broadcastToAll } = ctx;

    try {
      const noteDoc = crdtManager.getNoteDoc(noteId);
      if (!noteDoc) {
        return { success: false, error: 'Note not loaded' };
      }

      const replyId = noteDoc.addReply(threadId, reply);

      // Update database cache
      const replies = noteDoc.getReplies(threadId);
      const replyData = replies.find((r) => r.id === replyId);
      if (replyData) {
        await database.upsertCommentReply({
          id: replyData.id,
          threadId: replyData.threadId,
          authorId: replyData.authorId,
          authorName: replyData.authorName,
          authorHandle: replyData.authorHandle,
          content: replyData.content,
          created: replyData.created,
          modified: replyData.modified,
        });
      }

      // Broadcast the update
      broadcastToAll('comment:replyAdded', noteId, threadId, replyId);

      return { success: true, replyId };
    } catch (error) {
      console.error('[IPC] Failed to add comment reply:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  };
}

function handleUpdateCommentReply(ctx: HandlerContext) {
  return async (
    _event: IpcMainInvokeEvent,
    noteId: string,
    threadId: string,
    replyId: string,
    updates: Partial<Pick<CommentReply, 'content'>>
  ): Promise<{ success: boolean; error?: string }> => {
    const { crdtManager, database, broadcastToAll } = ctx;

    try {
      const noteDoc = crdtManager.getNoteDoc(noteId);
      if (!noteDoc) {
        return { success: false, error: 'Note not loaded' };
      }

      noteDoc.updateReply(threadId, replyId, updates);

      // Update database cache
      const replies = noteDoc.getReplies(threadId);
      const replyData = replies.find((r) => r.id === replyId);
      if (replyData) {
        await database.upsertCommentReply({
          id: replyData.id,
          threadId: replyData.threadId,
          authorId: replyData.authorId,
          authorName: replyData.authorName,
          authorHandle: replyData.authorHandle,
          content: replyData.content,
          created: replyData.created,
          modified: replyData.modified,
        });
      }

      // Broadcast the update
      broadcastToAll('comment:replyUpdated', noteId, threadId, replyId);

      return { success: true };
    } catch (error) {
      console.error('[IPC] Failed to update comment reply:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  };
}

function handleDeleteCommentReply(ctx: HandlerContext) {
  return async (
    _event: IpcMainInvokeEvent,
    noteId: string,
    threadId: string,
    replyId: string
  ): Promise<{ success: boolean; error?: string }> => {
    const { crdtManager, database, broadcastToAll } = ctx;

    try {
      const noteDoc = crdtManager.getNoteDoc(noteId);
      if (!noteDoc) {
        return { success: false, error: 'Note not loaded' };
      }

      noteDoc.deleteReply(threadId, replyId);

      // Update database cache
      await database.deleteCommentReply(replyId);

      // Broadcast the update
      broadcastToAll('comment:replyDeleted', noteId, threadId, replyId);

      return { success: true };
    } catch (error) {
      console.error('[IPC] Failed to delete comment reply:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  };
}

function handleGetCommentReplies(ctx: HandlerContext) {
  return async (
    _event: IpcMainInvokeEvent,
    noteId: string,
    threadId: string
  ): Promise<CommentReply[]> => {
    const { crdtManager, database } = ctx;

    const noteDoc = crdtManager.getNoteDoc(noteId);
    if (!noteDoc) {
      // Note not loaded yet, try to load it
      const note = await database.getNote(noteId);
      if (!note) {
        return [];
      }
      await crdtManager.loadNote(noteId, note.sdId);
      const loadedNoteDoc = crdtManager.getNoteDoc(noteId);
      if (!loadedNoteDoc) {
        return [];
      }
      return loadedNoteDoc.getReplies(threadId);
    }
    return noteDoc.getReplies(threadId);
  };
}

function handleGetCommentReactions(ctx: HandlerContext) {
  return async (
    _event: IpcMainInvokeEvent,
    noteId: string,
    threadId: string
  ): Promise<CommentReaction[]> => {
    const { crdtManager, database } = ctx;

    const noteDoc = crdtManager.getNoteDoc(noteId);
    if (!noteDoc) {
      // Note not loaded yet, try to load it
      const note = await database.getNote(noteId);
      if (!note) {
        return [];
      }
      await crdtManager.loadNote(noteId, note.sdId);
      const loadedNoteDoc = crdtManager.getNoteDoc(noteId);
      if (!loadedNoteDoc) {
        return [];
      }
      return loadedNoteDoc.getReactions(threadId);
    }
    return noteDoc.getReactions(threadId);
  };
}

function handleAddCommentReaction(ctx: HandlerContext) {
  return async (
    _event: IpcMainInvokeEvent,
    noteId: string,
    threadId: string,
    reaction: Omit<CommentReaction, 'id'>
  ): Promise<{ success: boolean; reactionId?: string; error?: string }> => {
    const { crdtManager, database, broadcastToAll } = ctx;

    try {
      const noteDoc = crdtManager.getNoteDoc(noteId);
      if (!noteDoc) {
        return { success: false, error: 'Note not loaded' };
      }

      const reactionId = noteDoc.addReaction(threadId, reaction);

      // Update database cache
      const reactions = noteDoc.getReactions(threadId);
      const reactionData = reactions.find((r) => r.id === reactionId);
      if (reactionData) {
        await database.upsertCommentReaction({
          id: reactionData.id,
          targetType: reactionData.targetType,
          targetId: reactionData.targetId,
          emoji: reactionData.emoji,
          authorId: reactionData.authorId,
          authorName: reactionData.authorName,
          created: reactionData.created,
        });
      }

      // Broadcast the update
      broadcastToAll('comment:reactionAdded', noteId, threadId, reactionId);

      return { success: true, reactionId };
    } catch (error) {
      console.error('[IPC] Failed to add comment reaction:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  };
}

function handleRemoveCommentReaction(ctx: HandlerContext) {
  return async (
    _event: IpcMainInvokeEvent,
    noteId: string,
    threadId: string,
    reactionId: string
  ): Promise<{ success: boolean; error?: string }> => {
    const { crdtManager, database, broadcastToAll } = ctx;

    try {
      const noteDoc = crdtManager.getNoteDoc(noteId);
      if (!noteDoc) {
        return { success: false, error: 'Note not loaded' };
      }

      noteDoc.removeReaction(threadId, reactionId);

      // Update database cache
      await database.deleteCommentReaction(reactionId);

      // Broadcast the update
      broadcastToAll('comment:reactionRemoved', noteId, threadId, reactionId);

      return { success: true };
    } catch (error) {
      console.error('[IPC] Failed to remove comment reaction:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  };
}
