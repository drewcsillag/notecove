# Import Markdown Tree Feature - Implementation Plan

**Overall Progress:** `100%` ✅ (All phases complete)

**Branch:** `import-markdown-tree`

**Related Files:**

- [QUESTIONS-1.md](./QUESTIONS-1.md) - Initial questions and answers
- [QUESTIONS-2.md](./QUESTIONS-2.md) - Follow-up questions and answers
- [PLAN-CRITIQUE.md](./PLAN-CRITIQUE.md) - Plan critique and revisions

---

## Summary of Requirements

### Feature 1: Import Markdown Files

- Import single `.md` file or entire folder (recursive)
- Option to preserve folder hierarchy or flatten
- Option to create container folder named after imported directory
- User picks target folder in NoteCove
- Title derived from first H1 heading (filename as fallback), **H1 kept in content**
- Full markdown support (headings, lists, checkboxes, tables, images, code blocks, blockquotes, horizontal rules)
- Images imported into NoteCove's storage
- Duplicates auto-renamed
- Inter-note links converted to NoteCove format (two-pass approach)
- Accessible via File menu only
- Import dialog appears in focused window
- Cancel support: already-imported notes remain
- Progress indicator for large imports

### Feature 2: Welcome Note from Markdown

- Welcome note content loaded from bundled markdown file
- Full markdown support
- Current content preserved for now
- Current behavior maintained (only created if no notes exist)
- English only

---

## Technical Approach

### Markdown → ProseMirror Conversion

**Implemented approach:** Markdown → ProseMirror JSON → Y.XmlFragment (direct conversion)

```
Markdown (string)
    ↓ markdown-it library (with GFM tables/strikethrough)
markdown-it tokens
    ↓ custom converter (markdown-to-prosemirror.ts)
ProseMirror JSON
    ↓ custom converter (prosemirror-to-yjs.ts)
Y.XmlFragment
```

We chose direct conversion over HTML intermediate because:

1. More control over the exact ProseMirror node structure
2. No DOM dependency - works in Node.js (main process)
3. Easier to handle custom node types (taskItem, etc.)

**Files created:**

- `packages/shared/src/markdown/markdown-to-prosemirror.ts` - Converts markdown string to ProseMirror JSON
- `packages/shared/src/markdown/prosemirror-to-yjs.ts` - Converts ProseMirror JSON to Y.XmlFragment
- `packages/shared/src/markdown/index.ts` - Module exports

---

## Tasks

### Phase 1: Minimal Parser + Welcome Note (Quick Win) ✅ COMPLETE

- [x] ✅ **1.1: Research and validate approach**
  - [x] ✅ Tested `markdown-it` library for markdown parsing (chose over `marked` for better GFM support)
  - [x] ✅ Implemented direct ProseMirror JSON conversion (no HTML intermediate needed)
  - [x] ✅ Verified output is compatible with Y.XmlFragment conversion
  - [x] ✅ Documented approach in this file

- [x] ✅ **1.2: Implement markdown-to-prosemirror**
  - [x] ✅ Added `markdown-it` dependency to shared package
  - [x] ✅ Wrote comprehensive tests (22 test cases covering all features)
  - [x] ✅ Implemented `markdownToProsemirror()` function
  - [x] ✅ Implemented `prosemirrorJsonToYXmlFragment()` helper

- [x] ✅ **1.3: Create welcome note markdown file**
  - [x] ✅ Created `packages/desktop/resources/welcome.md`
  - [x] ✅ electron-builder already configured to include resources directory
  - [x] ✅ Added `getResourcePath()` and `populateWelcomeContent()` utilities in index.ts

- [x] ✅ **1.4: Update welcome note creation**
  - [x] ✅ Unit tests for markdown conversion pass (788 tests total)
  - [x] ✅ Modified `ensureDefaultNote()` to read and parse `welcome.md`
  - [x] ✅ Converted parsed content to Y.XmlFragment via `populateWelcomeContent()`
  - [x] ✅ Desktop package builds successfully

### Phase 2: Extended Parser Features ✅ COMPLETE

All extended parser features were implemented as part of Phase 1 (the parser supports all features from the start).

- [x] ✅ **2.1: List support**
  - [x] ✅ Bullet lists - tested and working
  - [x] ✅ Ordered lists - tested and working
  - [x] ✅ Task lists (checkboxes) - tested and working, converts to `taskItem` nodes

- [x] ✅ **2.2: Code support**
  - [x] ✅ Inline code - tested and working
  - [x] ✅ Code blocks with language - tested and working

- [x] ✅ **2.3: Table support**
  - [x] ✅ Markdown tables - tested and working
  - [x] ✅ Converts to `table`/`tableRow`/`tableCell`/`tableHeader` nodes
  - [x] ✅ Alignment (left, center, right) - implemented via `extractCellAlignment()` parsing style attributes

- [x] ✅ **2.4: Other block elements**
  - [x] ✅ Blockquotes - tested and working
  - [x] ✅ Horizontal rules - tested and working
  - [x] ✅ Nested blockquotes - supported

- [x] ✅ **2.5: Image reference extraction**
  - [x] ✅ Images detected and converted to `importImage` placeholder nodes
  - [x] ✅ Full image import implemented in Phase 3.6

### Phase 3: Import Backend (Main Process) ✅ COMPLETE

- [x] ✅ **3.1: File scanner utility**
  - [x] ✅ Write tests for file scanning (20 test cases)
  - [x] ✅ Implement recursive `.md` file discovery
  - [x] ✅ Build tree structure with relative paths
  - [x] ✅ Skip hidden files, node_modules, .git directories
  - [x] ✅ Extract H1 for title (filename fallback)

- [x] ✅ **3.2: Import service core**
  - [x] ✅ Implement `ImportService` class
  - [x] ✅ Handle single file import
  - [x] ✅ Handle folder import with hierarchy preservation
  - [x] ✅ Handle folder import with flatten option
  - [x] ✅ Handle container folder creation option

- [x] ✅ **3.3: Folder creation**
  - [x] ✅ Create NoteCove folders matching source hierarchy
  - [x] ✅ Handle nested folder creation order (parent before child)
  - [x] ✅ Handle duplicate folder names (auto-rename)

- [x] ✅ **3.4: Note creation**
  - [x] ✅ Parse markdown content
  - [x] ✅ Create note with parsed Y.XmlFragment content
  - [x] ✅ Set title from H1 (or filename)

- [x] ✅ **3.5: Duplicate handling**
  - [x] ✅ Check existing notes in target folder
  - [x] ✅ Auto-rename with suffix (e.g., "notes (2)")
  - [x] ✅ Skip option for duplicates

- [x] ✅ **3.6: Image import**
  - [x] ✅ `extractImageReferences()` extracts image paths from markdown
  - [x] ✅ Images converted to `importImage` placeholder nodes with sourcePath
  - [x] ✅ `resolveImportImages()` converts placeholders to `notecoveImage` nodes
  - [x] ✅ `liftImagesToBlockLevel()` positions images correctly in document
  - [x] ✅ Images copied to SD media directory during import
  - [x] ✅ References updated to use `notecove://` protocol

- [x] ✅ **3.7: Inter-note link resolution**
  - [x] ✅ `extractLinkReferences()` extracts .md file links from markdown
  - [x] ✅ `convertLinksToImportMarkers()` creates `[[import:path|text]]` markers
  - [x] ✅ `resolveImportLinkMarkers()` converts markers to `note://` links
  - [x] ✅ Two-pass import: pre-assign note IDs, then resolve links after all notes created

- [x] ✅ **3.8: IPC handlers**
  - [x] ✅ `import:selectSource` - Open file/folder picker (focused window)
  - [x] ✅ `import:scanSource` - Scan and return file count/tree
  - [x] ✅ `import:execute` - Execute import with options and progress callback
  - [x] ✅ `import:cancel` - Cancel in-progress import
  - [x] ✅ Progress broadcasting via `import:progress` event

### Phase 4: Import Frontend (Renderer Process) ✅ COMPLETE

- [x] ✅ **4.1: Import Dialog component**
  - [x] ✅ Create `ImportDialog.tsx` component with multi-step flow
  - [x] ✅ Source display with file count
  - [x] ✅ Target folder dropdown (from NoteCove folders)
  - [x] ✅ "Preserve folder structure" checkbox
  - [x] ✅ "Create [name] folder" checkbox (dynamic name from source)
  - [x] ✅ Cancel / Import buttons
  - [x] ✅ Dialog opens in focused window

- [x] ✅ **4.2: Progress dialog**
  - [x] ✅ Progress bar with "Importing X of Y"
  - [x] ✅ Current file name display
  - [x] ✅ Cancel button
  - [x] ✅ Handle cancel gracefully

- [x] ✅ **4.3: Completion handling**
  - [x] ✅ Success message with count
  - [x] ✅ Error summary if any failures
  - [x] ✅ Navigate to imported folder/note via `onImportComplete` callback

- [x] ✅ **4.4: File menu integration**
  - [x] ✅ Add "Import Markdown..." menu item (Cmd/Ctrl+Shift+I)
  - [x] ✅ Wire up menu to open import dialog
  - [x] ✅ Menu triggers in focused window context

### Phase 5: Testing & Polish

- [x] ✅ **5.1: Unit test coverage**
  - [x] ✅ Ensure all parser functions have tests (22 test cases in markdown-to-prosemirror.test.ts)
  - [x] ✅ Ensure import service has tests (20 test cases in file-scanner.test.ts)
  - [x] ✅ Edge case coverage

- [x] ✅ **5.2: E2E tests**
  - [x] ✅ Import single markdown file
  - [x] ✅ Import folder with hierarchy (3 files, folder structure preserved)
  - [x] ✅ Preserve folder structure when importing (nested folders)
  - [x] ✅ Cancel import operation
  - [x] ✅ Handle dialog cancellation gracefully
  - [x] ✅ Import with images (verifies image appears with imageId)
  - [x] ✅ Import with inter-note links (verifies [[noteId]] links navigate correctly)

- [x] ✅ **5.3: Edge cases** (all handled by existing implementation)
  - [x] ✅ Empty folder handling (skipped during scan - test "excludes empty folders from tree")
  - [x] ✅ Invalid/malformed markdown (markdown-it handles gracefully, never crashes)
  - [x] ✅ Missing referenced images (warning logged, import continues)
  - [x] ✅ Permission errors (caught by try/catch blocks in import-service)
  - [x] ✅ Very large imports (progress reporting, cancel support in place)

- [x] ✅ **5.4: Documentation**
  - [x] ✅ Update website docs with import feature
  - [x] ✅ Code is self-documenting with clear function names and types

---

## File Structure

```
packages/
├── shared/src/
│   └── markdown/
│       ├── markdown-to-prosemirror.ts   # ✅ Markdown → ProseMirror JSON
│       ├── prosemirror-to-yjs.ts        # ✅ ProseMirror JSON → Y.XmlFragment
│       ├── index.ts                     # ✅ Module exports
│       └── __tests__/
│           ├── markdown-to-prosemirror.test.ts  # ✅ 22 test cases
│           └── prosemirror-to-yjs.test.ts       # ✅ Y.XmlFragment tests
├── desktop/
│   ├── resources/
│   │   └── welcome.md                   # ✅ Bundled welcome note
│   └── src/
│       ├── main/
│       │   ├── index.ts                 # ✅ Updated with populateWelcomeContent()
│       │   ├── ipc/handlers.ts          # ✅ Import IPC handlers added
│       │   └── import/                  # ✅ Phase 3 complete
│       │       ├── types.ts             # ✅ Type definitions
│       │       ├── file-scanner.ts      # ✅ File scanning utilities
│       │       ├── import-service.ts    # ✅ Import orchestration
│       │       ├── index.ts             # ✅ Module exports
│       │       └── __tests__/
│       │           └── file-scanner.test.ts  # ✅ 20 test cases
│       └── renderer/src/
│           └── components/
│               └── ImportDialog/        # ✅ Phase 4 complete
│                   ├── ImportDialog.tsx # ✅ Multi-step dialog component
│                   └── index.ts         # ✅ Module export
│   └── e2e/
│       └── markdown-import.spec.ts      # ✅ 5 E2E test cases
```

---

## Import Dialog Mockup

```
┌─────────────────────────────────────────────────┐
│  Import Markdown                            [X] │
├─────────────────────────────────────────────────┤
│                                                 │
│  Source: /Users/me/docs/                        │
│          15 markdown files found                │
│                                                 │
│  Import into: [All Notes          ▼]            │
│                                                 │
│  ☑ Preserve folder structure                    │
│  ☐ Create "docs" folder for imported files      │
│                                                 │
│                    [Cancel]  [Import]           │
└─────────────────────────────────────────────────┘
```

---

## Data Flow

```
1. User: File → Import Markdown...
2. Main: dialog.showOpenDialog() in focused window
3. User: Selects file or folder
4. Main: Scan source, count files, extract tree
5. Renderer: Show ImportDialog with options
6. User: Configure options, click Import
7. Main: Execute import with progress callbacks
   - Create folders (if preserving structure)
   - Pass 1: Create notes, build path→id map
   - Pass 2: Resolve inter-note links
   - Import images
8. Renderer: Show progress, handle cancel
9. Main: Return results
10. Renderer: Show completion, navigate to results
```

---

## Dependencies

**New (added):**

- `markdown-it` - Markdown parsing (with GFM tables and strikethrough enabled)

**Existing (already in project):**

- `yjs` - CRDT
- `@tiptap/*` - Editor
- MUI components - Dialog UI

---

## Risk Assessment

| Risk                            | Likelihood | Impact | Mitigation                                        |
| ------------------------------- | ---------- | ------ | ------------------------------------------------- |
| HTML→TipTap conversion issues   | Medium     | High   | Test early in Phase 1.1, have remark fallback     |
| Custom nodes not recognized     | Medium     | High   | Ensure TipTap extensions loaded during conversion |
| Large imports slow              | Medium     | Medium | Progress indicator, async chunked processing      |
| Y.XmlFragment conversion issues | Medium     | High   | Test with welcome note first (Phase 1.4)          |
| Dialog in wrong window          | Low        | Medium | Explicit BrowserWindow.getFocusedWindow()         |
| CRDT sync with many updates     | Low        | Medium | Batch updates, test multi-instance                |
