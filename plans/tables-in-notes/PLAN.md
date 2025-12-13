# Tables in Notes - Implementation Plan

**Overall Progress:** `11%` (Phase 1 complete)

**Branch:** `tables-in-notes`

## Summary of Decisions

| Decision          | Choice                                                                 |
| ----------------- | ---------------------------------------------------------------------- |
| Implementation    | Hybrid (TipTap official extensions + customizations)                   |
| Core features     | All: headers, dynamic columns, full keyboard nav                       |
| Advanced features | Column resizing, cell/column alignment                                 |
| Insertion         | Toolbar button, Markdown syntax                                        |
| Size limits       | 2×2 min, 20 cols max, 1000 rows max, 3×3 default                       |
| Size enforcement  | UI/commands enforce; paste allows larger with warning                  |
| Cell content      | Plain text, rich text, hashtags, inter-note links                      |
| Nesting           | **None** - tables cannot be inside blockquotes, lists, or other tables |
| Header toggle     | TipTap default (convert first row between th/td)                       |
| UI                | Main toolbar changes when cursor in table                              |
| Styling           | Bordered, subtle header bg, row hover, cell selection                  |
| Copy/paste        | Convert pasted tables, output HTML + Markdown                          |
| Export            | Markdown `\|` syntax                                                   |
| Shortcuts         | Cmd+Enter (row), Cmd+Shift+Enter (col), etc.                           |
| Empty tables      | Auto-delete                                                            |
| Accessibility     | Yes (v1 priority)                                                      |

See [QUESTIONS-1.md](./QUESTIONS-1.md) and [QUESTIONS-PLAN-1.md](./QUESTIONS-PLAN-1.md) for full discussion.

---

## Phase 1: Foundation

**Status:** 🟩 Done
**Progress:** `100%`

Install TipTap table extensions, get basic rendering working, and validate Yjs compatibility early.

### Tasks

- [x] 🟩 **1.1 Install TipTap table dependencies**
  - [x] 🟩 Add `@tiptap/extension-table` to package.json
  - [x] 🟩 Add `@tiptap/extension-table-row` to package.json
  - [x] 🟩 Add `@tiptap/extension-table-header` to package.json
  - [x] 🟩 Add `@tiptap/extension-table-cell` to package.json
  - [x] 🟩 Run `pnpm install`

- [x] 🟩 **1.2 Create Table extension wrapper**
  - [x] 🟩 Write test: Table extension registers correctly (26 tests)
  - [x] 🟩 Create `extensions/Table.ts` that wraps TipTap Table
  - [x] 🟩 Configure with keyboard shortcuts (Mod+Enter, etc.)
  - [x] 🟩 Export helper functions (isValidTableSize, getTableDimensions)

- [x] 🟩 **1.3 Register extensions in TipTapEditor**
  - [x] 🟩 Write test: Table node can be created and serialized
  - [x] 🟩 Import and register Table, TableRow, TableHeader, TableCell
  - [x] 🟩 Verify basic table renders in editor

- [x] 🟩 **1.4 Yjs compatibility testing (CRITICAL)**
  - [x] 🟩 Write test: Table operations work with Yjs collaboration
  - [x] 🟩 Write test: Undo/redo works with tables
  - [x] 🟩 Write test: Cross-editor sync works for tables
  - [x] 🟩 All tests pass - Yjs compatible!

- [x] 🟩 **1.5 Basic CSS styling**
  - [x] 🟩 Add table styles to TipTapEditor sx prop
  - [x] 🟩 Bordered cells with theme-aware colors
  - [x] 🟩 Header row background (subtle gray)
  - [x] 🟩 Basic cell padding and alignment
  - [x] 🟩 Cell selection highlighting (`.selectedCell` class)
  - [x] 🟩 Column resize handle styling

- [x] 🟩 **1.6 Debug tooling**
  - [x] 🟩 Console logging for table operations (keyboard shortcuts)
  - [x] 🟩 DEBUG flag for development mode

**Outputs:** Tables render correctly, work with Yjs, and are debuggable.

### Files Created/Modified

- `packages/desktop/package.json` - Added 4 TipTap table dependencies
- `packages/desktop/src/renderer/src/components/EditorPanel/extensions/Table.ts` - New extension
- `packages/desktop/src/renderer/src/components/EditorPanel/extensions/__tests__/Table.test.ts` - 26 tests
- `packages/desktop/src/renderer/src/components/EditorPanel/TipTapEditor.tsx` - Registered extensions, added CSS

---

## Phase 2: Toolbar & Insertion UI

**Status:** 🟥 To Do
**Progress:** `0%`

Add UI for creating tables and manipulating them.

### Tasks

- [ ] 🟥 **2.1 Table insertion button**
  - [ ] 🟥 Write test: Insert table button appears in toolbar
  - [ ] 🟥 Add table icon button to EditorToolbar.tsx
  - [ ] 🟥 Position between horizontal rule and undo/redo

- [ ] 🟥 **2.2 Table size picker dialog**
  - [ ] 🟥 Write test: Size picker shows grid, selection works
  - [ ] 🟥 Create TableSizePickerDialog component
  - [ ] 🟥 Grid-based selection (hover to preview size)
  - [ ] 🟥 Default 3×3, max preview 10×10
  - [ ] 🟥 Enforce min 2×2 in UI
  - [ ] 🟥 Insert table on click

- [ ] 🟥 **2.3 Table manipulation toolbar**
  - [ ] 🟥 Write test: Table toolbar appears when cursor in table
  - [ ] 🟥 Detect when editor selection is inside table
  - [ ] 🟥 Show additional toolbar buttons:
    - Add row above/below
    - Add column left/right
    - Delete row/column
    - Delete table
    - Toggle header row (converts first row th↔td)
    - Toggle header column

- [ ] 🟥 **2.4 Implement table commands**
  - [ ] 🟥 Write tests for each command
  - [ ] 🟥 Wire up all toolbar buttons to TipTap table commands
  - [ ] 🟥 Enforce size limits in commands (max 20 cols, max 1000 rows)
  - [ ] 🟥 Verify each operation works correctly

**Outputs:** Users can insert tables via toolbar and manipulate structure.

---

## Phase 3: Markdown Input Rule

**Status:** 🟥 To Do
**Progress:** `0%`

Support creating tables via Markdown syntax.

### Tasks

- [ ] 🟥 **3.1 Markdown table input rule**
  - [ ] 🟥 Write test: `| col1 | col2 |` + Enter converts to table
  - [ ] 🟥 Create input rule for pipe-separated header row
  - [ ] 🟥 Detect `|---|---|` separator line
  - [ ] 🟥 Convert markdown table syntax to table node

- [ ] 🟥 **3.2 Handle multi-row markdown tables**
  - [ ] 🟥 Write test: Pasting multi-row markdown creates full table
  - [ ] 🟥 Parse multiple rows of pipe-separated content
  - [ ] 🟥 Respect column alignment markers (`:---`, `:---:`, `---:`)

**Outputs:** Users can type or paste Markdown tables.

---

## Phase 4: Keyboard Navigation & Shortcuts

**Status:** 🟥 To Do
**Progress:** `0%`

Full keyboard support for table navigation and manipulation.

### Tasks

- [ ] 🟥 **4.1 Cell navigation**
  - [ ] 🟥 Write test: Tab moves to next cell, wraps to next row
  - [ ] 🟥 Write test: Shift+Tab moves backwards
  - [ ] 🟥 Write test: Arrow keys navigate between cells
  - [ ] 🟥 Configure TipTap table navigation (verify built-in behavior)
  - [ ] 🟥 Tab at last cell creates new row

- [ ] 🟥 **4.2 Table manipulation shortcuts**
  - [ ] 🟥 Write test: Cmd+Enter adds row below
  - [ ] 🟥 Write test: Cmd+Shift+Enter adds column right
  - [ ] 🟥 Write test: Cmd+Backspace deletes row
  - [ ] 🟥 Write test: Cmd+Shift+Backspace deletes column
  - [ ] 🟥 Add keyboard shortcuts in Table extension

- [ ] 🟥 **4.3 Empty table auto-deletion**
  - [ ] 🟥 Write test: Deleting all content removes table
  - [ ] 🟥 Detect when table becomes empty
  - [ ] 🟥 Auto-remove empty table node

**Outputs:** Full keyboard-driven table editing.

---

## Phase 5: Interactions & Visual Polish

**Status:** 🟥 To Do
**Progress:** `0%`

Column resizing, alignment, and selection polish.

### Tasks

- [ ] 🟥 **5.1 Column resizing**
  - [ ] 🟥 Write test: Dragging column border resizes
  - [ ] 🟥 Enable TipTap table resizing feature
  - [ ] 🟥 Add resize handles styling
  - [ ] 🟥 Persist column widths in node attributes

- [ ] 🟥 **5.2 Cell text alignment**
  - [ ] 🟥 Write test: Cell alignment can be set and persists
  - [ ] 🟥 Add alignment attribute to TableCell
  - [ ] 🟥 Add alignment buttons to table toolbar (from Phase 2)
  - [ ] 🟥 Style cells based on alignment attribute

- [ ] 🟥 **5.3 Column-level alignment**
  - [ ] 🟥 Write test: Setting column alignment affects all cells
  - [ ] 🟥 Add "apply to column" option
  - [ ] 🟥 Update all cells in column when set

- [ ] 🟥 **5.4 Multi-cell selection**
  - [ ] 🟥 Write test: Shift+click selects multiple cells
  - [ ] 🟥 Verify operations work on multi-cell selection

- [ ] 🟥 **5.5 Row hover highlight**
  - [ ] 🟥 Add row hover CSS
  - [ ] 🟥 Subtle background on hover

- [ ] 🟥 **5.6 Table focus indicator**
  - [ ] 🟥 Write test: Table has outline when focused
  - [ ] 🟥 Add focus styles to table wrapper

**Outputs:** Polished interactions with resizing and alignment.

---

## Phase 6: Cell Content & Rich Text

**Status:** 🟥 To Do
**Progress:** `0%`

Ensure cells support rich content properly.

### Tasks

- [ ] 🟥 **6.1 Rich text in cells**
  - [ ] 🟥 Write test: Bold/italic/code work inside cells
  - [ ] 🟥 Verify marks apply correctly to cell content
  - [ ] 🟥 Verify web links work inside cells

- [ ] 🟥 **6.2 Hashtags in cells**
  - [ ] 🟥 Write test: #tags render and are clickable in cells
  - [ ] 🟥 Verify Hashtag extension works inside TableCell
  - [ ] 🟥 Test autocomplete popup positioning

- [ ] 🟥 **6.3 Inter-note links in cells**
  - [ ] 🟥 Write test: [[note-id]] renders and links work
  - [ ] 🟥 Verify InterNoteLink extension works inside TableCell
  - [ ] 🟥 Test navigation from cell link

**Outputs:** Full rich text support inside table cells.

---

## Phase 7: Copy/Paste

**Status:** 🟥 To Do
**Progress:** `0%`

Proper clipboard handling for tables.

### Tasks

- [ ] 🟥 **7.1 Paste HTML tables**
  - [ ] 🟥 Write test: Pasting `<table>` HTML creates NoteCove table
  - [ ] 🟥 Add paste handler in TipTapEditor
  - [ ] 🟥 Parse HTML table structure
  - [ ] 🟥 Convert to NoteCove table nodes
  - [ ] 🟥 Warn if pasted table exceeds size limits (>20 cols or >1000 rows)

- [ ] 🟥 **7.2 Paste tab-separated text**
  - [ ] 🟥 Write test: Pasting TSV creates table
  - [ ] 🟥 Detect tab-separated content on paste
  - [ ] 🟥 Convert to table when multiple columns detected

- [ ] 🟥 **7.3 Copy table to clipboard**
  - [ ] 🟥 Write test: Copying table produces HTML and text
  - [ ] 🟥 Serialize table as HTML for rich paste
  - [ ] 🟥 Serialize table as Markdown for plain text

- [ ] 🟥 **7.4 Copy cells/rows**
  - [ ] 🟥 Write test: Copying selection maintains table structure
  - [ ] 🟥 Handle partial table selection
  - [ ] 🟥 Paste partial selection correctly

**Outputs:** Seamless table copy/paste with external apps.

---

## Phase 8: Export & Accessibility

**Status:** 🟥 To Do
**Progress:** `0%`

Export tables properly and ensure accessibility.

### Tasks

- [ ] 🟥 **8.1 Markdown export**
  - [ ] 🟥 Write test: Table exports as pipe-syntax Markdown
  - [ ] 🟥 Implement table → Markdown serialization
  - [ ] 🟥 Include alignment markers (`:---`, `:---:`, `---:`)

- [ ] 🟥 **8.2 HTML export**
  - [ ] 🟥 Write test: Table exports as valid HTML
  - [ ] 🟥 Verify renderHTML produces correct structure

- [ ] 🟥 **8.3 Semantic HTML**
  - [ ] 🟥 Verify table renders as proper `<table>` element
  - [ ] 🟥 Use `<thead>`, `<tbody>` structure
  - [ ] 🟥 Use `<th>` for header cells with `scope` attribute

- [ ] 🟥 **8.4 ARIA attributes**
  - [ ] 🟥 Add `role="grid"` for interactive tables
  - [ ] 🟥 Add `aria-rowcount`, `aria-colcount`
  - [ ] 🟥 Add `aria-selected` for selected cells

- [ ] 🟥 **8.5 Keyboard accessibility**
  - [ ] 🟥 Verify all operations accessible via keyboard
  - [ ] 🟥 Add focus management for toolbar

**Outputs:** Accessible tables with clean export.

---

## Phase 9: Testing & Polish

**Status:** 🟥 To Do
**Progress:** `0%`

Comprehensive testing and edge cases.

### Tasks

- [ ] 🟥 **9.1 Unit test coverage**
  - [ ] 🟥 Extension tests (schema, commands, attributes)
  - [ ] 🟥 Component tests (toolbar, dialogs)
  - [ ] 🟥 Aim for >80% coverage on new code

- [ ] 🟥 **9.2 Integration tests**
  - [ ] 🟥 Additional Yjs collaboration scenarios
  - [ ] 🟥 Complex undo/redo sequences
  - [ ] 🟥 Cross-window sync edge cases

- [ ] 🟥 **9.3 Edge cases**
  - [ ] 🟥 Very wide tables (horizontal scroll behavior)
  - [ ] 🟥 Very tall tables (performance testing)
  - [ ] 🟥 Empty cells handling
  - [ ] 🟥 Single-row and single-column tables
  - [ ] 🟥 Rapid operations (stress testing)

- [ ] 🟥 **9.4 E2E tests**
  - [ ] 🟥 Add Playwright tests for table workflows
  - [ ] 🟥 Test insert → edit → delete cycle
  - [ ] 🟥 Test copy/paste from external apps

- [ ] 🟥 **9.5 Documentation**
  - [ ] 🟥 Update website docs with table feature
  - [ ] 🟥 Add keyboard shortcuts to help
  - [ ] 🟥 Add screenshots/examples

**Outputs:** Production-ready, well-tested feature.

---

## Dependencies

```
Phase 1 (Foundation + Yjs validation)
    │
    ├── Phase 2 (Toolbar/UI)
    ├── Phase 3 (Markdown)
    ├── Phase 4 (Keyboard)
    ├── Phase 5 (Interactions/Polish)
    ├── Phase 6 (Cell Content)
    ├── Phase 7 (Copy/Paste)
    └── Phase 8 (Export/Accessibility)
            │
            └── Phase 9 (Testing & Polish)
```

- **Phase 1 is critical** - validates Yjs compatibility before building features
- Phases 2-8 can mostly run in parallel after Phase 1
- Phase 5 builds on Phase 2's toolbar
- Phase 9 is final integration testing

---

## Risk Assessment

| Risk                                              | Impact   | Mitigation                                |
| ------------------------------------------------- | -------- | ----------------------------------------- |
| TipTap table extensions conflict with Yjs         | **High** | Test in Phase 1.4; have fallback plan     |
| Decorations (Hashtag/InterNoteLink) fail in cells | Medium   | Test explicitly in Phase 6                |
| Column resizing performance                       | Medium   | Debounce updates, test with large tables  |
| Markdown parsing edge cases                       | Medium   | Comprehensive tests in Phase 3            |
| Copy/paste compatibility                          | Medium   | Test with Excel, Google Sheets, web pages |
| Undo creates wrong granularity                    | Medium   | Test undo behavior in Phase 1.4           |
| Cell content overflow                             | Low      | CSS text handling, word-wrap              |
| Pasted tables exceed limits                       | Low      | Warn user, allow but flag                 |

---

## Files to Create/Modify

**New Files:**

- `packages/desktop/src/renderer/src/components/EditorPanel/extensions/Table.ts`
- `packages/desktop/src/renderer/src/components/EditorPanel/extensions/__tests__/Table.test.ts`
- `packages/desktop/src/renderer/src/components/EditorPanel/TableSizePickerDialog.tsx`
- `packages/desktop/src/renderer/src/components/EditorPanel/__tests__/TableSizePickerDialog.test.tsx`

**Modified Files:**

- `packages/desktop/package.json` (add dependencies)
- `packages/desktop/src/renderer/src/components/EditorPanel/TipTapEditor.tsx` (register extension, add styles)
- `packages/desktop/src/renderer/src/components/EditorPanel/EditorToolbar.tsx` (add table buttons)
