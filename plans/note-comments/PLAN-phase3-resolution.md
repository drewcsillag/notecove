# Phase 3: Resolution & Edit/Delete

**Progress:** `0%`

## Goal

Allow resolving/reopening threads and editing/deleting own comments.

---

## 3.1 Add Resolved Fields to CommentThread

**Status:** 🟥 To Do

**File:** `packages/shared/src/comments/types.ts`

Extend CommentThread:

```typescript
export interface CommentThread {
  // ... existing fields
  resolved: boolean;
  resolvedBy?: string; // Profile ID who resolved
  resolvedAt?: number; // Timestamp
}
```

Update NoteDoc and SQLite schema to include these fields.

---

## 3.2 Implement Resolve/Reopen IPC

**Status:** 🟥 To Do

```typescript
ipcMain.handle('comment:resolveThread', this.handleResolveThread.bind(this));
ipcMain.handle('comment:reopenThread', this.handleReopenThread.bind(this));

private async handleResolveThread(_event: IpcMainInvokeEvent, threadId: string): Promise<void> {
  const thread = await this.database.getCommentThread(threadId);
  if (!thread) throw new Error('Thread not found');

  const noteDoc = this.crdtManager.getNoteDoc(thread.noteId);
  if (!noteDoc) throw new Error('Note not loaded');

  noteDoc.updateCommentThread(threadId, {
    resolved: true,
    resolvedBy: this.profileId,
    resolvedAt: Date.now(),
  });

  // Sync to SQLite and broadcast
}

private async handleReopenThread(_event: IpcMainInvokeEvent, threadId: string): Promise<void> {
  // Similar, but set resolved: false and clear resolvedBy/resolvedAt
}
```

---

## 3.3 Add "Show Resolved" Toggle to Panel

**Status:** 🟥 To Do

```typescript
const [showResolved, setShowResolved] = useState(false);

// Filter threads
const visibleThreads = showResolved
  ? threads
  : threads.filter(t => !t.resolved);

// Toggle UI
<FormControlLabel
  control={<Switch checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} />}
  label="Show resolved"
/>
```

Visual treatment for resolved threads:

- Grayed out / reduced opacity
- "Resolved" badge
- Strikethrough on original text quote

---

## 3.4 Implement Edit Mode for Comments

**Status:** 🟥 To Do

**File:** `packages/desktop/src/renderer/src/components/CommentPanel/CommentInput.tsx`

The CommentInput component should support edit mode:

- Accept `initialValue` prop
- Show "Save" instead of "Comment" button
- Call different handler on submit

```typescript
const isEditing = !!initialValue;

<Button variant="contained" onClick={handleSubmit}>
  {isEditing ? 'Save' : 'Comment'}
</Button>
```

Thread edit:

```typescript
ipcMain.handle('comment:updateThread', async (_event, threadId, updates) => {
  // Validate ownership
  const thread = await this.database.getCommentThread(threadId);
  if (thread.authorId !== this.profileId) {
    throw new Error("Cannot edit another user's comment");
  }
  // Update in CRDT and SQLite
});
```

---

## 3.5 Implement Delete with Confirmation

**Status:** 🟥 To Do

```typescript
// DeleteConfirmDialog component
<Dialog open={open}>
  <DialogTitle>Delete Comment</DialogTitle>
  <DialogContent>
    <DialogContentText>
      Are you sure you want to delete this comment?
    </DialogContentText>
    {hasReplies && (
      <Alert severity="warning">
        This will also delete all {replyCount} replies.
      </Alert>
    )}
  </DialogContent>
  <DialogActions>
    <Button onClick={onClose}>Cancel</Button>
    <Button color="error" onClick={onConfirm}>Delete</Button>
  </DialogActions>
</Dialog>
```

---

## 3.6 Add Ownership Validation

**Status:** 🟥 To Do

Frontend:

```typescript
const currentUserId = useCurrentUser()?.id;
const isOwner = thread.authorId === currentUserId;

// Disable edit/delete buttons if not owner
<IconButton disabled={!isOwner} onClick={handleEdit}>
  <EditIcon />
</IconButton>
```

Backend (already shown in 3.4):

- Validate authorId matches current profileId
- Throw error if not

---

## 3.7 Write Tests

**Status:** 🟥 To Do

- Unit: Resolve/reopen updates fields correctly
- Unit: Edit validates ownership
- Unit: Delete cascades to replies
- Integration: Full resolve/edit/delete flow
- E2E: Cannot edit others' comments

---

## Definition of Done

- [ ] Resolved field added to schema
- [ ] Resolve/reopen IPC working
- [ ] Show resolved toggle working
- [ ] Edit mode working
- [ ] Delete with confirmation working
- [ ] Ownership validation (frontend + backend)
- [ ] All tests passing
