# Folders & Organization

NoteCove provides flexible tools to organize your notes exactly the way you want.

## Folders

### Creating Folders

Create folders to organize related notes:

1. **Right-click in sidebar** → "New Folder"
2. **Or use keyboard shortcut**: `Cmd+Shift+N` / `Ctrl+Shift+N`
3. Name your folder
4. Press Enter

### Nested Folders

Create hierarchical folder structures:

```
📁 Work
  📁 Projects
    📁 Project A
    📁 Project B
  📁 Meetings
📁 Personal
  📁 Journal
  📁 Ideas
```

Nest folders by:

- Dragging folders onto other folders
- Creating new folders inside existing folders

### Managing Folders

**Rename:**

- Right-click → "Rename"
- Or press `F2`

**Delete:**

- Right-click → "Delete"
- Or press `Delete`
- Notes inside are moved to a default folder (not deleted)

**Move:**

- Drag folders to reorder
- Drop onto other folders to nest

### Folder Operations

**Expand/Collapse:**

- Click the arrow icon to expand/collapse
- `Cmd+Click` / `Ctrl+Click` to expand/collapse all

**Color Coding:**
(Coming soon)

- Assign colors to folders
- Visual organization in sidebar
- Color-coded note badges

## Notes

### Creating Notes

Create notes in the current folder:

1. **Click "New Note"** button
2. **Or use keyboard shortcut**: `Cmd+N` / `Ctrl+N`
3. Start typing to add content

### Moving Notes

Organize notes by moving them between folders:

**Drag and Drop:**

- Drag note from list to folder in sidebar
- Visual feedback shows drop target

**Move Dialog:**

- Right-click note → "Move to Folder"
- Or use `Cmd+Shift+M` / `Ctrl+Shift+M`
- Choose destination folder from list

### Note Metadata

Each note displays:

- **Title**: First line or heading of note
- **Preview**: First few lines of content
- **Modified date**: When last edited
- **Folder**: Current location
- **Tags**: Associated tags

## Tags

Tags provide flexible cross-cutting organization, letting you categorize notes independent of their folder location.

### Adding Tags

Add tags directly in your note content using hashtag syntax:

- Type `#` followed by the tag name (e.g., `#project`, `#important`)
- Tags are automatically recognized and highlighted
- Add multiple tags anywhere in your note

### Tag Panel

View and filter by tags in the Tag Panel:

- Shows all tags used across your notes
- Click a tag to filter notes
- Toggle between include/exclude filtering modes

### Tag Filtering Modes

**Include Mode:**

- Shows notes that contain the selected tags
- Select multiple tags to narrow results

**Exclude Mode:**

- Hides notes that contain the selected tags
- Useful for filtering out specific categories

## Search & Filtering

NoteCove provides powerful search capabilities:

- **Global Search** (`Cmd+F` / `Ctrl+F`): Search across all notes
- **Filter by Tags**: Use the Tag Panel to filter notes
- **Filter by Folder**: Select a folder to narrow results

[Learn more about search →](/features/search)

## Inter-Note Links

Connect related notes with wiki-style links to build your personal knowledge graph.

### Creating Links

Use `[[Note Title]]` syntax:

- Type `[[` to start a link
- Autocomplete shows matching notes as you type
- Select a note to insert the link
- The link appears as a clickable chip in the editor

### Linking to Headings

Jump directly to a specific section within a note:

1. Type `[[` and select a note from autocomplete
2. After selecting, autocomplete shows all headings in that note
3. Select a heading or type to filter the list
4. The link displays as `[[Note Title#Heading Text]]`

**Same-Note Heading Links**: Type `[[#` to link to a heading within the current note. This is perfect for:
- Creating a table of contents at the top of a note
- Cross-referencing sections within long documents
- Building navigation for structured notes

Same-note links display as `[[#Heading Text]]` for a cleaner look.

### Following Links

- Click a link to navigate to the linked note
- Click a heading link to jump directly to that section
- Double-click to open in a new window
- Links are validated - broken links are highlighted in red, broken heading links in orange

### Backlinks

(Coming soon)

See which notes link to the current note:

- Backlinks panel shows all incoming links
- Navigate backwards through your knowledge graph
- Find related content automatically

## Pinned Notes

Keep important notes at the top of your note list for quick access.

### Pinning Notes

- Right-click a note and select "Pin"
- Pinned notes appear at the top of the notes list
- Pin multiple notes - they stay grouped together
- Unpin anytime by right-clicking and selecting "Unpin"

### Use Cases

- **Active projects**: Keep current work at top
- **Reference notes**: Quick access to frequently used information
- **Daily notes**: Pin today's journal entry

## Best Practices

### Folder Structure

**Keep it simple:**

- Start with a few top-level folders
- Add nested folders as needed
- Don't over-organize early

**Example structures:**

**By area:**

```
Work
Personal
Learning
Projects
```

**By status:**

```
Active
Archived
Templates
Inbox
```

**PARA method:**

```
Projects (short-term work)
Areas (ongoing responsibilities)
Resources (reference materials)
Archive (completed/inactive)
```

### Naming Conventions

**Use clear, descriptive names:**

- ✅ "Meeting Notes - Project Alpha"
- ❌ "Notes 1"

**Date prefixes for chronological sorting:**

- "2024-01-15 - Sprint Planning"
- "2024-01-22 - Sprint Planning"

**Action prefixes:**

- "TODO: Review PR #123"
- "IDEA: Feature request"

## Next Steps

- [Learn about search](/features/search)
- [Understand offline sync](/features/offline-sync)
- [View keyboard shortcuts](/guide/keyboard-shortcuts)
