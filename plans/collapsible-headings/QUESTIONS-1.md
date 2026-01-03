# Collapsible Headings - Questions

## Understanding Gathered

Based on my analysis:

- The editor uses TipTap 3 (ProseMirror wrapper) with Yjs CRDT for collaboration
- Headings currently use StarterKit's default Heading extension (no custom implementation)
- The codebase has solid patterns for custom NodeViews (TriStateTaskItem, NotecoveImage, CodeBlock)
- Collapsed state would need to be stored as an attribute on the heading node (synced via Yjs)

## Questions

### 1. Persistence of Collapse State

When you collapse a heading, should the collapsed state be:

**A) Persisted in the document** - The collapsed/expanded state is part of the document and syncs across devices/sessions. When you reopen the note, collapsed sections remain collapsed.

**B) View-only / Session-only** - The collapsed state is local to the current editing session and is NOT stored in the document. When you reopen the note, everything is expanded.

My recommendation: **Option A (persisted)** because:

- Collapsed sections indicate "I don't need to see this right now"
- This intent typically persists across sessions
- It's consistent with how most editors (VSCode, Notion, etc.) handle folding

A

### 2. Should Collapse State Sync in Collaboration?

If two users are editing the same note, should one user collapsing a heading collapse it for the other user too?

**A) Yes - sync** - If I collapse "## Implementation Details", it collapses for all collaborators

**B) No - local only** - Each user has their own view of what's collapsed

Note: Option B is significantly more complex because it requires storing collapse state separately from the document. Option A naturally falls out of storing the state in the node attribute (which syncs via Yjs).

A

### 3. Default State for New Headings

When a user creates a new heading, should it start:

**A) Expanded** (default) - User explicitly collapses when needed

**B) Collapsed** - User explicitly expands when needed

Recommendation: **Option A (expanded)** - new content should be visible by default.

A

### 4. Keyboard Shortcuts

Should there be keyboard shortcuts for collapse/expand?

If yes, what shortcuts? Common options:

- `Cmd/Ctrl+.` - Toggle collapse at cursor
- `Cmd/Ctrl+Shift+.` - Collapse/expand all

Should there be any shortcuts, or is click-only sufficient for v1?

Assuming those key shortcuts aren't currently in use, yes, use them.

### 5. Print/Export Behavior

When printing or exporting a note that has collapsed sections:

**A) Include collapsed content** - Print/export ignores collapse state, shows everything

**B) Respect collapse state** - Collapsed sections are hidden in print/export

Recommendation: **Option A** - printing should show full content.

A

### 6. Website Documentation

This is a new editor feature. Should it be added to the features documentation on the website (specifically in `website/features/rich-text-editing.md`)? It might not warrant inclusion as a standalone feature but could be mentioned as part of the rich text editing capabilities.

include it.
