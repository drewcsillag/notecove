# Import & Export

NoteCove makes it easy to import your existing notes and move data between applications.

## Import Markdown Files

Import markdown files or entire folder structures from other note-taking applications into NoteCove.

### How to Import

1. Open NoteCove
2. Select **File > Import Markdown...** (or press `Cmd/Ctrl+Shift+I`)
3. Choose to import a single file or an entire folder
4. Configure import options:
   - **Target folder**: Where to place imported notes
   - **Structure**: Preserve folder hierarchy or flatten all notes
   - **Container folder**: Optionally wrap imports in a new folder
   - **Duplicates**: Skip or rename existing notes with same titles
5. Click **Import** and wait for completion
6. Navigate to your imported notes

### Supported Features

The import process handles a wide range of markdown content:

**Text Formatting**

- Headings (H1-H6)
- Bold, italic, underline, strikethrough
- Inline code and code blocks with syntax highlighting
- Blockquotes
- Horizontal rules

**Lists**

- Bullet lists (nested supported)
- Numbered lists
- Task lists with checkboxes

**Tables**

- Standard markdown tables
- Column alignment (left, center, right)
- Header rows

**Images**

- Local images are automatically copied to NoteCove storage
- Relative image paths are resolved from the markdown file location
- Alt text is preserved
- External URLs (http/https) are skipped

**Links**

- Inter-note links (links to other `.md` files) are converted to NoteCove's `[[note-id]]` format
- External web links are preserved

### Import Modes

**Preserve Structure**
Maintains your original folder hierarchy. If you import:

```
my-notes/
├── projects/
│   ├── project-a.md
│   └── project-b.md
└── daily/
    └── today.md
```

NoteCove creates matching folders and places notes in the same structure.

**Flatten**
All notes are placed directly in the target folder, ignoring the original folder structure. Useful when you want all notes accessible in one place.

**Container Folder**
Optionally wraps all imported content in a new folder named after the source folder. Keeps imports organized and separate from existing notes.

### Handling Duplicates

When a note with the same title already exists in the target folder:

- **Skip**: The existing note is kept, the import is skipped
- **Rename**: The imported note gets a suffix like "(2)", "(3)", etc.

### Tips

- **Large imports**: NoteCove shows a progress bar and allows cancellation
- **Missing images**: If a referenced image can't be found, the import continues with a placeholder
- **Invalid markdown**: NoteCove handles malformed markdown gracefully - it won't crash

## Export to Markdown

Export your notes to markdown files, preserving folder structure and images.

### How to Export

1. Open NoteCove
2. Select **File > Export...** (or press `Cmd/Ctrl+Shift+E`)
3. Choose what to export:
   - **Single note**: Export the currently selected note
   - **Folder**: Export all notes in a folder
   - **All notes**: Export your entire library
4. Select a destination folder
5. Click **Export** and wait for completion

### What Gets Exported

**Notes**

- Full markdown content with all formatting
- Headings, lists, code blocks, tables preserved
- File names match note titles

**Folder Structure**

- Folder hierarchy is recreated in the export destination
- Empty folders are not exported

**Images**

- All embedded images are copied to the export folder
- Image references are updated to relative paths
- Original quality preserved

### Export Tips

- **Backup**: Use export to create markdown backups of your notes
- **Sharing**: Export individual notes to share as markdown files
- **Migration**: Export all notes to migrate to another application

## Migrating from Other Apps

### From Obsidian

1. Locate your Obsidian vault folder
2. Use **File > Import Markdown...** and select the vault folder
3. Enable **Preserve Structure** to maintain your folder hierarchy
4. Inter-note `[[wiki links]]` are converted automatically

### From Bear

1. Export notes from Bear as Markdown files (File > Export Notes)
2. Import the exported folder into NoteCove
3. Tags in Bear's format may need manual cleanup

### From Apple Notes

1. Use a third-party tool to export Apple Notes to Markdown
2. Import the exported files into NoteCove

### From Notion

1. Export your Notion workspace as Markdown
2. Import the exported folder into NoteCove
3. Some Notion-specific features may not be preserved

## Print

Print your notes with full formatting and comments.

### How to Print

1. Open the note you want to print
2. Press `Cmd+P` (macOS) or `Ctrl+P` (Windows/Linux)
3. A print preview window opens showing your formatted note
4. Optionally toggle "Include resolved comments"
5. Click **Print** to open the system print dialog

### What Gets Printed

**Full Content**

- All text formatting (bold, italic, code, etc.)
- Headings, lists, blockquotes, and tables
- Code blocks with syntax highlighting
- Images (sized to fit page)
- Link chips and date chips
- Hashtags with colored styling

**Comments as Endnotes**

Comments appear as numbered endnotes at the end of the printed document:

- Highlighted text in the note shows superscript reference numbers
- Each comment is listed with its number, quoted text, author, and timestamp
- Replies are shown indented under their parent comment
- Toggle "Include resolved comments" to include or exclude resolved threads

### Print Styling

- Light mode styling for clear printing
- 11pt base font with proportional headings
- Page breaks avoid splitting code blocks, images, and tables
- Maximum image height prevents images from spanning multiple pages
