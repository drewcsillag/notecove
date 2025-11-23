# Storage System - Supplemental Documentation

This document contains supplemental information for the NoteCove storage system that complements the main [Storage Format Design](./STORAGE-FORMAT-DESIGN.md).

## Platform Architecture

### Desktop (Electron + Node.js)

**Technology Stack:**

- Electron main process (Node.js)
- In-memory Yjs documents
- Direct file system access
- TipTap/ProseMirror editor (renderer process)

**Key Classes:**

- `CRDTManagerImpl` - Manages in-memory Y.Doc instances
- `NoteDoc` - Wrapper around Y.Doc for note-specific operations
- `AppendLogManager` - Reads/writes CRDT log files (new format)
- `ActivitySync` - Cross-instance synchronization
- `ActivityLogger` - Records changes for other instances to discover

**File Location:** `packages/desktop/src/main/crdt/crdt-manager.ts`

### iOS (Swift + JavaScriptCore)

**Technology Stack:**

- Swift for app logic
- JavaScriptCore to run bundled JavaScript
- Shared TypeScript code compiled to single-file bundle
- Bridge pattern for Swift <-> JavaScript communication

**Key Classes:**

- `CRDTBridge` (Swift) - Manages JavaScriptCore context
- `NoteCoveBridge` (JS) - Global object exposed to Swift
- `FileChangeProcessor` (Swift) - Discovers and processes new notes
- `ActivityWatcher` (Swift) - Monitors activity logs for changes

**File Locations:**

- Swift bridge: `packages/ios/Sources/CRDT/CRDTBridge.swift`
- JavaScript bridge: `packages/shared/src/ios-bridge.ts`
- File processor: `packages/ios/Sources/Storage/FileChangeProcessor.swift`

---

## CRDT Document Structure

### Fragment Names

Both platforms use the **'content' fragment** for note content:

```typescript
const fragment = doc.getXmlFragment('content');
```

**Important:** Early code used 'default' fragment. All production code now uses 'content'.

### Document Structure

TipTap creates ProseMirror documents with this structure:

```
Y.XmlFragment('content')
  └─ Y.XmlElement('paragraph')
      └─ Y.XmlText('Hello world')
```

Title extraction finds the first non-empty text node at any depth.

---

## Title Extraction

### Shared Logic

**File:** `packages/shared/src/crdt/title-extractor.ts`

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

### Desktop Pattern

Desktop extracts titles after loading notes:

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

### iOS Pattern

iOS extracts from encoded state (base64), not live document:

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

---

## Cross-Platform Synchronization

### Desktop: Lazy Loading (ActivitySync)

**File:** `packages/shared/src/storage/activity-sync.ts`

- Only reloads notes **already in memory**
- Does NOT eagerly load new notes from other instances
- Relies on user opening notes via UI

```typescript
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

### iOS: Eager Loading (ActivityWatcher + FileChangeProcessor)

**File:** `packages/ios/Sources/Storage/ActivityWatcher.swift`

- Discovers ALL new notes from activity logs
- Immediately processes them via `FileChangeProcessor`
- Updates database and search index

```swift
// Pseudocode
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

---

## Activity Sync Edge Cases

### Instance Crashes

**Scenario:** Instance crashes while editing note-123

**Result:**

- Activity log remains on disk
- Other instances can still read it
- Will be cleaned up after 7 days of inactivity

**No data loss.**

### Clock Skew

**Scenario:** Instance A's clock is 5 minutes ahead of Instance B

**Mitigation:**

- Timestamps only used for ordering within same instance file
- Cross-instance sync uses "newer than last seen" not absolute time
- No issues as long as clocks don't go backwards

### Rapid Instance Restart

**Scenario:** Instance restarts immediately (same instance ID)

**Result:**

- Appends to existing activity log
- Other instances see new entries
- Works correctly

### File Sync Delay (Dropbox/iCloud)

**Scenario:** Instance A on machine 1, Instance B on machine 2, synced via Dropbox

**Result:**

- Instance A writes to `.activity/inst-a.log`
- Dropbox syncs file to machine 2 (a few seconds delay)
- Instance B's file watcher detects change
- Instance B syncs note updates

**Eventual consistency achieved.**

### Compaction During Continuous Editing

**Scenario:** Instance editing note-123 continuously, compaction triggers

**Result:**

- Last line contains most recent state for note-123
- Compaction keeps last 1,000 lines (including this one)
- No data loss, continuous editing preserved

---

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
- Check activity log files exist in `activity/` directory
- Confirm other instance's activity watcher is polling
- Check file permissions (iOS sandboxing)

**TypeError in title extraction:**

- Ensure document is loaded before extracting
- Check for null/undefined documents
- Verify fragment exists and is XmlFragment type

---

## Future Improvements

**Potential Optimizations:**

1. iOS could use snapshots (currently only Desktop does at startup)
2. Incremental title extraction (cache title, only update on content change)
3. Differential sync (only transfer changed updates, not full state)
4. Background sync workers to avoid blocking main thread

**Architectural Considerations:**

1. Consider consolidating Desktop's CRDTManager pattern into shared package
2. iOS could benefit from in-memory document caching like Desktop
3. Unified activity sync implementation for both platforms
