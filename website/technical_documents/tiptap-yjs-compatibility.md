# TipTap + Yjs Compatibility Research

**Date**: 2025-10-25
**Phase**: 2.3 (Note Editor - Basic TipTap)

## Overview

TipTap is a ProseMirror-based editor that has first-class support for Yjs collaborative editing. This document outlines the findings from researching TipTap + Yjs integration for NoteCove.

## Key Findings

### Official Support

✅ **TipTap officially supports Yjs** through the `@tiptap/extension-collaboration` extension
✅ **Offline-first architecture** - Yjs works without requiring a real-time server
✅ **Conflict-free** - Yjs CRDTs handle concurrent edits automatically

### Required Dependencies

For basic TipTap + Yjs integration:

```bash
npm install @tiptap/react @tiptap/starter-kit
npm install @tiptap/extension-collaboration yjs
```

Optional for collaborative cursors:

```bash
npm install @tiptap/extension-collaboration-cursor
```

### Core Architecture

**TipTap** (ProseMirror-based editor)
↓
**@tiptap/extension-collaboration** (TipTap's Yjs binding)
↓
**Yjs Y.Doc** (CRDT document)
↓
**Our sync mechanism** (file-based via IPC, not websocket)

### How It Works

1. **Y.Doc per note**: Each note has its own `Y.Doc` instance
2. **Fragment binding**: TipTap's content syncs to a Y.XmlFragment inside the Y.Doc
3. **Automatic updates**: Changes in the editor automatically update the Y.Doc
4. **Bidirectional sync**: Changes to Y.Doc automatically update the editor

### NoteCove-Specific Implementation

**Our Architecture:**

- Main process: Manages Y.Doc instances (via CRDTManager)
- Renderer process: TipTap editor displays content
- IPC bridge: Transfers Yjs updates between main and renderer

**Key differences from typical TipTap+Yjs setup:**

- ❌ No WebSocket provider (we use file-based sync)
- ❌ No Hocuspocus/Collaboration server (offline-first)
- ✅ Y.Doc lives in main process (Electron main, not renderer)
- ✅ Updates transferred via IPC (Electron IPC, not WebSocket)
- ✅ Updates persisted to disk as files (not database)

### Extension Compatibility

Based on TipTap documentation, the following extensions work with Yjs:

**Core Extensions (all compatible):**

- ✅ Document, Paragraph, Text
- ✅ Bold, Italic, Underline, Strike, Code
- ✅ Heading (all levels)
- ✅ BulletList, OrderedList, ListItem
- ✅ Blockquote, CodeBlock
- ✅ HorizontalRule, HardBreak
- ✅ Dropcursor, Gapcursor

**History Extension:**

- ⚠️ **Use Collaboration's built-in history** instead of `@tiptap/extension-history`
- The Collaboration extension includes its own undo/redo based on Yjs
- Must disable StarterKit's history when using Collaboration

**Collaborative Cursors:**

- ✅ `@tiptap/extension-collaboration-cursor` - shows other users' selections
- ✅ Requires awareness (Y.js feature for ephemeral state)
- ✅ Works with our architecture (awareness synced via IPC)

**Advanced Extensions (to verify later):**

- ❓ Tables - likely compatible but needs testing
- ❓ Images - likely compatible but needs testing
- ❓ TaskList - likely compatible but needs testing

## Implementation Plan

### Phase 2.3 (Current - Basic Editor)

1. Install core dependencies
2. Create TipTap editor component in renderer
3. Configure basic extensions (formatting, lists, headings)
4. Connect to Y.Doc via IPC:
   - Load note: Get Y.Doc state from main process
   - Apply updates: Send updates from editor to main process
   - Receive updates: Apply updates from main process to editor
5. Implement toolbar with Material-UI buttons
6. Add title extraction utility

### Future Phases

- **Collaborative cursors**: Add awareness support via IPC
- **Advanced extensions**: Tables, images, task lists
- **Markdown import/export**: TipTap → Markdown conversion

## Technical Challenges

### Challenge 1: Y.Doc in Main Process

**Problem**: TipTap expects Y.Doc in the same JavaScript context as the editor.

**Solution**:

- Keep Y.Doc in main process (CRDT manager)
- Transfer Yjs updates via IPC (binary data)
- Create lightweight Y.Doc in renderer for TipTap binding
- Keep renderer Y.Doc synced with main process Y.Doc

**Implementation**:

```typescript
// Main process (authoritative)
const noteDoc = new Y.Doc();
const update = Y.encodeStateAsUpdate(noteDoc);
// Send to renderer via IPC

// Renderer process (view only)
const localDoc = new Y.Doc();
Y.applyUpdate(localDoc, update); // Sync from main
// Bind to TipTap
```

### Challenge 2: IPC Update Transfer

**Problem**: Need to transfer Yjs updates between main and renderer efficiently.

**Solution**:

- Use existing IPC protocol
- Add commands: `note:getUpdates`, `note:applyUpdate`
- Add events: `note:updated` (broadcast to all windows)
- Transfer updates as Uint8Array (binary)

### Challenge 3: Title Extraction

**Problem**: Need to extract title from Yjs Y.XmlFragment without rendering.

**Solution**:

- Traverse Y.XmlFragment directly
- Find first text node with content
- Extract as string
- Handle "Untitled" case for empty notes

## References

### Official Documentation

- [TipTap Collaboration Extension](https://tiptap.dev/docs/editor/extensions/functionality/collaboration)
- [TipTap Collaboration Docs](https://tiptap.dev/docs/collaboration/getting-started/overview)
- [Yjs TipTap Bindings](https://docs.yjs.dev/ecosystem/editor-bindings/tiptap2)
- [TipTap Awareness](https://tiptap.dev/docs/collaboration/core-concepts/awareness)

### NPM Packages

- `@tiptap/react` - React wrapper for TipTap
- `@tiptap/starter-kit` - Common extensions bundle
- `@tiptap/extension-collaboration` - Yjs binding
- `@tiptap/extension-collaboration-cursor` - Collaborative cursors
- `yjs` - CRDT library

## Conclusion

✅ **TipTap + Yjs is fully compatible** with NoteCove's offline-first architecture
✅ **No server required** - we can use file-based sync instead of WebSocket
✅ **All basic extensions work** with Yjs collaboration
⚠️ **Must use Collaboration's history** instead of default History extension
✅ **Collaborative cursors supported** via awareness (implement in future phase)

The main technical challenge is bridging the Y.Doc between Electron's main and renderer processes via IPC, but this is solvable by syncing Yjs updates as binary data.
