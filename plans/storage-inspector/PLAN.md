# Storage Inspector - Implementation Plan

**Overall Progress:** `90%` (core functionality complete, E2E tests and docs deferred)

**Related Documents:**

- [QUESTIONS-1.md](./QUESTIONS-1.md) - Initial questions and answers
- [QUESTIONS-2.md](./QUESTIONS-2.md) - Follow-up questions and answers
- [PLAN-CRITIQUE.md](./PLAN-CRITIQUE.md) - Plan review and refinements

---

## Summary

A standalone, resizable window accessible from Tools menu that allows browsing and inspecting the contents of a Storage Directory (SD). Features a three-column hex viewer with bidirectional highlighting, color-coded field types, and parsed structure views. Supports CRDT logs, snapshots, activity logs, profile files, media (with image previews), and SD identity files.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Storage Inspector Window                      │
├─────────────┬───────────────────────────────────────────────────┤
│   Tree      │              Detail Panel                          │
│   Browser   │  ┌──────────────────────────────────────────────┐ │
│             │  │ Toolbar: Refresh | Copy | Export | [Debug]    │ │
│  ▼ notes/   │  ├──────────────────────────────────────────────┤ │
│    ▼ abc123 │  │ Hex View (three-column, paginated)            │ │
│      ▼ logs │  │ Offset   │ Hex               │ Structure      │ │
│        file1│  │ 00000000 │ 4E 43 4C 47 01... │ Magic: NCLG    │ │
│        file2│  │ 00000005 │ 8F 01...          │ Length: 143    │ │
│    ▼ snap.. │  │          [< Prev] Page 1/5 [Next >]           │ │
│  ▼ folders/ │  ├──────────────────────────────────────────────┤ │
│  ▼ activity/│  │ Record List (for multi-record files)          │ │
│  ▼ profiles/│  │ [Record 1] [Record 2] [Record 3] ...          │ │
│  ▼ media/   │  ├──────────────────────────────────────────────┤ │
│    SD_ID    │  │ Content Preview                                │ │
│    SD_VER   │  │ - XML view (TipTap format)                     │ │
│             │  │ - Yjs structure view                           │ │
│             │  │ - Image preview (for media)                    │ │
│             │  │ - Text view (for activity/profile files)       │ │
└─────────────┴──┴──────────────────────────────────────────────┴─┘
```

---

## Tasks

### Phase 1: Minimal End-to-End (Visual Feedback First)

- [x] 🟩 **1.1 Menu and Window Shell**
  - [x] 🟩 Add "Storage Inspector" menu item to Tools menu (no shortcut)
  - [x] 🟩 Create IPC handler for opening inspector window
  - [x] 🟩 Create `StorageInspectorWindow` route in App.tsx
  - [x] 🟩 Create basic window component (two-pane layout, placeholder content)
  - [x] 🟩 Add window state persistence (size, position) in electron-store

- [x] 🟩 **1.2 SD Selection Dialog**
  - [x] 🟩 Create IPC handler to list registered SDs (id, name, path) - uses existing sd.list()
  - [x] 🟩 Create SD picker dialog component
  - [x] 🟩 Show dialog when inspector opens
  - [x] 🟩 Handle SD selection → opens inspector window

### Phase 2: Data Layer (TDD)

- [x] 🟩 **2.1 StorageInspectorService - Tests First**
  - [x] 🟩 Write tests for `listSDContents()` - returns tree structure
  - [x] 🟩 Write tests for `readFileInfo()` - returns metadata + raw bytes
  - [x] 🟩 Write tests for error cases (missing files, permissions)

- [x] 🟩 **2.2 StorageInspectorService - Implementation**
  - [x] 🟩 Create `StorageInspectorService` class in main process
  - [x] 🟩 Implement `listSDContents(sdPath)` - walks SD directory
  - [x] 🟩 Implement `readFileInfo(sdPath, relativePath)` - reads file
  - [x] 🟩 Create IPC handlers for service methods

- [x] 🟩 **2.3 Binary Parser Utilities - Tests First**
  - [x] 🟩 Write tests for `parseCrdtLogWithOffsets()` - includes byte ranges
  - [x] 🟩 Write tests for `parseSnapshotWithOffsets()` - includes byte ranges
  - [x] 🟩 Write tests for partial/corrupt file handling

- [x] 🟩 **2.4 Binary Parser Utilities - Implementation**
  - [x] 🟩 Create `parseCrdtLogWithOffsets()` - extends existing parser
  - [x] 🟩 Create `parseSnapshotWithOffsets()` - extends existing parser
  - [ ] 🟥 Create `parseActivityLog()` - parse activity .log files (deferred)
  - [ ] 🟥 Create `parseProfilePresence()` - parse profile .json files (deferred)
  - [x] 🟩 Add error markers for partial/corrupt parses

### Phase 3: Tree Browser and Basic Display

- [x] 🟩 **3.1 Tree Browser Component**
  - [x] 🟩 Create `StorageTreeBrowser` component
  - [x] 🟩 Implement expandable tree structure (custom List + Collapse)
  - [x] 🟩 Add icons for different file/folder types
  - [x] 🟩 Wire to `listSDContents()` IPC call
  - [x] 🟩 Handle file selection → emit event

- [x] 🟩 **3.2 Basic File Display**
  - [x] 🟩 Create `FileDetailPanel` (integrated in StorageInspectorWindow)
  - [x] 🟩 Show file metadata (name, size, type, path)
  - [x] 🟩 Show raw bytes as simple hex dump (proof of concept)
  - [x] 🟩 Add loading state while fetching file

### Phase 4: Hex View (Core Feature)

- [x] 🟩 **4.1 Three-Column Hex Layout**
  - [x] 🟩 Create `HexViewer` component
  - [x] 🟩 Implement offset column (hex addresses)
  - [x] 🟩 Implement hex column (16 bytes per row)
  - [x] 🟩 Implement ASCII column (printable characters)
  - [ ] 🟥 Implement structure column (decoded field names) - needs Phase 2.3-2.4 parsers

- [x] 🟩 **4.2 Pagination**
  - [x] 🟩 Show 1000 rows per page (~16KB)
  - [x] 🟩 Add Prev/Next page buttons
  - [x] 🟩 Show current page and total pages
  - [x] 🟩 Handle page changes → update view

- [x] 🟩 **4.3 Color Coding**
  - [x] 🟩 Define color scheme for field types
  - [x] 🟩 Apply colors to hex bytes based on parsed structure
  - [x] 🟩 Wire parsers to hex viewer via IPC
  - [ ] 🟥 Add legend/tooltip explaining colors

- [x] 🟩 **4.4 Bidirectional Highlighting**
  - [x] 🟩 Click hex bytes → highlight field (if fields provided)
  - [x] 🟩 Visual feedback for selected region
  - [ ] 🟥 Click structure field → highlight hex bytes - needs structure panel

- [x] 🟩 **4.5 Record List for Multi-Record Files**
  - [x] 🟩 Create `RecordList` component
  - [x] 🟩 Show record metadata (index, timestamp, sequence, size)
  - [x] 🟩 Click record → jump to page + highlight bytes

### Phase 5: Content Previews

- [ ] 🟥 **5.1 XML Preview** (deferred - requires Yjs document reconstruction)
  - [ ] 🟥 Create `XmlPreview` component
  - [ ] 🟥 Parse Yjs document from update/snapshot
  - [ ] 🟥 Render as formatted TipTap-style XML

- [ ] 🟥 **5.2 Yjs Structure Preview** (deferred - requires Yjs document reconstruction)
  - [ ] 🟥 Create `YjsStructurePreview` component
  - [ ] 🟥 Show Yjs internal structure (XmlFragment tree)
  - [ ] 🟥 Display shared types, item counts

- [x] 🟩 **5.3 Image Preview**
  - [x] 🟩 Create `ImagePreview` component
  - [x] 🟩 Show image thumbnail
  - [x] 🟩 Show metadata (dimensions, format, file size)

- [x] 🟩 **5.4 Text Preview**
  - [x] 🟩 Create `TextPreview` component
  - [x] 🟩 Use for activity logs (plain text)
  - [x] 🟩 Use for profile files (formatted JSON)
  - [x] 🟩 Use for SD_ID, SD_VERSION files

### Phase 6: Toolbar and Actions

- [x] 🟩 **6.1 Toolbar Component**
  - [x] 🟩 Toolbar integrated in StorageInspectorWindow (not separate component)
  - [x] 🟩 Add Refresh button → reload current view
  - [x] 🟩 Add "Dump to Console" button (dev mode only)

- [x] 🟩 **6.2 Copy Actions**
  - [x] 🟩 Copy hex selection to clipboard
  - [x] 🟩 Copy parsed structure as JSON

- [x] 🟩 **6.3 Export Actions**
  - [x] 🟩 Export raw binary file (download)

### Phase 7: Polish and Testing

- [x] 🟩 **7.1 Error Handling**
  - [x] 🟩 Add React error boundary around inspector
  - [x] 🟩 Handle SD access errors (show dialog, allow retry) - built into component
  - [ ] 🟥 Show inline error markers for corrupt files (deferred)
  - [x] 🟩 Handle empty states (no notes, no logs) - shows empty tree

- [x] 🟩 **7.2 Loading States**
  - [x] 🟩 Add loading spinner for tree scan
  - [x] 🟩 Add loading state for file fetch
  - [ ] 🟥 Add skeleton for hex view while parsing (deferred)

- [ ] 🟥 **7.3 E2E Tests** (deferred - manual testing sufficient for dev tool)
  - [ ] 🟥 Test: Menu item opens window
  - [ ] 🟥 Test: SD selection dialog shows and works
  - [ ] 🟥 Test: Tree navigation and file selection
  - [ ] 🟥 Test: Hex view displays and paginates
  - [ ] 🟥 Test: Copy to clipboard works

- [ ] 🟥 **7.4 Documentation** (deferred - internal dev tool)
  - [ ] 🟥 Update website docs with Storage Inspector feature
  - [ ] 🟥 Add usage guide with screenshots

---

## Technical Notes

### Color Scheme for Hex View

```typescript
const FIELD_COLORS = {
  magic: '#4A90D9', // Blue - header magic bytes
  version: '#4A90D9', // Blue - version byte
  timestamp: '#50C878', // Green - timestamp fields
  sequence: '#00CED1', // Cyan - sequence numbers
  length: '#FFA500', // Orange - varint lengths
  data: 'inherit', // Default - payload data
  error: '#FF6B6B', // Red - parse errors
  vectorClock: '#DDA0DD', // Plum - vector clock entries
  status: '#FFD700', // Gold - status bytes
};
```

### File Type Detection

```typescript
type InspectorFileType =
  | 'crdtlog' // .crdtlog files
  | 'snapshot' // .snapshot files
  | 'activity' // activity/*.log files
  | 'profile' // profiles/*.json files
  | 'image' // media/* images
  | 'identity' // SD_ID, SD_VERSION
  | 'unknown';
```

### Pagination Constants

```typescript
const HEX_ROWS_PER_PAGE = 1000; // 1000 rows × 16 bytes = 16KB per page
const BYTES_PER_ROW = 16;
```

### Window State Storage Key

```typescript
// In electron-store
'windowState.storageInspector': {
  width: number;
  height: number;
  x?: number;
  y?: number;
}
```

### Parsed Structure with Byte Offsets

```typescript
interface ParsedField {
  name: string; // e.g., "Magic", "Timestamp"
  value: string | number; // Decoded value
  startOffset: number; // Byte offset in file
  endOffset: number; // End byte offset (exclusive)
  type: keyof typeof FIELD_COLORS;
  error?: string; // If parsing failed
}

interface ParsedFile {
  fields: ParsedField[];
  records?: ParsedRecord[]; // For multi-record files
  errors: string[]; // Any parse errors
}
```

---

## Dependencies

- Existing: `binary-format.ts`, `parseLogFile()`, `parseSnapshotFile()`
- Existing: `SyncDirectoryStructure` for path management
- Existing: MUI components (TreeView, Table, IconButton, etc.)
- Existing: react-resizable-panels for split layout
- New: None required

---

## Risk Assessment

| Risk                               | Likelihood | Impact | Mitigation                                          |
| ---------------------------------- | ---------- | ------ | --------------------------------------------------- |
| Large files cause lag              | Medium     | Medium | Paginate hex view (1000 rows/page)                  |
| Corrupt file parsing crashes       | Low        | High   | Wrap all parsing in try/catch, show partial results |
| Complex bidirectional highlighting | Medium     | Low    | Start simple, iterate on UX                         |
| SD path inaccessible               | Low        | Medium | Show error dialog, allow retry                      |

---

## Out of Scope (for this iteration)

- File comparison/diff view
- Auto-refresh on file changes
- Search within files
- Editing/modifying files
- Compressed (.zst) file support
- Tree virtualization (dev tool, assume reasonable scale)
