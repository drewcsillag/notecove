# Phase 7: Polish & Edge Cases

**Progress:** `0%`

## Goal

Handle edge cases, improve UX, add debug tooling, and finalize the feature.

---

## 7.1 Handle Orphaned Comments

**Status:** 🟥 To Do

When anchored text is deleted, the RelativePosition returns null.

**Detection:**

```typescript
// In CommentMarker extension
const startPos = Y.createAbsolutePositionFromRelativePosition(...);
const isOrphaned = startPos === null;
```

**UI Treatment:**

```typescript
// In CommentThread.tsx
{isOrphaned && (
  <Alert severity="warning" sx={{ mb: 1 }}>
    The text this comment was attached to has been deleted.
  </Alert>
)}

// Visual treatment
<Box sx={{
  bgcolor: isOrphaned ? 'error.light' : 'action.hover',
  textDecoration: isOrphaned ? 'line-through' : 'none',
}}>
  <Typography sx={{ fontStyle: 'italic' }}>
    "{thread.originalText}"
  </Typography>
</Box>
```

**Options menu for orphaned comments:**

- Delete orphaned comment
- Keep (just shows warning)

---

## 7.2 Handle Overlapping Ranges

**Status:** 🟥 To Do

When multiple comments cover the same text:

**Visual treatment:**

- Darker highlight for overlapped regions
- Add `comment-overlap` class when position has multiple comments

**Click handling:**

- If click hits multiple comments, show selection popover

```typescript
// Track overlaps during decoration creation
const positionToComments = new Map<number, string[]>();
// ... build map

// When clicking overlapped area:
if (commentIds.length > 1) {
  setOverlapSelection({ commentIds, anchorEl: event.target });
}

// Popover:
<Popover open={!!overlapSelection} anchorEl={overlapSelection?.anchorEl}>
  <List dense>
    {overlapSelection?.commentIds.map(id => {
      const thread = threads.find(t => t.id === id);
      return (
        <ListItem button onClick={() => selectComment(id)}>
          <ListItemText
            primary={thread?.authorName}
            secondary={truncate(thread?.content, 40)}
          />
        </ListItem>
      );
    })}
  </List>
</Popover>
```

---

## 7.3 Add Keyboard Navigation in Panel

**Status:** 🟢 Complete

| Key    | Action                           |
| ------ | -------------------------------- |
| ↑/↓    | Navigate between threads         |
| Enter  | Scroll to selected thread's text |
| R      | Open reply input                 |
| E      | Edit (if owner)                  |
| Escape | Close panel                      |

```typescript
const [selectedIndex, setSelectedIndex] = useState(0);

useEffect(() => {
  if (!isOpen) return;

  const handler = (e: KeyboardEvent) => {
    // Ignore if in textarea
    if ((e.target as HTMLElement).tagName === 'TEXTAREA') return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, threads.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        onScrollToText(threads[selectedIndex]?.anchorStart);
        break;
      case 'r':
        e.preventDefault();
        openReplyFor(threads[selectedIndex]?.id);
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  };

  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}, [isOpen, threads, selectedIndex]);
```

Visual feedback for selected thread:

```typescript
<Card sx={{ outline: isSelected ? '2px solid' : 'none', outlineColor: 'primary.main' }}>
```

---

## 7.4 Add to Storage Inspector

**Status:** 🟥 To Do

**File:** Update Storage Inspector to show comments Y.Map

In the NoteDoc breakdown view:

- Show comments count
- Expandable list of comment threads
- Show anchor positions (for debugging)
- Show replies and reactions

```typescript
// In YjsUpdatePreview or similar
<Typography variant="subtitle2">Comments ({commentsCount})</Typography>
{commentsExpanded && (
  <List dense>
    {comments.map(comment => (
      <ListItem>
        <ListItemText
          primary={`${comment.authorName}: ${truncate(comment.content, 50)}`}
          secondary={`Anchor: ${comment.anchorStart?.slice(0,10)}... | Replies: ${comment.replies?.length ?? 0}`}
        />
      </ListItem>
    ))}
  </List>
)}
```

---

## 7.5 Performance Testing (100+ Comments)

**Status:** 🟥 To Do

**Test scenarios:**

1. **Load time:** Open note with 100 comments
   - Target: <500ms to display
   - Measure: Time from note load to panel rendered

2. **Scroll performance:** Scroll through 100 comments in panel
   - Target: 60fps
   - Implement virtualization if needed (react-window)

3. **Editor performance:** Type in note with 100 comment highlights
   - Target: No noticeable lag
   - Measure: Input latency

4. **Memory usage:** Monitor memory with 100 comments
   - No memory leaks on note switch

**Virtualization implementation (if needed):**

```typescript
import { FixedSizeList } from 'react-window';

// If threads.length > 20
<FixedSizeList
  height={panelHeight}
  itemCount={threads.length}
  itemSize={120}
>
  {({ index, style }) => (
    <div style={style}>
      <CommentThread thread={threads[index]} />
    </div>
  )}
</FixedSizeList>
```

---

## 7.6 Final E2E Test Suite

**Status:** 🟥 To Do

**File:** `packages/desktop/e2e/comments-full.spec.ts`

Comprehensive scenarios:

```typescript
test.describe('Comments - Full Suite', () => {
  test.describe('Basic CRUD', () => {
    test('create comment on selected text');
    test('view comment in panel');
    test('edit own comment');
    test('delete comment with confirmation');
  });

  test.describe('Threading', () => {
    test('add reply to comment');
    test('collapse replies when >3');
    test('delete thread with replies shows warning');
  });

  test.describe('Resolution', () => {
    test('resolve thread');
    test('resolved threads hidden by default');
    test('show resolved toggle');
    test('reopen resolved thread');
  });

  test.describe('Reactions', () => {
    test('add reaction');
    test('click reaction to toggle');
    test('hover shows user names');
  });

  test.describe('Mentions', () => {
    test('@ triggers autocomplete');
    test('select user from autocomplete');
    test('mention styled in comment');
  });

  test.describe('Edge Cases', () => {
    test('orphaned comment shows warning');
    test('overlapping comments show selection');
    test('very long comment scrolls');
  });

  test.describe('Keyboard', () => {
    test('Cmd+Shift+M adds comment');
    test('arrow keys navigate panel');
    test('Escape closes panel');
  });

  test.describe('Sync', () => {
    test('comment appears in second window');
    test('delete syncs across windows');
  });
});
```

---

## Definition of Done (Phase 7)

- [ ] Orphaned comments handled gracefully
- [ ] Overlapping comments show selection UI
- [ ] Keyboard navigation works
- [ ] Storage Inspector shows comments
- [ ] Performance acceptable with 100+ comments
- [ ] Virtualization implemented if needed
- [ ] Final E2E suite passing

---

## Definition of Done (Overall Feature)

- [ ] All 7 phases complete
- [ ] All unit tests passing
- [ ] All integration tests passing
- [ ] All E2E tests passing
- [ ] CI passes (`pnpm ci-local`)
- [ ] Manual QA complete
- [ ] Code review complete
