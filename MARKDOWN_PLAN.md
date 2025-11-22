# Markdown Export Feature Plan

## Overview

Add the ability to export single or multiple notes to Markdown format via:

- Right-click context menu
- Main application menu bar (File menu)

## Requirements

### Export Options

1. **Single note export** - Right-click on a note, export to markdown
2. **Multi-note export** - Select multiple notes (Cmd/Ctrl+Click, Shift+Click), right-click, export all selected
3. **Export all notes** - From app menu, export entire SD with folder structure

### File Handling

- Pop up native file chooser for destination folder
- One `.md` file per note
- Filename: note title, sanitized (special chars → underscore), truncated at 40 chars
- Collision handling: append ` (2)`, ` (3)`, etc.

### Content Conversion

- Convert ProseMirror/TipTap content to Markdown
- Hashtags → `#tag`
- Inter-note links → `[[Title]]` (resolve note ID to title)
- Tri-state checkboxes → `[ ]` / `[x]` / `[-]`

### Export All Structure

- Only export from currently selected Storage Directory
- Skip "Recently Deleted" folder
- Skip empty notes (no content)
- Preserve folder hierarchy in export
- No duplicates: notes in folders don't also appear in root "All Notes" export

### UI

- Context menu: "Export to Markdown" option
- App menu bar: File → Export Selected Notes / Export All Notes
- Progress indicator dialog for large exports

---

## Implementation Plan

### Phase 1: Core Utilities

#### 1.1 Markdown Converter

**File:** `packages/desktop/src/renderer/src/utils/markdown-export.ts`

Convert ProseMirror JSON to Markdown string:

- Standard nodes: paragraph, heading (H1-H3), bulletList, orderedList, listItem, blockquote, codeBlock, horizontalRule
- Marks: bold (`**`), italic (`*`), underline (`<u>`), strikethrough (`~~`), code (`` ` ``)
- Custom nodes:
  - `hashtag` → `#tagname`
  - `interNoteLink` → `[[Note Title]]` (requires note ID → title lookup)
  - `triStateCheckbox` → `[ ]` / `[x]` / `[-]`

#### 1.2 Filename Utilities

**Same file:** `packages/desktop/src/renderer/src/utils/markdown-export.ts`

- `sanitizeFilename(title: string): string` - Replace special chars with `_`
- `truncateFilename(name: string, maxLength: number): string` - Truncate to 40 chars
- `resolveFilenameCollision(filename: string, existingNames: Set<string>): string` - Append ` (2)`, ` (3)`, etc.

### Phase 2: IPC Handlers

#### 2.1 Main Process Handlers

**File:** `packages/desktop/src/main/ipc/handlers.ts`

Add handlers:

- `export:selectDirectory` - Show native folder picker dialog, return selected path
- `export:writeFile` - Write string content to a file path
- `export:createDirectory` - Create directory (recursive) for nested folder structure
- `export:showCompletionMessage` - Show native dialog with export summary

#### 2.2 Preload Exposure

**File:** `packages/desktop/src/preload/index.ts`

Expose new IPC methods to renderer.

### Phase 3: Export Service

#### 3.1 Export Service

**File:** `packages/desktop/src/renderer/src/services/export-service.ts`

Functions:

- `exportNotes(notes: NoteInfo[], destinationPath: string, noteTitleLookup: Map<string, string>, onProgress: (current, total, noteName) => void): Promise<ExportResult>`
- `exportAllNotes(sdId: string, folders: Folder[], notes: NoteInfo[], destinationPath: string, noteTitleLookup: Map<string, string>, onProgress): Promise<ExportResult>`

Logic for "Export All":

1. Get all folders except "Recently Deleted"
2. Get all notes, group by folder
3. Create folder structure in destination
4. Export notes into appropriate folders
5. Notes without a folder (or in "All Notes" only) go to root
6. Track exported note IDs to avoid duplicates

### Phase 4: UI Components

#### 4.1 Progress Dialog

**File:** `packages/desktop/src/renderer/src/components/ExportProgressDialog/ExportProgressDialog.tsx`

- Modal dialog showing export progress
- Progress bar (x of y notes)
- Current note name being exported
- Cancel button to abort

#### 4.2 Context Menu Integration

**File:** `packages/desktop/src/renderer/src/components/NotesListPanel/NotesListPanel.tsx`

Add "Export to Markdown" menu item:

- Appears for normal folders (not Recently Deleted)
- Works with single or multi-selected notes
- Triggers folder picker → export → progress → completion

#### 4.3 App Menu Bar

**File:** `packages/desktop/src/main/menu.ts` (create or extend existing)

Add to File menu:

- "Export Selected Notes to Markdown..." (enabled when notes selected)
- "Export All Notes to Markdown..."

Wire IPC to communicate with renderer for export triggers.

### Phase 5: Integration & Polish

#### 5.1 Wire Everything Together

- Connect context menu to export service
- Connect app menu to export service via IPC
- Handle edge cases (no notes selected, empty SD, etc.)

#### 5.2 Error Handling

- Handle write permission errors
- Handle disk full scenarios
- Show meaningful error messages

---

## File Changes Summary

### New Files

- `packages/desktop/src/renderer/src/utils/markdown-export.ts`
- `packages/desktop/src/renderer/src/services/export-service.ts`
- `packages/desktop/src/renderer/src/components/ExportProgressDialog/ExportProgressDialog.tsx`
- `packages/desktop/src/main/menu.ts` (if doesn't exist)

### Modified Files

- `packages/desktop/src/main/ipc/handlers.ts` - Add export IPC handlers
- `packages/desktop/src/preload/index.ts` - Expose export methods
- `packages/desktop/src/renderer/src/components/NotesListPanel/NotesListPanel.tsx` - Add context menu item
- `packages/desktop/src/main/index.ts` - Wire up app menu

---

## Testing Plan

### Unit Tests

- Markdown converter: test each node type conversion
- Filename utilities: sanitization, truncation, collision resolution

### Integration Tests

- Export single note
- Export multiple notes
- Export all notes with folder structure
- Filename collision handling
- Empty note skipping
- Recently Deleted exclusion

### Manual Testing

- Verify markdown renders correctly in other apps (VS Code, Obsidian, etc.)
- Test with notes containing all formatting types
- Test with very long titles
- Test with special characters in titles
- Test large export (100+ notes) for performance
