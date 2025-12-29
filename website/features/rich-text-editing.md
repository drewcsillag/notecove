# Rich Text Editing

NoteCove uses TipTap, a powerful and extensible rich text editor built on ProseMirror.

## Editor Features

### Text Formatting

Apply rich formatting to your notes:

- **Bold**, _italic_, and ~~strikethrough~~
- `Inline code` for technical content
- Underline for emphasis
- Text colors and highlights (coming soon)

### Headings

Organize content with hierarchical headings:

```markdown
# Heading 1

## Heading 2

### Heading 3
```

Use keyboard shortcuts for quick access:

- `Cmd+Alt+1` / `Ctrl+Alt+1`: Heading 1
- `Cmd+Alt+2` / `Ctrl+Alt+2`: Heading 2
- `Cmd+Alt+3` / `Ctrl+Alt+3`: Heading 3

### Lists

Create structured lists:

**Bullet Lists:**

- Item one
- Item two
  - Nested item
  - Another nested item

**Numbered Lists:**

1. First item
2. Second item
   1. Nested numbered item
   2. Another nested item

**Task Lists:**

- [ ] Todo item
- [x] Completed item
- [ ] Another todo

### Code Blocks

Syntax-highlighted code blocks for technical notes:

```javascript
function greet(name) {
  console.log(`Hello, ${name}!`);
}
```

```python
def greet(name):
    print(f"Hello, {name}!")
```

Supported languages include JavaScript, Python, TypeScript, Java, C++, Go, Rust, and many more.

### Blockquotes

Emphasize important content:

> This is a blockquote.
> It can span multiple lines.

### Horizontal Rules

Separate sections with horizontal rules:

---

### Tables

Create structured data tables:

| Column 1 | Column 2 | Column 3 |
| -------- | -------- | -------- |
| Data 1   | Data 2   | Data 3   |
| Data 4   | Data 5   | Data 6   |

**Table Features:**

- **Insert from toolbar**: Click the table button to create a new table
- **Header rows**: Toggle header styling for the first row
- **Column resizing**: Drag column borders to adjust width
- **Cell alignment**: Left, center, or right align content
- **Keyboard navigation**: Use Tab to move between cells
- **Add/remove rows and columns**: Right-click for context menu

**Keyboard Shortcuts:**

- `Tab`: Move to next cell
- `Shift+Tab`: Move to previous cell
- `Enter`: Add new row (when in last cell)

### Images

Add images to enhance your notes:

**Adding Images:**

- **Drag and drop**: Drop image files directly into the editor
- **Paste from clipboard**: Paste screenshots or copied images
- **Insert from toolbar**: Click the image button to browse files

**Image Features:**

- **Automatic thumbnails**: Images are optimized for fast loading
- **Lightbox view**: Click any image to view full-size in a lightbox
- **Text wrapping**: Configure how text flows around images
- **Resize**: Drag image corners to resize
- **Alt text**: Add descriptions for accessibility

**Supported Formats:**

- PNG, JPEG, GIF, WebP
- Images are stored locally alongside your notes
- Automatic deduplication saves storage space

## Markdown Support

NoteCove supports markdown-style shortcuts for fast typing:

| Type         | Get           |
| ------------ | ------------- |
| `# `         | Heading 1     |
| `## `        | Heading 2     |
| `### `       | Heading 3     |
| `* ` or `- ` | Bullet list   |
| `1. `        | Numbered list |
| `[] `        | Task list     |
| `` ` ``      | Inline code   |
| ` ``` `      | Code block    |
| `> `         | Blockquote    |

### Markdown Formatting

Apply formatting while typing:

- `**bold**` → **bold**
- `*italic*` → _italic_
- `` `code` `` → `code`
- `~~strikethrough~~` → ~~strikethrough~~

## Toolbar

The formatting toolbar provides quick access to common operations:

- **Text formatting**: Bold, italic, underline, strikethrough, code
- **Paragraph styles**: Headings, paragraph, code block
- **Lists**: Bullet, numbered, task lists
- **Alignment**: Left, center, right, justify (coming soon)
- **Insert**: Links, images, tables

## Keyboard Shortcuts

See the complete [keyboard shortcuts reference](/guide/keyboard-shortcuts) for all editing shortcuts.

## Advanced Features

### Multi-Cursor Editing

Edit multiple locations simultaneously:

1. Select a word
2. Press `Cmd+D` / `Ctrl+D` to select next occurrence
3. Type to edit all instances at once

Or use `Alt+Click` to place cursors manually.

### Slash Commands

(Coming soon)

Type `/` to open the command menu:

- `/h1`, `/h2`, `/h3`: Insert headings
- `/bullet`: Bullet list
- `/number`: Numbered list
- `/task`: Task list
- `/code`: Code block
- `/quote`: Blockquote

### Smart Paste

NoteCove intelligently handles pasted content:

- **Rich text**: Preserves formatting from other apps
- **Code**: Auto-detects code blocks
- **URLs**: Auto-converts to links
- **Images**: Embeds inline automatically

### Focus Mode

(Coming soon)

Distraction-free writing:

- Hide sidebar and toolbar
- Center text column
- Dim inactive paragraphs
- Full-screen mode

## CRDT-Powered Editing

NoteCove's editor is built on CRDTs (Conflict-free Replicated Data Types):

- **Real-time sync**: Changes appear instantly in other windows
- **Conflict-free**: Multiple people can edit simultaneously
- **Offline-capable**: Edits sync when connection is restored
- **Guaranteed convergence**: All devices reach the same state

Learn more about [sync mechanism](/architecture/sync-mechanism).

## Performance

NoteCove is optimized for large documents:

- Fast rendering with virtual scrolling
- Efficient CRDT operations
- Incremental sync updates
- Lazy loading of large notes

Tested with notes containing 100,000+ words.

## Accessibility

NoteCove follows accessibility best practices:

- Keyboard navigation
- Screen reader support
- High contrast mode
- Customizable font sizes
- Focus indicators

## Next Steps

- [Learn organization features](/features/folders-organization)
- [Understand sync mechanism](/architecture/sync-mechanism)
- [View keyboard shortcuts](/guide/keyboard-shortcuts)
