# Phase 4: Emoji Reactions

**Progress:** `0%`

## Goal

Allow emoji reactions on comments and replies with standard emoji picker, multiple per user, hover to see names.

---

## 4.1 Add CommentReaction Type

**Status:** 🟥 To Do

**File:** `packages/shared/src/comments/types.ts`

```typescript
export interface CommentReaction {
  id: string;
  targetType: 'thread' | 'reply';
  targetId: string;
  emoji: string; // Single emoji character
  authorId: string;
  authorName: string;
  created: number;
}

// For display purposes
export interface AggregatedReaction {
  emoji: string;
  count: number;
  users: { id: string; name: string }[];
  currentUserReacted: boolean;
}

export function aggregateReactions(
  reactions: CommentReaction[],
  currentUserId: string
): AggregatedReaction[] {
  const byEmoji = new Map<string, Map<string, string>>();

  for (const r of reactions) {
    if (!byEmoji.has(r.emoji)) byEmoji.set(r.emoji, new Map());
    byEmoji.get(r.emoji)!.set(r.authorId, r.authorName);
  }

  return Array.from(byEmoji.entries()).map(([emoji, users]) => ({
    emoji,
    count: users.size,
    users: Array.from(users.entries()).map(([id, name]) => ({ id, name })),
    currentUserReacted: users.has(currentUserId),
  }));
}
```

---

## 4.2 Extend NoteDoc for Reactions

**Status:** 🟥 To Do

Store reactions in thread Y.Map (covers both thread and reply reactions):

```typescript
// Structure:
// thread Y.Map
//   └── reactions: Y.Array<Y.Map>
//       └── { id, targetType, targetId, emoji, authorId, authorName, created }

getReactions(threadId: string): CommentReaction[] {
  const threadMap = this.comments.get(threadId);
  if (!threadMap) return [];
  const reactionsArray = threadMap.get('reactions') as Y.Array<Y.Map<unknown>> | undefined;
  if (!reactionsArray) return [];
  return reactionsArray.toArray().map(this.mapToReaction);
}

addReaction(threadId: string, reaction: Omit<CommentReaction, 'id'>): string {
  const threadMap = this.comments.get(threadId);
  if (!threadMap) throw new Error(`Thread ${threadId} not found`);

  let reactionsArray = threadMap.get('reactions') as Y.Array<Y.Map<unknown>> | undefined;
  if (!reactionsArray) {
    reactionsArray = new Y.Array();
    threadMap.set('reactions', reactionsArray);
  }

  const id = generateCommentId();
  const reactionMap = new Y.Map();
  reactionMap.set('id', id);
  // ... set other fields
  reactionsArray.push([reactionMap]);

  return id;
}

removeReaction(threadId: string, reactionId: string): void {
  // Find and remove from array
}
```

---

## 4.3 Add comment_reactions SQLite Table

**Status:** 🟥 To Do

```sql
CREATE TABLE IF NOT EXISTS comment_reactions (
  id TEXT PRIMARY KEY,
  target_type TEXT NOT NULL CHECK(target_type IN ('thread', 'reply')),
  target_id TEXT NOT NULL,
  emoji TEXT NOT NULL,
  author_id TEXT NOT NULL,
  author_name TEXT NOT NULL,
  created INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_comment_reactions_target ON comment_reactions(target_type, target_id);
```

---

## 4.4 Add Reaction IPC Handlers

**Status:** 🟥 To Do

```typescript
ipcMain.handle('comment:addReaction', async (_event, targetType, targetId, emoji) => {
  // Find thread (if targetType is 'reply', get thread from reply)
  // Check if user already has this emoji on this target
  // If yes, remove it (toggle behavior)
  // If no, add it
  // Sync to SQLite and broadcast
});

ipcMain.handle('comment:removeReaction', async (_event, reactionId) => {
  // Remove from CRDT and SQLite
  // Broadcast
});
```

---

## 4.5 Create ReactionPicker Component

**Status:** 🟥 To Do

**File:** `packages/desktop/src/renderer/src/components/CommentPanel/ReactionPicker.tsx`

Quick reactions + native picker:

```typescript
const QUICK_REACTIONS = ['👍', '👎', '❤️', '🎉', '😄', '🤔'];

export const ReactionPicker: React.FC<ReactionPickerProps> = ({
  targetType,
  targetId,
}) => {
  const handleAddReaction = async (emoji: string) => {
    await window.electronAPI.comment.addReaction(targetType, targetId, emoji);
  };

  return (
    <Box sx={{ display: 'flex', gap: 0.25 }}>
      {QUICK_REACTIONS.map(emoji => (
        <IconButton
          key={emoji}
          size="small"
          onClick={() => handleAddReaction(emoji)}
          sx={{ fontSize: '14px' }}
        >
          {emoji}
        </IconButton>
      ))}
      <IconButton size="small" title="More (Ctrl+Cmd+Space)">
        <MoreHorizIcon fontSize="small" />
      </IconButton>
    </Box>
  );
};
```

---

## 4.6 Create ReactionDisplay Component

**Status:** 🟥 To Do

**File:** `packages/desktop/src/renderer/src/components/CommentPanel/ReactionDisplay.tsx`

```typescript
export const ReactionDisplay: React.FC<ReactionDisplayProps> = ({
  reactions,
  targetType,
  targetId,
}) => {
  const currentUser = useCurrentUser();
  const aggregated = aggregateReactions(reactions, currentUser?.id ?? '');

  if (aggregated.length === 0) return null;

  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
      {aggregated.map(reaction => (
        <Tooltip
          key={reaction.emoji}
          title={reaction.users.map(u => u.name).join(', ')}
        >
          <Chip
            label={`${reaction.emoji} ${reaction.count}`}
            size="small"
            variant={reaction.currentUserReacted ? 'filled' : 'outlined'}
            onClick={() => handleToggleReaction(reaction.emoji)}
            sx={{ cursor: 'pointer' }}
          />
        </Tooltip>
      ))}
    </Box>
  );
};
```

---

## 4.7 Write Tests

**Status:** 🟥 To Do

- Unit: aggregateReactions function
- Unit: NoteDoc reaction CRUD
- Unit: Toggle behavior (add if not present, remove if present)
- Integration: Reaction IPC flow
- E2E: Add reaction, see it appear, click to remove

---

## Definition of Done

- [ ] Reaction type defined
- [ ] NoteDoc supports reactions
- [ ] SQLite table created
- [ ] IPC handlers with toggle behavior
- [ ] ReactionPicker shows quick reactions
- [ ] ReactionDisplay shows aggregated reactions
- [ ] Hover shows user names
- [ ] Click toggles reaction
- [ ] All tests passing
