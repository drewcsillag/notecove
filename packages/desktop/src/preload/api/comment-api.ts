/**
 * Comment and Mention API
 */

import { ipcRenderer } from 'electron';

export const commentApi = {
  /**
   * Get all comment threads for a note
   * @param noteId Note ID
   * @returns Array of comment threads with replies and reactions
   */
  getThreads: (
    noteId: string
  ): Promise<
    {
      id: string;
      noteId: string;
      anchorStart: Uint8Array;
      anchorEnd: Uint8Array;
      originalText: string;
      authorId: string;
      authorName: string;
      authorHandle: string;
      content: string;
      created: number;
      modified: number;
      resolved: boolean;
      resolvedBy?: string;
      resolvedAt?: number;
    }[]
  > =>
    ipcRenderer.invoke('comment:getThreads', noteId) as Promise<
      {
        id: string;
        noteId: string;
        anchorStart: Uint8Array;
        anchorEnd: Uint8Array;
        originalText: string;
        authorId: string;
        authorName: string;
        authorHandle: string;
        content: string;
        created: number;
        modified: number;
        resolved: boolean;
        resolvedBy?: string;
        resolvedAt?: number;
      }[]
    >,

  /**
   * Add a new comment thread to a note
   * @param noteId Note ID
   * @param thread Thread data (without id)
   * @returns Result with threadId if successful
   */
  addThread: (
    noteId: string,
    thread: {
      noteId: string;
      anchorStart: Uint8Array;
      anchorEnd: Uint8Array;
      originalText: string;
      authorId: string;
      authorName: string;
      authorHandle: string;
      content: string;
      created: number;
      modified: number;
      resolved: boolean;
      resolvedBy?: string;
      resolvedAt?: number;
    }
  ): Promise<{ success: boolean; threadId?: string; error?: string }> =>
    ipcRenderer.invoke('comment:addThread', noteId, thread) as Promise<{
      success: boolean;
      threadId?: string;
      error?: string;
    }>,

  /**
   * Update an existing comment thread
   * @param noteId Note ID
   * @param threadId Thread ID
   * @param updates Partial updates
   */
  updateThread: (
    noteId: string,
    threadId: string,
    updates: {
      content?: string;
      resolved?: boolean;
      resolvedBy?: string;
      resolvedAt?: number;
    }
  ): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('comment:updateThread', noteId, threadId, updates) as Promise<{
      success: boolean;
      error?: string;
    }>,

  /**
   * Delete a comment thread
   * @param noteId Note ID
   * @param threadId Thread ID
   */
  deleteThread: (noteId: string, threadId: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('comment:deleteThread', noteId, threadId) as Promise<{
      success: boolean;
      error?: string;
    }>,

  /**
   * Add a reply to a thread
   * @param noteId Note ID
   * @param threadId Thread ID
   * @param reply Reply data (without id)
   * @returns Result with replyId if successful
   */
  addReply: (
    noteId: string,
    threadId: string,
    reply: {
      threadId: string;
      authorId: string;
      authorName: string;
      authorHandle: string;
      content: string;
      created: number;
      modified: number;
    }
  ): Promise<{ success: boolean; replyId?: string; error?: string }> =>
    ipcRenderer.invoke('comment:addReply', noteId, threadId, reply) as Promise<{
      success: boolean;
      replyId?: string;
      error?: string;
    }>,

  /**
   * Get all replies for a thread
   * @param noteId Note ID
   * @param threadId Thread ID
   * @returns Array of replies
   */
  getReplies: (
    noteId: string,
    threadId: string
  ): Promise<
    {
      id: string;
      threadId: string;
      authorId: string;
      authorName: string;
      authorHandle: string;
      content: string;
      created: number;
      modified: number;
    }[]
  > =>
    ipcRenderer.invoke('comment:getReplies', noteId, threadId) as Promise<
      {
        id: string;
        threadId: string;
        authorId: string;
        authorName: string;
        authorHandle: string;
        content: string;
        created: number;
        modified: number;
      }[]
    >,

  /**
   * Update a reply
   * @param noteId Note ID
   * @param threadId Thread ID
   * @param replyId Reply ID
   * @param updates Partial updates
   */
  updateReply: (
    noteId: string,
    threadId: string,
    replyId: string,
    updates: { content?: string }
  ): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('comment:updateReply', noteId, threadId, replyId, updates) as Promise<{
      success: boolean;
      error?: string;
    }>,

  /**
   * Delete a reply
   * @param noteId Note ID
   * @param threadId Thread ID
   * @param replyId Reply ID
   */
  deleteReply: (
    noteId: string,
    threadId: string,
    replyId: string
  ): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('comment:deleteReply', noteId, threadId, replyId) as Promise<{
      success: boolean;
      error?: string;
    }>,

  /**
   * Get all reactions for a thread
   * @param noteId Note ID
   * @param threadId Thread ID
   * @returns Array of reactions
   */
  getReactions: (
    noteId: string,
    threadId: string
  ): Promise<
    {
      id: string;
      targetType: 'thread' | 'reply';
      targetId: string;
      emoji: string;
      authorId: string;
      authorName: string;
      created: number;
    }[]
  > =>
    ipcRenderer.invoke('comment:getReactions', noteId, threadId) as Promise<
      {
        id: string;
        targetType: 'thread' | 'reply';
        targetId: string;
        emoji: string;
        authorId: string;
        authorName: string;
        created: number;
      }[]
    >,

  /**
   * Add a reaction to a thread or reply
   * @param noteId Note ID
   * @param threadId Thread ID (reactions are stored per-thread)
   * @param reaction Reaction data (without id)
   * @returns Result with reactionId if successful
   */
  addReaction: (
    noteId: string,
    threadId: string,
    reaction: {
      targetType: 'thread' | 'reply';
      targetId: string;
      emoji: string;
      authorId: string;
      authorName: string;
      created: number;
    }
  ): Promise<{ success: boolean; reactionId?: string; error?: string }> =>
    ipcRenderer.invoke('comment:addReaction', noteId, threadId, reaction) as Promise<{
      success: boolean;
      reactionId?: string;
      error?: string;
    }>,

  /**
   * Remove a reaction
   * @param noteId Note ID
   * @param threadId Thread ID
   * @param reactionId Reaction ID
   */
  removeReaction: (
    noteId: string,
    threadId: string,
    reactionId: string
  ): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('comment:removeReaction', noteId, threadId, reactionId) as Promise<{
      success: boolean;
      error?: string;
    }>,

  // Event listeners for comment updates
  onThreadAdded: (callback: (noteId: string, threadId: string) => void): (() => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      noteId: string,
      threadId: string
    ): void => {
      callback(noteId, threadId);
    };
    ipcRenderer.on('comment:threadAdded', listener);
    return () => {
      ipcRenderer.removeListener('comment:threadAdded', listener);
    };
  },
  onThreadUpdated: (callback: (noteId: string, threadId: string) => void): (() => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      noteId: string,
      threadId: string
    ): void => {
      callback(noteId, threadId);
    };
    ipcRenderer.on('comment:threadUpdated', listener);
    return () => {
      ipcRenderer.removeListener('comment:threadUpdated', listener);
    };
  },
  onThreadDeleted: (callback: (noteId: string, threadId: string) => void): (() => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      noteId: string,
      threadId: string
    ): void => {
      callback(noteId, threadId);
    };
    ipcRenderer.on('comment:threadDeleted', listener);
    return () => {
      ipcRenderer.removeListener('comment:threadDeleted', listener);
    };
  },
  onReplyAdded: (
    callback: (noteId: string, threadId: string, replyId: string) => void
  ): (() => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      noteId: string,
      threadId: string,
      replyId: string
    ): void => {
      callback(noteId, threadId, replyId);
    };
    ipcRenderer.on('comment:replyAdded', listener);
    return () => {
      ipcRenderer.removeListener('comment:replyAdded', listener);
    };
  },
  onReplyUpdated: (
    callback: (noteId: string, threadId: string, replyId: string) => void
  ): (() => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      noteId: string,
      threadId: string,
      replyId: string
    ): void => {
      callback(noteId, threadId, replyId);
    };
    ipcRenderer.on('comment:replyUpdated', listener);
    return () => {
      ipcRenderer.removeListener('comment:replyUpdated', listener);
    };
  },
  onReplyDeleted: (
    callback: (noteId: string, threadId: string, replyId: string) => void
  ): (() => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      noteId: string,
      threadId: string,
      replyId: string
    ): void => {
      callback(noteId, threadId, replyId);
    };
    ipcRenderer.on('comment:replyDeleted', listener);
    return () => {
      ipcRenderer.removeListener('comment:replyDeleted', listener);
    };
  },
  onReactionAdded: (
    callback: (noteId: string, threadId: string, reactionId: string) => void
  ): (() => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      noteId: string,
      threadId: string,
      reactionId: string
    ): void => {
      callback(noteId, threadId, reactionId);
    };
    ipcRenderer.on('comment:reactionAdded', listener);
    return () => {
      ipcRenderer.removeListener('comment:reactionAdded', listener);
    };
  },
  onReactionRemoved: (
    callback: (noteId: string, threadId: string, reactionId: string) => void
  ): (() => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      noteId: string,
      threadId: string,
      reactionId: string
    ): void => {
      callback(noteId, threadId, reactionId);
    };
    ipcRenderer.on('comment:reactionRemoved', listener);
    return () => {
      ipcRenderer.removeListener('comment:reactionRemoved', listener);
    };
  },
};

export const mentionApi = {
  /**
   * Get users available for @-mentions autocomplete
   * @returns Array of mention users (current user + users from profile presence)
   */
  getUsers: (): Promise<
    {
      profileId: string;
      handle: string;
      name: string;
    }[]
  > =>
    ipcRenderer.invoke('mention:getUsers') as Promise<
      {
        profileId: string;
        handle: string;
        name: string;
      }[]
    >,
};
