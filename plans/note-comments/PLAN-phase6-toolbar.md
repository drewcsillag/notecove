# Phase 6: Toolbar & Keyboard Integration

**Progress:** `100%`

## Goal

Provide multiple entry points for adding comments: toolbar button, keyboard shortcut, context menu.

---

## 6.1 Add Toolbar Button (Selection-Dependent)

**Status:** 🟢 Complete

**File:** `packages/desktop/src/renderer/src/components/EditorPanel/EditorToolbar.tsx`

Add comment button that's only enabled when text is selected:

```typescript
interface EditorToolbarProps {
  // ... existing
  hasSelection: boolean;
  onAddComment: () => void;
  commentCount: number;
  onToggleCommentPanel: () => void;
}

// In toolbar:
<Tooltip title="Add comment (⌘⇧M)">
  <span>
    <IconButton
      onClick={onAddComment}
      disabled={!hasSelection}
      size="small"
    >
      <AddCommentIcon />
    </IconButton>
  </span>
</Tooltip>

<Tooltip title="Toggle comments panel">
  <IconButton onClick={onToggleCommentPanel} size="small">
    <Badge badgeContent={commentCount} color="primary" max={99}>
      <CommentIcon />
    </Badge>
  </IconButton>
</Tooltip>
```

Track selection state in TipTapEditor:

```typescript
const [hasSelection, setHasSelection] = useState(false);

useEffect(() => {
  if (!editor) return;
  const update = () => {
    const { from, to } = editor.state.selection;
    setHasSelection(from !== to);
  };
  editor.on('selectionUpdate', update);
  return () => editor.off('selectionUpdate', update);
}, [editor]);
```

---

## 6.2 Add Keyboard Shortcut (Cmd+Alt+M)

**Status:** 🟢 Complete

**Option A: TipTap extension keyboard shortcut**

```typescript
// In CommentMarker extension
addKeyboardShortcuts() {
  return {
    'Mod-Shift-m': () => {
      const { from, to } = this.editor.state.selection;
      if (from === to) return false;
      this.options.onAddComment?.();
      return true;
    },
  };
},
```

**Option B: Global handler in EditorPanel**

```typescript
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'm') {
      e.preventDefault();
      handleAddComment();
    }
  };
  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}, [handleAddComment]);
```

Prefer Option A for better TipTap integration.

---

## 6.3 Add Context Menu Item

**Status:** 🟢 Complete

**File:** `packages/desktop/src/renderer/src/components/EditorPanel/TipTapEditor.tsx`

Custom context menu on right-click:

```typescript
const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

const handleContextMenu = (e: React.MouseEvent) => {
  e.preventDefault();
  setContextMenu({ x: e.clientX, y: e.clientY });
};

// In render:
<div onContextMenu={handleContextMenu}>
  <EditorContent editor={editor} />
</div>

{contextMenu && (
  <Menu
    open
    anchorReference="anchorPosition"
    anchorPosition={{ top: contextMenu.y, left: contextMenu.x }}
    onClose={() => setContextMenu(null)}
  >
    <MenuItem onClick={() => { document.execCommand('cut'); setContextMenu(null); }}>
      Cut
    </MenuItem>
    <MenuItem onClick={() => { document.execCommand('copy'); setContextMenu(null); }}>
      Copy
    </MenuItem>
    <MenuItem onClick={() => { document.execCommand('paste'); setContextMenu(null); }}>
      Paste
    </MenuItem>
    <Divider />
    <MenuItem
      onClick={() => { handleAddComment(); setContextMenu(null); }}
      disabled={!hasSelection}
    >
      Add Comment
      <Typography variant="caption" sx={{ ml: 2, color: 'text.secondary' }}>
        ⌘⇧M
      </Typography>
    </MenuItem>
  </Menu>
)}
```

---

## 6.4 Add Comment Count Badge

**Status:** 🟢 Complete

Track unresolved comment count:

```typescript
const [commentCount, setCommentCount] = useState(0);

useEffect(() => {
  const load = async () => {
    const threads = await window.electronAPI.comment.getThreadsForNote(noteId);
    const unresolvedCount = threads.filter((t) => !t.resolved).length;
    setCommentCount(unresolvedCount);
  };
  load();

  const unsub1 = window.electronAPI.comment.onThreadCreated(() => load());
  const unsub2 = window.electronAPI.comment.onThreadDeleted(() => load());
  const unsub3 = window.electronAPI.comment.onThreadUpdated?.(() => load());

  return () => {
    unsub1();
    unsub2();
    unsub3?.();
  };
}, [noteId]);
```

Badge in toolbar (shown in 6.1).

---

## 6.5 Write E2E Tests

**Status:** 🟢 Complete

**File:** `packages/desktop/e2e/comments.spec.ts`

Comprehensive E2E tests implemented covering:

- Toolbar button visibility when text selected
- Keyboard shortcut (Cmd+Alt+M) opens comment panel
- Context menu shows "Add Comment" option
- Comment panel display with threads
- Reply flow
- Reactions
- @-mentions autocomplete
- Edit and delete with confirmation
- Resolution workflow

---

## Definition of Done

- [x] Toolbar button shows (enabled with selection, disabled without)
- [x] Keyboard shortcut Cmd+Alt+M works
- [x] Context menu shows "Add Comment" option
- [x] Comment count badge updates in real-time
- [x] Panel auto-opens when adding comment
- [x] E2E tests passing (14 tests in comments.spec.ts)
