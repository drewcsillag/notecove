# Basic Usage

This guide covers the essential operations in NoteCove.

## Creating Your First Note

1. **Launch NoteCove**
2. **Create a note**: Click the "New Note" button or press `Cmd+N` (macOS) / `Ctrl+N` (Windows/Linux)
3. **Start typing**: The editor will auto-save as you type

## Editing Notes

### Rich Text Formatting

NoteCove uses a TipTap editor with extensive formatting options:

- **Bold**: `Cmd+B` / `Ctrl+B`
- **Italic**: `Cmd+I` / `Ctrl+I`
- **Strikethrough**: `Cmd+Shift+X` / `Ctrl+Shift+X`
- **Code**: `Cmd+E` / `Ctrl+E`

### Lists

- **Bullet List**: `Cmd+Shift+8` / `Ctrl+Shift+8`
- **Numbered List**: `Cmd+Shift+7` / `Ctrl+Shift+7`
- **Task List**: `Cmd+Shift+9` / `Ctrl+Shift+9`

### Headings

Use `#` at the beginning of a line for headings:

- `# Heading 1`
- `## Heading 2`
- `### Heading 3`

### Code Blocks

Create code blocks with triple backticks:

\`\`\`javascript
function hello() {
console.log('Hello, NoteCove!')
}
\`\`\`

## Organizing Notes

### Folders

1. **Create a folder**: Right-click in the sidebar → "New Folder"
2. **Rename a folder**: Right-click → "Rename"
3. **Delete a folder**: Right-click → "Delete"
4. **Move notes**: Drag and drop notes between folders

### Tags

Add hashtags to notes for flexible organization:

- Type `#tagname` anywhere in your note (must start with a letter)
- Tags automatically appear in the Tag Panel on the left sidebar
- Tags show note counts for easy browsing

**Autocomplete**: When you type `#`, existing tags appear in a dropdown menu. Use arrow keys to navigate and press Enter to insert.

**Filtering Notes by Tags**:
- Click a tag pill in the Tag Panel to filter notes
- Tags have three states that cycle when clicked:
  - **Gray (neutral)**: Tag is not filtering
  - **Blue (include)**: Show only notes WITH this tag
  - **Red (exclude)**: Show only notes WITHOUT this tag
- Multiple tag filters use AND logic: notes must match all include tags and have none of the exclude tags
- Click the "Clear" button to remove all tag filters

**Resizable Panel**: Drag the divider between the Folder Panel and Tag Panel to adjust their size.

## Search

### Quick Search

Press `Cmd+F` / `Ctrl+F` to search within the current note.

### Global Search

(Coming soon)

Press `Cmd+Shift+F` / `Ctrl+Shift+F` to search across all notes:

- Full-text search powered by SQLite FTS5
- Search in note titles, content, and tags
- Filter by folder or date range

## Sync

### Setting Up Sync

1. **Choose a sync folder**: File → Preferences → Sync
2. **Select cloud storage**: Choose a folder in your Dropbox, Google Drive, or iCloud Drive
3. **Enable sync**: Toggle "Enable Sync"

### Sync Status

- **Green dot**: Synced and up to date
- **Yellow dot**: Syncing in progress
- **Red dot**: Sync error (check activity log)

### Multi-Device Sync

NoteCove uses CRDTs to merge changes from multiple devices:

- Edit the same note on different devices
- Changes merge automatically without conflicts
- Works offline - syncs when connection is restored

## Tips & Tricks

### Multi-Window Support

Open multiple windows to view different notes side-by-side:

- File → New Window (`Cmd+Shift+N` / `Ctrl+Shift+N`)

### Auto-Save

All changes are saved automatically as you type. There's no save button - your work is always protected.

### Offline Mode

NoteCove works perfectly offline. All features are available without internet:

- Create and edit notes
- Organize folders
- Search your notes
- Changes sync automatically when you reconnect

## Next Steps

- [Configure sync settings](/guide/sync-configuration)
- [Learn keyboard shortcuts](/guide/keyboard-shortcuts)
- [Explore advanced features](/features/)
