# Import Markdown Tree Feature - Implementation Plan

**Overall Progress:** `~25%` (Phase 1 complete, Phase 2 complete)

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
  - [ ] 🟥 Alignment (left, center, right) - not yet implemented

- [x] ✅ **2.4: Other block elements**
  - [x] ✅ Blockquotes - tested and working
  - [x] ✅ Horizontal rules - tested and working
  - [x] ✅ Nested blockquotes - supported

- [x] ✅ **2.5: Image reference extraction**
  - [x] ✅ Images detected and converted to placeholder text `[Image: alt]`
  - [ ] 🟥 Full image import (copy to storage, update references) - deferred to Phase 3

### Phase 3: Import Backend (Main Process)

- [ ] 🟥 **3.1: File scanner utility**
  - [ ] 🟥 Write tests for file scanning
  - [ ] 🟥 Implement recursive `.md` file discovery
  - [ ] 🟥 Build tree structure with relative paths
  - [ ] 🟥 Extract H1 for title (filename fallback)

- [ ] 🟥 **3.2: Import service core**
  - [ ] 🟥 Write tests for import service
  - [ ] 🟥 Implement `ImportService` class
  - [ ] 🟥 Handle single file import
  - [ ] 🟥 Handle folder import with hierarchy preservation
  - [ ] 🟥 Handle folder import with flatten option
  - [ ] 🟥 Handle container folder creation option

- [ ] 🟥 **3.3: Folder creation**
  - [ ] 🟥 Write tests for folder creation
  - [ ] 🟥 Create NoteCove folders matching source hierarchy
  - [ ] 🟥 Handle nested folder creation order

- [ ] 🟥 **3.4: Note creation**
  - [ ] 🟥 Write tests for note creation from markdown
  - [ ] 🟥 Parse markdown content
  - [ ] 🟥 Create note with parsed Y.XmlFragment content
  - [ ] 🟥 Set title from H1 (or filename)

- [ ] 🟥 **3.5: Duplicate handling**
  - [ ] 🟥 Write tests for duplicate detection
  - [ ] 🟥 Check existing notes in target folder
  - [ ] 🟥 Auto-rename with suffix (e.g., "notes (2)")

- [ ] 🟥 **3.6: Image import**
  - [ ] 🟥 Write tests for image import
  - [ ] 🟥 Resolve relative image paths from markdown location
  - [ ] 🟥 Copy images to NoteCove storage
  - [ ] 🟥 Update image references in content to NoteCove format

- [ ] 🟥 **3.7: Inter-note link resolution**
  - [ ] 🟥 Write tests for link resolution
  - [ ] 🟥 Pass 1: Create all notes, build `relativePath → noteId` map
  - [ ] 🟥 Pass 2: Update inter-note links using map
  - [ ] 🟥 Preserve links to non-imported files as regular links

- [ ] 🟥 **3.8: IPC handlers**
  - [ ] 🟥 `import:selectSource` - Open file/folder picker (focused window)
  - [ ] 🟥 `import:scanSource` - Scan and return file count/tree
  - [ ] 🟥 `import:getFolders` - Get NoteCove folders for target picker
  - [ ] 🟥 `import:execute` - Execute import with options and progress callback
  - [ ] 🟥 `import:cancel` - Cancel in-progress import

### Phase 4: Import Frontend (Renderer Process)

- [ ] 🟥 **4.1: Import Dialog component**
  - [ ] 🟥 Create `ImportDialog.tsx` component
  - [ ] 🟥 Source display with file count
  - [ ] 🟥 Target folder dropdown (from NoteCove folders)
  - [ ] 🟥 "Preserve folder structure" checkbox
  - [ ] 🟥 "Create [name] folder" checkbox (dynamic name from source)
  - [ ] 🟥 Cancel / Import buttons
  - [ ] 🟥 Ensure dialog opens in focused window

- [ ] 🟥 **4.2: Progress dialog**
  - [ ] 🟥 Progress bar with "Importing X of Y"
  - [ ] 🟥 Current file name display
  - [ ] 🟥 Cancel button
  - [ ] 🟥 Handle cancel gracefully

- [ ] 🟥 **4.3: Completion handling**
  - [ ] 🟥 Success message with count
  - [ ] 🟥 Error summary if any failures
  - [ ] 🟥 Navigate to imported folder/note

- [ ] 🟥 **4.4: File menu integration**
  - [ ] 🟥 Add "Import Markdown..." menu item
  - [ ] 🟥 Wire up menu to open file picker then dialog
  - [ ] 🟥 Ensure menu triggers in focused window context

### Phase 5: Testing & Polish

- [ ] 🟥 **5.1: Unit test coverage**
  - [ ] 🟥 Ensure all parser functions have tests
  - [ ] 🟥 Ensure import service has tests
  - [ ] 🟥 Edge case coverage

- [ ] 🟥 **5.2: E2E tests**
  - [ ] 🟥 Import single markdown file
  - [ ] 🟥 Import folder with hierarchy
  - [ ] 🟥 Import with images
  - [ ] 🟥 Import with inter-note links
  - [ ] 🟥 Cancel mid-import

- [ ] 🟥 **5.3: Edge cases**
  - [ ] 🟥 Empty folder handling
  - [ ] 🟥 Invalid/malformed markdown
  - [ ] 🟥 Missing referenced images (warning, continue)
  - [ ] 🟥 Permission errors
  - [ ] 🟥 Very large imports (100+ files)

- [ ] 🟥 **5.4: Documentation**
  - [ ] 🟥 Update website docs with import feature
  - [ ] 🟥 Add inline code comments where needed

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
│           └── markdown-to-prosemirror.test.ts  # ✅ 22 test cases
├── desktop/
│   ├── resources/
│   │   └── welcome.md                   # ✅ Bundled welcome note
│   └── src/
│       ├── main/
│       │   ├── index.ts                 # ✅ Updated with populateWelcomeContent()
│       │   └── import/                  # 🟥 TODO: Phase 3
│       │       ├── import-service.ts
│       │       ├── import-service.test.ts
│       │       ├── file-scanner.ts
│       │       └── file-scanner.test.ts
│       └── renderer/src/
│           └── components/
│               └── ImportDialog/        # 🟥 TODO: Phase 4
│                   ├── ImportDialog.tsx
│                   ├── ImportProgress.tsx
│                   └── index.ts
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
