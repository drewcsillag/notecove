# CRDT Architecture and Cross-Platform Sync

## Overview

NoteCove uses Yjs (Y CRDT) for conflict-free document synchronization between Desktop and iOS. This document explains how CRDT loading, title extraction, and cross-platform sync work.

## Architecture Differences: Desktop vs iOS

### Desktop (Electron + Node.js)

**Technology Stack:**

- Electron main process (Node.js)
- In-memory Yjs documents
- Direct file system access
- TipTap/ProseMirror editor (renderer process)

**Key Classes:**

- `CRDTManagerImpl` - Manages in-memory Y.Doc instances
- `NoteDoc` - Wrapper around Y.Doc for note-specific operations
- `UpdateManager` - Reads/writes CRDT update files
- `ActivitySync` - Cross-instance synchronization
- `ActivityLogger` - Records changes for other instances to discover

**File Location:** `packages/desktop/src/main/crdt/crdt-manager.ts`

### iOS (Swift + JavaScriptCore)

**Technology Stack:**

- Swift for app logic
- JavaScriptCore to run bundled JavaScript
- Shared TypeScript code compiled to single-file bundle
- Bridge pattern for Swift ↔ JavaScript communication

**Key Classes:**

- `CRDTBridge` (Swift) - Manages JavaScriptCore context
- `NoteCoveBridge` (JS) - Global object exposed to Swift
- `FileChangeProcessor` (Swift) - Discovers and processes new notes
- `ActivityWatcher` (Swift) - Monitors activity logs for changes

**File Locations:**

- Swift bridge: `packages/ios/Sources/CRDT/CRDTBridge.swift`
- JavaScript bridge: `packages/shared/src/ios-bridge.ts`
- File processor: `packages/ios/Sources/Storage/FileChangeProcessor.swift`

## CRDT Document Structure

### Fragment Names

Both platforms use the **'content' fragment** for note content:

```typescript
const fragment = doc.getXmlFragment('content');
```

⚠️ **Important:** Early code used 'default' fragment. All production code now uses 'content'.

### Document Structure

TipTap creates ProseMirror documents with this structure:

```
Y.XmlFragment('content')
  └─ Y.XmlElement('paragraph')
      └─ Y.XmlText('Hello world')
```

Title extraction finds the first non-empty text node at any depth.

## How Desktop Loads and Processes Notes

### 1. Loading Notes (`CRDTManager.loadNote()`)

**File:** `packages/desktop/src/main/crdt/crdt-manager.ts:40-281`

```typescript
async loadNote(noteId: string, sdId?: string): Promise<Y.Doc> {
  // 1. Create NoteDoc wrapper
  const noteDoc = new NoteDoc(noteId);
  const doc = noteDoc.doc;

  // 2. Load from snapshots (best performance)
  const snapshots = await this.updateManager.listSnapshotFiles(noteSdId, noteId);

  if (snapshots.length > 0) {
    // Load snapshot
    const snapshot = await this.updateManager.readSnapshot(/*...*/);
    Y.applyUpdate(doc, snapshot.documentState);

    // Load pack files (filtered by vector clock)
    const packFiles = await this.updateManager.listPackFiles(noteSdId, noteId);
    for (const packMeta of packFiles) {
      const pack = await this.updateManager.readPackFile(/*...*/);
      for (const update of pack.updates) {
        if (shouldApplyUpdate(snapshot.maxSequences, packMeta.instanceId, update.seq)) {
          Y.applyUpdate(doc, update.data);
        }
      }
    }

    // Load remaining individual updates (filtered)
    const updateFiles = await this.updateManager.listNoteUpdateFiles(noteSdId, noteId);
    for (const updateFile of updateFiles) {
      if (shouldApplyUpdate(snapshot.maxSequences, metadata.instanceId, metadata.sequence)) {
        const update = await this.updateManager.readUpdateFile(updateFile.path);
        Y.applyUpdate(doc, update);
      }
    }
  } else {
    // No snapshots: load all update files
    const updates = await this.updateManager.readNoteUpdates(noteSdId, noteId);
    for (const update of updates) {
      Y.applyUpdate(doc, update);
    }
  }

  // 3. Store in cache and set up update listener
  this.documents.set(noteId, { doc, noteDoc, /*...*/ });
  doc.on('update', (update) => this.handleUpdate(noteId, update));

  return doc;
}
```

**Key Points:**

- Creates `NoteDoc` wrapper (not plain Y.Doc)
- Optimized loading: snapshots → packs → updates
- Vector clock filtering prevents duplicate updates
- In-memory caching with reference counting
- Automatic write-to-disk on updates

### 2. Title Extraction (Desktop Pattern)

**File:** `packages/desktop/src/main/index.ts:545-546, 586-587, 1375-1377`

Desktop extracts titles in 3 scenarios:

**A. During Initial SD Scan** (lines 1365-1377):

```typescript
// Load note from disk
await crdtManager.loadNote(noteId, sdId);

// Extract metadata
const doc = crdtManager.getDocument(noteId);
if (doc) {
  let title = extractTitleFromDoc(doc, 'content');
  title = title.replace(/<[^>]+>/g, '').trim() || 'Untitled';

  await database.insertNote({
    id: noteId,
    title: title,
    // ...
  });
}
```

**B. During Cross-Instance Reload (ActivitySync)** (lines 577-587):

```typescript
// Note exists, reload from disk
await crdtManager.reloadNote(noteId);

const doc = crdtManager.getDocument(noteId);
if (doc) {
  let newTitle = extractTitleFromDoc(doc, 'content');
  newTitle = newTitle.replace(/<[^>]+>/g, '').trim() || 'Untitled';

  await db.updateNote({
    id: noteId,
    title: newTitle,
    // ...
  });
}
```

**Pattern Summary:**

1. Load note via `crdtManager.loadNote()` or `reloadNote()`
2. Get document: `crdtManager.getDocument(noteId)`
3. Extract: `extractTitleFromDoc(doc, 'content')`
4. Strip HTML: `title.replace(/<[^>]+>/g, '').trim() || 'Untitled'`

## How iOS Loads and Processes Notes

### 1. JavaScript Bridge Pattern

**Swift → JavaScript Communication:**

```swift
// Swift side (CRDTBridge.swift)
func createNote(noteId: String) throws {
    let result = bridge.invokeMethod("createNote", withArguments: [noteId])
    // Handle result/errors
}
```

**JavaScript side (ios-bridge.ts:170-180):**

```typescript
createNote(noteId: string): void {
  if (openNotes.has(noteId)) {
    throw new Error(`Note ${noteId} is already open`);
  }

  const noteDoc = new NoteDoc(noteId);
  // Note: We don't call initializeNote() here because we don't have metadata yet
  // The note structure will be initialized when first edited

  openNotes.set(noteId, noteDoc.doc);
}
```

**Key Methods:**

- `createNote(noteId)` - Create new note document
- `applyUpdate(noteId, updateData)` - Apply CRDT update
- `getDocumentState(noteId)` - Encode doc to transferable state
- `extractTitle(stateData)` - Extract title from encoded state
- `extractContent(stateData)` - Extract all text content

### 2. FileChangeProcessor Pattern

**File:** `packages/ios/Sources/Storage/FileChangeProcessor.swift:79-190`

```swift
func updateNoteFromFile(noteId: String, storageId: String) async throws {
    let storageDir = try db.getStorageDirectory(id: storageId)
    let notePath = "\(storageDir.path)/notes/\(noteId)"
    let updatesPath = "\(notePath)/updates"

    // List all .yjson update files
    let yjsonFiles = try fileIO.listFiles(in: updatesPath, matching: "*.yjson")

    // Create the note in bridge
    try bridge.createNote(noteId: noteId)

    // Apply all updates (sorted order)
    for fileName in yjsonFiles.sorted() {
        let updateData = try fileIO.readFile(at: filePath)
        try bridge.applyUpdate(noteId: noteId, updateData: updateData)
    }

    // Extract metadata
    let state = try bridge.getDocumentState(noteId: noteId)
    let title = try bridge.extractTitle(stateData: state)
    let content = try bridge.extractContent(stateData: state)

    // Update database
    if noteExists {
        try db.updateNote(id: noteId, title: title, folderId: nil)
    } else {
        try db.insertNote(id: noteId, storageDirectoryId: storageId,
                         folderId: nil, title: title)
    }

    // Index for search
    try await indexNoteContent(noteId: noteId, title: title, content: content)
}
```

### 3. Title Extraction (iOS Pattern)

**File:** `packages/shared/src/ios-bridge.ts:202-212`

```typescript
extractTitle(stateBase64: string): string {
  const stateBytes = base64ToUint8Array(stateBase64);

  // Create a temporary doc to decode the state
  const tempDoc = new Y.Doc();
  Y.applyUpdate(tempDoc, stateBytes);

  // Extract the fragment and get the title
  const fragment = tempDoc.getXmlFragment('content');
  const title = extractTitleFromFragment(fragment);

  tempDoc.destroy();
  return title;
}
```

**Key Difference from Desktop:**

- iOS extracts from **encoded state** (base64), not live document
- Creates **temporary Y.Doc** just for extraction
- But the document that was encoded was created via `NoteDoc`, so structure should be correct

## Title Extraction Logic (Shared)

**File:** `packages/shared/src/crdt/title-extractor.ts:19-46`

```typescript
export function extractTitleFromFragment(fragment: Y.XmlFragment): string {
  // Iterate through top-level nodes
  for (let i = 0; i < fragment.length; i++) {
    const node = fragment.get(i);
    if (!node) continue;

    // Check if it's an XmlElement (like <p>, <h1>, etc.)
    if (node instanceof Y.XmlElement) {
      const text = extractTextFromElement(node);
      if (text.trim().length > 0) {
        return text.trim();
      }
    }
    // Check if it's an XmlText node
    else if (node instanceof Y.XmlText) {
      const text = node.toString();
      if (text.trim().length > 0) {
        return text.trim();
      }
    }
  }

  return 'Untitled';
}

function extractTextFromElement(element: Y.XmlElement): string {
  let text = '';

  // Recursively collect text from child nodes
  element.forEach((child) => {
    if (child instanceof Y.XmlText) {
      text += child.toString();
    } else if (child instanceof Y.XmlElement) {
      text += extractTextFromElement(child);
    }
  });

  return text;
}
```

**Algorithm:**

1. Iterate through top-level fragment nodes
2. For each XmlElement: recursively extract all text
3. For each XmlText: get string directly
4. Return first non-empty text, or "Untitled"

## Cross-Platform Synchronization

### Activity Log System

Both platforms use activity logs to discover changes made by other instances.

**Directory Structure:**

```
storage-dir/
├── .activity/
│   ├── {desktop-instance-id}.log    # Desktop's activity log
│   └── {ios-instance-id}.log        # iOS's activity log
└── notes/
    └── {note-id}/
        └── updates/
            ├── {instance}-{seq}-{timestamp}.yjson
            └── ...
```

### Desktop: ActivitySync

**File:** `packages/shared/src/storage/activity-sync.ts:54-139`

**Lazy Loading Pattern:**

- Only reloads notes **already in memory**
- Does NOT eagerly load new notes from other instances
- Relies on user opening notes via UI

```typescript
interface ActivitySyncCallbacks {
  /**
   * Reload a note from disk if it's currently loaded
   */
  reloadNote: (noteId: string, sdId: string) => Promise<void>;

  /**
   * Get list of currently loaded note IDs
   */
  getLoadedNotes: () => string[];
}

async syncFromOtherInstances(sdId: string): Promise<void> {
  // Read other instances' activity logs
  for (const instanceId of otherInstances) {
    const activities = await this.readActivityLog(sdId, instanceId, lastSeq);

    for (const activity of activities) {
      // Only reload if note is currently loaded
      const loadedNotes = this.callbacks.getLoadedNotes();
      if (loadedNotes.includes(activity.noteId)) {
        await this.callbacks.reloadNote(activity.noteId, sdId);
      }
    }
  }
}
```

### iOS: ActivityWatcher + FileChangeProcessor

**File:** `packages/ios/Sources/Storage/ActivityWatcher.swift`

**Eager Loading Pattern:**

- Discovers ALL new notes from activity logs
- Immediately processes them via `FileChangeProcessor`
- Updates database and search index

```swift
// Pseudocode (actual implementation may vary)
func pollActivityLogs() async {
    for instanceId in otherInstances {
        let newActivities = readActivityLog(instanceId: instanceId, afterSeq: lastSeq)

        for activity in newActivities {
            // Eagerly process the note
            try await fileChangeProcessor.updateNoteFromFile(
                noteId: activity.noteId,
                storageId: activity.sdId
            )
        }
    }
}
```

## Performance Optimizations

### Snapshots

**Purpose:** Avoid loading thousands of small update files

**Format:** `.yjson` files in `notes/{noteId}/snapshots/`

**Content:**

- Full document state (encoded as single update)
- Vector clock (max sequence per instance)
- Total changes included
- Timestamp

**Usage:**

1. Load snapshot (fast)
2. Apply only updates newer than snapshot (filtered by vector clock)
3. Result: Same final state, much faster

### Pack Files

**Purpose:** Reduce number of individual update files

**Format:** `.yjson` files in `notes/{noteId}/packs/`

**Content:**

- Array of updates from same instance
- Contiguous sequence numbers
- Start/end sequence metadata

**Desktop Packing Strategy:**

- Runs every 5 minutes
- Packs updates older than 5 minutes
- Keeps last 50 updates unpacked
- Only packs contiguous sequences
- Minimum 10 updates per pack

### Garbage Collection

**Purpose:** Delete redundant snapshots, packs, and updates

**Desktop GC Strategy:**

- Runs every 30 minutes
- Keeps newest snapshot only
- Deletes packs superseded by snapshot
- Deletes updates superseded by packs/snapshots

## File Formats

### Flag Byte Protocol

**CRITICAL:** All `.yjson` files use a flag byte protocol for cross-platform sync safety.

**Format:**

```
Byte 0: Flag byte
  0x00 = File is incomplete (still being written)
  0x01 = File is complete (safe to read)
Bytes 1+: Actual CRDT data (Yjs update, snapshot, or pack)
```

**Purpose:**

- Prevents reading partial/incomplete files during concurrent writes
- Essential for cross-platform sync where one instance writes while another reads
- Both Desktop and iOS must handle this protocol

**Desktop Implementation:**
Desktop's UpdateManager writes files with the flag byte protocol. When Desktop reads `.yjson` files, it needs to strip the first byte before passing to Yjs.

**iOS Implementation:**
iOS's `FileIOManager.readFile()` checks and strips the flag byte:

```swift
// packages/ios/Sources/Storage/FileIOManager.swift:28-74
func readFile(at path: String) throws -> Data {
    let data = try Data(contentsOf: url)

    // Handle flag byte protocol for .yjson files
    if path.hasSuffix(".yjson") {
        guard data.count > 0 else {
            throw FileIOError.fileIncomplete(path)
        }

        let flagByte = data[0]

        // Check if file is still being written
        if flagByte == 0x00 {
            throw FileIOError.fileIncomplete(path)
        }

        // Check for valid flag byte
        if flagByte != 0x01 {
            throw FileIOError.invalidFlagByte(path, flagByte)
        }

        // Strip flag byte and return actual data
        return data.subdata(in: 1..<data.count)
    }

    return data
}
```

**⚠️ Bug Alert:** If iOS doesn't strip the flag byte, the first byte (0x01) corrupts the CRDT data, causing Yjs parsing errors and resulting in "Untitled" extraction even when the content exists in the file.

**🐛 Fixed Bug:** iOS FileChangeProcessor was treating full paths from `listFiles()` as filenames and appending them to `updatesPath` again, creating invalid doubled paths like `/path/to/updates/path/to/updates/file.yjson`. This caused all file reads to fail, resulting in no CRDT updates being applied and "Untitled" extraction. Fixed by using paths directly from `listFiles()` instead of re-appending them. (packages/ios/Sources/Storage/FileChangeProcessor.swift:136-139)

### Update Files

**Naming:** `{instanceId}_{noteId}_{timestamp}-{seq}.yjson`

Example: `088b8285-e7b0-4e3f-8f20-dc7203e0e44d_5c8f84dd-63aa-479e-bc71-f8e960ae6fa7_1763686120495-0.yjson`

**Content:**

```
Byte 0: 0x01 (flag byte - file complete)
Bytes 1+: Binary Yjs update (Uint8Array)
```

### Snapshot Files

**Naming:** `snapshot-{totalChanges}-{timestamp}.yjson`

Example: `snapshot-1234-1704067200000.yjson`

**Content:**

```typescript
{
  documentState: Uint8Array,  // Full Y.Doc encoded as update
  maxSequences: {             // Vector clock
    "instance-1": 42,
    "instance-2": 15,
    // ...
  },
  totalChanges: 1234,
  timestamp: 1704067200000
}
```

### Pack Files

**Naming:** `pack-{instanceId}-{startSeq}-{endSeq}-{timestamp}.yjson`

Example: `pack-abc123-0000-0099-1704067200000.yjson`

**Content:**

```typescript
{
  updates: [
    { seq: 0, data: Uint8Array },
    { seq: 1, data: Uint8Array },
    // ...
    { seq: 99, data: Uint8Array },
  ];
}
```

## Common Patterns

### Creating a New Note (Desktop)

```typescript
// 1. Create note via CRDTManager
const doc = await crdtManager.loadNote(noteId, sdId);

// 2. Initialize content (TipTap does this automatically)
// The editor will trigger updates that get written to disk

// 3. Extract metadata
const title = extractTitleFromDoc(doc, 'content');

// 4. Save to database
await database.insertNote({ id: noteId, title, sdId });
```

### Creating a New Note (iOS)

```swift
// 1. Create note via bridge
try bridge.createNote(noteId: noteId)

// 2. User edits in TipTap editor (WebView)
// Editor sends updates back to Swift via message handler

// 3. Apply updates from editor
try bridge.applyUpdate(noteId: noteId, updateData: editorUpdate)

// 4. Extract metadata when needed
let state = try bridge.getDocumentState(noteId: noteId)
let title = try bridge.extractTitle(stateData: state)

// 5. Save to database
try db.insertNote(id: noteId, storageDirectoryId: sdId, title: title)
```

### Discovering Changes from Other Instances (Desktop)

```typescript
// ActivitySync polls activity logs every 5 seconds
await activitySync.syncFromOtherInstances(sdId);

// For each activity:
if (loadedNotes.includes(noteId)) {
  // Note is open in editor - reload it
  await crdtManager.reloadNote(noteId);

  // Extract updated metadata
  const doc = crdtManager.getDocument(noteId);
  const newTitle = extractTitleFromDoc(doc, 'content');

  // Update database
  await db.updateNote({ id: noteId, title: newTitle });
}
```

### Discovering Changes from Other Instances (iOS)

```swift
// ActivityWatcher polls activity logs
let newActivities = readActivityLog(instanceId: otherInstance, afterSeq: lastSeq)

for activity in newActivities {
    // Process the note (eager loading)
    try await fileChangeProcessor.updateNoteFromFile(
        noteId: activity.noteId,
        storageId: activity.sdId
    )
    // This loads all updates, extracts title, and updates database
}
```

## Debugging Tips

### Desktop Logging

```typescript
// Enable CRDT manager logs
console.log('[CRDT Manager] Loading note:', noteId);

// Check loaded documents
const loadedNotes = crdtManager.getLoadedNotes();
console.log('Currently loaded:', loadedNotes);

// Inspect document state
const doc = crdtManager.getDocument(noteId);
const fragment = doc.getXmlFragment('content');
console.log('Fragment length:', fragment.length);
console.log('Fragment contents:', fragment.toJSON());
```

### iOS Logging

```swift
// Enable bridge logging
print("[CRDTBridge] Creating note:", noteId)

// Check open documents
let count = bridge.getOpenDocumentCount()
print("Open documents:", count)

// Extract and log state
let state = try bridge.getDocumentState(noteId: noteId)
print("State size:", state.count, "bytes")
let title = try bridge.extractTitle(stateData: state)
print("Extracted title:", title)
```

### Common Issues

**"Untitled" when title should exist:**

- Check fragment name ('content' not 'default')
- Verify updates were applied in correct order
- Inspect fragment structure: `fragment.toJSON()`
- Check if document is empty: `fragment.length === 0`

**Changes not syncing between instances:**

- Verify activity logger is writing to correct SD
- Check activity log files exist in `.activity/` directory
- Confirm other instance's activity watcher is polling
- Check file permissions (iOS sandboxing)

**TypeError in title extraction:**

- Ensure document is loaded before extracting
- Check for null/undefined documents
- Verify fragment exists and is XmlFragment type

## Future Improvements

**Potential Optimizations:**

1. iOS could use snapshots/packs (currently only Desktop does)
2. Incremental title extraction (cache title, only update on content change)
3. Differential sync (only transfer changed updates, not full state)
4. Background sync workers to avoid blocking main thread

**Architectural Considerations:**

1. Consider consolidating Desktop's CRDTManager pattern into shared package
2. iOS could benefit from in-memory document caching like Desktop
3. Unified activity sync implementation for both platforms
