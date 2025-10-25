# Real-Time Collaboration Demo

**Status**: Demo Hack (Temporary)
**Phase**: 2.3 (Note Editor - Basic TipTap)

## Overview

This is a **temporary demo** to showcase real-time collaborative editing using Yjs and TipTap. It uses `BroadcastChannel` API to sync between Electron windows - this will be replaced with proper IPC integration in Phase 3.x.

## How It Works

- Each Electron window has its own TipTap editor with a Yjs Y.Doc
- When you type, the Yjs updates are broadcast to all other windows via `BroadcastChannel`
- Other windows receive the updates and apply them to their Y.Doc
- TipTap automatically re-renders with the new content

**Technical Note**: This uses browser's `BroadcastChannel` API which works between windows in the same origin (same Electron app). In production, we'll use IPC (Inter-Process Communication) to sync through the main process.

## How to Try It

### Step 1: Start the App

```bash
cd /Users/drew/devel/nc2/packages/desktop
pnpm dev
```

### Step 2: Open a Second Window

Use **any** of these methods:

**Method 1 - Menu:**

- Click `File` → `New Window`

**Method 2 - Keyboard:**

- Press `Cmd+N` (macOS) or `Ctrl+N` (Windows/Linux)

**Method 3 - Help Menu (Highlighted):**

- Click `Help` → `Demo: Open 2nd Window`
- Or press `Cmd+Shift+N` (macOS) / `Ctrl+Shift+N` (Windows/Linux)

### Step 3: Test Collaboration

1. **Arrange windows side-by-side** so you can see both
2. **Type in one window** - watch it appear instantly in the other!
3. **Try formatting**:
   - Select text and click Bold/Italic in the toolbar
   - Use keyboard shortcuts: `Cmd+B` for bold, `Cmd+I` for italic
   - Try headings: `Cmd+Alt+1` for H1, `Cmd+Alt+2` for H2, etc.
4. **Multiple cursors**: Type in both windows simultaneously
5. **Undo/Redo**: Each window has independent undo history (via Yjs)

### What You'll See

✅ **Real-time sync**: Changes appear instantly in all windows
✅ **Conflict resolution**: Type in both windows at once - Yjs handles conflicts automatically
✅ **Rich formatting**: All formatting syncs (bold, italic, lists, headings, etc.)
✅ **Operational transformation**: Characters are inserted correctly even when typing simultaneously

## Cool Things to Try

### Experiment 1: Concurrent Editing

1. Open 2 windows
2. Type in Window 1: "Hello from Window 1"
3. Type in Window 2: "Hello from Window 2"
4. Both texts appear without conflicts!

### Experiment 2: Formatting Sync

1. Type "This is a test" in Window 1
2. Select "test" in Window 1 and make it bold
3. Watch Window 2 update with bold text instantly

### Experiment 3: Lists and Headings

1. Use toolbar in Window 1 to create a bullet list
2. Add items to the list
3. Watch Window 2 show the same list structure

### Experiment 4: Undo/Redo

1. Type something in Window 1
2. Press `Cmd+Z` to undo
3. Notice Window 1 undoes, but Window 2 keeps the content (each window has independent undo stack)

## Technical Details

### BroadcastChannel API

```typescript
// Create channel
const channel = new BroadcastChannel('notecove-demo');

// Send updates
yDoc.on('update', (update: Uint8Array) => {
  channel.postMessage({
    type: 'yjs-update',
    update: Array.from(update),
  });
});

// Receive updates
channel.onmessage = (event) => {
  if (event.data.type === 'yjs-update') {
    const update = new Uint8Array(event.data.update);
    Y.applyUpdate(yDoc, update);
  }
};
```

### Why This Works

1. **Yjs CRDT**: Yjs (Conflict-free Replicated Data Type) automatically handles merging concurrent edits
2. **TipTap Integration**: TipTap's Collaboration extension binds the editor to Yjs
3. **BroadcastChannel**: Browser API for messaging between same-origin windows
4. **Automatic Re-render**: TipTap watches the Y.Doc and re-renders when it changes

## Limitations of This Demo

⚠️ **This is NOT production-ready**:

1. **No persistence**: Close all windows and data is lost
2. **Same machine only**: BroadcastChannel only works between windows on the same computer
3. **No main process sync**: Changes aren't saved to the database
4. **No file storage**: Updates aren't written to disk
5. **No cross-instance sync**: Can't sync between different app launches

## What's Coming in Production

The real implementation (Phase 3.x) will include:

- ✅ **IPC Integration**: Renderer ↔ Main process sync via Electron IPC
- ✅ **File Persistence**: Updates saved to disk as binary files
- ✅ **Database Cache**: Note metadata and search indices in SQLite
- ✅ **Cross-instance Sync**: Changes sync across app restarts
- ✅ **Multi-user**: Eventually sync across devices/users (Phase 4+)

## Troubleshooting

### "Changes aren't syncing"

- Make sure both windows are from the same app launch
- Try closing all windows and restarting
- Check browser console for errors (View → Toggle DevTools)

### "App won't start"

- Run `pnpm build` first
- Make sure Node.js 22 is installed
- Check for errors in terminal

### "Can't open second window"

- Use `Cmd+N` or File → New Window
- Make sure the app menu is visible (autoHideMenuBar is false)

## Code Location

**Demo Code:**

- `packages/desktop/src/renderer/src/components/EditorPanel/TipTapEditor.tsx` (lines 63-97)
- `packages/desktop/src/main/index.ts` (menu creation, lines 84-151)

**Will Be Replaced With:**

- IPC handlers for note loading/saving
- Main process Y.Doc management
- File-based update persistence

## Enjoy the Demo! 🎉

This is a sneak peek at the collaborative editing that will be fully implemented in Phase 3. It's amazing to see Yjs working in real-time!

**Questions?** Check `/docs/tiptap-yjs-compatibility.md` for technical details about the TipTap+Yjs integration.
