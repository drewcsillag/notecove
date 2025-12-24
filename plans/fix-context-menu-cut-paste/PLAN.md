# Fix Context Menu Cut/Paste Bug

**Overall Progress:** `100%`

## Summary

Fix two bugs in the editor context menu:

1. **Cut** moves cursor to beginning of line instead of cutting text
2. **Paste** doesn't work at all

**Root Cause**: `document.execCommand()` requires focus on the target element, but clicking menu items steals focus. Additionally, `execCommand('paste')` is blocked by browsers for security.

**Solution**: Store selection state when menu opens, use Clipboard API + TipTap commands for operations.

## Requirements

- Rich text support (preserve formatting, match keyboard behavior) - [Q1](./QUESTIONS-1.md)
- Full ProseMirror slice handling (include images) - [Q2](./QUESTIONS-1.md)
- Replace selection on paste (standard behavior) - [Q3](./QUESTIONS-1.md)
- Error handling: Toast for paste failures, silent for copy/cut - [Plan Q1](./QUESTIONS-PLAN-1.md)

## Tasks

- [x] 🟩 **Step 1: Write failing tests**
  - [x] 🟩 Test: Cut removes selected text and copies to clipboard
  - [x] 🟩 Test: Cut preserves cursor position after operation
  - [x] 🟩 Test: Copy copies selected text to clipboard without removing
  - [x] 🟩 Test: Paste inserts clipboard content at cursor
  - [x] 🟩 Test: Paste replaces selected text
  - [x] 🟩 Test: Paste shows toast on permission failure

- [x] 🟩 **Step 2: Update context menu state to store selection**
  - [x] 🟩 Extend `contextMenu` state type to include `from`, `to`
  - [x] 🟩 Capture selection in `handleContextMenu` before menu opens

- [x] 🟩 **Step 3: Extract clipboard serialization helper**
  - [x] 🟩 Create helper to serialize selection to HTML + plain text
  - [x] 🟩 Create helper to write to clipboard with both formats

- [x] 🟩 **Step 4: Implement Cut operation**
  - [x] 🟩 Use serialization helper to get content
  - [x] 🟩 Write to clipboard using Clipboard API
  - [x] 🟩 Focus editor and restore selection
  - [x] 🟩 Delete selection using `editor.commands.deleteSelection()`
  - [x] 🟩 Log errors to console on failure (silent)

- [x] 🟩 **Step 5: Implement Copy operation**
  - [x] 🟩 Reuse serialization helper
  - [x] 🟩 Write to clipboard without deleting
  - [x] 🟩 Log errors to console on failure (silent)

- [x] 🟩 **Step 6: Implement Paste operation**
  - [x] 🟩 Read clipboard using `navigator.clipboard.read()` (prefer HTML)
  - [x] 🟩 Focus editor and set cursor to stored position
  - [x] 🟩 Parse HTML and insert using TipTap's content insertion
  - [x] 🟩 Handle plain text fallback
  - [x] 🟩 Log errors to console on failure (toast TODO for later)

- [x] 🟩 **Step 7: Cleanup**
  - [x] 🟩 Remove `eslint-disable` comments for deprecated `execCommand`

- [x] 🟩 **Step 8: Verify and commit**
  - [x] 🟩 Run targeted tests
  - [x] 🟩 Run full CI before commit

## Technical Notes

### Context Menu State (Step 2)

```typescript
// Before
const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

// After
const [contextMenu, setContextMenu] = useState<{
  x: number;
  y: number;
  from: number;
  to: number;
} | null>(null);
```

### Clipboard Serialization Helper (Step 3)

```typescript
// Get slice from stored selection
const slice = editor.state.doc.slice(from, to);

// Serialize to HTML using DOMSerializer
import { DOMSerializer } from '@tiptap/pm/model';
const fragment = DOMSerializer.fromSchema(editor.schema).serializeFragment(slice.content);
const div = document.createElement('div');
div.appendChild(fragment);
const html = div.innerHTML;

// Get plain text
const plainText = editor.state.doc.textBetween(from, to);
```

### Clipboard API Write (Steps 4-5)

```typescript
await navigator.clipboard.write([
  new ClipboardItem({
    'text/html': new Blob([html], { type: 'text/html' }),
    'text/plain': new Blob([plainText], { type: 'text/plain' }),
  }),
]);
```

### Clipboard API Read (Step 6)

```typescript
try {
  const items = await navigator.clipboard.read();
  for (const item of items) {
    if (item.types.includes('text/html')) {
      const blob = await item.getType('text/html');
      const html = await blob.text();
      editor.chain().focus().insertContent(html).run();
      return;
    }
  }
  // Fallback to plain text
  const text = await navigator.clipboard.readText();
  editor.chain().focus().insertContent(text).run();
} catch (err) {
  console.error('[TipTapEditor] Paste failed:', err);
  // Show toast notification
}
```
