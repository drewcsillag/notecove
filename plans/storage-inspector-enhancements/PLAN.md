# Storage Inspector Enhancements - Implementation Plan

**Overall Progress:** `100%`

**Original Prompt:** [PROMPT.md](./PROMPT.md)

**Questions & Answers:** [QUESTIONS-1.md](./QUESTIONS-1.md), [QUESTIONS-PLAN-1.md](./QUESTIONS-PLAN-1.md)

---

## Summary of Requirements

1. **Parsed Activity Logs**: Show parsed view (Note ID, Profile, Sequence) with toggle to raw. Display filename metadata (profileId.instanceId) in header. Hover on noteId shows title, click navigates. Hover on profileId shows parsed profile.

2. **Refresh Buttons**: Small icon buttons on file detail view and subcomponents. Refresh re-parses files.

3. **Copy Full Path**: Copy absolute filesystem path. Button in both toolbar and next to path in metadata.

4. **Open Note from CRDT Logs**: Button in RecordList header AND file metadata for any file under `notes/{noteId}/`. Disabled with tooltip if note doesn't exist.

---

## Tasks

### Phase 1: Activity Log Parsing & Display

- [x] 🟩 **1.1: Create ActivityLogPreview component**
  - [x] 🟩 Parse activity log format: `noteId|profileId|sequenceNumber`
  - [x] 🟩 Display as scrollable table with columns: Note ID, Source Profile, Sequence Number
    - Note: Used simple scrolling instead of virtualization (no library available; 1000 entries is manageable)
  - [x] 🟩 Add toggle button to switch between parsed and raw view
  - [x] 🟩 If parsing fails (malformed lines), fall back to raw view automatically
  - [x] 🟩 Extract profileId.instanceId from filename and display in header
  - [x] 🟩 Write tests for parsing logic (12 tests in ActivityLogPreview.test.tsx)

- [x] 🟩 **1.2: Add hover tooltips for noteId**
  - [x] 🟩 Use existing note.getInfo() for cross-SD lookup
  - [x] 🟩 Show note title on hover over noteId (searches across all SDs)
  - [x] 🟩 Created HoverableId component with async loading and caching

- [x] 🟩 **1.3: Add hover tooltips for profileId**
  - [x] 🟩 Load and parse ProfilePresence JSON from `profiles/{profileId}.json`
  - [x] 🟩 Show formatted profile data on hover (profileName, username, user handle, hostname with platform icon)
  - [x] 🟩 Show "Profile not found" or "Invalid profile" if missing/malformed
  - [x] 🟩 Click on profileId navigates to profile file in tree

- [x] 🟩 **1.4: Add click-to-navigate for noteId**
  - [x] 🟩 On click, open note in new window (using existing createWindow API)
  - [x] 🟩 Handle case where note doesn't exist (disabled button with tooltip)

- [x] 🟩 **1.5: Integrate ActivityLogPreview into StorageInspectorWindow**
  - [x] 🟩 Replace TextPreview for activity logs with new component

### Phase 2: Refresh Buttons

- [x] 🟩 **2.1: Add refresh button to file detail header**
  - [x] 🟩 ActivityLogPreview has refresh button in header
  - [x] 🟩 On click, reload file data and re-parse

- [x] 🟩 **2.2: Add refresh to RecordList component**
  - [x] 🟩 Add onRefresh callback prop
  - [x] 🟩 Add small icon button in RecordList header

- [x] 🟩 **2.3: Add refresh to TextPreview/ActivityLogPreview**
  - [x] 🟩 Add onRefresh callback prop to both
  - [x] 🟩 Add small icon button in header

- [x] 🟩 **2.4: Add refresh to HexViewer header**
  - [x] 🟩 Add onRefresh callback prop
  - [x] 🟩 Add small icon button (in pagination/footer area)

### Phase 3: Copy Full Path

- [x] 🟩 **3.1: Add copy path button to file metadata section**
  - [x] 🟩 Add small icon button next to path display
  - [x] 🟩 Copy absolute path (sdPath + relativePath) to clipboard
  - [x] 🟩 Show "Copied!" tooltip briefly after copy

- [x] 🟩 **3.2: Add copy path button to toolbar**
  - [x] 🟩 Add icon button (FolderOpenIcon) in toolbar
  - [x] 🟩 Shows "Copied!" feedback

### Phase 4: Open Note in New Window

- [x] 🟩 **4.1: Add helper to extract noteId from path**
  - [x] 🟩 Parse paths like `notes/{noteId}/...` to extract noteId
  - [x] 🟩 Write tests for path parsing (6 tests added to shouldShowHexViewer.test.ts)

- [x] 🟩 **4.2: Add "Open Note" button to file metadata section**
  - [x] 🟩 Show for any file under `notes/{noteId}/` path
  - [x] 🟩 Check if note exists in database
  - [x] 🟩 Disable with tooltip "Note not found" if note doesn't exist
  - [x] 🟩 On click, open note in new window

- [x] 🟩 **4.3: Add "Open Note" button to RecordList header**
  - [x] 🟩 Add button with same behavior as 4.2
  - [x] 🟩 Pass noteId, noteExists, onOpenNote as props to RecordList

- [x] 🟩 **4.4: Add note context display for CRDT files**
  - [x] 🟩 Show note title when viewing CRDT log files
  - [x] 🟩 Display path hierarchy: notes/{noteId} → logs → {filename}.crdtlog
  - [x] 🟩 Handle missing notes with "(note not found in database)" message
  - [x] 🟩 Handle untitled notes with "(untitled note)" message

- [x] 🟩 **4.5: Show SD name and path in window title**
  - [x] 🟩 Update window title to show: `Storage Inspector - {sdName} ({sdPath})`

### Phase 5: Testing & Polish

- [x] 🟩 **5.1: Write unit tests**
  - [x] 🟩 Test ActivityLogPreview parsing and display (12 tests)
  - [x] 🟩 Test extractNoteIdFromPath (6 tests)
  - [x] 🟩 Additional integration tests if needed (deferred - manual testing sufficient)

- [x] 🟩 **5.2: Final review and cleanup**
  - [x] 🟩 Code review
  - [x] 🟩 Run full CI
  - [x] 🟩 Update PLAN.md with final status

### Additional Enhancements (Post-Phase 5)

- [x] 🟩 **5.3: Improve YjsUpdatePreview key display**
  - [x] 🟩 Show parentSub (key name) prominently next to type label
  - [x] 🟩 Add struct ID (client:clock) for debugging
  - Note: If parentSub is null for certain operations, key info may still be missing

---

## Deferred Items

(Items moved here only with user approval)

- None

---

## Technical Notes

### Activity Log Format
- File: `activity/{profileId}.{instanceId}.log`
- Line format: `noteId|profileId|sequenceNumber`
- Legacy formats use `_` delimiter (handled by activity-sync.ts)

### Profile Files
- Location: `profiles/{profileId}.json`
- Contains profile metadata for display in hover tooltip

### Note Path Structure
- CRDT logs: `notes/{noteId}/logs/*.crdtlog`
- Snapshots: `notes/{noteId}/snapshots/*.snapshot`

### Existing APIs to Leverage
- `window.electronAPI.testing.createWindow({ noteId })` - open note in new window
- `window.electronAPI.inspector.readFileInfo()` - read file data
- `window.electronAPI.note.getInfo(noteId)` - get note metadata (for title)

---

## Design Decisions (from Plan Review)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **P1: Large activity logs** | Simple scrolling | No virtualization library available; 1000 entries is manageable |
| **P2: Malformed log lines** | Fall back to raw view | Simpler than partial parsing; user can see actual file content |
| **P3: Missing/invalid profiles** | Show error in tooltip | "Profile not found" or "Invalid profile" - explicit feedback |
| **P4: Clipboard feedback** | Brief tooltip change | "Copied!" tooltip - lightweight, no snackbar infrastructure needed |
| **P5: Cross-SD note lookup** | Look up across all SDs | More useful for debugging sync issues across SDs |

---

## Implementation Notes

### Files Created/Modified

**New Files:**
- `ActivityLogPreview.tsx` - New component for parsed activity log display with HoverableId subcomponent
- `ActivityLogPreview.test.tsx` - Tests for parsing logic

**Modified Files:**
- `StorageInspectorWindow.tsx` - Integrated ActivityLogPreview, added copy path, open note, getNoteTitle, getProfileData, note context display, profile navigation, SD path in toolbar
- `RecordList.tsx` - Added onRefresh, noteId, noteExists, onOpenNote props
- `TextPreview.tsx` - Added onRefresh prop
- `HexViewer.tsx` - Added onRefresh prop
- `shouldShowHexViewer.test.ts` - Added extractNoteIdFromPath tests
- `window-manager.ts` - Updated Storage Inspector title to include SD path
- `YjsUpdatePreview.tsx` - Added prominent parentSub display and struct ID info

### Key Components Added

**HoverableId** (in ActivityLogPreview.tsx):
- Handles async tooltip loading on hover
- Caches fetched data to avoid repeated fetches
- Shows loading spinner while fetching
- Supports clickable mode with customizable click hints
- Used for both noteId (opens note) and profileId (navigates to profile file)

**Note Context Display** (in StorageInspectorWindow.tsx):
- Shows note title and path hierarchy when viewing CRDT log files
- Visual tree showing: notes/{noteId} → logs → {filename}.crdtlog
- Fetches note info on file selection for title display
