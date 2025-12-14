# Phase 2: Replies

**Progress:** `0%`

## Goal

Add threaded replies to comments. Single-level (flat) threading as decided.

---

## 2.1 Add CommentReply Type

**Status:** 🟥 To Do

**File:** `packages/shared/src/comments/types.ts`

Add:

```typescript
export interface CommentReply {
  id: string;
  threadId: string;
  authorId: string;
  authorName: string;
  authorHandle: string;
  content: string;
  created: number;
  modified: number;
}
```

---

## 2.2 Extend NoteDoc for Replies

**Status:** 🟥 To Do

**File:** `packages/shared/src/crdt/note-doc.ts`

Store replies as Y.Array inside each thread's Y.Map:

```typescript
getReplies(threadId: string): CommentReply[] {
  const threadMap = this.comments.get(threadId);
  if (!threadMap) return [];
  const repliesArray = threadMap.get('replies') as Y.Array<Y.Map<unknown>> | undefined;
  if (!repliesArray) return [];
  return repliesArray.toArray().map(this.mapToReply);
}

addReply(threadId: string, reply: Omit<CommentReply, 'id'>): string {
  const threadMap = this.comments.get(threadId);
  if (!threadMap) throw new Error(`Thread ${threadId} not found`);

  let repliesArray = threadMap.get('replies') as Y.Array<Y.Map<unknown>> | undefined;
  if (!repliesArray) {
    repliesArray = new Y.Array<Y.Map<unknown>>();
    threadMap.set('replies', repliesArray);
  }

  const id = generateCommentId();
  const replyMap = new Y.Map<unknown>();
  replyMap.set('id', id);
  replyMap.set('threadId', threadId);
  // ... set other fields
  repliesArray.push([replyMap]);

  return id;
}

deleteReply(threadId: string, replyId: string): void {
  const threadMap = this.comments.get(threadId);
  if (!threadMap) return;
  const repliesArray = threadMap.get('replies') as Y.Array<Y.Map<unknown>> | undefined;
  if (!repliesArray) return;

  const index = repliesArray.toArray().findIndex(r => r.get('id') === replyId);
  if (index >= 0) {
    repliesArray.delete(index, 1);
  }
}
```

---

## 2.3 Add comment_replies SQLite Table

**Status:** 🟥 To Do

**File:** `packages/shared/src/database/schema.ts`

```sql
CREATE TABLE IF NOT EXISTS comment_replies (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
  author_name TEXT NOT NULL,
  author_handle TEXT NOT NULL,
  content TEXT NOT NULL,
  created INTEGER NOT NULL,
  modified INTEGER NOT NULL,
  FOREIGN KEY (thread_id) REFERENCES comment_threads(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_comment_replies_thread_id ON comment_replies(thread_id);
```

---

## 2.4 Add Reply IPC Handlers

**Status:** 🟥 To Do

**File:** `packages/desktop/src/main/ipc/handlers.ts`

```typescript
ipcMain.handle('comment:addReply', this.handleAddReply.bind(this));
ipcMain.handle('comment:updateReply', this.handleUpdateReply.bind(this));
ipcMain.handle('comment:deleteReply', this.handleDeleteReply.bind(this));

private async handleAddReply(
  _event: IpcMainInvokeEvent,
  threadId: string,
  content: string
): Promise<string> {
  // Get thread to find noteId
  const thread = await this.database.getCommentThread(threadId);
  if (!thread) throw new Error('Thread not found');

  const authorId = this.profileId;
  const authorName = await this.database.getState(AppStateKey.Username) ?? '';
  const authorHandle = await this.database.getState(AppStateKey.UserHandle) ?? '';

  const noteDoc = this.crdtManager.getNoteDoc(thread.noteId);
  if (!noteDoc) throw new Error('Note not loaded');

  const replyId = noteDoc.addReply(threadId, {
    threadId,
    authorId,
    authorName,
    authorHandle,
    content,
    created: Date.now(),
    modified: Date.now(),
  });

  // Sync to SQLite
  const replies = noteDoc.getReplies(threadId);
  const reply = replies.find(r => r.id === replyId);
  if (reply) {
    await this.database.upsertCommentReply(reply);
  }

  // Broadcast
  this.broadcastToAll('comment:replyAdded', threadId, reply);

  return replyId;
}
```

Update preload bridge with reply methods.

---

## 2.5 Create CommentReply UI Component

**Status:** 🟥 To Do

**File:** `packages/desktop/src/renderer/src/components/CommentPanel/CommentReply.tsx`

```typescript
interface CommentReplyProps {
  reply: CommentReply;
}

export const CommentReplyComponent: React.FC<CommentReplyProps> = ({ reply }) => {
  return (
    <Box sx={{ ml: 2, mt: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Avatar sx={{ width: 20, height: 20, fontSize: 10 }}>
          {reply.authorName.charAt(0)}
        </Avatar>
        <Typography variant="caption" fontWeight="medium">
          {reply.authorName}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {formatRelativeTime(reply.created)}
        </Typography>
      </Box>
      <Typography variant="body2" sx={{ ml: 3.5 }}>
        {reply.content}
      </Typography>
    </Box>
  );
};
```

---

## 2.6 Add Reply Input to Threads

**Status:** 🟥 To Do

Update CommentThread in panel to show:

1. List of replies (collapsed if >3, with "Show N more" button)
2. Reply input button
3. Submit handler

```typescript
// In CommentThread card:
{replies.length > 0 && (
  <Box sx={{ borderTop: 1, borderColor: 'divider', pt: 1 }}>
    {replies.slice(0, showAll ? undefined : 3).map(reply => (
      <CommentReplyComponent key={reply.id} reply={reply} />
    ))}
    {replies.length > 3 && !showAll && (
      <Button size="small" onClick={() => setShowAll(true)}>
        Show {replies.length - 3} more replies
      </Button>
    )}
  </Box>
)}

<Button size="small" onClick={() => setShowReplyInput(true)}>
  Reply
</Button>

{showReplyInput && (
  <CommentInput
    placeholder="Reply..."
    onSubmit={async (content) => {
      await window.electronAPI.comment.addReply(thread.id, content);
      setShowReplyInput(false);
    }}
    onCancel={() => setShowReplyInput(false)}
  />
)}
```

---

## 2.7 Write Tests

**Status:** 🟥 To Do

- Unit: NoteDoc reply CRUD
- Unit: Database reply CRUD
- Integration: Reply IPC flow
- Integration: Replies appear in UI

---

## Definition of Done

- [ ] Reply type defined
- [ ] NoteDoc supports replies
- [ ] SQLite table created
- [ ] IPC handlers working
- [ ] Replies display in UI
- [ ] Reply input works
- [ ] Collapse behavior works (>3 replies)
- [ ] All tests passing
