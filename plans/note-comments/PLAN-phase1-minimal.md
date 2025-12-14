# Phase 1: Minimal End-to-End (Threads Only)

**Progress:** `0%`

## Goal

Get basic commenting working end-to-end: select text → add comment → see highlight → view in panel.

This is the minimal vertical slice that proves the architecture works.

---

## 1.1 Define Minimal Types (CommentThread Only)

**Status:** 🟥 To Do

**File:** `packages/shared/src/comments/types.ts`

```typescript
/**
 * A comment thread anchored to a text selection in a note.
 *
 * For Phase 1, we only implement threads (no replies, reactions, or mentions).
 */
export interface CommentThread {
  /** Unique identifier (UUID) */
  id: string;

  /** Parent note ID */
  noteId: string;

  /** Yjs RelativePosition for selection start (serialized) */
  anchorStart: Uint8Array;

  /** Yjs RelativePosition for selection end (serialized) */
  anchorEnd: Uint8Array;

  /** Original text at time of comment (for orphan detection) */
  originalText: string;

  /** Author's profile ID */
  authorId: string;

  /** Author's display name at creation time */
  authorName: string;

  /** Author's @handle at creation time */
  authorHandle: string;

  /** Comment content (plain text for now, mentions added in Phase 5) */
  content: string;

  /** Creation timestamp (ms since epoch) */
  created: number;

  /** Last modification timestamp (ms since epoch) */
  modified: number;
}

/**
 * Generate a UUID for a new comment
 */
export function generateCommentId(): string {
  return crypto.randomUUID();
}
```

**Test file:** `packages/shared/src/comments/__tests__/types.test.ts`

- Test generateCommentId produces valid UUIDs
- Test type structure (compile-time only)

---

## 1.2 Extend NoteDoc with Comments Y.Map

**Status:** 🟥 To Do

**File:** `packages/shared/src/crdt/note-doc.ts`

Add to NoteDoc class:

```typescript
import * as Y from 'yjs';

export class NoteDoc {
  // Existing...
  readonly doc: Y.Doc;
  readonly metadata: Y.Map<unknown>;
  readonly content: Y.XmlFragment;

  // NEW: Comments map, lazily initialized
  get comments(): Y.Map<Y.Map<unknown>> {
    return this.doc.getMap('comments');
  }

  /**
   * Get all comment threads for this note
   */
  getCommentThreads(): CommentThread[] {
    const threads: CommentThread[] = [];
    this.comments.forEach((threadMap, id) => {
      threads.push(this.mapToThread(id, threadMap));
    });
    return threads;
  }

  /**
   * Get a single comment thread by ID
   */
  getCommentThread(threadId: string): CommentThread | null {
    const threadMap = this.comments.get(threadId);
    if (!threadMap) return null;
    return this.mapToThread(threadId, threadMap);
  }

  /**
   * Add a new comment thread
   * @returns The new thread ID
   */
  addCommentThread(thread: Omit<CommentThread, 'id'>): string {
    const id = generateCommentId();
    const threadMap = new Y.Map<unknown>();

    threadMap.set('noteId', thread.noteId);
    threadMap.set('anchorStart', thread.anchorStart);
    threadMap.set('anchorEnd', thread.anchorEnd);
    threadMap.set('originalText', thread.originalText);
    threadMap.set('authorId', thread.authorId);
    threadMap.set('authorName', thread.authorName);
    threadMap.set('authorHandle', thread.authorHandle);
    threadMap.set('content', thread.content);
    threadMap.set('created', thread.created);
    threadMap.set('modified', thread.modified);

    this.comments.set(id, threadMap);
    return id;
  }

  /**
   * Update a comment thread
   */
  updateCommentThread(threadId: string, updates: Partial<CommentThread>): void {
    const threadMap = this.comments.get(threadId);
    if (!threadMap) throw new Error(`Thread ${threadId} not found`);

    if (updates.content !== undefined) {
      threadMap.set('content', updates.content);
    }
    threadMap.set('modified', Date.now());
  }

  /**
   * Delete a comment thread
   */
  deleteCommentThread(threadId: string): void {
    this.comments.delete(threadId);
  }

  private mapToThread(id: string, map: Y.Map<unknown>): CommentThread {
    return {
      id,
      noteId: map.get('noteId') as string,
      anchorStart: map.get('anchorStart') as Uint8Array,
      anchorEnd: map.get('anchorEnd') as Uint8Array,
      originalText: map.get('originalText') as string,
      authorId: map.get('authorId') as string,
      authorName: map.get('authorName') as string,
      authorHandle: map.get('authorHandle') as string,
      content: map.get('content') as string,
      created: map.get('created') as number,
      modified: map.get('modified') as number,
    };
  }
}
```

**Tests:** `packages/shared/src/crdt/__tests__/note-doc-comments.test.ts`

- Create thread, read back
- Update thread content
- Delete thread
- Multiple threads
- Lazy initialization (comments map created on first access)

---

## 1.3 Add comment_threads SQLite Table

**Status:** 🟥 To Do

**File:** `packages/shared/src/database/schema.ts`

Add to SCHEMA constant:

```sql
-- Comment threads table
CREATE TABLE IF NOT EXISTS comment_threads (
  id TEXT PRIMARY KEY,
  note_id TEXT NOT NULL,
  anchor_start BLOB NOT NULL,
  anchor_end BLOB NOT NULL,
  original_text TEXT NOT NULL,
  author_id TEXT NOT NULL,
  author_name TEXT NOT NULL,
  author_handle TEXT NOT NULL,
  content TEXT NOT NULL,
  created INTEGER NOT NULL,
  modified INTEGER NOT NULL,
  FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_comment_threads_note_id ON comment_threads(note_id);
```

**Tests:** Schema creation in existing schema tests

---

## 1.4 Implement Thread CRUD in Database

**Status:** 🟥 To Do

**File:** `packages/desktop/src/main/database/database.ts`

Add methods:

```typescript
// Comment thread CRUD
async upsertCommentThread(thread: CommentThread): Promise<void> {
  this.db.run(
    `INSERT INTO comment_threads
     (id, note_id, anchor_start, anchor_end, original_text,
      author_id, author_name, author_handle, content, created, modified)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       content = excluded.content,
       modified = excluded.modified`,
    [
      thread.id,
      thread.noteId,
      thread.anchorStart,
      thread.anchorEnd,
      thread.originalText,
      thread.authorId,
      thread.authorName,
      thread.authorHandle,
      thread.content,
      thread.created,
      thread.modified,
    ]
  );
}

async getCommentThread(threadId: string): Promise<CommentThread | null> {
  const row = this.db.get<CommentThreadRow>(
    'SELECT * FROM comment_threads WHERE id = ?',
    [threadId]
  );
  return row ? this.rowToThread(row) : null;
}

async getCommentThreadsForNote(noteId: string): Promise<CommentThread[]> {
  const rows = this.db.all<CommentThreadRow>(
    'SELECT * FROM comment_threads WHERE note_id = ? ORDER BY created ASC',
    [noteId]
  );
  return rows.map(this.rowToThread);
}

async deleteCommentThread(threadId: string): Promise<void> {
  this.db.run('DELETE FROM comment_threads WHERE id = ?', [threadId]);
}

private rowToThread(row: CommentThreadRow): CommentThread {
  return {
    id: row.id,
    noteId: row.note_id,
    anchorStart: row.anchor_start,
    anchorEnd: row.anchor_end,
    originalText: row.original_text,
    authorId: row.author_id,
    authorName: row.author_name,
    authorHandle: row.author_handle,
    content: row.content,
    created: row.created,
    modified: row.modified,
  };
}
```

**Tests:** `packages/desktop/src/main/database/__tests__/database-comments.test.ts`

- Insert and retrieve thread
- Update thread
- Delete thread
- Get threads for note
- Cascade delete when note is deleted

---

## 1.5 Add IPC Handlers (Create/Read/Delete)

**Status:** 🟥 To Do

**File:** `packages/desktop/src/main/ipc/handlers.ts`

Add handlers:

```typescript
// Register in setupHandlers()
ipcMain.handle('comment:createThread', this.handleCreateThread.bind(this));
ipcMain.handle('comment:getThreadsForNote', this.handleGetThreadsForNote.bind(this));
ipcMain.handle('comment:deleteThread', this.handleDeleteThread.bind(this));

private async handleCreateThread(
  _event: IpcMainInvokeEvent,
  noteId: string,
  anchorStart: Uint8Array,
  anchorEnd: Uint8Array,
  originalText: string,
  content: string
): Promise<string> {
  // Get current user info
  const authorId = this.profileId;
  const authorName = await this.database.getState(AppStateKey.Username) ?? '';
  const authorHandle = await this.database.getState(AppStateKey.UserHandle) ?? '';

  // Add to CRDT
  const noteDoc = this.crdtManager.getNoteDoc(noteId);
  if (!noteDoc) throw new Error(`Note ${noteId} not loaded`);

  const threadId = noteDoc.addCommentThread({
    noteId,
    anchorStart,
    anchorEnd,
    originalText,
    authorId,
    authorName,
    authorHandle,
    content,
    created: Date.now(),
    modified: Date.now(),
  });

  // Sync to SQLite cache
  const thread = noteDoc.getCommentThread(threadId);
  if (thread) {
    await this.database.upsertCommentThread(thread);
  }

  // Broadcast to all windows
  this.broadcastToAll('comment:threadCreated', noteId, thread);

  return threadId;
}

private async handleGetThreadsForNote(
  _event: IpcMainInvokeEvent,
  noteId: string
): Promise<CommentThread[]> {
  // Try CRDT first (source of truth)
  const noteDoc = this.crdtManager.getNoteDoc(noteId);
  if (noteDoc) {
    return noteDoc.getCommentThreads();
  }
  // Fall back to SQLite cache
  return this.database.getCommentThreadsForNote(noteId);
}

private async handleDeleteThread(
  _event: IpcMainInvokeEvent,
  threadId: string
): Promise<void> {
  // Find the thread to get noteId
  const thread = await this.database.getCommentThread(threadId);
  if (!thread) return;

  // Delete from CRDT
  const noteDoc = this.crdtManager.getNoteDoc(thread.noteId);
  if (noteDoc) {
    noteDoc.deleteCommentThread(threadId);
  }

  // Delete from SQLite
  await this.database.deleteCommentThread(threadId);

  // Broadcast
  this.broadcastToAll('comment:threadDeleted', threadId, thread.noteId);
}
```

---

## 1.6 Expose in Preload Bridge

**Status:** 🟥 To Do

**File:** `packages/desktop/src/preload/index.ts`

Add to electronAPI:

```typescript
comment: {
  createThread: (
    noteId: string,
    anchorStart: Uint8Array,
    anchorEnd: Uint8Array,
    originalText: string,
    content: string
  ): Promise<string> =>
    ipcRenderer.invoke('comment:createThread', noteId, anchorStart, anchorEnd, originalText, content),

  getThreadsForNote: (noteId: string): Promise<CommentThread[]> =>
    ipcRenderer.invoke('comment:getThreadsForNote', noteId),

  deleteThread: (threadId: string): Promise<void> =>
    ipcRenderer.invoke('comment:deleteThread', threadId),

  onThreadCreated: (callback: (noteId: string, thread: CommentThread) => void) => {
    const listener = (_event: IpcRendererEvent, noteId: string, thread: CommentThread) =>
      callback(noteId, thread);
    ipcRenderer.on('comment:threadCreated', listener);
    return () => ipcRenderer.removeListener('comment:threadCreated', listener);
  },

  onThreadDeleted: (callback: (threadId: string, noteId: string) => void) => {
    const listener = (_event: IpcRendererEvent, threadId: string, noteId: string) =>
      callback(threadId, noteId);
    ipcRenderer.on('comment:threadDeleted', listener);
    return () => ipcRenderer.removeListener('comment:threadDeleted', listener);
  },
},
```

**File:** `packages/desktop/src/renderer/src/types/electron.d.ts`

Add type definitions matching above.

---

## 1.7 Create CommentMarker TipTap Extension

**Status:** 🟥 To Do

**File:** `packages/desktop/src/renderer/src/components/EditorPanel/extensions/CommentMarker.ts`

```typescript
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import * as Y from 'yjs';
import { CommentThread } from '@notecove/shared/comments/types';

export interface CommentMarkerOptions {
  ydoc: Y.Doc;
  content: Y.XmlFragment;
  getComments: () => CommentThread[];
  onCommentClick?: (threadId: string) => void;
}

export const CommentMarkerPluginKey = new PluginKey('commentMarker');

export const CommentMarker = Extension.create<CommentMarkerOptions>({
  name: 'commentMarker',

  addOptions() {
    return {
      ydoc: null as unknown as Y.Doc,
      content: null as unknown as Y.XmlFragment,
      getComments: () => [],
      onCommentClick: undefined,
    };
  },

  addProseMirrorPlugins() {
    const { ydoc, content, getComments, onCommentClick } = this.options;

    return [
      new Plugin({
        key: CommentMarkerPluginKey,

        state: {
          init(_, state) {
            return buildDecorations(state.doc, getComments(), ydoc, content);
          },
          apply(tr, oldDecorations, oldState, newState) {
            // Rebuild on doc change or when comments change
            if (tr.docChanged || tr.getMeta('rebuildCommentDecorations')) {
              return buildDecorations(newState.doc, getComments(), ydoc, content);
            }
            return oldDecorations.map(tr.mapping, tr.doc);
          },
        },

        props: {
          decorations(state) {
            return this.getState(state);
          },

          handleClick(view, pos, event) {
            const target = event.target as HTMLElement;
            if (target.classList.contains('comment-highlight')) {
              const threadId = target.dataset.commentId;
              if (threadId && onCommentClick) {
                onCommentClick(threadId);
                return true;
              }
            }
            return false;
          },
        },
      }),
    ];
  },
});

function buildDecorations(
  doc: Node,
  comments: CommentThread[],
  ydoc: Y.Doc,
  content: Y.XmlFragment
): DecorationSet {
  const decorations: Decoration[] = [];

  for (const comment of comments) {
    try {
      const startPos = Y.createAbsolutePositionFromRelativePosition(
        Y.decodeRelativePosition(comment.anchorStart),
        ydoc
      );
      const endPos = Y.createAbsolutePositionFromRelativePosition(
        Y.decodeRelativePosition(comment.anchorEnd),
        ydoc
      );

      if (startPos && endPos && startPos.index < endPos.index) {
        // Convert Yjs positions to ProseMirror positions
        // (This may need adjustment based on y-prosemirror binding)
        const from = startPos.index;
        const to = endPos.index;

        if (from >= 0 && to <= doc.content.size) {
          decorations.push(
            Decoration.inline(from, to, {
              class: 'comment-highlight',
              'data-comment-id': comment.id,
            })
          );
        }
      }
    } catch (e) {
      // Orphaned comment - position can't be resolved
      console.warn(`Could not resolve position for comment ${comment.id}:`, e);
    }
  }

  return DecorationSet.create(doc, decorations);
}
```

**CSS:** Add to editor styles

```css
.comment-highlight {
  background-color: rgba(255, 212, 0, 0.3);
  border-bottom: 2px solid rgba(255, 180, 0, 0.6);
  cursor: pointer;
}

.comment-highlight:hover {
  background-color: rgba(255, 212, 0, 0.5);
}
```

---

## 1.8 Create Minimal CommentPanel

**Status:** 🟥 To Do

**File:** `packages/desktop/src/renderer/src/components/CommentPanel/CommentPanel.tsx`

```typescript
import React, { useEffect, useState, useCallback } from 'react';
import {
  Drawer, Box, Typography, IconButton, Card, CardContent,
  TextField, Button, Avatar
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { CommentThread } from '@notecove/shared/comments/types';

interface CommentPanelProps {
  noteId: string;
  isOpen: boolean;
  onClose: () => void;
  onScrollToText: (anchorStart: Uint8Array) => void;
  newCommentData?: {
    anchorStart: Uint8Array;
    anchorEnd: Uint8Array;
    originalText: string;
  } | null;
  onNewCommentClear: () => void;
}

export const CommentPanel: React.FC<CommentPanelProps> = ({
  noteId,
  isOpen,
  onClose,
  onScrollToText,
  newCommentData,
  onNewCommentClear,
}) => {
  const [threads, setThreads] = useState<CommentThread[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);

  // Load comments
  useEffect(() => {
    const loadThreads = async () => {
      const result = await window.electronAPI.comment.getThreadsForNote(noteId);
      setThreads(result);
    };
    loadThreads();

    // Subscribe to updates
    const unsubCreate = window.electronAPI.comment.onThreadCreated((nId, thread) => {
      if (nId === noteId) {
        setThreads(prev => [...prev, thread]);
      }
    });
    const unsubDelete = window.electronAPI.comment.onThreadDeleted((threadId, nId) => {
      if (nId === noteId) {
        setThreads(prev => prev.filter(t => t.id !== threadId));
      }
    });

    return () => {
      unsubCreate();
      unsubDelete();
    };
  }, [noteId]);

  const handleSubmitNew = async () => {
    if (!newCommentData || !newComment.trim()) return;
    setLoading(true);
    try {
      await window.electronAPI.comment.createThread(
        noteId,
        newCommentData.anchorStart,
        newCommentData.anchorEnd,
        newCommentData.originalText,
        newComment.trim()
      );
      setNewComment('');
      onNewCommentClear();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Drawer
      anchor="right"
      open={isOpen}
      onClose={onClose}
      variant="persistent"
      sx={{ '& .MuiDrawer-paper': { width: 360, maxWidth: '40vw' } }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Header */}
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between' }}>
          <Typography variant="h6">Comments</Typography>
          <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
        </Box>

        {/* New comment form */}
        {newCommentData && (
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', bgcolor: 'action.hover' }}>
            <Typography variant="caption" color="text.secondary">Commenting on:</Typography>
            <Typography variant="body2" sx={{ fontStyle: 'italic', mb: 1 }}>
              "{newCommentData.originalText.slice(0, 100)}..."
            </Typography>
            <TextField
              multiline
              fullWidth
              minRows={2}
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a comment..."
              size="small"
              sx={{ mb: 1 }}
            />
            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
              <Button size="small" onClick={onNewCommentClear}>Cancel</Button>
              <Button
                size="small"
                variant="contained"
                onClick={handleSubmitNew}
                disabled={!newComment.trim() || loading}
              >
                Comment
              </Button>
            </Box>
          </Box>
        )}

        {/* Thread list */}
        <Box sx={{ flex: 1, overflow: 'auto', p: 1 }}>
          {threads.length === 0 ? (
            <Typography color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
              No comments yet
            </Typography>
          ) : (
            threads.map((thread) => (
              <Card key={thread.id} sx={{ mb: 1 }} onClick={() => onScrollToText(thread.anchorStart)}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Avatar sx={{ width: 24, height: 24, fontSize: 12 }}>
                      {thread.authorName.charAt(0)}
                    </Avatar>
                    <Typography variant="subtitle2">{thread.authorName}</Typography>
                  </Box>
                  <Typography variant="body2" sx={{ fontStyle: 'italic', color: 'text.secondary', mb: 1 }}>
                    "{thread.originalText.slice(0, 50)}..."
                  </Typography>
                  <Typography variant="body2">{thread.content}</Typography>
                </CardContent>
              </Card>
            ))
          )}
        </Box>
      </Box>
    </Drawer>
  );
};
```

---

## 1.9 Integrate with EditorPanel

**Status:** 🟥 To Do

**File:** `packages/desktop/src/renderer/src/components/EditorPanel/EditorPanel.tsx`

Add state and integration:

```typescript
const [commentPanelOpen, setCommentPanelOpen] = useState(false);
const [newCommentData, setNewCommentData] = useState<{
  anchorStart: Uint8Array;
  anchorEnd: Uint8Array;
  originalText: string;
} | null>(null);

// Handler for adding a comment (will be called from toolbar/keyboard later)
const handleAddComment = useCallback(() => {
  if (!editor) return;
  const { from, to } = editor.state.selection;
  if (from === to) return;

  const selectedText = editor.state.doc.textBetween(from, to);
  const anchorStart = Y.encodeRelativePosition(
    Y.createRelativePositionFromTypeIndex(content, from)
  );
  const anchorEnd = Y.encodeRelativePosition(
    Y.createRelativePositionFromTypeIndex(content, to)
  );

  setNewCommentData({ anchorStart, anchorEnd, originalText: selectedText });
  setCommentPanelOpen(true);
}, [editor, content]);

// Handler for scrolling to text
const handleScrollToText = useCallback((anchorStart: Uint8Array) => {
  if (!editor) return;
  const pos = Y.createAbsolutePositionFromRelativePosition(
    Y.decodeRelativePosition(anchorStart),
    ydoc
  );
  if (pos) {
    editor.chain().focus().setTextSelection(pos.index).scrollIntoView().run();
  }
}, [editor, ydoc]);

// In render, add the panel:
<CommentPanel
  noteId={selectedNoteId}
  isOpen={commentPanelOpen}
  onClose={() => setCommentPanelOpen(false)}
  onScrollToText={handleScrollToText}
  newCommentData={newCommentData}
  onNewCommentClear={() => setNewCommentData(null)}
/>
```

---

## 1.10 Write Tests

**Status:** 🟥 To Do

### Unit Tests

**`packages/shared/src/comments/__tests__/types.test.ts`**

- generateCommentId returns valid UUID

**`packages/shared/src/crdt/__tests__/note-doc-comments.test.ts`**

- Create thread
- Read thread
- Update thread
- Delete thread
- Lazy initialization

**`packages/desktop/src/main/database/__tests__/database-comments.test.ts`**

- CRUD operations
- Cascade delete

### Integration Tests

**`packages/desktop/src/main/__tests__/comment-handlers.test.ts`**

- createThread IPC flow
- getThreadsForNote IPC flow
- deleteThread IPC flow
- Broadcast events

---

## Definition of Done

- [ ] Types defined
- [ ] NoteDoc extended with comments
- [ ] SQLite table created
- [ ] Database CRUD working
- [ ] IPC handlers working
- [ ] Preload bridge exposed
- [ ] CommentMarker extension shows highlights
- [ ] CommentPanel shows threads
- [ ] Full flow works: select → add → view → click to scroll
- [ ] All tests passing
- [ ] Manual verification complete

**🎯 After this phase:** We can manually test the full comment flow!
