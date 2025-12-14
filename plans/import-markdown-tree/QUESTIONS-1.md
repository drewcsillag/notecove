# Questions for Import Markdown Tree Feature

## Feature 1: Import Markdown Files to Folder Structure

### 1. Import Source Scope

When importing a directory tree of markdown files:

- **Q1a**: Should the import dialog allow selecting a single `.md` file, or always require a folder selection?

Single imports are allowed also

- **Q1b**: If a folder is selected, should we import ALL `.md` files recursively, or only files at specific depths?

All, recursively

### 2. Folder Mapping Strategy

The user can select a folder like:

```
/Users/me/docs/
├── work/
│   ├── project1/
│   │   └── notes.md
│   └── ideas.md
├── personal/
│   └── journal.md
└── README.md
```

- **Q2a**: Should the import **create matching folders** in NoteCove (e.g., `work`, `work/project1`, `personal`)?
  yes
- **Q2b**: Or import all notes **flat** into a single target folder (no folder hierarchy)?
  no
- **Q2c**: Or should the user be given a **choice** at import time?
  yes

### 3. Target Destination

- **Q3a**: Should the user pick a **target folder** in NoteCove where notes get imported (e.g., "Import into folder X")?
  yes
- **Q3b**: Or always import into the **root** of the current Storage Directory?
  no
- **Q3c**: Should it create a **new parent folder** named after the imported directory (e.g., importing `docs/` creates folder called "docs")?
  Optionally

### 4. Note Title Derivation

- **Q4a**: Should note titles be derived from the **filename** (e.g., `notes.md` → "notes")?
- **Q4b**: Or from the **first H1 heading** in the markdown content (if present)?
- **Q4c**: Or filename first, with H1 as a fallback?
  Actually first H1, or filename if no H1

### 5. Markdown Content Conversion

The app uses TipTap/ProseMirror with a specific content structure. Markdown needs to be parsed into this format.

- **Q5a**: Should we use a well-tested library (like `marked`, `remark`, or `@tiptap/extension-markdown`)?
  yes

- **Q5b**: What markdown features must be supported?
  - Basic: headings, paragraphs, bold, italic, code, links ✓
  - Lists: bullet, numbered, checkboxes/task lists ✓
  - Code blocks with language syntax ✓
  - Tables (now supported in NoteCove) ✓
  - Images (local references need handling - see Q6)
  - Blockquotes ✓
  - Horizontal rules ✓
    Yes to all

### 6. Image Handling

If markdown files reference images (e.g., `![alt](./images/photo.png)`):

- **Q6a**: Should images be **imported** into NoteCove's image storage?
  yes
- **Q6b**: Should they be **skipped** with a warning?
- **Q6c**: Or converted to **placeholder references** that user can fix later?

### 7. Duplicate Handling

If a note with the same title already exists in the target folder:

- **Q7a**: **Skip** the duplicate with a warning?
- **Q7b**: **Rename** automatically (e.g., "notes (2).md")?
- **Q7c**: **Replace** existing content?
- **Q7d**: Ask the **user per conflict** (could be tedious for large imports)?

Rename

### 8. Inter-note Links

Markdown files might contain links like `[See also](other-note.md)`:

- **Q8a**: Should these be converted to **NoteCove inter-note links** (`[[note-id]]`)?
- **Q8b**: Or preserved as **regular web links** to the original path?
- **Q8c**: How should we handle links to `.md` files that aren't being imported?

If it's a note within the tree that we're importing (we'd have to see if it's there), turn it into a notecove inter-note link
There may be an interesting wrinkle if we have two notes that link to each other.

### 9. UI Location

Where should the import option be accessible?

- **Q9a**: File menu → "Import Markdown..." ?
- **Q9b**: Right-click on a folder → "Import Markdown Here..." ?
- **Q9c**: Both locations?

File menu only

---

## Feature 2: Welcome Note from Markdown File

### 10. Welcome Note Source Location

- **Q10a**: Should the welcome note markdown be **bundled with the app** (in resources)?
- **Q10b**: Or located in a **user-editable location** (e.g., `~/.notecove/welcome.md`)?
- **Q10c**: Or both (bundled default, user can override)?

bundled with the app

### 11. Welcome Note Content

- **Q11a**: Should the welcome markdown be **static text** only (no images, simple formatting)?
- **Q11b**: Or should it support **full markdown** including images, links, etc.?
- **Q11c**: What content should the welcome note contain? (Current: "Welcome to NoteCove! Open multiple windows to see real-time collaboration in action.")

Full markdown. For now it should have what it currently has. We can change what it contains later.

### 12. Welcome Note Updates

If we update the welcome.md in a new app version:

- **Q12a**: Should existing users see the **updated content**?
- **Q12b**: Or only new users / fresh installations?
- **Q12c**: Current behavior: welcome note is only created if no notes exist. Should we change this?

Current behavior.

### 13. Localization

- **Q13a**: Should welcome notes support **multiple languages**?
- **Q13b**: Or English-only for initial implementation?

## English only

## Implementation Considerations (for your awareness)

### Current Architecture

- Notes are stored as Yjs CRDT documents (Y.XmlFragment content)
- There's an existing `prosemirrorToMarkdown()` for **export**, but no **import** (markdown → ProseMirror) yet
- The welcome note is currently hardcoded in `index.ts` lines 633-640
- TipTap uses ProseMirror under the hood; there's a `@tiptap/extension-markdown` package that could help with parsing

### Suggested Libraries for Markdown Parsing

1. **@tiptap/extension-markdown** - Native TipTap integration, but may not support all features
2. **prosemirror-markdown** - Official ProseMirror markdown parser
3. **remark + remark-parse** - Powerful AST-based parsing, would need custom conversion to ProseMirror

---

## Summary of Key Decisions Needed:

| #   | Decision           | Default Recommendation                                |
| --- | ------------------ | ----------------------------------------------------- |
| Q2  | Folder hierarchy   | Create matching folders                               |
| Q3  | Target destination | User picks target folder + option to create container |
| Q4  | Title derivation   | Filename (H1 fallback)                                |
| Q5  | Markdown library   | @tiptap/extension-markdown or prosemirror-markdown    |
| Q6  | Image handling     | Import with relative path resolution                  |
| Q7  | Duplicates         | Auto-rename with warning                              |
| Q8  | Inter-note links   | Convert to NoteCove links where possible              |
| Q10 | Welcome location   | Bundled with app, simple markdown                     |
| Q11 | Welcome content    | Rich markdown supported                               |
